# ScrollPop V1 QA and Cutover Plan

## Objective
Ship new conversion intelligence capabilities while preserving current production/dev behavior.

## Regression Gates (must pass)
1. Existing campaign CRUD still works.
2. Existing design save/load still works.
3. Existing trigger creation and evaluation still works.
4. Existing targeting and frequency endpoints still work.
5. Existing snippet rendering and event ingest still work.
6. Existing analytics pages still load with expected stats.
7. `npm run typecheck` and `npm run build` pass.

## New Capability Gates
1. Realtime ops overview endpoint returns valid payload.
2. Live events feed includes old + new event types.
3. Journey list maps all active campaigns.
4. Diagnose endpoint returns blocked reason distribution.
5. Insights table records and retrieves cards.
6. Feature flags correctly hide/show new surfaces.

## Shadow Mode Verification
- Enable `ff_realtime_ops_dashboard` for internal tenant only.
- New pages are read-only for first pass.
- Compare old analytics counts with new aggregate counts (tolerance +/-1%).

## Controlled Write Verification
- Enable `ff_journeys_ui` and `ff_behavior_graph_ui` for internal tenant.
- Save journey metadata into `designs.config`.
- Confirm legacy renderer ignores unknown keys and still serves campaigns.

## Cutover Sequence
1. Deploy additive migrations.
2. Deploy API additions.
3. Deploy dashboard flags OFF by default.
4. Enable internal tenant flags.
5. Observe for 24h.
6. Enable for 10% tenants.
7. Full rollout.

## On-Failure Recovery
- Turn off flags:
  - `ff_realtime_ops_dashboard`
  - `ff_journeys_ui`
  - `ff_behavior_graph_ui`
  - `ff_trigger_debugger`
  - `ff_ai_insights_v1`
- Keep existing endpoints and pages as fallback.
- No rollback migration required for additive tables.

