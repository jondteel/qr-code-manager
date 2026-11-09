-- Additive expansion: existing identities, links, provenance and history are retained.
CREATE TYPE "QRLifecycleStatus" AS ENUM ('active', 'archived', 'retired');
ALTER TABLE "QRCode" ADD COLUMN "lifecycleStatus" "QRLifecycleStatus" NOT NULL DEFAULT 'active';
