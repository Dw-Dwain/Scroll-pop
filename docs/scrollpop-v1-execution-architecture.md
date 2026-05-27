# ScrollPop V1 Execution Architecture (Additive, No Refactor)

## Guardrails (must not break current dev/runtime)
- Keep all existing build scripts, Turbo graph, and workspace package scripts unchanged.
- Keep existing API resource names and endpoints working as-is.
- Keep current auth, tenant, snippet, worker, and analytics connection points unchanged.
- Ship all new capability behind feature flags and additive schema/API paths.

## Product Surface (V1)
- Realtime Conversion Ops Center
- Journey-oriented campaign management
- Builder tabs: `Design`, `Behavior`, `Diagnose`
- Insights and experiment control

## Existing Runtime Compatibility
- `campaigns`, `designs`, `triggers`, `targeting_rules`, `frequency_rules` remain canonical for serving.
- Existing snippet delivery and event ingestion remain canonical paths.
- New objects are attached as metadata/adjacent tables; no destructive migration.

## High-Level Architecture
1. Event ingest (existing path)
2. Rules evaluation (existing + additive evaluator metadata)
3. Decision emit (`trigger_fired` / `trigger_blocked` additive events)
4. Aggregation service for realtime dashboard (additive queries/materialized views)
5. Dashboard realtime transport (SSE or WS, additive route)

## New Additive Modules
- `journeys` abstraction layer in dashboard UI (maps 1:1 to existing campaigns initially)
- trigger debugger stream
- insight generator service (deterministic first, ML later)
- feature flag gate for each new page/section

## Feature Flags
- `ff_realtime_ops_dashboard`
- `ff_journeys_ui`
- `ff_behavior_graph_ui`
- `ff_trigger_debugger`
- `ff_ai_insights_v1`
- `ff_experiments_v1`

## Rollout Policy
1. Internal tenant allowlist only
2. Read-only shadow mode (no serving-path mutations)
3. Controlled write mode for new journeys only
4. General rollout, with one-click fallback to legacy surfaces

