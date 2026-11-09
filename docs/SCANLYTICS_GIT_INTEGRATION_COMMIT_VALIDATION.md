# Scanlytics Git integration and commit validation

November 8, 2026, Eastern Time

**Recommendation: BLOCKED for push pending verification of Vercel Preview bindings and the team's Git deployment rules.** The local series is available for owner review.

## Source and checkout

The accepted source was Candidate-B1-01a1aa40 on codex/scanlytics-integration-candidate at 84d63d91964b2bc06eeab361536a1f74212dce0e. The original checkout at Documents/qr code website/qr-code-manager supplied the cached origin/main and GitHub origin metadata. The isolated checkout is Documents/Scanlytics-Integration/Git-Integration-01a1be1b on codex/scanlytics-git-integration. Its own Git object store passed strict full fsck. There are no alternates, linked worktrees or configured remotes.

Read-only git ls-remote against https://github.com/jondteel/qr-code-manager.git returned the recorded base as live refs/heads/main and no matching integration feature ref. Both product commits descend directly from that base, so there was no upstream divergence to resolve at review time. GitHub branch protection and CI remain owner review items.

## Commits

- 56191aa074969d967a7eff0010106c6a8c523558 Preserve applied QR and recovery migrations
- ead76846c4769580a685669e5b5ab4966e2208b5 Integrate QR lifecycle, account safety and credential-safe logging

This report is included as a separate documentation commit. Its exact commit ID is available from git log.

## Migration checks

All six candidate working files matched the recorded production execution evidence before transfer. After staging the migration commit, all six index blob SHA-256 hashes matched. After committing, all six HEAD blobs, working files, and fresh Windows checkout-index outputs matched. The historical migrations and migration_lock.toml are unchanged relative to base. Prisma schema and the three applied October migrations are in the first commit.

| Migration directory | Verified SHA-256 |
| --- | --- |
| 20260209211149_init | 1c0a91ad1a498a737e33db0a53bad859e1aa6109b8e4bfa068899c91ea33c3db |
| 20260212003255_add_username | 7927d2d430c3c775f6a0bcfc2dd864a2385d4fc5d29b2c8c1681f69db5299063 |
| 20261014050000_p0_supabase_containment | ed146c4640d90544c3744325c45bb40e8777c209254408e40909da764dcb7e3a |
| 20261017000000_qr_issued_encoded_target | 30a926f231c010816e03159082ca3ce5dd4ab2eef38b767b34caf6036ac01b0b |
| 20261017010000_qr_lifecycle | 276a1abfec7da6427ed0296b08e61555a70253fb0db1e5351f61af9c554d1687 |
| 20261020000000_recovery_foundation | 531aa1be2f515ac2ec3fdac9112990b9f003568b7c84ca49904e27cd2562b3e1 |

The migration-scoped .gitattributes uses `*.sql text eol=lf`. Git reported index LF, working tree LF, and text eol=lf for all six with core.autocrlf=true. No historical SQL was changed. Windows checkout initially cached the prior historical SQL file stats. Restaging those three unchanged files refreshed metadata and produced an empty staged diff.

The unmodified issued-target SQL has a blank line at EOF. Default `git diff --check 84d63d91964b2bc06eeab361536a1f74212dce0e HEAD` reports that one line. The check passes with only blank-at-eof disabled. The other paths pass the default check. Preserving the applied bytes takes precedence over trimming the line.

## Disconnected validation

Node v22.20.0 and npm 11.6.2 match B2-A. The locked install used the existing integrity-checked cache with install hooks disabled. Tests and build used a minimal environment, a fictional PostgreSQL URL at 192.0.2.1:1, telemetry disabled, and a Node preload that denies network connections and DNS except same-process ephemeral loopback HTTP for QR and logging suites. No production credentials or provider variables were loaded. The Prisma generation used the previously verified Windows engines from the exact-version candidate install.

