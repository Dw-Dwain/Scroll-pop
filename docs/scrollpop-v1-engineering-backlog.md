# ScrollPop V1 Engineering Backlog

## Execution Principles
- Additive changes only.
- No refactor of existing build/runtime integration points.
- Each ticket includes compatibility checks against current live variable wiring.

## Epic A: Realtime Ops Center
1. Dashboard shell with realtime KPI pulse row.
2. Live event feed panel (`impression/view/click/dismiss/conversion` + new debug events).
3. Campaign health matrix (status, CVR trend, fatigue, trigger success).
4. Opportunity panel with deterministic recommendations.
5. Device/source segmentation cards with trend deltas.

## Epic B: Journeys Surface (UI abstraction on existing campaigns)
1. Add `Journeys` route in dashboard nav.
2. Render existing campaigns as journeys with objective and format chips.
3. Add pause/activate/clone actions using existing campaign endpoints.
4. Add “Open Diagnose” action.
5. Add migration-safe “journey metadata” storage in design config JSON.

## Epic C: Builder 3-tab Experience
1. Design tab: keep existing editor controls; improve layout and inline editing affordances.
2. Behavior tab: keep existing rules builder + scheduler windows; add suppression and priority controls in config metadata.
3. Diagnose tab: add visitor simulation view and rule eligibility trace.
4. Persist only additive `config.rulesBuilderV1`/`config.debugHints`.
5. Preserve all existing create/update payload fields.

## Epic D: Trigger Debugger
1. Emit `trigger_fired` and `trigger_blocked` events from evaluator path.
2. Add blocked-reason taxonomy:
- `targeting_miss`
- `frequency_cap`
- `priority_lost`
- `schedule_window_miss`
- `campaign_inactive`
3. Add dashboard debug table filtered by campaign/session.
4. Add per-session trace modal.

## Epic E: Insights V1 (Deterministic)
1. Add insight job that runs over trailing windows (15m/24h/7d).
2. Generate cards with:
- message
- confidence
- impact estimate
- affected segment
3. Add one-click action hooks:
- create experiment
- adjust delay
- adjust suppression
4. Log action acceptance and post-action impact.

## Epic F: Experiments V1
1. Add experiment model mapped to existing design variants.
2. Add winner confidence and minimum sample thresholds.
3. Add stop/pause controls.
4. Add summary widget to ops dashboard.

## Epic G: Mobile-first Enhancements
1. Mobile preview safe areas and keyboard-safe form checks.
2. Mobile trigger diagnostics (dismiss speed, close rate).
3. Mobile-specific override fields in design config metadata.

## Epic H: Reliability and QA
1. Add regression suite for existing campaign lifecycle.
2. Add compatibility tests for existing worker/snippet/API contracts.
3. Add dashboard load testing for realtime feed.
4. Add feature-flag rollback validation.

## Milestone Sequence
1. M1 (Week 1-2): Epic A + B
2. M2 (Week 3-4): Epic C + D
3. M3 (Week 5-6): Epic E + G
4. M4 (Week 7-8): Epic F + H, rollout hardening

