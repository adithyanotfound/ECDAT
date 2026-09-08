-- CreateEnum
CREATE TYPE "ScanTrigger" AS ENUM ('INITIAL', 'PUSH', 'MANUAL');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'COMPLIANT');

-- CreateEnum
CREATE TYPE "CryptoKind" AS ENUM ('ALGORITHM', 'CERTIFICATE', 'KEY', 'PROTOCOL', 'LIBRARY', 'SECRET');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'MITIGATED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "Criticality" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "githubId" INTEGER NOT NULL,
    "login" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "email" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installation" (
    "id" TEXT NOT NULL,
    "githubInstallationId" INTEGER NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Installation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "githubRepoId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "language" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "scanEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dataLifetimeYears" INTEGER NOT NULL DEFAULT 5,
    "criticality" "Criticality" NOT NULL DEFAULT 'MEDIUM',
    "webhookSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rulePackIds" TEXT[],
    "includeGlobs" TEXT[],
    "excludeGlobs" TEXT[],
    "maxFileSizeKb" INTEGER NOT NULL DEFAULT 1024,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "profileId" TEXT,
    "trigger" "ScanTrigger" NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
    "commitSha" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "durationMs" INTEGER,
    "filesScanned" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanLog" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,

    CONSTRAINT "ScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoAsset" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "kind" "CryptoKind" NOT NULL,
    "name" TEXT NOT NULL,
    "primitive" TEXT,
    "algorithm" TEXT,
    "keyLengthBits" INTEGER,
    "mode" TEXT,
    "padding" TEXT,
    "curve" TEXT,
    "nistQuantumLevel" INTEGER,
    "quantumSafe" BOOLEAN,
    "executionEnvironment" TEXT,
    "classicalSecLevel" INTEGER,
    "filePath" TEXT NOT NULL,
    "lineNumber" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "ruleId" TEXT,
    "firstSeenScanId" TEXT NOT NULL,
    "lastSeenScanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "cryptoAssetId" TEXT NOT NULL,
    "crsfScore" INTEGER NOT NULL DEFAULT 0,
    "cisScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pqcSafetyScore" INTEGER NOT NULL DEFAULT 0,
    "riskCategory" TEXT NOT NULL DEFAULT 'SAFE',
    "moscaX" INTEGER NOT NULL DEFAULT 5,
    "moscaY" INTEGER NOT NULL DEFAULT 3,
    "moscaZ" INTEGER NOT NULL DEFAULT 7,
    "moscaVerdict" TEXT NOT NULL DEFAULT 'SAFE',
    "cisExplanation" TEXT,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "remediation" TEXT,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "cweId" TEXT,
    "nistRef" TEXT,
    "affectedComponent" TEXT,
    "filePath" TEXT,
    "lineNumber" INTEGER,
    "firstSeenScanId" TEXT NOT NULL,
    "lastSeenScanId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FindingAsset" (
    "findingId" TEXT NOT NULL,
    "cryptoAssetId" TEXT NOT NULL,

    CONSTRAINT "FindingAsset_pkey" PRIMARY KEY ("findingId","cryptoAssetId")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "fromAlgorithm" TEXT NOT NULL,
    "toAlgorithm" TEXT NOT NULL,
    "standard" TEXT,
    "effort" TEXT NOT NULL DEFAULT 'MEDIUM',
    "latencyImpact" TEXT,
    "sizeImpact" TEXT,
    "notes" TEXT,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cbom" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "spec" TEXT NOT NULL DEFAULT '1.6',
    "json" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cbom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "Installation_githubInstallationId_key" ON "Installation"("githubInstallationId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_githubRepoId_key" ON "Repository"("githubRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_fullName_key" ON "Repository"("fullName");

-- CreateIndex
CREATE INDEX "Repository_installationId_idx" ON "Repository"("installationId");

-- CreateIndex
CREATE INDEX "Repository_fullName_idx" ON "Repository"("fullName");

-- CreateIndex
CREATE INDEX "Scan_repositoryId_idx" ON "Scan"("repositoryId");

-- CreateIndex
CREATE INDEX "Scan_status_idx" ON "Scan"("status");

-- CreateIndex
CREATE INDEX "Scan_startedAt_idx" ON "Scan"("startedAt");

-- CreateIndex
CREATE INDEX "ScanLog_scanId_ts_idx" ON "ScanLog"("scanId", "ts");

-- CreateIndex
CREATE INDEX "CryptoAsset_repositoryId_kind_idx" ON "CryptoAsset"("repositoryId", "kind");

-- CreateIndex
CREATE INDEX "CryptoAsset_repositoryId_quantumSafe_idx" ON "CryptoAsset"("repositoryId", "quantumSafe");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoAsset_repositoryId_fingerprint_key" ON "CryptoAsset"("repositoryId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_cryptoAssetId_key" ON "RiskAssessment"("cryptoAssetId");

-- CreateIndex
CREATE INDEX "Finding_repositoryId_severity_idx" ON "Finding"("repositoryId", "severity");

-- CreateIndex
CREATE INDEX "Finding_repositoryId_status_idx" ON "Finding"("repositoryId", "status");

-- CreateIndex
CREATE INDEX "Finding_code_idx" ON "Finding"("code");

-- CreateIndex
CREATE INDEX "Recommendation_repositoryId_idx" ON "Recommendation"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Cbom_scanId_key" ON "Cbom"("scanId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_deliveryId_key" ON "WebhookDelivery"("deliveryId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_deliveryId_idx" ON "WebhookDelivery"("deliveryId");

-- CreateIndex
CREATE INDEX "Job_status_runAfter_idx" ON "Job"("status", "runAfter");

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ScanProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoAsset" ADD CONSTRAINT "CryptoAsset_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoAsset" ADD CONSTRAINT "CryptoAsset_firstSeenScanId_fkey" FOREIGN KEY ("firstSeenScanId") REFERENCES "Scan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoAsset" ADD CONSTRAINT "CryptoAsset_lastSeenScanId_fkey" FOREIGN KEY ("lastSeenScanId") REFERENCES "Scan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_cryptoAssetId_fkey" FOREIGN KEY ("cryptoAssetId") REFERENCES "CryptoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_firstSeenScanId_fkey" FOREIGN KEY ("firstSeenScanId") REFERENCES "Scan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_lastSeenScanId_fkey" FOREIGN KEY ("lastSeenScanId") REFERENCES "Scan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingAsset" ADD CONSTRAINT "FindingAsset_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingAsset" ADD CONSTRAINT "FindingAsset_cryptoAssetId_fkey" FOREIGN KEY ("cryptoAssetId") REFERENCES "CryptoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cbom" ADD CONSTRAINT "Cbom_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
