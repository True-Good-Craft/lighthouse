# Validation Guide — Referrer Capture Feature (v1.6.0)

## Live Validation Steps

### After Deploying v1.6.0+

1. **Deploy the Worker with updated code**
   ```bash
   wrangler deploy
   ```

2. **Trigger traffic capture** (choose one):
   - **Option A**: Wait for the scheduled cron to run (if configured), OR
   - **Option B**: Call `/report` with valid `X-Admin-Token` header to trigger best-effort refresh capture:
     ```bash
     curl -H "X-Admin-Token: YOUR_TOKEN" https://your-lighthouse-worker/report
     ```

3. **Check Worker logs for referrer capture events**

### Expected Log Sequences

#### ✓ SUCCESS — Referrer capture succeeds
```
[Traffic Totals] Fetching traffic totals for day YYYY-MM-DD
[Traffic Totals] Retrieved: visits=NNN, requests=NNN
[Referrer Capture] Starting referrer capture for day YYYY-MM-DD
[Referrer Capture] Starting query for day YYYY-MM-DD
[Referrer Capture] Query succeeded; N raw referrer row(s) returned from Cloudflare
[Referrer Capture] Normalized to M unique referrer(s) after aggregation
[Referrer Capture] Summary built: {"example.com":1500,"direct_or_unknown":800}
[Referrer Capture] Capture succeeded for day YYYY-MM-DD; referrer_summary will be populated.
[Traffic Totals] Upserting row for day YYYY-MM-DD: visits=..., requests=..., referrer_summary=populated
[Traffic Totals] Upsert complete for day YYYY-MM-DD
```

#### ⚠ FAILURE — Referrer query returns no rows (GraphQL field/filter issue)
```
[Traffic Totals] Fetching traffic totals for day YYYY-MM-DD
[Traffic Totals] Retrieved: visits=NNN, requests=NNN
[Referrer Capture] Starting referrer capture for day YYYY-MM-DD
[Referrer Capture] Starting query for day YYYY-MM-DD
[Referrer Capture] Query returned no rows. Payload structure: data=true, viewer=true, zones=true, referrerData=missing
[Referrer Capture] Referrer capture failed for day YYYY-MM-DD; traffic totals will still be captured with referrer_summary=null. Error: cloudflare_referrers_graphql_empty_result
[Traffic Totals] Upserting row for day YYYY-MM-DD: visits=..., requests=..., referrer_summary=null
[Traffic Totals] Upsert complete for day YYYY-MM-DD
```

#### ⚠ FAILURE — GraphQL API error (field name or query malformed)
```
[Traffic Totals] Fetching traffic totals for day YYYY-MM-DD
[Traffic Totals] Retrieved: visits=NNN, requests=NNN
[Referrer Capture] Starting referrer capture for day YYYY-MM-DD
[Referrer Capture] Starting query for day YYYY-MM-DD
[Referrer Capture] GraphQL error(s): Field clientRequestHTTPReferer is unknown on type httpRequestsAdaptiveGroup
[Referrer Capture] Referrer capture failed for day YYYY-MM-DD; traffic totals will still be captured with referrer_summary=null. Error: cloudflare_referrers_graphql_payload_Field clientRequestHTTPReferer is unknown...
[Traffic Totals] Upserting row for day YYYY-MM-DD: visits=..., requests=..., referrer_summary=null
[Traffic Totals] Upsert complete for day YYYY-MM-DD
```

#### ⚠ FAILURE — HTTP error (auth or connectivity)
```
[Traffic Totals] Fetching traffic totals for day YYYY-MM-DD
[Traffic Totals] Retrieved: visits=NNN, requests=NNN
[Referrer Capture] Starting referrer capture for day YYYY-MM-DD
[Referrer Capture] Starting query for day YYYY-MM-DD
[Referrer Capture] Query failed: HTTP 401
[Referrer Capture] Referrer capture failed for day YYYY-MM-DD; traffic totals will still be captured with referrer_summary=null. Error: cloudflare_referrers_graphql_http_401
[Traffic Totals] Upserting row for day YYYY-MM-DD: visits=..., requests=..., referrer_summary=null
[Traffic Totals] Upsert complete for day YYYY-MM-DD
```

