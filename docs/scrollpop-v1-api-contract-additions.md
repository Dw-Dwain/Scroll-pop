# ScrollPop V1 API Contract Additions (Non-Breaking)

## Contract Rules
- Existing endpoints and payloads remain valid.
- Add new endpoints under `/api/v1/ops/*` and `/api/v1/journeys/*`.
- For existing endpoints, only additive optional fields are allowed.

## 1) Realtime Ops Endpoints

### GET `/api/v1/ops/overview`
Returns aggregate KPIs for dashboard.

Response:
```json
{
  "data": {
    "activeVisitorsNow": 0,
    "activeCampaigns": 0,
    "conversionVelocity15m": 0,
    "conversionVelocityDeltaPct": 0,
    "alertsOpen": 0
  }
}
```

### GET `/api/v1/ops/live-events?campaignId=&limit=`
Returns merged recent event feed.

Event row (additive):
```json
{
  "id": "evt_...",
  "ts": "2026-05-25T12:00:00.000Z",
  "campaignId": "uuid",
  "eventType": "impression|view|click|dismiss|conversion|trigger_fired|trigger_blocked|suppressed",
  "sessionId": "string",
  "visitorId": "string",
  "device": "mobile|desktop|tablet|unknown",
  "meta": {
    "reason": "frequency_cap"
  }
}
```

### GET `/api/v1/ops/campaign-health`
Returns campaign health cards.

Response:
```json
{
  "data": [
    {
      "campaignId": "uuid",
      "status": "active",
      "impressions": 1000,
      "clicks": 42,
      "ctr": 0.042,
      "dismissRate": 0.61,
      "healthScore": 78,
      "trend": "up|flat|down"
    }
  ]
}
```

## 2) Journey Endpoints (UI abstraction)

### GET `/api/v1/journeys`
Maps existing campaigns to journeys.

Response:
```json
{
  "data": [
    {
      "id": "campaign-uuid",
      "campaignId": "campaign-uuid",
      "name": "Spring Offer",
      "status": "active",
      "objective": "lead_capture",
      "format": "modal",
      "siteId": "site-uuid"
    }
  ]
}
```

### GET `/api/v1/journeys/:id/diagnose`
Returns eligibility and trigger diagnostics.

Response:
```json
{
  "data": {
    "campaignId": "uuid",
    "rulesEvaluated": 12,
    "fired": 8,
    "blocked": 4,
    "topBlockedReasons": [
      { "reason": "frequency_cap", "count": 2 }
    ]
  }
}
```

## 3) Additive Extensions to Existing Endpoints

### POST/PUT `/api/v1/campaigns/:id/design`
Existing payload remains unchanged. New optional additive fields under `config`:
```json
{
  "config": {
    "rulesBuilderV1": {
      "tree": {},
      "scheduler": []
    },
    "journeyMeta": {
      "objective": "lead_capture",
      "priority": 50,
      "suppressionGroup": "default"
    },
    "mobileOverrides": {
      "enabled": true
    }
  }
}
```

### POST `/api/v1/events/batch`
Accept existing rows; additive optional event types:
- `trigger_fired`
- `trigger_blocked`
- `suppressed`
- `variant_assigned`

## 4) SSE/WS Stream (Additive)

### GET `/api/v1/ops/stream` (SSE)
Pushes:
- `ops_kpi_update`
- `live_event`
- `campaign_health_update`
- `insight_created`

