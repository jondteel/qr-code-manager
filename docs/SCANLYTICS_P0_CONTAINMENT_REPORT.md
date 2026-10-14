# Scanlytics P0 security containment — Option B

Execution date: October 14, 2026 (America/New_York).

Status: COMPLETED for authorized containment; verification scope and remaining gaps are detailed below.

Authorized scope: only the supplied permissions/RLS SQL and a new Prisma migration record. The user accepted residual uncertainty about the running Vercel connection role and a security-metadata-only exception to the verified backup/restore gate. Later structural/data migrations still require Phase 0C recovery proof.

Verified target: project `mglkfeldoaobgulqfdqa`, name `qr-code-manager`, ACTIVE_HEALTHY, region us-east-2; organization `miaswwnmvzkpmiwzvfrn`, free/tier_free. Free Account connector used. No other project inspected.

Initial Git: main, HEAD `3c999a7af9a476911454333bede7bb7bb6a651ec`. Existing status:
```text
 M prisma/schema.prisma
 M server/api/qr/create.post.ts
?? .nuxt-dev.pid
?? docs/
?? pet-runs/
?? repo_audit_scanlytics.md
?? scanalytics_audit.md
?? server/utils/shortUrl.ts
```

Dedicated branch: `codex/p0-supabase-containment`, same HEAD. Existing work preserved. No staging/commit/push.

Baseline: exactly five postgres-owned public tables; 80/80 anon/authenticated privilege checks true (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN); RLS/FORCE RLS false; no public policies or column ACLs. No client-role memberships or PUBLIC table grants. postgres and service_role have all eight privileges and BYPASSRLS. Security baseline matches Phase 0B. Both existing migration records completed with matching SHA-256 checksums.

