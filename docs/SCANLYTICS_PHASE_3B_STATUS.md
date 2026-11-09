# Phase 3B analytics summary status

## Implemented

Both summary routes use one captured UTC as-of instant with inclusive starts and exclusive ends. The finite chart and total cover the same interval. The previous window ends at the equivalent elapsed point. Lifetime totals cover all associated events before as-of, and the lifetime chart covers at most 365 UTC dates. The API returns total and chart bounds separately. The application fills missing dates with zero from daily database counts.

- `GET /api/analytics/overview` uses one parameterized PostgreSQL statement for current and previous counts, the number of QRs with current events, UTC day buckets, and the top ten QRs. The ranking preserves zero-count QRs and breaks count ties by QR ID.
- `GET /api/analytics/qr/:id` uses the existing repeatable-read QR snapshot for owner-scoped metadata, one parameterized PostgreSQL summary statement, and a Prisma recent-events query. Recent events use the current total range and return at most 50 rows ordered by timestamp descending, then ID descending. Existing IP and user-agent fields are confined to this existing owner-only response projection.

Each summary statement returns one row with up to 365 daily buckets. Overview adds at most ten QR entries. Counts are independent of these result limits. PostgreSQL can still examine many matching rows to compute exact totals. The QR endpoint's aggregate and recent query now share the existing interactive transaction and its timeout.

## Ownership and metric meaning

Fresh email-account admission provides the owner ID before reads. Foreign or missing QR lookups return 404. Both aggregate statements derive event scope from the QR's owner and the event's explicit QR foreign key. Active, archived, and retired QR histories remain eligible. A missing QR association excludes an event even if it has a short-link association. An inconsistent short-link association does not reassign an event away from the explicit QR reference. Actual historical anomalies and historical tracking coverage remain unresolved.

Recorded events are redirect requests and may include repeated or automated requests. Direct-content tracking remains unavailable. Unique visitors, observation-based daily averages, and growth remain unavailable. The pages continue to consume the existing fields and retain their direct-content notice.

## Disconnected validation

- Analytics window and route fixtures passed (17), including two-account isolation, lifecycle history, UTC boundaries, sparse and zero dates, deterministic ranking and recent ordering, and a mocked 100,001-event count.
- Auth passed (188), full QR and frontend consumer regressions passed (305), and HTTP route logging passed (45). The relevant HTTP fixtures used local loopback.
- Prisma schema validation with fictional configuration and installed engines, Nuxt build, and Git whitespace checks all passed.

## Remaining work

The QR list still loads an unpaginated QR collection with event arrays. The separate QR detail route still loads an unbounded event history. Cursor pagination for recent events remains a separate slice.

Real PostgreSQL parity, query plans, and large-volume performance are unverified. The regression fixtures inspect bindings and emulate aggregation without executing SQL. In an authorized disposable database with fictional data, check PostgreSQL results and plans for finite and lifetime ranges at representative volumes. Evaluate a QR-owner lookup index and an event index on QR ID and timestamp, with an ID tie-breaker if warranted by the recent-read plan. Measure before proposing a migration.

The next Phase 3B slice is the disposable PostgreSQL parity and query-plan rehearsal. QR list and recent-event pagination, IANA time zones, historical coverage, and release readiness remain open.