| Command | Actual result |
| --- | --- |
| `npm ci --offline --registry=https://registry.npmjs.org/ --ignore-scripts --no-audit --no-fund` | Exit 0. Installed 776 packages from the npm lockfile. |
| `prisma validate --schema prisma/schema.prisma` | Exit 0. Schema valid. |
| `prisma generate --schema prisma/schema.prisma` | Exit 0. Generated Prisma Client 5.22.0. |
| `npm run build` | Exit 0. Prisma, Nuxt client and server builds, and Nitro bundle completed. |
| `npm run test:qr` | 305 passed, zero failed or skipped. |
| `npm run test:auth` | 188 passed, zero failed or skipped. |
| `npm run test:keepalive` | 34 passed, zero failed or skipped. |
| `node --experimental-vm-modules --test tests/route-logging.test.mjs` | 45 passed, zero failed or skipped. |
| Same logging command with `LOGGING_TEST_COMPILED=1` | 45 passed, zero failed or skipped. |
| Disconnected Node ESM import probe | All 17 Nitro route and renderer chunks loaded. Compiled recovery status returned `{ enabled: false }`. |

The build warned about intentionally absent provider settings, missing optional Supabase types, outdated Browserslist data and dependency export deprecations. The first harness attempts hit Windows path length, npm CLI selection and console encoding issues. Extended paths for cache copying, the explicit npm 11.6.2 CLI, slash-normalized preload paths and UTF-8 output resolved these without changing the committed application.

The PostgreSQL ledger suite requires a separately verified disposable database and was outside this disconnected run. Hosted Auth, provider and mail behavior, browser and physical QR flows, production runtime bindings and deployment acceptance require separate validation. Production recovery configuration was outside scope.

## Corrections and review

Three fixtures embedded an absolute local PostgreSQL directory. The runtime fixture now requires SCANLYTICS_RECOVERY_PG_DATA_DIR and the ledger test and its worker use RECOVERY_TEST_PG_DATA_DIR. The fixed loopback endpoints, task-specific directory suffixes, database and role checks, and cluster identity checks remain in place. The worker receives the exact verified directory from the test payload. Missing or mismatched directory configuration fails closed. The rest of the application follows the readiness inventory byte-for-byte on transfer, with Git's normal non-SQL line-ending conversion.

Staged checks covered each allowlisted path and local imports. The complete staged application patch was recorded in the local Git metadata, and the committed path list was compared to the allowlist. The bounded secret and private-data scan identified sample credentials and synthetic canaries. Machine-specific absolute fixture paths were removed. No campaign or scanner draft, database backup, dotenv secret, or generated artifact was introduced.

The five required documents were consulted for preflight, scope and evidence. The roadmap, readiness report, B1 manifest, B2-A report and production execution record remain local evidence under the readiness publication rules. The optional recovery and database runbooks were deferred pending publication review. Phase 3B, historical audits, private restore evidence, campaign and scanner drafts, and local build, cache and temporary artifacts were excluded. Baseline keep-alive, package-lock.json, vercel.json and existing production-history documents remain inherited from the verified base.

## Vercel and owner review

