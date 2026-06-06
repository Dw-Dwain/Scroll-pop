import { clerkClient } from '@clerk/fastify';

interface SessionLogger {
  warn: (obj: unknown, msg: string) => void;
}

/**
 * Revoke every active Clerk session for a given user. Call on account deletion and
 * other high-value destructive ops so a stolen JWT can't be replayed until expiry (P3-4).
 *
 * Best-effort: a revocation failure is logged but never throws, so callers can proceed
 * with their cleanup. Shared by the `user.deleted` webhook and the DELETE /me route
 * (SR-15) so retry/audit changes only need to be made in one place.
 */
export async function revokeAllUserSessions(clerkUserId: string, log: SessionLogger): Promise<void> {
  try {
    const sessionList = await clerkClient.sessions.getSessionList({ userId: clerkUserId, status: 'active' });
    await Promise.allSettled(
      sessionList.data.map((s) => clerkClient.sessions.revokeSession(s.id)),
    );
  } catch (err) {
    log.warn({ err, clerkUserId }, '[auth] failed to revoke sessions — continuing');
  }
}
