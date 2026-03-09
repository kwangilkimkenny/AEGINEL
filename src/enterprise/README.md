# AEGINEL Enterprise

## Architecture

```
┌─────────────────────────────┐
│   Admin Dashboard (Web)     │
│   - Policy management       │
│   - Audit log viewer        │
│   - User/device management  │
│   - Analytics dashboard     │
└─────────────┬───────────────┘
              │ REST API
┌─────────────▼───────────────┐
│   Admin Server (API)        │
│   POST /api/v1/policy/:org  │
│   GET  /api/v1/policy/:org  │
│   POST /api/v1/telemetry    │
│   POST /api/v1/audit        │
│   GET  /api/v1/reports/:org │
└─────────────┬───────────────┘
              │ HTTPS (JSON)
┌─────────────▼───────────────┐
│   Browser Extensions        │
│   (N devices per org)       │
│   - Fetch policy on startup │
│   - Report scan telemetry   │
│   - Report audit events     │
│   - Apply enforced policies │
└─────────────────────────────┘
```

## Privacy Guarantee

**No raw prompt text is ever transmitted to the server.**

The extension only sends:
- Risk score (0-100)
- Risk level (low/medium/high/critical)
- Detected categories (e.g., "jailbreak", "pii_exposure")
- PII count (number only, not the actual PII)
- Site name
- Timestamp
- Latency metrics

## API Endpoints

### GET /api/v1/policy/:orgId
Fetch the current enterprise policy for an organization.

### POST /api/v1/telemetry/:orgId
Submit anonymized scan telemetry (fire-and-forget).

### POST /api/v1/audit/:orgId
Submit audit events (block overrides, config changes).

### GET /api/v1/reports/:orgId
Generate compliance reports (GDPR, CCPA, 개인정보보호법).

## Pricing Model (Planned)

| Tier | Seats | Price | Features |
|------|-------|-------|----------|
| Free | 1 | $0 | All detection + PII proxy |
| Team | 5-50 | $5/seat/mo | + Admin dashboard, audit log |
| Business | 50-500 | $10/seat/mo | + SSO, custom policies, API |
| Enterprise | 500+ | Custom | + On-premise, SLA, dedicated support |
