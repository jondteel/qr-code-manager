# Phase 3B: UTC analytics endpoint slice

Both analytics endpoints use UTC calendar windows with one captured as-of instant, inclusive starts and exclusive ends. The previous window ends at the equivalent elapsed point. Event counts represent recorded redirect requests, including repeated or automated requests; they are not verified people or physical scans. Direct-content QR tracking remains unavailable.

Tracking coverage has no verified start authority, so daily averages and growth remain unavailable, including zero-baseline cases. The response exposes the previous count and an unavailable growth status without inferring coverage. Unique visitors remain unavailable. All-time totals include all associated recorded events before as-of; their chart covers only the latest 365 UTC calendar days. Response range metadata specifies both total and chart bounds. For finite periods, the chart and total cover the same interval.

Existing event reads remain unbounded. Ownership-safe aggregation and pagination, database parity and large-volume query-plan validation, IANA timezone and DST support, and historical attribution and coverage authority remain future work. No historical data or ingestion is changed. This slice does not establish production or Preview readiness.
