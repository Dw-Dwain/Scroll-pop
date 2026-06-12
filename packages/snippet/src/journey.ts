// ─── Journey engine (lazy chunk) — node-graph runtime ───────────────────────────
// Walks a COMPILED journey graph served in the site config: entry → popup → delay →
// condition → split → goal, branching on dismiss / convert / timeout. Loaded by the core
// (p.js) only when a site has published journeys, so it never touches the core size budget.
//
// HARD anti-trap guards (non-negotiable; per CLAUDE.md rule #1 there is NO history /
// popstate / beforeunload manipulation anywhere here):
//   • maxPopups   — at most this many popups shown per journey run, full stop.
//   • no repeats  — a popup node already shown in this run is never re-entered (cycle guard).
//   • minDelay    — floor on delay nodes so popups can't fire back-to-back.
//   • stickiness  — a completed journey (reached a goal) never re-triggers for the visitor.
//   • show-gated  — advancing into a popup only counts if the core actually displayed it
//                   (the core still honours the campaign's own frequency cap).
//
// The core hands us run(journeys, ctx) and tells us each popup's outcome via notify(id, on).
// Also keeps advance() for the legacy uiTriggers 2-popup chain (backward compatibility).

interface JNode {
  id: string;
  type: 'entry' | 'popup' | 'delay' | 'condition' | 'split' | 'goal';
  campaignId?: string;
  config?: Record<string, any>;
  next: Record<string, string>;
}
interface JCompiled {
  id: string;
  entryNodeId: string;
  trigger?: { type: string; params?: Record<string, unknown> } | null;
  schedule?: { startsAt?: string | null; endsAt?: string | null };
  maxPopups?: number;
  minDelay?: number;
  nodes: JNode[];
}
interface JCtx {
  show: (campaignId: string) => boolean;
  arm: (trigger: { type: string; params?: Record<string, unknown> }, cb: () => void) => void;
}

const DEFAULT_MAX_POPUPS = 4;
const DEFAULT_MIN_DELAY = 5;

interface RunState {
  j: JCompiled;
  nodes: Record<string, JNode>;
  shown: number;
  seen: Set<string>;
  active?: { nodeId: string; campaignId: string; timer?: ReturnType<typeof setTimeout> } | undefined;
}

const runs: RunState[] = [];
let _ctx: JCtx | undefined;

