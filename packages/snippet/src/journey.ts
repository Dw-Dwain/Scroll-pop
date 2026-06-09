// ─── Journey / sequence runtime (lazy chunk, FU-7) ──────────────────────────────
// Bounded popup chaining: when a popup is dismissed (or converts), advance to a configured
// "next" campaign after a delay. Loaded by the core (p.js) only when a campaign declares a
// `sequence` block, so it never touches the core bundle's size budget.
//
// HARD anti-trap guards (non-negotiable — a sequence must never become a popup trap, and per
// CLAUDE.md rule #1 there is NO history/back-button/beforeunload manipulation anywhere here):
//   • MAX_CHAIN     — at most this many *sequenced* popups per page load, full stop.
//   • no repeats    — a campaign id already shown via the chain is never shown again.
//   • MIN_DELAY     — a floor between popups so they can't fire back-to-back.
//   • count-on-show — the chain counter only advances if the next popup actually displayed
//                     (the core respects the next campaign's frequency cap), so a capped/blocked
//                     popup doesn't burn the budget or leave a dangling timer effect.
// Attaches window.__sp_journey = { advance }.

const MAX_CHAIN = 2; // hard cap on sequenced popups per page load
const MIN_DELAY = 5; // seconds floor between popups (anti-trap / UX guardrail)

let shown = 0;
const seen = new Set<string>();

// advance(selfId, ui, on): the core hands us the dismissed/converted campaign's id, its raw
// uiTriggers object, and which event fired. We own the field parsing + every guard here.
function advance(selfId: string, ui: Record<string, unknown>, on: string): void {
  const core = (window as unknown as { __sp_core?: { show: (id: string) => boolean } }).__sp_core;
  const next = ui['sequenceNextCampaignId'] as string | undefined;
  if (!core || !next || next === selfId) return;          // need a target; never chain to self
  const advanceOn = (ui['sequenceAdvanceOn'] as string) || 'dismiss';
  if (advanceOn !== on && advanceOn !== 'both') return;   // event must match the configured trigger
  if (shown >= MAX_CHAIN) return;                          // never trap the visitor
  if (seen.has(next)) return;                              // no cycles / no repeats
  seen.add(next);
  const delay = Math.max(MIN_DELAY, Number(ui['sequenceDelaySeconds']) || MIN_DELAY);
  setTimeout(() => {
    if (core.show(next)) shown++;                          // only count a popup that actually displayed
  }, delay * 1000);
}

(window as unknown as { __sp_journey?: { advance: (selfId: string, ui: Record<string, unknown>, on: string) => void } })
  .__sp_journey = { advance };
