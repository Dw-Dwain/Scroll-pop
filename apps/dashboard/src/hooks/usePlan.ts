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

// ─── localStorage fallbacks (desktop mode / pre-load) ─────────────────────────

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

  const apiPlan  = (meData?.data as any)?.tenant?.plan  as string | undefined;
  const apiEmail = (meData?.data as any)?.user?.email   as string | undefined;

  // API data wins; fall back to localStorage while loading or in desktop mode.
  const plan: PlanId = (apiPlan && (PLAN_ORDER as string[]).includes(apiPlan))
    ? (apiPlan as PlanId)
    : detectPlanLocal();

  // isAdmin = platform super-admin ONLY (exact ADMIN_EMAIL match from API).
  // NO localStorage fallback — admin panel access must be confirmed by the API.
  // If /me hasn't loaded yet, isAdmin is false (never speculatively true).
  const isAdmin: boolean = apiEmail ? isSuperAdminEmail(apiEmail) : false;

  // isUnlimited = super-admin OR @novatise.com (agency plan limits, no admin console).
  // Determined solely by the /me API email — no client-side fallback.
  const isUnlimited: boolean = apiEmail ? isUnlimitedEmail(apiEmail) : false;

  const [, rerender] = React.useState(0);
  React.useEffect(() => {
    const onStorage = () => rerender(n => n + 1);
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const limits: PlanLimits = isUnlimited ? UNLIMITED : PLAN_LIMITS[plan];

  const hasFeature = (key: keyof Omit<PlanLimits, 'maxSites' | 'maxCampaigns' | 'maxViews'>): boolean =>
    isUnlimited || limits[key];

  const withinLimit = (type: 'maxSites' | 'maxCampaigns', current: number): boolean =>
    isUnlimited || current < limits[type];

  const planRank = (p: PlanId) => PLAN_ORDER.indexOf(p);
  const meetsMinPlan = (required: PlanId): boolean => isUnlimited || planRank(plan) >= planRank(required);

  return { plan, isAdmin, isUnlimited, limits, hasFeature, withinLimit, meetsMinPlan };
}
