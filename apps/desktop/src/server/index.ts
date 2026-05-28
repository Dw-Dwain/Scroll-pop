import Fastify from 'fastify';
import cors from '@fastify/cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { initDb, getDb, persist } from './db/client';
import { runMigrations } from './db/migrate';
import { users, sites, campaigns, events } from './db/schema';
import { eq, and, isNull, sql, gte } from 'drizzle-orm';
import { signIn, changePassword, verifyJwt } from './auth';

export const PORT = 3010;

async function authGuard(request: any, reply: any) {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
  const payload = verifyJwt(auth.slice(7));
  if (!payload) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  request.userId = payload.userId;
  request.userEmail = payload.email;
}

export async function startServer() {
  await initDb();
  await runMigrations();

  const fastify = Fastify({ logger: false });
  await fastify.register(cors, { origin: true, credentials: true });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleSignIn = async (request: any, reply: any) => {
    const { email, password } = request.body as { email: string; password: string };
    if (!email || !password) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Email and password required' } });
    const result = await signIn(email, password);
    if (!result) return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    return reply.send({ data: result });
  };
  fastify.post('/api/v1/auth/sign-in', handleSignIn);
  fastify.post('/api/v1/auth/login', handleSignIn);

  fastify.post('/api/v1/auth/change-password', { preHandler: authGuard }, async (request: any, reply) => {
    const { currentPassword, newPassword } = request.body as any;
    const ok = await changePassword(request.userId, currentPassword, newPassword);
    if (!ok) return reply.code(400).send({ error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } });
    persist();
    return reply.send({ data: { success: true } });
  });

  fastify.get('/api/v1/auth/me', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const rows = db.select({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl, role: users.role }).from(users).where(eq(users.id, request.userId)).all();
    if (!rows.length) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return reply.send({ data: rows[0] });
  });

  fastify.patch('/api/v1/auth/profile', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const { name, avatarUrl } = request.body as any;
    db.update(users).set({ name, avatarUrl, updatedAt: new Date().toISOString() }).where(eq(users.id, request.userId)).run();
    persist();
    const rows = db.select({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl, role: users.role }).from(users).where(eq(users.id, request.userId)).all();
    return reply.send({ data: rows[0] });
  });

  // ── Admin ─────────────────────────────────────────────────────────────────
  fastify.get('/api/v1/admin/users', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    // Desktop mode allows all authenticated users to see the admin panel
    const allUsers = db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    }).from(users).all();

    // Enrich with site + campaign counts
    const enriched = allUsers.map((u) => {
      const siteCount = db.select({ id: sites.id }).from(sites)
        .where(and(eq(sites.userId, u.id), isNull(sites.deletedAt))).all().length;
      const campaignCount = db.select({ id: campaigns.id }).from(campaigns)
        .where(and(eq(campaigns.userId, u.id), isNull(campaigns.deletedAt))).all().length;
      return { ...u, siteCount, campaignCount };
    });

    return reply.send({ data: enriched });
  });

  // ── Sites ─────────────────────────────────────────────────────────────────
  fastify.get('/api/v1/sites', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const rows = db.select().from(sites).where(and(eq(sites.userId, request.userId), isNull(sites.deletedAt))).all();
    return reply.send({ data: rows, meta: { total: rows.length } });
  });

  fastify.post('/api/v1/sites', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const { domain, name } = request.body as any;
    const id = crypto.randomUUID();
    const publicKey = `pk_${crypto.randomUUID().replace(/-/g, '')}`;
    db.insert(sites).values({ id, userId: request.userId, domain, name, publicKey }).run();
    persist();
    const rows = db.select().from(sites).where(eq(sites.id, id)).all();
    return reply.code(201).send({ data: rows[0] });
  });

  fastify.patch('/api/v1/sites/:id', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const { domain, name, status } = request.body as any;
    db.update(sites).set({ domain, name, status, updatedAt: new Date().toISOString() }).where(and(eq(sites.id, id), eq(sites.userId, request.userId))).run();
    persist();
    const rows = db.select().from(sites).where(eq(sites.id, id)).all();
    return reply.send({ data: rows[0] });
  });

  fastify.post('/api/v1/sites/:id/verify', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    db.update(sites).set({ verifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(sites.id, id), eq(sites.userId, request.userId))).run();
    persist();
    const rows = db.select().from(sites).where(eq(sites.id, id)).all();
    if (!rows.length) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Site not found' } });
    return reply.send({ data: rows[0] });
  });

  fastify.delete('/api/v1/sites/:id', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    db.update(sites).set({ deletedAt: new Date().toISOString() }).where(and(eq(sites.id, id), eq(sites.userId, request.userId))).run();
    persist();
    return reply.code(204).send();
  });

  // ── Campaigns ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/campaigns', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const rows = db.select().from(campaigns).where(and(eq(campaigns.userId, request.userId), isNull(campaigns.deletedAt))).all();
    return reply.send({ data: rows, meta: { total: rows.length } });
  });

  fastify.post('/api/v1/campaigns', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const { siteId, name, startsAt, endsAt } = request.body as any;
    const id = crypto.randomUUID();
    db.insert(campaigns).values({ id, userId: request.userId, siteId, name, startsAt, endsAt }).run();
    persist();
    const rows = db.select().from(campaigns).where(eq(campaigns.id, id)).all();
    return reply.code(201).send({ data: rows[0] });
  });

  fastify.patch('/api/v1/campaigns/:id', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const { name, status, startsAt, endsAt } = request.body as any;
    db.update(campaigns).set({ name, status, startsAt, endsAt, updatedAt: new Date().toISOString() }).where(and(eq(campaigns.id, id), eq(campaigns.userId, request.userId))).run();
    persist();
    const rows = db.select().from(campaigns).where(eq(campaigns.id, id)).all();
    return reply.send({ data: rows[0] });
  });

    const handleActivate = async (request: any, reply: any) => {
      const db = getDb();
      const { id } = request.params as any;
      db.update(campaigns).set({ status: 'active', updatedAt: new Date().toISOString() }).where(and(eq(campaigns.id, id), eq(campaigns.userId, request.userId))).run();
      persist();
      return reply.send({ data: { status: 'active' } });
    };
    fastify.post('/api/v1/campaigns/:id/activate', { preHandler: authGuard }, handleActivate);
    fastify.patch('/api/v1/campaigns/:id/activate', { preHandler: authGuard }, handleActivate);

    const handlePause = async (request: any, reply: any) => {
      const db = getDb();
      const { id } = request.params as any;
      db.update(campaigns).set({ status: 'paused', updatedAt: new Date().toISOString() }).where(and(eq(campaigns.id, id), eq(campaigns.userId, request.userId))).run();
      persist();
      return reply.send({ data: { status: 'paused' } });
    };
    fastify.post('/api/v1/campaigns/:id/pause', { preHandler: authGuard }, handlePause);
    fastify.patch('/api/v1/campaigns/:id/pause', { preHandler: authGuard }, handlePause);

  fastify.delete('/api/v1/campaigns/:id', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    db.update(campaigns).set({ deletedAt: new Date().toISOString(), status: 'archived' }).where(and(eq(campaigns.id, id), eq(campaigns.userId, request.userId))).run();
    persist();
    return reply.code(204).send();
  });

  fastify.get('/api/v1/campaigns/:id', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const rows = db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, request.userId))).all();
    if (!rows.length) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    return reply.send({ data: rows[0] });
  });

  fastify.get('/api/v1/campaigns/:id/design', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const rows = db.select({ design: campaigns.design }).from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, request.userId))).all();
    if (!rows.length) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    return reply.send({ data: rows[0].design ?? {} });
  });

  fastify.put('/api/v1/campaigns/:id/design', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const design = request.body as any;
    db.update(campaigns).set({ design, updatedAt: new Date().toISOString() }).where(and(eq(campaigns.id, id), eq(campaigns.userId, request.userId))).run();
    persist();
    return reply.send({ data: design });
  });

  fastify.post('/api/v1/campaigns/:id/design', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const body = request.body as any;
    const row = db.select({ design: campaigns.design }).from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, request.userId))).all()[0];
    if (!row) return reply.code(404).send({ error: 'Campaign not found' });
    const design = row.design as any || {};
    design.config = body.config;
    design.frequency = body.frequency;
    design.affiliateSlots = body.affiliateSlots;
    db.update(campaigns).set({ design, updatedAt: new Date().toISOString() }).where(and(eq(campaigns.id, id), eq(campaigns.userId, request.userId))).run();
    persist();
    return reply.send({ data: body });
  });

  fastify.post('/api/v1/campaigns/:id/triggers', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const body = request.body as any;
    const row = db.select({ design: campaigns.design }).from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, request.userId))).all()[0];
    if (!row) return reply.code(404).send({ error: 'Campaign not found' });
    const design = row.design as any || {};
    if (!design.triggers) design.triggers = [];
    design.triggers.push({ id: crypto.randomUUID(), type: body.type, params: body.params });
    db.update(campaigns).set({ design, updatedAt: new Date().toISOString() }).where(and(eq(campaigns.id, id), eq(campaigns.userId, request.userId))).run();
    persist();
    return reply.send({ data: body });
  });

  fastify.post('/api/v1/campaigns/:id/targeting', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const body = request.body as any;
    const row = db.select({ design: campaigns.design }).from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, request.userId))).all()[0];
    if (!row) return reply.code(404).send({ error: 'Campaign not found' });
    const design = row.design as any || {};
    if (!design.targeting) design.targeting = [];
    design.targeting.push({ id: crypto.randomUUID(), kind: body.kind, operator: body.operator, value: body.value });
    db.update(campaigns).set({ design, updatedAt: new Date().toISOString() }).where(and(eq(campaigns.id, id), eq(campaigns.userId, request.userId))).run();
    persist();
    return reply.send({ data: body });
  });

  // ── Analytics ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/analytics/overview', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const rows = db.select({
      eventType: events.eventType,
      count: sql<number>`count(*)`,
    }).from(events)
      .innerJoin(campaigns, eq(events.campaignId, campaigns.id))
      .where(and(eq(campaigns.userId, request.userId), gte(events.ts, thirtyDaysAgo)))
      .groupBy(events.eventType)
      .all();

    const map: Record<string, number> = {};
    for (const r of rows) map[r.eventType] = Number(r.count);
    const impressions = map['impression'] ?? 0;
    const clicks = map['click'] ?? 0;
    return reply.send({ data: { impressions, views: map['view'] ?? 0, clicks, conversions: map['conversion'] ?? 0, ctr: impressions > 0 ? parseFloat((clicks / impressions).toFixed(4)) : 0 } });
  });

  fastify.get('/api/v1/analytics/campaigns', { preHandler: authGuard }, async (request: any, reply) => {
    const db = getDb();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const myCampaigns = db.select({ id: campaigns.id }).from(campaigns).where(and(eq(campaigns.userId, request.userId), isNull(campaigns.deletedAt))).all();
    const result = myCampaigns.map(({ id: campaignId }) => {
      const rows = db.select({ eventType: events.eventType, count: sql<number>`count(*)` })
        .from(events).where(and(eq(events.campaignId, campaignId), gte(events.ts, thirtyDaysAgo))).groupBy(events.eventType).all();
      const map: Record<string, number> = {};
      for (const r of rows) map[r.eventType] = Number(r.count);
      const impressions = map['impression'] ?? 0;
      const clicks = map['click'] ?? 0;
      return { campaignId, impressions, views: map['view'] ?? 0, clicks, conversions: map['conversion'] ?? 0, ctr: impressions > 0 ? parseFloat((clicks / impressions).toFixed(4)) : 0 };
    });
    return reply.send({ data: result });
  });

  // ── Event Ingest ──────────────────────────────────────────────────────────
  fastify.post('/e', async (request: any, reply) => {
    const db = getDb();
    const body = request.body as any;

    // Support both single event body and { events: [...] } array format
    const rawEvents = body.events ? body.events : [body];

    for (const evt of rawEvents) {
      const { campaignId, siteId, eventType, meta } = evt;
      if (campaignId && siteId && eventType) {
        db.insert(events).values({
          id: crypto.randomUUID(),
          campaignId,
          siteId,
          eventType,
          meta: meta || null
        }).run();
      }
    }
    persist();
    return reply.code(204).send();
  });

  // ── Desktop Local CDN Server ──────────────────────────────────────────────
  fastify.get('/v1/:publicKey/p.js', async (request: any, reply) => {
    const devPath = path.join(__dirname, '../../../../packages/snippet/dist/p.js');
    const prodPath = typeof process !== 'undefined' && process.resourcesPath ? path.join(process.resourcesPath, 'snippet', 'p.js') : '';
    
    const pJsPath = fs.existsSync(prodPath) ? prodPath : (fs.existsSync(devPath) ? devPath : null);
    if (!pJsPath) return reply.code(404).send('p.js not found');
    
    const normalized = path.normalize(pJsPath);
    // Assert target path matches the expected asset suffix to prevent path traversal issues
    if (!normalized.endsWith('p.js')) {
      return reply.code(400).send('Invalid file path');
    }
    
    const content = fs.readFileSync(normalized, 'utf-8');
    reply.header('Content-Type', 'application/javascript');
    return reply.send(content);
  });

  fastify.get('/c/:publicKey', async (request: any, reply) => {
    const db = getDb();
    const { publicKey } = request.params as any;
    const siteRows = db.select().from(sites).where(and(eq(sites.publicKey, publicKey), isNull(sites.deletedAt))).all();
    if (!siteRows.length) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Site not found' } });
    
    const site = siteRows[0];
    const activeCampaigns = db.select().from(campaigns).where(and(eq(campaigns.siteId, site.id), eq(campaigns.status, 'active'), isNull(campaigns.deletedAt))).all();
    
    const validCampaigns = activeCampaigns.map(c => {
      const design = c.design as any;
      if (!design) return null;
      return {
        id: c.id,
        design: design.config,
        triggers: design.triggers || [],
        targeting: design.targeting || [],
        frequency: { frequency: design.frequency || 'once_per_session' },
        affiliateSlots: design.affiliateSlots || []
      };
    }).filter(Boolean);

    const version = crypto.createHash('sha256').update(JSON.stringify(validCampaigns)).digest('hex').slice(0, 8);
    const payload = { siteId: site.id, campaigns: validCampaigns, version };
    return reply.send(payload);
  });

  await fastify.listen({ port: PORT, host: '127.0.0.1' });
  return fastify;
}
