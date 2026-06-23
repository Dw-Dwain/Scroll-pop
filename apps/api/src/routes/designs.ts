import type { FastifyPluginAsync } from 'fastify';
import { AffiliateSlotSchema } from '@scrollpop/shared';
import { z } from 'zod';
import { db } from '../db/client.js';
import { designs, campaigns, tenants } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { isGreyHatTenant, stripAdClose, hasAdClose } from '../lib/grey-hat.js';
import { recordAudit } from '../lib/audit.js';

export const DESIGN_KINDS = ['modal', 'slide_in', 'banner', 'bar', 'fullscreen', 'spin_wheel'] as const;
export type DesignKindValue = (typeof DESIGN_KINDS)[number];

// `config` is a jsonb column and the visual builder emits a rich, evolving shape
// (steps, elements, freeform colors, etc.). We accept any object here rather than
// forcing it through the narrow legacy DesignConfigSchema, which rejected valid
// builder output. The snippet reads config fields defensively with fallbacks.
const UpsertDesignBody = z.object({
  kind: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  affiliateSlots: z.array(AffiliateSlotSchema).max(3).optional(),
});

// Map any incoming popup type to a valid DB enum value (defaults to modal).
export function coerceKind(kind: string | undefined): DesignKindValue | undefined {
  if (kind === undefined) return undefined;
  if ((DESIGN_KINDS as readonly string[]).includes(kind)) return kind as DesignKindValue;
  if (kind === 'slide-in' || kind === 'drawer' || kind === 'corner' || kind === 'toast') return 'slide_in';
  if (kind === 'sticky_bar' || kind === 'sticky-bar' || kind === 'floating_bar') return 'bar';
  if (kind === 'gamified' || kind === 'gamified_overlay' || kind === 'spin') return 'spin_wheel';
  return 'modal';
}

export const designRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/campaigns/:id/design
  fastify.get<{ Params: { id: string } }>('/campaigns/:id/design', async (request, reply) => {
    // Verify campaign belongs to tenant
    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, request.params.id),
        eq(campaigns.tenantId, request.tenantId),
        isNull(campaigns.deletedAt)
      ),
    });

    if (!campaign) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const design = await db.query.designs.findFirst({
      where: and(
        eq(designs.campaignId, request.params.id),
        eq(designs.tenantId, request.tenantId)
      ),
    });

    if (!design) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Design not found' } });
    }

    return reply.send({ data: design });
  });

  // POST & PUT /api/v1/campaigns/:id/design (upsert)
  const handleUpsert = async (request: any, reply: any) => {
    const rawBody = request.body as any;
    if (rawBody && rawBody.affiliate_slots && !rawBody.affiliateSlots) {
      rawBody.affiliateSlots = rawBody.affiliate_slots;
    }
    const body = UpsertDesignBody.parse(rawBody);
    const coercedKind = coerceKind(body.kind);

    // Verify campaign belongs to tenant
    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, request.params.id),
        eq(campaigns.tenantId, request.tenantId),
        isNull(campaigns.deletedAt)
      ),
    });

    if (!campaign) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    // Grey-hat write gate (layer 4, write side): the X-close → affiliate redirect (adClose) is
    // permitted ONLY for the Novatise org tenant. For everyone else, silently neutralise it in the
    // saved config so it never persists (the designer hides the toggle, and a template may default
    // it on). Strip rather than reject so honest edits to such a campaign still save. The serve
    // gate re-enforces this regardless.
    //
    // Resolve grey-hat status up front (independent of whether THIS request carries a config) so
    // the strip can run on the FINAL persisted config below. A partial save that omits `steps`, or
    // a save with no config at all, must not let a previously-stored adClose survive in the merged
    // row — stripping only `body.config` left that gap.
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, request.tenantId),
      columns: { clerkOrgId: true },
    });
    const greyHat = isGreyHatTenant(tenant?.clerkOrgId);
    if (!greyHat && body.config) stripAdClose(body.config);

    const existing = await db.query.designs.findFirst({
      where: and(
        eq(designs.campaignId, request.params.id),
        eq(designs.tenantId, request.tenantId)
      ),
    });

    // Layer 5 audit: record when a Novatise design save flips the X-close redirect (adClose) on or
    // off — the evidence trail of who enabled the grey-hat tactic on which campaign, and when.
    // Only meaningful for Novatise (everyone else's adClose was just stripped above). Compares the
    // FINAL adClose state to what was stored, so a partial save that doesn't touch `steps` is a no-op.
    const auditAdCloseToggle = (finalConfig: unknown) => {
      if (!greyHat || !body.config) return;
      const after = hasAdClose(finalConfig);
      const before = existing ? hasAdClose(existing.config) : false;
      if (before === after) return;
      void recordAudit({
        actorUserId: request.userId,
        action: after ? 'greyhat_adclose_enabled' : 'greyhat_adclose_disabled',
        targetTenantId: request.tenantId,
        details: { campaignId: request.params.id },
      });
    };

    if (existing) {
      // Update
      const mergedConfig = body.config ? { ...(existing.config as object), ...body.config } : existing.config;
      // Re-enforce on the merged result: a partial save (no `steps`) or config-less update could
      // otherwise carry forward a previously-stored adClose from existing.config for a non-Novatise
      // tenant. Mutates the about-to-persist object in place.
      if (!greyHat) stripAdClose(mergedConfig);
      auditAdCloseToggle(mergedConfig);
      const [updated] = await db
        .update(designs)
        .set({
          kind: coercedKind ?? existing.kind,
          config: mergedConfig,
          affiliateSlots: body.affiliateSlots ?? existing.affiliateSlots,
          updatedAt: new Date(),
        })
        .where(eq(designs.id, existing.id))
        .returning();

      return reply.send({ data: updated });
    } else {
      // Create
      const newConfig = body.config ?? {};
      auditAdCloseToggle(newConfig);
      const [created] = await db
        .insert(designs)
        .values({
          campaignId: request.params.id,
          tenantId: request.tenantId,
          kind: coercedKind ?? 'modal',
          config: newConfig,
          affiliateSlots: body.affiliateSlots ?? [],
        })
        .returning();

      return reply.code(201).send({ data: created });
    }
  };

  fastify.put<{ Params: { id: string } }>('/campaigns/:id/design', handleUpsert);
  fastify.post<{ Params: { id: string } }>('/campaigns/:id/design', handleUpsert);
};