Sanitized recovery metadata captured before write (ACLs are evidence, not authorized recovery SQL):
```json
{
  "roles": [
    {
      "name": "authenticated",
      "bypass": false,
      "inherit": true,
      "superuser": false
    },
    {
      "name": "anon",
      "bypass": false,
      "inherit": true,
      "superuser": false
    },
    {
      "name": "service_role",
      "bypass": true,
      "inherit": true,
      "superuser": false
    },
    {
      "name": "postgres",
      "bypass": true,
      "inherit": true,
      "superuser": false
    }
  ],
  "tables": [
    {
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": false,
      "name": "_prisma_migrations",
      "owner": "postgres",
      "force_rls": false
    },
    {
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": false,
      "name": "QRCode",
      "owner": "postgres",
      "force_rls": false
    },
    {
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": false,
      "name": "ShortUrl",
      "owner": "postgres",
      "force_rls": false
    },
    {
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": false,
      "name": "Analytics",
      "owner": "postgres",
      "force_rls": false
    },
    {
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": false,
      "name": "User",
      "owner": "postgres",
      "force_rls": false
    }
  ],
  "policies": null,
  "effective": [
    {
      "role": "authenticated",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "authenticated",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "authenticated",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "authenticated",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "authenticated",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "authenticated",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "authenticated",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "authenticated",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "authenticated",
      "table": "Analytics",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "authenticated",
      "table": "Analytics",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "authenticated",
      "table": "Analytics",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "authenticated",
      "table": "Analytics",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "authenticated",
      "table": "Analytics",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "authenticated",
      "table": "Analytics",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "authenticated",
      "table": "Analytics",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "authenticated",
      "table": "Analytics",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "authenticated",
      "table": "User",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "authenticated",
      "table": "User",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "authenticated",
      "table": "User",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "authenticated",
      "table": "User",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "authenticated",
      "table": "User",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "authenticated",
      "table": "User",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "authenticated",
      "table": "User",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "authenticated",
      "table": "User",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "authenticated",
      "table": "QRCode",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "authenticated",
      "table": "QRCode",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "authenticated",
      "table": "QRCode",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "authenticated",
      "table": "QRCode",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "authenticated",
      "table": "QRCode",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "authenticated",
      "table": "QRCode",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "authenticated",
      "table": "QRCode",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "authenticated",
      "table": "QRCode",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "authenticated",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "authenticated",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "authenticated",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "authenticated",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "authenticated",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "authenticated",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "authenticated",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "authenticated",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "anon",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "anon",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "anon",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "anon",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "anon",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "anon",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "anon",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "anon",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "anon",
      "table": "Analytics",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "anon",
      "table": "Analytics",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "anon",
      "table": "Analytics",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "anon",
      "table": "Analytics",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "anon",
      "table": "Analytics",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "anon",
      "table": "Analytics",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "anon",
      "table": "Analytics",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "anon",
      "table": "Analytics",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "anon",
      "table": "User",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "anon",
      "table": "User",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "anon",
      "table": "User",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "anon",
      "table": "User",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "anon",
      "table": "User",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "anon",
      "table": "User",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "anon",
      "table": "User",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "anon",
      "table": "User",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "anon",
      "table": "QRCode",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "anon",
      "table": "QRCode",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "anon",
      "table": "QRCode",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "anon",
      "table": "QRCode",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "anon",
      "table": "QRCode",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "anon",
      "table": "QRCode",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "anon",
      "table": "QRCode",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "anon",
      "table": "QRCode",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "anon",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "anon",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "anon",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "anon",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "anon",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "anon",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "anon",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "anon",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "service_role",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "service_role",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "service_role",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "service_role",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "service_role",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "service_role",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "service_role",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "service_role",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "service_role",
      "table": "Analytics",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "service_role",
      "table": "Analytics",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "service_role",
      "table": "Analytics",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "service_role",
      "table": "Analytics",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "service_role",
      "table": "Analytics",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "service_role",
      "table": "Analytics",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "service_role",
      "table": "Analytics",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "service_role",
      "table": "Analytics",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "service_role",
      "table": "User",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "service_role",
      "table": "User",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "service_role",
      "table": "User",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "service_role",
      "table": "User",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "service_role",
      "table": "User",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "service_role",
      "table": "User",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "service_role",
      "table": "User",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "service_role",
      "table": "User",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "service_role",
      "table": "QRCode",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "service_role",
      "table": "QRCode",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "service_role",
      "table": "QRCode",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "service_role",
      "table": "QRCode",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "service_role",
      "table": "QRCode",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "service_role",
      "table": "QRCode",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "service_role",
      "table": "QRCode",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "service_role",
      "table": "QRCode",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "service_role",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "service_role",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "service_role",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "service_role",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "service_role",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "service_role",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "service_role",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "service_role",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "postgres",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "postgres",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "postgres",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "postgres",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "postgres",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "postgres",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "postgres",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "postgres",
      "table": "_prisma_migrations",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "postgres",
      "table": "Analytics",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "postgres",
      "table": "Analytics",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "postgres",
      "table": "Analytics",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "postgres",
      "table": "Analytics",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "postgres",
      "table": "Analytics",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "postgres",
      "table": "Analytics",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "postgres",
      "table": "Analytics",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "postgres",
      "table": "Analytics",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "postgres",
      "table": "User",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "postgres",
      "table": "User",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "postgres",
      "table": "User",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "postgres",
      "table": "User",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "postgres",
      "table": "User",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "postgres",
      "table": "User",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "postgres",
      "table": "User",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "postgres",
      "table": "User",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "postgres",
      "table": "QRCode",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "postgres",
      "table": "QRCode",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "postgres",
      "table": "QRCode",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "postgres",
      "table": "QRCode",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "postgres",
      "table": "QRCode",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "postgres",
      "table": "QRCode",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "postgres",
      "table": "QRCode",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "postgres",
      "table": "QRCode",
      "allowed": true,
      "privilege": "MAINTAIN"
    },
    {
      "role": "postgres",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "SELECT"
    },
    {
      "role": "postgres",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "INSERT"
    },
    {
      "role": "postgres",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "UPDATE"
    },
    {
      "role": "postgres",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "DELETE"
    },
    {
      "role": "postgres",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "TRUNCATE"
    },
    {
      "role": "postgres",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "REFERENCES"
    },
    {
      "role": "postgres",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "TRIGGER"
    },
    {
      "role": "postgres",
      "table": "ShortUrl",
      "allowed": true,
      "privilege": "MAINTAIN"
    }
  ],
  "column_acl": null,
  "migrations": [
    {
      "name": "20260209211149_init",
      "steps": 1,
      "started": "2026-02-09T21:11:49.568855+00:00",
      "checksum": "1c0a91ad1a498a737e33db0a53bad859e1aa6109b8e4bfa068899c91ea33c3db",
      "finished": "2026-02-09T21:11:50.076776+00:00",
      "has_logs": false,
      "rolled_back": null
    },
    {
      "name": "20260212003255_add_username",
      "steps": 1,
      "started": "2026-02-12T00:32:55.612925+00:00",
      "checksum": "7927d2d430c3c775f6a0bcfc2dd864a2385d4fc5d29b2c8c1681f69db5299063",
      "finished": "2026-02-12T00:32:55.979454+00:00",
      "has_logs": false,
      "rolled_back": null
    }
  ],
  "default_acl": [
    {
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "type": "r",
      "owner": "postgres",
      "schema": "public"
    },
    {
      "acl": "{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "type": "f",
      "owner": "postgres",
      "schema": "public"
    },
    {
      "acl": "{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}",
      "type": "S",
      "owner": "postgres",
      "schema": "public"
    },
    {
      "acl": "{postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin}",
      "type": "S",
      "owner": "supabase_admin",
      "schema": "public"
    },
    {
      "acl": "{postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin}",
      "type": "r",
      "owner": "supabase_admin",
      "schema": "public"
    },
    {
      "acl": "{postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
      "type": "f",
      "owner": "supabase_admin",
      "schema": "public"
    }
  ],
  "memberships": [
    {
      "role": "pg_monitor",
      "member": "supabase_read_only_user"
    },
    {
      "role": "pg_monitor",
      "member": "postgres"
    },
    {
      "role": "pg_monitor",
      "member": "supabase_etl_admin"
    },
    {
      "role": "pg_read_all_settings",
      "member": "pg_monitor"
    },
    {
      "role": "pg_read_all_stats",
      "member": "pg_monitor"
    },
    {
      "role": "pg_stat_scan_tables",
      "member": "pg_monitor"
    },
    {
      "role": "pg_signal_backend",
      "member": "postgres"
    },
    {
      "role": "pg_read_all_data",
      "member": "supabase_read_only_user"
    },
    {
      "role": "pg_read_all_data",
      "member": "supabase_etl_admin"
    },
    {
      "role": "pg_read_all_data",
      "member": "postgres"
    },
    {
      "role": "pg_create_subscription",
      "member": "postgres"
    },
    {
      "role": "anon",
      "member": "authenticator"
    },
    {
      "role": "anon",
      "member": "postgres"
    },
    {
      "role": "authenticated",
      "member": "authenticator"
    },
    {
      "role": "authenticated",
      "member": "postgres"
    },
    {
      "role": "service_role",
      "member": "authenticator"
    },
    {
      "role": "service_role",
      "member": "postgres"
    },
    {
      "role": "authenticator",
      "member": "supabase_storage_admin"
    },
    {
      "role": "authenticator",
      "member": "postgres"
    },
    {
      "role": "supabase_privileged_role",
      "member": "supabase_etl_admin"
    },
    {
      "role": "supabase_privileged_role",
      "member": "postgres"
    }
  ]
}
```

