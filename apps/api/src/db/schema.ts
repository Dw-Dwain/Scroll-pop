import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  smallint,
  uniqueIndex,
  primaryKey,
  pgEnum,
  boolean,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const planEnum = pgEnum('plan', [
  'free', 'starter', 'growth', 'scale', 'agency',
]);

export const roleEnum = pgEnum('member_role', [
  'owner', 'admin', 'editor', 'viewer',
]);

export const platformEnum = pgEnum('platform', [
  'wordpress', 'shopify', 'html', 'donorbox', 'gofundme', 'other',
]);

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft', 'active', 'paused', 'archived',
]);

export const designKindEnum = pgEnum('design_kind', [
  'modal', 'slide_in', 'banner', 'bar', 'fullscreen',
]);

export const triggerTypeEnum = pgEnum('trigger_type', [
  'scroll_pct', 'dwell_time', 'inactivity', 'exit_intent_mouse', 'click',
  // NOTE: back_button_capture is intentionally ABSENT. See CLAUDE.md rule #1.
]);

export const targetingKindEnum = pgEnum('targeting_kind', [
  'url_exact', 'url_contains', 'url_regex', 'device', 'returning_visitor',
]);

export const operatorEnum = pgEnum('operator', ['include', 'exclude']);

export const frequencyEnum = pgEnum('frequency', [
  'once_per_session', 'once_per_day', 'once_per_visitor', 'always',
]);

export const eventTypeEnum = pgEnum('event_type', [
  'impression', 'view', 'click', 'dismiss', 'conversion',
  'popup_close', 'popup_submit', 'popup_expand', 'popup_minimize',
  'email_capture', 'sms_capture', 'discount_redeemed',
  'checkout_started', 'purchase_completed', 'trigger_fired',
]);

// ─── Tenants ──────────────────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkOrgId: text('clerk_org_id').unique().notNull(),
  name: text('name').notNull(),
  plan: planEnum('plan').notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  monthlyViewLimit: integer('monthly_view_limit').notNull().default(1000),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').unique().notNull(),
  email: text('email').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
});

// ─── Tenant Members ───────────────────────────────────────────────────────────

export const tenantMembers = pgTable(
  'tenant_members',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull().default('editor'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.userId] }),
  })
);

// ─── Sites ────────────────────────────────────────────────────────────────────

export const sites = pgTable(
  'sites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    domain: text('domain').notNull(),
    publicKey: text('public_key')
      .unique()
      .notNull()
      .default(sql`encode(gen_random_bytes(16), 'hex')`),
    platform: platformEnum('platform').notNull().default('html'),
    shopifyShop: text('shopify_shop'),
    wpSiteUrl: text('wp_site_url'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    tenantDomainUniq: uniqueIndex('sites_tenant_domain_idx').on(
      t.tenantId,
      t.domain
    ),
  })
);

// ─── Shopify Installations ────────────────────────────────────────────────────

export const shopifyInstallations = pgTable('shopify_installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  shop: text('shop').unique().notNull(),
  accessToken: text('access_token').notNull(),
  scope: text('scope'),
  scriptTagId: text('script_tag_id'),
  nonce: text('nonce'),
  installedAt: timestamp('installed_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
  uninstalledAt: timestamp('uninstalled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
});

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: campaignStatusEnum('status').notNull().default('draft'),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ─── Designs ──────────────────────────────────────────────────────────────────

export const designs = pgTable('designs', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  kind: designKindEnum('kind').notNull().default('modal'),
  config: jsonb('config').notNull().default({}),
  affiliateSlots: jsonb('affiliate_slots').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
});

// ─── Triggers ─────────────────────────────────────────────────────────────────

export const triggers = pgTable('triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  // IMPORTANT: back_button_capture is NOT a valid type. See CLAUDE.md rule #1.
  type: triggerTypeEnum('type').notNull(),
  params: jsonb('params').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
});

// ─── Targeting Rules ──────────────────────────────────────────────────────────

export const targetingRules = pgTable('targeting_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  kind: targetingKindEnum('kind').notNull(),
  operator: operatorEnum('operator').notNull().default('include'),
  value: jsonb('value').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
});

// ─── Frequency Rules ──────────────────────────────────────────────────────────

export const frequencyRules = pgTable('frequency_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  frequency: frequencyEnum('frequency').notNull().default('once_per_session'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
});

// ─── Events (TimescaleDB hypertable — created via migration) ──────────────────

export const events = pgTable('events', {
  ts:             timestamp('ts', { withTimezone: true }).notNull().default(sql`NOW()`),
  tenantId:       uuid('tenant_id').notNull(),
  siteId:         uuid('site_id').notNull(),
  campaignId:     uuid('campaign_id').notNull(),
  eventType:      eventTypeEnum('event_type').notNull(),
  affiliateSlotId: text('affiliate_slot_id'),
  visitorId:      text('visitor_id'),
  sessionId:      text('session_id'),
  country:        text('country'),
  device:         text('device'),
  pageUrl:        text('page_url'),
  referrer:       text('referrer'),
  metadata:       jsonb('metadata').notNull().default({}),
  // Added in migration 0003 — analytics expansion
  scrollDepthPct: smallint('scroll_depth_pct'),
  trafficSource:  text('traffic_source'),
  abVariantId:    text('ab_variant_id'),
  shopifyOrderId: text('shopify_order_id'),
  revenueCents:   integer('revenue_cents'),
});
