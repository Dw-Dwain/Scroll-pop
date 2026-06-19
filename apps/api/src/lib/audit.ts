import { systemDb } from '../db/client.js';
import { users, adminAuditLog } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Best-effort write to admin_audit_log. The table is global (intentionally NOT tenant-force-scoped —
 * see ensure-rls.ts), so it's written via the system pool. Looks up the actor's email for the trail.
 * NEVER throws — a logging hiccup must never break the privileged action it records.
 */
export async function recordAudit(params: {
  actorUserId: string;
  action: string;
  targetTenantId?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const actor = await systemDb.query.users.findFirst({
      where: eq(users.id, params.actorUserId),
      columns: { email: true },
    });
    await systemDb.insert(adminAuditLog).values({
      actorUserId: params.actorUserId,
      actorEmail: actor?.email ?? null,
      action: params.action,
      targetTenantId: params.targetTenantId ?? null,
      details: params.details ?? {},
    });
  } catch {
    /* best-effort */
  }
}
