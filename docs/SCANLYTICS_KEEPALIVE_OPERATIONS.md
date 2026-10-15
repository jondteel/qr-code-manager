# Scanlytics keep-alive operations

## Configuration

The keep-alive endpoint requires the Vercel project environment variable `CRON_SECRET` in the **Production** scope. Vercel uses this variable to send the cron invocation's `Authorization: Bearer …` header; the server reads the same variable at request time. Do not create a second `NUXT_CRON_SECRET` requirement. Use a randomly generated token of at least 16 characters (prefer 32 or more), containing only printable ASCII with no whitespace; the handler supports at most 4096 bytes. Empty, non-ASCII, whitespace/control-containing, or oversized configuration fails closed as a configuration error.

After adding or changing an environment variable, create a new production deployment. Vercel does not apply environment changes to deployments that already exist.

The existing Vercel cron remains `GET /api/cron/keep-db-alive` on `0 12 * * *` (daily at 12:00 UTC). Do not increase its frequency without separately checking the current plan limits.

## Local verification

Run `npm run test:keepalive` from a clean checkout. The focused tests use a mocked query function and never connect to PostgreSQL. Missing or invalid configuration returns a generic 500; missing or incorrect authorization returns 401 without querying; a query failure returns a generic 503; success is returned only after the awaited `SELECT 1` resolves. Every response is marked `no-store`. Tests execute the actual route source with real H3 header/error adapters, the real helper and a mocked Prisma query, checking request-time secret rotation, the exact SQL, completion ordering and error headers. The Node test script enables experimental VM modules only for testing; production does not require that flag.

Use these tests to verify authorization rejection safely. They cover absent, incorrect, malformed, and oversized credentials without sending requests to production. Never put a credential in a URL, test output, issue, screenshot, or log.

## Diagnostics

The function emits one structured record per invocation with a timestamp and outcome category:

- `missing_configuration`: `CRON_SECRET` was absent or invalid in the server function.
- `unauthorized`: the Bearer credential was absent or did not match.
- `success`: the awaited PostgreSQL read completed; the record includes query duration.
- `database_error`: the read failed; the record includes a sanitized error category and duration.

Safe Vercel request and deployment identifiers are included only when they match the expected identifier format. Secret values, authorization headers, database URLs, raw error messages, and user or QR data are not logged.

## Production verification and recovery

Production verification requires a separately authorized deployment and endpoint invocation. After deployment, inspect the Vercel Cron Jobs page for the registered path, daily schedule, enabled state, and invocation logs. Verify an invalid or absent Bearer credential is rejected without SQL, then verify an authorized invocation returns success only after PostgreSQL completes `SELECT 1`. Keep the credential in Vercel's secret environment-variable UI; never expose it to a shell transcript or diagnostic output.

Continue monitoring both explicit failures and missing recent successes. Retain a named operator, a failure alert, a stale-success alert, and sanitized timestamps/outcomes/query durations for at least the required seven-day observation. The daily query is a risk reduction, not an uptime guarantee; Supabase Free may still pause a project.

If Supabase pauses, use the existing project's supported resume process. Confirm the same project is healthy, then verify a read-only database connection and ordinary safe dashboard reads. Preserve the existing project, records, short codes, and production URLs. Reassess the cron and monitoring after recovery; do not reset, migrate, or replace the project as part of this procedure.

## Rollout prerequisites and monitoring

Use the reviewed containment-based branch. Do not deploy the original dirty checkout: its unfinished campaign/scanner schema and QR-create/helper work are excluded. The P0 containment migration is already applied; do not reapply or modify it. Confirm the deployment's database binding is still the existing Scanlytics project `mglkfeldoaobgulqfdqa`, and preserve its Free organization/project and issued URLs. Prior reports do not prove the current deployed database role or current cron enablement. Keep the outstanding Phase 0B/API-configuration and Phase 0C full-project recovery limits explicit; reassess those gates before release. No migration command is needed for this repair.

Assign an operator before rollout. Alert on each `missing_configuration`, `unauthorized`, or `database_error` outcome and on platform timeouts/crashes that may produce no application diagnostic. Alert when no `success` has been recorded for 26 hours after rollout's initial authorized successful read; also check the initial scheduled run if it never succeeds. Hobby scheduling can run within the scheduled hour, so allow that window. A healthy HTTP function alone is insufficient: use the sanitized success outcome emitted after the database read. Collect daily scheduled successes for at least seven days. This document specifies monitoring; it does not install alerts or establish an alert owner.

For a pause, have the operator open the existing project's Supabase dashboard and use its supported Restore/resume action only with operational authorization. Stop and escalate if same-project recovery is unavailable; do not create a replacement project or alter DNS/issued links. Do not assume daily `SELECT 1` prevents pausing: Free projects can pause for low activity over seven days, and this task has not verified how this query affects the activity heuristic. Use the dashboard's current recovery eligibility instead of assuming an indefinite restore window. Free-tier recovery and a protected, tested backup remain necessary.

Official references: [Vercel cron authorization, scheduling and logs](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [production-only cron execution](https://vercel.com/docs/cron-jobs/quickstart), [environment-variable deployment scope](https://vercel.com/docs/environment-variables), and [Supabase Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

## Local final review limitations

The helper uses Node's built-in SHA-256 to produce equal-length buffers for `timingSafeEqual`; bounded credential inputs avoid buffer-length exceptions. The `.mjs` helper is directly imported by the production route and the Node tests; `.d.mts` provides TypeScript declarations without adding a loader/framework or runtime dependency. The Node/Nitro production build checks runtime import resolution. Local mocked tests do not establish deployed Vercel scheduler behavior, production PostgreSQL connectivity, or Free-tier uptime.

Nuxt typechecking is a documented tooling follow-up, not a passed check. On final review, `nuxt typecheck` exited 1 before source checking with `ERR_PACKAGE_PATH_NOT_EXPORTED`: cached `vue-tsc 3.3.13` calls `require.resolve('typescript/lib/tsc')`, but cached TypeScript `7.0.2` does not export that path. Both the base and Phase 1A.2 package manifests lack local TypeScript/vue-tsc dependencies, so Nuxt falls back to unpinned `npx` tools. Establish a separately reviewed compatible pinned local toolchain and then address any actual source diagnostics; no dependencies or lockfile are changed by this repair. Successful bundling is not typecheck acceptance.

Phase 1A remains open pending separate production preparation, deployment approval, authorized endpoint/database-read verification, monitoring setup and seven days of observed scheduled execution. This guide does not accept or complete Phase 1A or authorize Phase 1B.