Migration: `prisma/migrations/20261014050000_p0_supabase_containment/migration.sql`, exactly the approved SQL; one explicit transaction, lock_timeout 2s and statement_timeout 15s. No application data changes, FORCE RLS, permissive policies, schema/client generation or applied-file edits.

Execution plan: installed Prisma 5.22.0 migrate deploy with a verified manifest comprising the two applied/checksum-matched migrations and this single pending migration. The dirty Prisma schema is used only as existing datasource configuration; migrate deploy executes SQL migration files and does not generate the Client or apply schema differences. Target credentials remain in memory. Supabase session pooler port 5432 is selected only for this child process; .env/Vercel configuration unchanged.

Read-only preflight: default sandbox could not reach transaction pooler; an authorized unsandboxed local Prisma read confirmed current_user=postgres and database=postgres. This is local connection evidence, not deployed Vercel runtime-role verification. Transaction-pooler migration status hung and was interrupted before writes. Session-pooler migration status succeeded: two migrations, database up to date. No write operation retried.

Production preflight: existing signed-in Chrome dashboard refreshed successfully (5 QR codes, 5 short URLs, 29 scans); analytics overview loaded normally. No short-link endpoints visited. Protected fingerprints of every existing User, QRCode, ShortUrl, Analytics and migration-history row captured in session memory; only comparison results will be reported.

