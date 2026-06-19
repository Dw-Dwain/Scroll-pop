import React from 'react';
import { authedFetch } from '../providers/dataProvider';

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

export type PlanId = 'free' | 'agency';
export const PLAN_ORDER: PlanId[] = ['free', 'agency'];

export const PLAN_PRICES: Record<PlanId, string> = {
  free: '$0',
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

type MePayload = {
  tenant?: { plan?: string; usage?: number; monthlyViewLimit?: number; greyHat?: boolean };
  user?: { email?: string };
  role?: string;
};

export function usePlan() {
  // Fetch real plan + email + role from GET /me.
  // plan  → tenants.plan in DB (updated by Stripe webhook on subscription change).
  // email → users.email    (synced from Clerk on sign-up).
  // role  → tenant_members.role for THIS user (owner | admin | editor | viewer).
  // NOTE: this uses authedFetch, NOT Refine's useCustom — useCustom returns empty in production
  // (systemic bug), which made plan/email silently fall back to stale localStorage from a previous
  // account (e.g. an invited viewer inheriting a prior owner's "agency" plan + full access).
  const [mePayload, setMePayload] = React.useState<MePayload | undefined>(undefined);
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await authedFetch('/me');
        if (!res.ok) return;
        const body = await res.json() as { data?: MePayload };
        if (!cancelled) setMePayload(body.data ?? (body as MePayload));
      } catch { /* leave undefined — callers fall back to localStorage while loading */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const apiPlan  = mePayload?.tenant?.plan;
  const apiEmail = mePayload?.user?.email;
  const apiRole  = mePayload?.role;                 // membership role (undefined while loading)
  const apiUsage = mePayload?.tenant?.usage;        // live popup impressions this month (or undefined while loading)
  const apiViewLimit = mePayload?.tenant?.monthlyViewLimit;
  // Grey-hat (X-close → affiliate redirect) is gated server-side to the Novatise org tenant.
  // Used only to hide the designer toggle for everyone else (cosmetic — the API enforces it).
  const isNovatise: boolean = mePayload?.tenant?.greyHat === true;

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

  // Membership role for the active (possibly shared/agency) tenant. `viewer` is read-only — the API
  // enforces this (403 on writes); the UI should mirror it by hiding/disabling write controls.
  // While /me is loading, role is undefined → treat as NOT view-only so controls aren't briefly
  // hidden for a legitimate editor on a slow request (the API stays the source of truth).
  const role: string | undefined = apiRole;
  const isViewer = role === 'viewer';
  const canWrite = !isViewer;

  return { plan, isAdmin, isUnlimited, isNovatise, limits, hasFeature, withinLimit, meetsMinPlan, planOverride, usage: apiUsage, monthlyViewLimit: apiViewLimit, role, isViewer, canWrite, loaded: !!mePayload };
}