function ls(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function lsSet(key: string, v: string): void { try { localStorage.setItem(key, v); } catch { /* private mode */ } }

// Journey-level active window, evaluated in the visitor's local time (mirrors design.schedule).
function withinWindow(s?: { startsAt?: string | null; endsAt?: string | null }): boolean {
  if (!s) return true;
  const now = Date.now();
  if (s.startsAt && now < new Date(s.startsAt).getTime()) return false;
  if (s.endsAt && now > new Date(s.endsAt).getTime()) return false;
  return true;
}

function isMobile(): boolean {
  return typeof navigator !== 'undefined' &&
    (navigator.maxTouchPoints > 0 || /Mobi|Android/i.test(navigator.userAgent));
}

// Condition nodes branch true/false on a small set of client-evaluable rules. Unknown kinds
// fail-open to the true branch (never trap or dead-end the flow).
function evalCondition(node: JNode): boolean {
  const rule = (node.config?.['rule'] ?? {}) as { kind?: string; value?: any };
  switch (rule.kind) {
    case 'device': {
      const want = rule.value?.device ?? rule.value;
      return want === 'mobile' ? isMobile() : !isMobile();
    }
    case 'returning_visitor':
      return !!ls('_sp_vid'); // visitor id was set on a prior visit
    case 'converted':
      return ls('_sp_conv_' + (rule.value?.campaignId ?? '')) === '1';
    default:
      return true;
  }
}

// Split nodes pick a weighted branch, sticky per visitor so they stay in the same arm.
function pickSplit(node: JNode): string | undefined {
  const keys = Object.keys(node.next);
  if (!keys.length) return undefined;
  const skey = '_sp_js_' + node.id;
  const saved = ls(skey);
  if (saved && node.next[saved]) return node.next[saved];
  const weights = (node.config?.['weights'] ?? []) as number[];
  const total = weights.reduce((a, b) => a + (b || 0), 0) || keys.length;
  let r = Math.random() * total;
  for (let i = 0; i < keys.length; i++) {
    r -= (weights[i] ?? 1);
    if (r < 0) { lsSet(skey, keys[i]!); return node.next[keys[i]!]; }
  }
  lsSet(skey, keys[0]!);
  return node.next[keys[0]!];
}

function stepTo(rs: RunState, nodeId: string | undefined): void {
  if (!nodeId || !_ctx) return;
  const node = rs.nodes[nodeId];
  if (!node) return;
  const maxPopups = rs.j.maxPopups ?? DEFAULT_MAX_POPUPS;
  const minDelay = rs.j.minDelay ?? DEFAULT_MIN_DELAY;

  switch (node.type) {
    case 'entry':
      stepTo(rs, node.next['always']);
      break;

    case 'popup': {
      if (rs.seen.has(nodeId)) return;          // no-repeat (cycle guard)
      if (rs.shown >= maxPopups) return;         // anti-trap cap
      if (!node.campaignId) return;
      rs.seen.add(nodeId);
      if (!_ctx.show(node.campaignId)) return;   // frequency-capped / blocked → stop this branch
      rs.shown++;
      const active: NonNullable<RunState['active']> = { nodeId, campaignId: node.campaignId };
      rs.active = active;
      // 'timeout' branch — taken if the visitor neither dismisses nor converts in time.
      const to = Number(node.config?.['timeoutSeconds']);
      if (Number.isFinite(to) && to > 0 && node.next['timeout']) {
        active.timer = setTimeout(() => {
          if (rs.active === active) { rs.active = undefined; stepTo(rs, node.next['timeout']); }
        }, Math.max(minDelay, to) * 1000);
      }
      break; // movement resumes in notify() when the outcome arrives
    }

    case 'delay': {
      const secs = node.config?.['untilNextPageview']
        ? minDelay
        : Math.max(minDelay, Number(node.config?.['seconds']) || minDelay);
      setTimeout(() => stepTo(rs, node.next['always']), secs * 1000);
      break;
    }

    case 'condition':
      stepTo(rs, node.next[evalCondition(node) ? 'true' : 'false']);
      break;

    case 'split':
      stepTo(rs, pickSplit(node));
      break;

    case 'goal':
      lsSet('_sp_j_' + rs.j.id, 'done'); // sticky: completed journeys never re-trigger
      rs.active = undefined;
      break;
  }
}

function startJourney(j: JCompiled): void {
  if (!j || !Array.isArray(j.nodes) || !j.entryNodeId) return;
  if (ls('_sp_j_' + j.id) === 'done') return;   // already completed for this visitor
  if (!withinWindow(j.schedule)) return;         // outside the journey's scheduled window
  const nodes: Record<string, JNode> = {};
  for (const n of j.nodes) nodes[n.id] = n;
  const rs: RunState = { j, nodes, shown: 0, seen: new Set() };
  runs.push(rs);
  if (j.trigger && j.trigger.type) {
    _ctx!.arm(j.trigger, () => stepTo(rs, j.entryNodeId));
  } else {
    stepTo(rs, j.entryNodeId); // no entry trigger → start immediately
  }
}

// run(journeys, ctx): the core calls this once at boot when the site has published journeys.
function run(journeys: JCompiled[], ctx: JCtx): void {
  _ctx = ctx;
  if (!Array.isArray(journeys)) return;
  for (const j of journeys) { try { startJourney(j); } catch { /* never throw onto the host */ } }
}

// notify(campaignId, on): the core reports a popup's outcome. If it's the active popup of a
// running journey, follow that branch ('dismiss' | 'convert').
function notify(campaignId: string, on: 'dismiss' | 'convert'): void {
  if (on === 'convert') lsSet('_sp_conv_' + campaignId, '1');
  for (const rs of runs) {
    const a = rs.active;
    if (a && a.campaignId === campaignId) {
      if (a.timer) clearTimeout(a.timer);
      const node = rs.nodes[a.nodeId];
      rs.active = undefined;
      if (node) stepTo(rs, node.next[on]);
    }
  }
}

// ─── Legacy 2-popup chain (design.config.uiTriggers) — kept for backward compatibility ──────
const LEGACY_MAX_CHAIN = 2;
const LEGACY_MIN_DELAY = 5;
let legacyShown = 0;
const legacySeen = new Set<string>();
function advance(selfId: string, ui: Record<string, unknown>, on: string): void {
  const core = (window as unknown as { __sp_core?: { show: (id: string) => boolean } }).__sp_core;
  const next = ui['sequenceNextCampaignId'] as string | undefined;
  if (!core || !next || next === selfId) return;
  const advanceOn = (ui['sequenceAdvanceOn'] as string) || 'dismiss';
  if (advanceOn !== on && advanceOn !== 'both') return;
  if (legacyShown >= LEGACY_MAX_CHAIN) return;
  if (legacySeen.has(next)) return;
  legacySeen.add(next);
  const delay = Math.max(LEGACY_MIN_DELAY, Number(ui['sequenceDelaySeconds']) || LEGACY_MIN_DELAY);
  setTimeout(() => { if (core.show(next)) legacyShown++; }, delay * 1000);
}

(window as unknown as {
  __sp_journey?: {
    run: (journeys: JCompiled[], ctx: JCtx) => void;
    notify: (campaignId: string, on: 'dismiss' | 'convert') => void;
    advance: (selfId: string, ui: Record<string, unknown>, on: string) => void;
  };
}).__sp_journey = { run, notify, advance };