Historical evidence accepted by authorization: Vercel DATABASE_URL bound to this project through pooler/postgres, all environments, updated February 21, 2026; production deployment May 12, 2026; earlier deployed database reads; source uses server-side Prisma. These are strong supporting evidence, not definitive runtime-role verification.

Recovery rule: on execution error stop and inspect transaction outcome; no repeat write. On application failure preserve containment, identify role/operation, and report narrow correction. Never routinely regrant client access, disable RLS, or execute recovery SQL without additional authorization. Sanitized metadata above is not a full backup.

Phase 0B, 0C and Phase 1 remain open. No subsequent roadmap work authorized by this task.

## Execution and verified security result

Outcome: COMPLETED for the authorized security containment and nonmutating verification. This does not establish full application lifecycle acceptance or close roadmap phases.

Prisma 5.22.0 migrate deploy exited 0, applied only `20261014050000_p0_supabase_containment`, and reported all migrations applied. Security transaction committed. New migration checksum: `ed146c4640d90544c3744325c45bb40e8777c209254408e40909da764dcb7e3a`. Database finished_at: 2026-10-14T04:30:18.570613Z (October 14, 12:30:18 AM Eastern). The directory timestamp is an identifier, not the actual execution time.

| Check | Before | Verified after |
| --- | --- | --- |
| Client effective privileges, 2 roles × 5 tables × 8 | 80 true | 80 false |
| postgres/service_role privileges | 80 true | 80 true |
| RLS enabled | 0/5 | 5/5 |
| FORCE RLS | 0/5 | 0/5 |
| PUBLIC table grants | None | None |
| Client inherited-role memberships | None | None |
| Effective client column privilege paths | No column ACLs | Zero SELECT/INSERT/UPDATE/REFERENCES paths |
| Public policies | None | None |
| postgres public table defaults | Client grants present | Only postgres/service_role; no global table ACL override |
| GraphQL role introspection | Prior advisor flagged all five | Both actual client roles: Query has only node; no mutation type; no application-table types or collection fields |
| Advisor missing RLS/GraphQL findings | 5 missing-RLS, 10 client GraphQL findings | All absent in fresh advisor results |

Catalog checks account for PUBLIC, ownership, role inheritance and column grants. The client roles are neither table owners nor BYPASSRLS/superusers. All eight effective checks were tested, including PostgreSQL 17 MAINTAIN. GraphQL was called inside READ ONLY transactions with SET LOCAL ROLE anon/authenticated, not through the HTTP endpoint. No Data API mutation requests were issued; privilege denial was established by PostgreSQL catalogs. No future-table fixture was created: postgres default table ACL and absence of global defaults establish the expected new-table grants. Supabase-managed supabase_admin defaults and routine/sequence defaults remain unchanged by scope.

