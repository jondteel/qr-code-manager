BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
-- CreateTable
CREATE TABLE "RecoverySubject" (
    "environment" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "version" INTEGER,
    "purpose" TEXT,
    "selector" TEXT,
    "email" TEXT,
    "recipientId" TEXT,
    "keyId" TEXT,
    "secretDigest" TEXT,
    "proofMac" TEXT,
    "issuedAtMs" BIGINT,
    "expiresAtMs" BIGINT,
    "operationId" TEXT,
    "terminalAtMs" BIGINT,

    CONSTRAINT "RecoverySubject_pkey" PRIMARY KEY ("environment","project","subject")
);

-- CreateTable
CREATE TABLE "RecoveryAdmission" (
    "environment" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "subject" TEXT,
    "state" TEXT NOT NULL,
    "operationId" TEXT,
    "issuedAtMs" BIGINT,

    CONSTRAINT "RecoveryAdmission_pkey" PRIMARY KEY ("environment","project","recipientId")
);

-- CreateTable
CREATE TABLE "RecoveryBudget" (
    "environment" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "windowMs" BIGINT NOT NULL,
    "attempts" INTEGER NOT NULL,

    CONSTRAINT "RecoveryBudget_pkey" PRIMARY KEY ("environment","project","scope","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecoverySubject_selector_key" ON "RecoverySubject"("selector");

-- CreateIndex
CREATE UNIQUE INDEX "RecoverySubject_operationId_key" ON "RecoverySubject"("operationId");

-- CreateIndex
CREATE INDEX "RecoverySubject_state_expiresAtMs_idx" ON "RecoverySubject"("state", "expiresAtMs");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryAdmission_operationId_key" ON "RecoveryAdmission"("operationId");

-- CreateIndex
CREATE INDEX "RecoveryAdmission_state_issuedAtMs_idx" ON "RecoveryAdmission"("state", "issuedAtMs");

-- CreateIndex
CREATE INDEX "RecoveryBudget_windowMs_idx" ON "RecoveryBudget"("windowMs");


-- Private server-owned tables. No browser policies or managed Auth writes.
ALTER TABLE public."RecoverySubject" ADD CONSTRAINT "RecoverySubject_state_check"
  CHECK (state IN ('empty','issuing','pending','processing','consumed','refused','outcome_unknown','expired'));
ALTER TABLE public."RecoverySubject" ADD CONSTRAINT "RecoverySubject_generation_check" CHECK (generation >= 0);
ALTER TABLE public."RecoverySubject" ADD CONSTRAINT "RecoverySubject_material_check" CHECK (
  state NOT IN ('pending','processing','consumed','refused') OR
  (version IS NOT NULL AND version=1 AND purpose IS NOT NULL AND purpose='password-recovery'
   AND selector IS NOT NULL AND email IS NOT NULL AND "recipientId" IS NOT NULL AND "keyId" IS NOT NULL
   AND "secretDigest" IS NOT NULL AND "secretDigest" ~ '^[a-f0-9]{64}$'
   AND "proofMac" IS NOT NULL AND "proofMac" ~ '^[a-f0-9]{64}$'
   AND "issuedAtMs" IS NOT NULL AND "expiresAtMs" IS NOT NULL AND "expiresAtMs">"issuedAtMs"
   AND "expiresAtMs"-"issuedAtMs"<=600000 AND generation>0));
ALTER TABLE public."RecoverySubject" ADD CONSTRAINT "RecoverySubject_processing_check" CHECK (state<>'processing' OR "operationId" IS NOT NULL);
ALTER TABLE public."RecoveryAdmission" ADD CONSTRAINT "RecoveryAdmission_state_check" CHECK (state IN ('ready','issuing','outcome_unknown'));
ALTER TABLE public."RecoveryAdmission" ADD CONSTRAINT "RecoveryAdmission_fence_check" CHECK (state='ready' OR ("operationId" IS NOT NULL AND "issuedAtMs" IS NOT NULL));
ALTER TABLE public."RecoveryBudget" ADD CONSTRAINT "RecoveryBudget_attempts_check" CHECK (attempts>0 AND attempts<=100001);
REVOKE ALL PRIVILEGES ON TABLE public."RecoverySubject", public."RecoveryAdmission", public."RecoveryBudget" FROM PUBLIC;
-- Fail if the Supabase roles are absent: target review is required, never silently skip containment.
REVOKE ALL PRIVILEGES ON TABLE public."RecoverySubject", public."RecoveryAdmission", public."RecoveryBudget" FROM anon, authenticated;
ALTER TABLE public."RecoverySubject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RecoveryAdmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RecoveryBudget" ENABLE ROW LEVEL SECURITY;
COMMIT;
