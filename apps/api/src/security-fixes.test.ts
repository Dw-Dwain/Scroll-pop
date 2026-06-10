/**
 * Regression tests for the June 2026 security-hardening pass. Each test pins the behaviour of a
 * specific finding's fix so a future change can't silently reopen it. Pure-logic only — no DB.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { isPrivateAddress } from './lib/url-guard.js';

// webhooks.ts → client.js requires DATABASE_URL at import time; set a dummy before importing it.
type ResolveClerkEmail = typeof import('./routes/webhooks.js')['resolveClerkEmail'];
let resolveClerkEmail: ResolveClerkEmail;
beforeAll(async () => {
  process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgres://localhost:5432/test';
  ({ resolveClerkEmail } = await import('./routes/webhooks.js'));
});

describe('H-3 — SSRF guard private-range detection', () => {
  it('flags loopback, RFC1918, link-local and cloud-metadata addresses', () => {
    for (const addr of [
      '127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1',
      '169.254.169.254', '0.0.0.0', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1',
      '::ffff:169.254.169.254', '100.64.0.1',
    ]) {
      expect(isPrivateAddress(addr), addr).toBe(true);
    }
  });

  it('allows genuine public addresses', () => {
    for (const addr of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:2800:220:1::1']) {
      expect(isPrivateAddress(addr), addr).toBe(false);
    }
  });
});

describe('M-1/M-2/M-3 — secret encryption roundtrip', () => {
  let encryptToken: (s: string) => string;
  let decryptToken: (s: string) => string;

  beforeAll(async () => {
    // 32-byte base64 key so encryption is active in the test.
    process.env['SHOPIFY_ENCRYPTION_KEY'] = Buffer.alloc(32, 7).toString('base64');
    ({ encryptToken, decryptToken } = await import('./lib/token-crypto.js'));
  });

  it('round-trips a secret and does not store it in plaintext', () => {
    const secret = 'pk_live_super_secret_value';
    const enc = encryptToken(secret);
    expect(enc.startsWith('enc:')).toBe(true);
    expect(enc).not.toContain(secret);
    expect(decryptToken(enc)).toBe(secret);
  });

  it('passes legacy plaintext through unchanged (back-compat)', () => {
    expect(decryptToken('legacy_plaintext_key')).toBe('legacy_plaintext_key');
  });
});

describe('H-2 — Clerk webhook stores the verified primary email', () => {
  it('prefers the verified primary over an unverified first entry (admin-impersonation guard)', () => {
    const res = resolveClerkEmail({
      id: 'user_1',
      primary_email_address_id: 'idp',
      email_addresses: [
        // An attacker-attached, unverified address sits first…
        { id: 'idx', email_address: 'admin@scrollpop.io', verification: { status: 'unverified' } },
        // …but the verified PRIMARY is what must be stored.
        { id: 'idp', email_address: 'attacker@evil.com', verification: { status: 'verified' } },
      ],
    });
    expect(res).toEqual({ email: 'attacker@evil.com', verified: true });
  });

  it('marks the value untrusted when no address is verified', () => {
    const res = resolveClerkEmail({
      id: 'user_2',
      primary_email_address_id: 'id1',
      email_addresses: [{ id: 'id1', email_address: 'nobody@example.com', verification: { status: 'unverified' } }],
    });
    expect(res.verified).toBe(false);
  });

  it('falls back to a synthetic placeholder when there is no email at all', () => {
    const res = resolveClerkEmail({ id: 'user_3', email_addresses: [] });
    expect(res.verified).toBe(false);
    expect(res.email).toContain('@noemail.scrollpop.local');
  });
});
