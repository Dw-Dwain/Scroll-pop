// ─── Viewer write-guard (role enforcement) ─────────────────────────────────────
// `viewer` members get read-only access to their tenant. Any mutating request
// (POST/PUT/PATCH/DELETE) is rejected with 403 EXCEPT a small allowlist of self-service /
// personal actions a viewer legitimately performs. owner/admin/editor are unaffected.
//
// The decision is a pure function of (method, matched-route-pattern) so it can be unit-tested
// without a server or DB; the Fastify preHandler in plugins/tenant-context.ts calls it once the
// member role is resolved. The route pattern is Fastify's `request.routeOptions.url`, which
// includes the `/api/v1` registration prefix (e.g. `/api/v1/team/invites/:id/accept`).

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Keyed by `METHOD route-pattern`. Keep this list TIGHT — every entry is a hole in read-only
// enforcement, so it must be a genuinely personal action (something a viewer does to their own
// account/membership, never tenant business content). If you add a route here, add a test.
const VIEWER_WRITE_ALLOWLIST = new Set([
  'POST /api/v1/team/invites/:id/accept',   // accept an invite addressed to me (cross-tenant)
  'POST /api/v1/team/invites/:id/decline',  // decline an invite addressed to me
  'DELETE /api/v1/me',                       // self-service account deletion
  'POST /api/v1/notifications/:id/read',     // mark one of MY notifications read
  'POST /api/v1/notifications/read-all',     // mark all of MY notifications read
  'PUT /api/v1/notification-prefs',          // set MY notification preferences
]);

/**
 * Decide whether a `viewer`-role member may perform this request.
 * Returns true to allow, false to reject with 403 (read-only).
 * Callers should only invoke this for viewers — every other role is allowed unconditionally.
 *
 * @param method        Uppercase HTTP method (`request.method`).
 * @param routePattern  Matched route pattern incl. prefix (`request.routeOptions.url`).
 */
export function viewerMayWrite(method: string, routePattern: string): boolean {
  if (!MUTATING_METHODS.has(method)) return true; // reads are always allowed
  return VIEWER_WRITE_ALLOWLIST.has(`${method} ${routePattern}`);
}
