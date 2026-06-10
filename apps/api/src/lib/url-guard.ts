/**
 * SSRF guard — shared by every code path that fetches an operator-supplied URL
 * (outbound webhooks, WordPress/snippet site verification). Rejects URLs whose
 * hostname resolves to a private / loopback / link-local / cloud-metadata address.
 *
 * Resolution is done at fire time (not just write time) so a DNS-rebind from a
 * public to a private record after save can't reach internal services.
 */
import dns from 'node:dns/promises';

const PRIVATE_RANGES = [
  // IPv4 private / loopback / link-local / "this host" / CGNAT / metadata
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  // IPv6 loopback, unspecified, unique-local (fc00::/7 → fc/fd), link-local (fe80::/10)
  /^::1$/, /^::$/, /^fc/i, /^fd/i, /^fe80:/i,
];

export function isPrivateAddress(address: string): boolean {
  // Normalize IPv4-mapped IPv6 (e.g. ::ffff:169.254.169.254) down to the embedded IPv4.
  const addr = address.replace(/^::ffff:/i, '');
  return PRIVATE_RANGES.some((r) => r.test(addr));
}

/**
 * True only if `rawUrl` is http(s) AND every resolved A/AAAA record is a public address.
 * A hostname with one public and one private record is rejected — that's the DNS-rebind
 * trick. Returns false on any parse/resolution error (fail closed).
 */
export async function isPublicUrl(rawUrl: string): Promise<boolean> {
  try {
    const { hostname, protocol } = new URL(rawUrl);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    const records = await dns.lookup(hostname, { all: true });
    if (records.length === 0) return false;
    return records.every((r) => !isPrivateAddress(r.address));
  } catch {
    return false;
  }
}