The advisor now reports five informational [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) findings, consistent with intentionally server-managed tables, and the existing [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No Auth configuration changed.

## Data preservation and migration consistency

Protected full-row fingerprint comparisons (including identifiers, destinations, ownership, configuration and timestamps) returned:

| Object | Result |
| --- | --- |
| User | All 3 rows unchanged |
| QRCode | All 5 rows unchanged, including QR identifiers/destinations and mapping references |
| ShortUrl | All 5 rows unchanged, including short codes and originalUrl destinations |
| Analytics | All 29 existing rows unchanged; no additions observed |
| Original migration history | Both complete original rows unchanged |
| New migration history | Exactly one completed record added; checksum matches local bytes; steps=1, rolled_back_at null |

Fingerprints remained in session memory and are omitted from artifacts. Analytics comparison checks every baseline fingerprint remains present, so legitimate concurrent additions would be distinguished from changed/deleted existing records. Final Prisma migrate status exited 0: three migrations, database up to date. No existing migration files or records were rewritten.

## Application checks and limits

- Existing authenticated production dashboard refreshed successfully before containment; displayed 5 QR codes, 5 short URLs and 29 scans.
- Production analytics overview refreshed successfully after containment; normal 30-day zero-scan result and five existing QR entries rendered.
- Local server-side Prisma shortUrl.findUnique lookups resolved all five existing short codes to their original destinations after containment; only aggregate comparison output printed. This is local Prisma access evidence, not a deployed redirect-handler invocation.
- Post-containment dashboard was reloaded from production and again displayed 5 QR codes, 5 short URLs and 29 scans.
- All-time production analytics loaded 29 scans and five active QR codes after containment. Existing per-QR analytics also loaded its normal 30-day result and QR/mapping details. Real record IDs, destinations, IP addresses and account identifiers are omitted from this report.
- Production public homepage loaded normally after containment. Browser checks used the existing authenticated session and safe read controls only.

No short-link redirect endpoints, fixture writes, QR scans or scan logging tests were run. Successful short-code reads do not prove scan ingestion writes work. No application deployment, Prisma Client regeneration, source changes, Auth changes, Vercel configuration changes, billing changes or unrelated project inspection occurred.

## Recovery and remaining roadmap work

No SQL error or observed post-change read regression occurred; recovery not needed or executed. The preserved ACL metadata documents the old insecure state solely for diagnosis. Any later corrective change requires identifying the failing role/operation and separate authorization; never routinely restore anonymous/authenticated grants or disable RLS.

Residual uncertainty expressly accepted under Option B: the effective role of the running Vercel deployment was not independently verified. Current production reads are verified; postgres runtime identity remains an inference supported by the user-accepted historical settings and source evidence. Full exposed-schema/API configuration, HTTP cross-account tests, write/scan lifecycle, and backup restoration remain unverified. Only the narrowly approved security-metadata backup exception was used. Full protected backup/export with Auth dependencies and isolated restoration remains outstanding Phase 0C work before structural/data migrations.

Recommended next roadmap step: separately authorize Phase 0C protected backup and isolated restore validation, and close remaining Phase 0B/API configuration gaps. Do not start Phase 1A or campaign/scanner migration work here.

## Files and final Git state

Created only:
- `docs/SCANLYTICS_P0_CONTAINMENT_REPORT.md` (this report, including pre-change recovery metadata).
- `prisma/migrations/20261014050000_p0_supabase_containment/migration.sql`.

SHA-256 preservation check: all 48 checked pre-existing files unchanged (tracked files plus prior docs, audits, shortUrl.ts and PID file). Generated pet-runs contents were not hashed and were not operated on. No applicable AGENTS.md was found in root or checked ancestors; no separate local P0 investigation/preflight report was available, so the attached authorization, Phase 0B artifacts and existing audits supplied the baseline. Final staged and unstaged git diff --check passed outside the sandbox; the sandbox had returned a work-tree restriction. Existing LF/CRLF notices do not indicate file changes.

Final branch: `codex/p0-supabase-containment`; HEAD remains `3c999a7af9a476911454333bede7bb7bb6a651ec`.
```text
 M prisma/schema.prisma
 M server/api/qr/create.post.ts
?? .nuxt-dev.pid
?? docs/
?? pet-runs/
?? prisma/migrations/20261014050000_p0_supabase_containment/
?? repo_audit_scanlytics.md
?? scanalytics_audit.md
?? server/utils/shortUrl.ts
```

No files staged; no commit, push or application deployment. Production database containment was applied and normally tracked in Prisma. No hotfix resolve procedure was needed. Task stops here; Phase 0C and Phase 1 were not started.

Documentation consulted: [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api), [connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres), and [Prisma hotfix reconciliation](https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing). The installed 5.22 CLI help and actual migrate deploy/status output governed execution; newer Prisma configuration syntax was not introduced. Official Supabase changelog was fetched successfully outside the network sandbox; relevant automatic Data API grants and GraphQL introspection changes do not substitute for the verified project catalogs and successful role introspection above.
