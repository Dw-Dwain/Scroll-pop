import React from 'react';
import { useCustom } from '@refinedev/core';
import { getApiBase } from '../providers/dataProvider';

export const ADMIN_EMAIL       = 'dwain3991@gmail.com';
export const UNLIMITED_DOMAINS = ['novatise.com'];

// Platform super-admin: only the exact ADMIN_EMAIL gets admin console access.
export function isSuperAdminEmail(email: string): boolean {
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// Unlimited plan: super-admin + Novatise agency members.
// These users get agency-level limits but NOT admin console access (except ADMIN_EMAIL).
export function isUnlimitedEmail(email: string): boolean {
  const e = email.toLowerCase();
  return e === ADMIN_EMAIL.toLowerCase() ||
    UNLIMITED_DOMAINS.some((d) => e.endsWith(`@${d}`));
}

export type PlanId = 'free' | 'starter' | 'growth' | 'scale' | 'agency';
export const PLAN_ORDER: PlanId[] = ['free', 'starter', 'growth', 'scale', 'agency'];

export const PLAN_PRICES: Record<PlanId, string> = {
  free: '$0',
  starter: '$19',
  growth: '$49',
  scale: '$129',
  agency: '$299',
};

export interface PlanLimits {
  maxSites: number;
  maxCampaigns: number;
  maxViews: number;
  abTesting: boolean;
  advancedAnalytics: boolean;
  customWebhooks: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  noWatermark: boolean;
  prioritySupport: boolean;
  geoTargeting: boolean;
}

const UNLIMITED: PlanLimits = {
  maxSites: Infinity,
  maxCampaigns: Infinity,
  maxViews: Infinity,
  abTesting: true,
  advancedAnalytics: true,
  customWebhooks: true,
  apiAccess: true,
  whiteLabel: true,
  noWatermark: true,
  prioritySupport: true,
  geoTargeting: true,
};

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    maxSites: 1,
    maxCampaigns: 1,
    maxViews: 1_000,
    abTesting: false,
    advancedAnalytics: false,
    customWebhooks: false,
    apiAccess: false,
    whiteLabel: false,
    noWatermark: false,
    prioritySupport: false,
    geoTargeting: false,
  },
  starter: {
    maxSites: 3,
    maxCampaigns: 5,
    maxViews: 25_000,
    abTesting: false,
    advancedAnalytics: false,
    customWebhooks: false,
    apiAccess: false,
    whiteLabel: false,
    noWatermark: true,
    prioritySupport: true,
    geoTargeting: false,
  },
  growth: {
    maxSites: 10,
    maxCampaigns: 20,
    maxViews: 150_000,
    abTesting: true,
    advancedAnalytics: true,
    customWebhooks: true,
    apiAccess: false,
    whiteLabel: false,
    noWatermark: true,
    prioritySupport: true,
    geoTargeting: true,
  },
  scale: {
    maxSites: Infinity,
    maxCampaigns: Infinity,
    maxViews: 500_000,
    abTesting: true,
    advancedAnalytics: true,
    customWebhooks: true,
    apiAccess: false,
    whiteLabel: false,
    noWatermark: true,
    prioritySupport: true,
    geoTargeting: true,
  },
  agency: {
    maxSites: Infinity,
    maxCampaigns: Infinity,
    maxViews: 2_000_000,
    abTesting: true,
    advancedAnalytics: true,
    customWebhooks: true,
    apiAccess: true,
    whiteLabel: true,
    noWatermark: true,
    prioritySupport: true,
    geoTargeting: true,
  },
};

// ─── localStorage fallback (used only while the /me API response is loading) ──────

function detectPlanLocal(): PlanId {
  try {
    const settings = localStorage.getItem('_sp_settings');
    if (settings) {
      const s = JSON.parse(settings) as { plan?: string };
      if (s.plan && (PLAN_ORDER as string[]).includes(s.plan)) return s.plan as PlanId;
    }
  } catch {}
  return 'free';
}

// ─── Super-admin tier override (lead-dev testing, no Stripe) ──────────────────
// dwain3991 can preview any tier's gating/limits without a real subscription. The override
// is local-only (never sent to the API) and only honoured for the verified super-admin.
// 'unlimited' (or unset) keeps full super-admin access; a PlanId simulates that exact tier.
const PLAN_OVERRIDE_KEY = '_sp_admin_plan_override';
export const PLAN_OVERRIDE_EVENT = 'sp:plan-override';
export type PlanOverride = PlanId | 'unlimited' | null;

