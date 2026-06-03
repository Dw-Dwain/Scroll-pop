import crypto from 'node:crypto';

/**
 * Minimal, dependency-free Sentry client for the API.
 *
 * We deliberately do NOT add the `@sentry/node` package: that would desync the pnpm
 * lockfile and risk the CI `--frozen-lockfile` install. Instead we parse `SENTRY_DSN`
 * and POST an event envelope to Sentry's ingest API over `fetch` (global in Node 22).
 *
 * Fully DORMANT when `SENTRY_DSN` is unset — every export is a no-op, so it costs
 * nothing until you paste the DSN into Render. Never throws into the caller.
 */

interface ParsedDsn {
  publicKey: string;
  host: string;
  projectId: string;
  protocol: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, '');
    if (!u.username || !projectId) return null;
    return {
      publicKey: u.username,
      host: u.host,
      projectId,
      protocol: u.protocol.replace(':', ''),
    };
  } catch {
    return null;
  }
}

const rawDsn = process.env['SENTRY_DSN'];
const dsn = rawDsn ? parseDsn(rawDsn) : null;
const environment = process.env['NODE_ENV'] ?? 'development';
// Render injects the deployed commit; used as the Sentry release if present.
const release = process.env['RENDER_GIT_COMMIT'] ?? undefined;

export function sentryEnabled(): boolean {
  return dsn !== null;
}

/**
 * Report an error to Sentry. No-op when DSN is unset. Best-effort and non-blocking:
 * callers should `void captureException(err)` and never await it on a hot path.
 */
export async function captureException(
  err: unknown,
  extra?: Record<string, unknown>,
): Promise<void> {
  if (!dsn) return;
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    const eventId = crypto.randomUUID().replace(/-/g, '');
    const now = new Date().toISOString();

    const event = {
      event_id: eventId,
      timestamp: now,
      platform: 'node',
      level: 'error',
      environment,
      ...(release ? { release } : {}),
      server_name: 'scrollpop-api',
      exception: {
        values: [{ type: e.name, value: e.message }],
      },
      // The SDK would symbolicate a structured stacktrace; without it we attach the
      // raw stack as extra so the trace is still visible in the Sentry issue.
      extra: { ...(extra ?? {}), stack: e.stack ?? null },
    };

    const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: now, dsn: rawDsn });
    const itemHeader = JSON.stringify({ type: 'event' });
    const body = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}`;

    const url =
      `${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/` +
      `?sentry_key=${dsn.publicKey}&sentry_version=7`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body,
    });
  } catch {
    /* the reporter must never throw */
  }
}
