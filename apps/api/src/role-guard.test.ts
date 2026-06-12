/**
 * Role enforcement: `viewer` members are read-only except a tight allowlist of personal actions.
 * Two layers: (1) the pure decision function, (2) an integration test that boots a real Fastify
 * instance to prove `request.routeOptions.url` carries the `/api/v1` prefix — the assumption the
 * preHandler in plugins/tenant-context.ts relies on to match the allowlist.
 */
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { viewerMayWrite } from './lib/role-guard.js';

describe('viewerMayWrite — pure allowlist decision', () => {
  it('allows all read (non-mutating) methods regardless of route', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(viewerMayWrite(method, '/api/v1/campaigns'), method).toBe(true);
      expect(viewerMayWrite(method, '/api/v1/anything/:id'), method).toBe(true);
    }
  });

  it('blocks mutating methods on tenant business content', () => {
    const blocked: Array<[string, string]> = [
      ['POST', '/api/v1/campaigns'],
      ['PUT', '/api/v1/designs/:id'],
      ['PATCH', '/api/v1/sites/:id'],
      ['DELETE', '/api/v1/campaigns/:id'],
      ['POST', '/api/v1/team/invites'],            // inviting is owner/admin only, never a viewer
      ['DELETE', '/api/v1/team/members/:userId'],
      ['POST', '/api/v1/journeys'],
    ];
    for (const [method, route] of blocked) {
      expect(viewerMayWrite(method, route), `${method} ${route}`).toBe(false);
    }
  });

  it('allows the self-service / personal-action allowlist', () => {
    const allowed: Array<[string, string]> = [
      ['POST', '/api/v1/team/invites/:id/accept'],
      ['POST', '/api/v1/team/invites/:id/decline'],
      ['DELETE', '/api/v1/me'],
      ['POST', '/api/v1/notifications/:id/read'],
      ['POST', '/api/v1/notifications/read-all'],
      ['PUT', '/api/v1/notification-prefs'],
    ];
    for (const [method, route] of allowed) {
      expect(viewerMayWrite(method, route), `${method} ${route}`).toBe(true);
    }
  });

  it('does not allow a different method on an allowlisted path', () => {
    // The allowlist is keyed on METHOD+route, so DELETE on an accept path is still blocked.
    expect(viewerMayWrite('DELETE', '/api/v1/team/invites/:id/accept')).toBe(false);
    expect(viewerMayWrite('POST', '/api/v1/me')).toBe(false);
  });
});

describe('integration — preHandler guard against a real Fastify instance', () => {
  /** Build an app whose guard mirrors plugins/tenant-context.ts, with a fixed member role. */
  async function buildApp(memberRole: string) {
    const app = Fastify({ ignoreTrailingSlash: true });
    app.addHook('preHandler', async (request, reply) => {
      if (memberRole !== 'viewer') return;
      const routePattern = request.routeOptions?.url ?? request.url;
      if (!viewerMayWrite(request.method, routePattern)) {
        return reply.code(403).send({ error: { code: 'READ_ONLY_ROLE', message: 'view-only' } });
      }
    });
    // Routes registered under the same /api/v1 prefix the real app uses.
    await app.register(
      async (f) => {
        f.get('/campaigns', async () => ({ data: [] }));
        f.post('/campaigns', async () => ({ data: { id: 'c1' } }));
        f.delete('/campaigns/:id', async () => ({ data: { ok: true } }));
        f.post('/team/invites/:id/accept', async () => ({ data: { ok: true } }));
        f.delete('/me', async (_req, reply) => reply.code(204).send());
        f.post('/notifications/:id/read', async () => ({ data: { ok: true } }));
      },
      { prefix: '/api/v1' },
    );
    return app;
  }

  it('viewer: reads pass, disallowed writes 403, allowlisted writes pass', async () => {
    const app = await buildApp('viewer');

    expect((await app.inject({ method: 'GET', url: '/api/v1/campaigns' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/v1/campaigns' })).statusCode).toBe(403);
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/campaigns/abc' })).statusCode).toBe(403);
    // Trailing slash (ignoreTrailingSlash) resolves to the same route pattern → still blocked.
    expect((await app.inject({ method: 'POST', url: '/api/v1/campaigns/' })).statusCode).toBe(403);

    // Allowlisted personal actions go through.
    expect((await app.inject({ method: 'POST', url: '/api/v1/team/invites/xyz/accept' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/me' })).statusCode).toBe(204);
    expect((await app.inject({ method: 'POST', url: '/api/v1/notifications/n1/read' })).statusCode).toBe(200);

    await app.close();
  });

  it('editor: every write passes (guard is viewer-only)', async () => {
    const app = await buildApp('editor');
    expect((await app.inject({ method: 'POST', url: '/api/v1/campaigns' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/campaigns/abc' })).statusCode).toBe(200);
    await app.close();
  });
});