export function readPlanOverride(): PlanOverride {
  try {
    const v = localStorage.getItem(PLAN_OVERRIDE_KEY);
    if (v === 'unlimited' || (v && (PLAN_ORDER as string[]).includes(v))) return v as PlanOverride;
  } catch {}
  return null;
}

export function setPlanOverride(p: PlanOverride): void {
  try {
    if (p) localStorage.setItem(PLAN_OVERRIDE_KEY, p);
    else localStorage.removeItem(PLAN_OVERRIDE_KEY);
  } catch {}
  window.dispatchEvent(new Event(PLAN_OVERRIDE_EVENT));
}


// ─── Main hook ────────────────────────────────────────────────────────────────

export function usePlan() {
  // Fetch real plan + email from GET /me.
  // plan  → tenants.plan in DB (updated by Stripe webhook on subscription change).
  // email → users.email    (synced from Clerk on sign-up).
  const { data: meData } = useCustom({
    url: `${getApiBase()}/me`,
    method: 'get',
    queryOptions: { staleTime: 60_000, retry: false },
  });

  const mePayload = meData?.data as { tenant?: { plan?: string; usage?: number; monthlyViewLimit?: number }; user?: { email?: string } } | undefined;
  const apiPlan  = mePayload?.tenant?.plan;
  const apiEmail = mePayload?.user?.email;
  const apiUsage = mePayload?.tenant?.usage;        // live popup impressions this month (or undefined while loading)
  const apiViewLimit = mePayload?.tenant?.monthlyViewLimit;

  // isAdmin = platform super-admin ONLY (exact ADMIN_EMAIL match from API).
  // NO localStorage fallback — admin panel access must be confirmed by the API.
  // If /me hasn't loaded yet, isAdmin is false (never speculatively true).
  const isAdmin: boolean = apiEmail ? isSuperAdminEmail(apiEmail) : false;

  const [, rerender] = React.useState(0);
  React.useEffect(() => {
    const onChange = () => rerender(n => n + 1);
    window.addEventListener('storage', onChange);
    window.addEventListener(PLAN_OVERRIDE_EVENT, onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener(PLAN_OVERRIDE_EVENT, onChange);
    };
  }, []);

  // Super-admin tier override (lead-dev testing). Only honoured for the verified super-admin.
  const planOverride: PlanOverride = isAdmin ? readPlanOverride() : null;
  const simulatedTier = planOverride && planOverride !== 'unlimited' ? planOverride : null;

  // API data wins; fall back to localStorage while loading. A super-admin tier override
  // (a concrete tier) takes precedence so the lead dev can preview that exact plan.
  const plan: PlanId = simulatedTier
    ?? ((apiPlan && (PLAN_ORDER as string[]).includes(apiPlan)) ? (apiPlan as PlanId) : detectPlanLocal());

  // isUnlimited = super-admin OR @novatise.com (agency limits, no admin console) — UNLESS the
  // super-admin is simulating a concrete tier, in which case they experience that tier's real gating.
  const isUnlimited: boolean = simulatedTier ? false : (apiEmail ? isUnlimitedEmail(apiEmail) : false);

  const limits: PlanLimits = isUnlimited ? UNLIMITED : PLAN_LIMITS[plan];

  const hasFeature = (key: keyof Omit<PlanLimits, 'maxSites' | 'maxCampaigns' | 'maxViews'>): boolean =>
    isUnlimited || limits[key];

  const withinLimit = (type: 'maxSites' | 'maxCampaigns', current: number): boolean =>
    isUnlimited || current < limits[type];

  const planRank = (p: PlanId) => PLAN_ORDER.indexOf(p);
  const meetsMinPlan = (required: PlanId): boolean => isUnlimited || planRank(plan) >= planRank(required);

  return { plan, isAdmin, isUnlimited, limits, hasFeature, withinLimit, meetsMinPlan, planOverride, usage: apiUsage, monthlyViewLimit: apiViewLimit, loaded: !!mePayload };
}
