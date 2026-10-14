BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';

REVOKE ALL PRIVILEGES ON TABLE
  public."User",
  public."QRCode",
  public."ShortUrl",
  public."Analytics",
  public."_prisma_migrations"
FROM anon, authenticated;

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."QRCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ShortUrl" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Analytics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;

COMMIT;