The read-only project response identifies qr-code-manager, Node 24.x and a latest production deployment. Recorded deployment evidence ties the project to main at the base SHA. The project response did not expose the current Git integration rules or Preview bindings. Treat a feature branch push as capable of triggering a Preview deployment and a merge to main as capable of triggering a production deployment. Verify the current Git settings and isolated Preview bindings before push. The Node 22 local result does not establish parity with the hosted Node 24.x setting. [Vercel Git deployments](https://vercel.com/docs/git)

## Preservation and final Git state

The original and candidate HEAD, branch, refs, full porcelain status, index hash and Git config hash matched their intake snapshots. All 160 B1 manifest files and six candidate migration files matched again after integration. Source operations used read-only access with optional Git locks disabled. The independent checkout had clean Git status after the product commits and is expected clean after this documentation commit. No push, pull request, merge, deployment, database connection or migration execution occurred.

## Exact product files in the series

- `.env.example`
- `components/AccountPanel.vue`
- `components/AppHeaderNav.vue`
- `components/QrLifecycleActions.vue`
- `composables/useAccountLogout.ts`
- `composables/useAccountReadiness.ts`
- `middleware/account.global.ts`
- `modules/auth-transport.ts`
- `nuxt.config.ts`
- `package.json`
- `pages/analytics/[id].vue`
- `pages/analytics/index.vue`
- `pages/auth/confirm.vue`
- `pages/auth/recovery.vue`
- `pages/dashboard.vue`
- `pages/edit/[id].vue`
- `pages/forgot-password.vue`
- `pages/generate.vue`
- `pages/login.vue`
- `pages/onboarding.vue`
- `pages/signup.vue`
- `prisma/migrations/.gitattributes`
- `prisma/migrations/20261017000000_qr_issued_encoded_target/migration.sql`
- `prisma/migrations/20261017010000_qr_lifecycle/migration.sql`
- `prisma/migrations/20261020000000_recovery_foundation/migration.sql`
- `prisma/schema.prisma`
- `server/api/analytics/overview.get.ts`
- `server/api/analytics/qr/[id].get.ts`
- `server/api/auth/onboard.post.ts`
- `server/api/auth/readiness.get.ts`
- `server/api/auth/recovery-complete.post.ts`
- `server/api/auth/recovery-request.post.ts`
- `server/api/auth/recovery-status.get.ts`
- `server/api/auth/signup.post.ts`
- `server/api/qr/[id].delete.ts`
- `server/api/qr/[id].get.ts`
- `server/api/qr/[id].put.ts`
- `server/api/qr/[id]/lifecycle.patch.ts`
- `server/api/qr/create.post.ts`
- `server/api/qr/list.get.ts`
- `server/middleware/recovery-security.ts`
- `server/middleware/redirect-cache.ts`
- `server/routes/s/[code].get.ts`
- `server/utils/auth-account.mjs`
- `server/utils/auth-admission.mjs`
- `server/utils/auth-boundary.ts`
- `server/utils/auth-recovery.mjs`
- `server/utils/downloadQrPng.ts`
- `server/utils/qr-destination.mjs`
- `server/utils/qr-edit.mjs`
- `server/utils/qr-issuance.mjs`
- `server/utils/qr-lifecycle-state.mjs`
- `server/utils/qr-lifecycle.mjs`
- `server/utils/qr-redirect.mjs`
- `server/utils/qr-scan.mjs`
- `server/utils/qrToBlob.ts`
- `server/utils/recovery-crypto.mjs`
- `server/utils/recovery-fixture-issuer.mjs`
- `server/utils/recovery-integration.mjs`
- `server/utils/recovery-ledger.mjs`
- `server/utils/recovery-local.mjs`
- `server/utils/require-email-account.ts`
- `tests/auth-account.test.mjs`
- `tests/auth-admission.test.mjs`
- `tests/helpers/email-identity.mjs`
- `tests/helpers/qr-create-harness.mjs`
- `tests/helpers/qr-edit-harness.mjs`
- `tests/helpers/qr-redirect-harness.mjs`
- `tests/helpers/recovery-worker.mjs`
- `tests/qr-consumers.test.mjs`
- `tests/qr-contract.test.mjs`
- `tests/qr-edit.test.mjs`
- `tests/qr-lifecycle.test.mjs`
- `tests/qr-provenance.test.mjs`
- `tests/qr-redirect.test.mjs`
- `tests/recovery-foundation.test.mjs`
- `tests/recovery-integration.test.mjs`
- `tests/recovery-ledger.pg.test.mjs`
- `tests/route-logging.test.mjs`
- `utils/auth-fetch.mjs`
- `utils/auth-navigation.mjs`
- `utils/qr-payload.mjs`
- `utils/qr-render.mjs`