#### ⚠ FAILURE — All rows filtered/normalized away
```
[Traffic Totals] Fetching traffic totals for day YYYY-MM-DD
[Traffic Totals] Retrieved: visits=NNN, requests=NNN
[Referrer Capture] Starting referrer capture for day YYYY-MM-DD
[Referrer Capture] Starting query for day YYYY-MM-DD
[Referrer Capture] Query succeeded; 3 raw referrer row(s) returned from Cloudflare
[Referrer Capture] Skipped 3 row(s) with invalid/missing count metric
[Referrer Capture] No valid entries after filtering. All 3 rows either had invalid count or normalized to nothing.
[Referrer Capture] Referrer capture failed for day YYYY-MM-DD; traffic totals will still be captured with referrer_summary=null. Error: cloudflare_referrers_no_valid_entries
[Traffic Totals] Upserting row for day YYYY-MM-DD: visits=..., requests=..., referrer_summary=null
[Traffic Totals] Upsert complete for day YYYY-MM-DD
```

3. **Verify results in `/report`**
   - Call the report endpoint and check response structure:
     ```bash
     curl -H "X-Admin-Token: YOUR_TOKEN" https://your-lighthouse-worker/report | jq '.traffic'
     ```
   - Expected structure when referrer capture **succeeds**:
     ```json
     {
       "latest_day": {
         "day": "YYYY-MM-DD",
         "visits": 123,
         "requests": 456,
         "captured_at": "2026-03-24T10:30:00.000Z",
         "referrer_summary": "{\"example.com\":1500,\"direct_or_unknown\":800}"
       },
       "last_7_days": { ... }
     }
     ```
   - Expected when referrer capture **fails** (non-blocking):
     ```json
     {
       "latest_day": {
         "day": "YYYY-MM-DD",
         "visits": 123,
         "requests": 456,
         "captured_at": "2026-03-24T10:30:00.000Z",
         "referrer_summary": null
       },
       "last_7_days": { ... }
     }
     ```

### Troubleshooting — Diagnostic Guide

| Log Indicator | Most Likely Cause | Diagnostic | Fix |
|---|---|---|---|
| `Payload structure: ... referrerData=missing` | Query field name wrong or query shape doesn't return grouped results | Check Cloudflare GraphQL schema for valid dimensions field on `httpRequestsAdaptiveGroups` | Verify `dimensions { clientRequestHTTPReferer }` field exists and is spelled correctly |
| `Field ... is unknown on type httpRequestsAdaptiveGroup` | Query has invalid field or dimension reference | GraphQL schema doesn't recognize the field name | Check Cloudflare Analytics API documentation for correct dimension field names |
| `HTTP 401` or `HTTP 403` | Auth failure | `CF_API_TOKEN` invalid, expired, or insufficient permissions | Regenerate API token with GraphQL Analytics read permissions |
| `Skipped N row(s) with invalid/missing count metric` | Rows returned but `count` field missing or zero | Query returning rows but missing the count aggregation | Ensure query includes `count` aggregation function |
| `No valid entries after filtering. All N rows ... normalized to nothing.` | All referrers were self-hosted/direct | Data is valid but all traffic came from Lighthouse itself or direct | Normal behavior; check if `requestSource: "eyeball"` filter is excluding needed data |
| No referrer logs appear at all | Deployment didn't include referrer capture code | Code not deployed or old version running | Run `wrangler deploy` with latest code and confirm logs show `[Referrer Capture]` prefix |

### Key Validation Points

✓ **Traffic totals always captured** — Referrer failure does not block visits/requests  
✓ **Separate logs** — `[Traffic Totals]` and `[Referrer Capture]` prefixes clearly separate concerns  
✓ **Detailed failure reasons** — Logs show exact failure point (HTTP error, GraphQL error, empty result, no valid entries, etc.)  
✓ **Referrer_summary populated on success** — Field contains compact top-10 JSON  
✓ **Graceful fallback on failure** — Field is null; no synthetic data created  

### End-to-End Validation Checklist

- [ ] Deploy code to Worker
- [ ] Trigger capture via `/report` or wait for scheduled cron
- [ ] Inspect logs: Both `[Traffic Totals]` and `[Referrer Capture]` section visible
- [ ] If referrer failed: Read the error reason from logs (HTTP error, GraphQL error, empty result, etc.)
- [ ] Call `/report` endpoint and verify structure matches expected output
- [ ] Confirm `referrer_summary` is either populated JSON or explicitly null
- [ ] Verify totals (visits, requests, captured_at) always present regardless of referrer result
