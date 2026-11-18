-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "username" TEXT,
    "displayUsername" TEXT,
    "role" TEXT NOT NULL DEFAULT 'AUDITOR',
    "facilityId" TEXT,
    "unitId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "user_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "user_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Counter" (
    "facilityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    PRIMARY KEY ("facilityId", "kind"),
    CONSTRAINT "Counter_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Unit_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SetTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shelfLifeDays" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "SetTemplate_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SetComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setTemplateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "SetComponent_setTemplateId_fkey" FOREIGN KEY ("setTemplateId") REFERENCES "SetTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonitoringPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "requirePhysical" BOOLEAN NOT NULL,
    "requireChemical" BOOLEAN NOT NULL,
    "requireBiological" BOOLEAN NOT NULL,
    "reference" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonitoringPolicy_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tray" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "setTemplateId" TEXT NOT NULL,
    "homeUnitId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Tray_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Tray_setTemplateId_fkey" FOREIGN KEY ("setTemplateId") REFERENCES "SetTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Tray_homeUnitId_fkey" FOREIGN KEY ("homeUnitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Device_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Location_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnitRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "setTemplateId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "fulfilled" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL,
    "neededBy" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "requestedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "UnitRequest_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UnitRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UnitRequest_setTemplateId_fkey" FOREIGN KEY ("setTemplateId") REFERENCES "SetTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReprocessingCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "trayId" TEXT NOT NULL,
    "originUnitId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "expectedCount" INTEGER NOT NULL,
    "actualCount" INTEGER NOT NULL,
    "conditionNote" TEXT,
    "receivedBy" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "backdateReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ReprocessingCase_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReprocessingCase_trayId_fkey" FOREIGN KEY ("trayId") REFERENCES "Tray" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReprocessingCase_originUnitId_fkey" FOREIGN KEY ("originUnitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CleaningRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CleaningRun_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReprocessingCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "actualCount" INTEGER NOT NULL,
    "note" TEXT,
    "actorId" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Inspection_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReprocessingCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT NOT NULL,
    "componentId" TEXT,
    "name" TEXT NOT NULL,
    "expected" INTEGER NOT NULL,
    "actual" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "InspectionLine_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InspectionLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SetComponent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Load" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "setTemplateId" TEXT NOT NULL,
    "originUnitId" TEXT NOT NULL,
    "setCount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "processStatus" TEXT NOT NULL,
    "qualityStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "queueStatus" TEXT NOT NULL,
    "startedAt" DATETIME,
    "targetAt" DATETIME,
    "note" TEXT,
    "synthetic" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deviceId" TEXT,
    "startedBy" TEXT,
    "completedAt" DATETIME,
    "releasedAt" DATETIME,
    "policyRef" TEXT,
    CONSTRAINT "Load_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Load_setTemplateId_fkey" FOREIGN KEY ("setTemplateId") REFERENCES "SetTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Load_originUnitId_fkey" FOREIGN KEY ("originUnitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Load_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "loadId" TEXT,
    "caseId" TEXT,
    "trayId" TEXT,
    "setTemplateId" TEXT,
    "originUnitId" TEXT,
    "materialLot" TEXT,
    "qualityStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "position" TEXT NOT NULL DEFAULT 'CSSD',
    "locationId" TEXT,
    "destinationUnitId" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Package_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Package_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Package_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReprocessingCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Package_trayId_fkey" FOREIGN KEY ("trayId") REFERENCES "Tray" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Package_setTemplateId_fkey" FOREIGN KEY ("setTemplateId") REFERENCES "SetTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Package_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Package_destinationUnitId_fkey" FOREIGN KEY ("destinationUnitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loadId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StageEvent_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonitoringResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loadId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "source" TEXT,
    "requiredBy" TEXT,
    "observedAt" DATETIME,
    "recordedBy" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "backdateReason" TEXT,
    CONSTRAINT "MonitoringResult_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QualityDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loadId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QualityDecision_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Handover" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "destinationUnitId" TEXT NOT NULL,
    "requestId" TEXT,
    "dispatchedBy" TEXT NOT NULL,
    "dispatchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "Handover_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Handover_destinationUnitId_fkey" FOREIGN KEY ("destinationUnitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Handover_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "UnitRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HandoverLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handoverId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "ackBy" TEXT,
    "ackAt" DATETIME,
    CONSTRAINT "HandoverLine_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "Handover" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HandoverLine_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedBy" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capa" TEXT,
    "closedBy" TEXT,
    "closedAt" DATETIME,
    CONSTRAINT "Recall_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Recall_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecallItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recallId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "positionAtOpen" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDENTIFIED',
    "note" TEXT,
    "updatedBy" TEXT,
    "updatedAt" DATETIME,
    CONSTRAINT "RecallItem_recallId_fkey" FOREIGN KEY ("recallId") REFERENCES "Recall" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecallItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL DEFAULT '',
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityCode" TEXT NOT NULL,
    "related" TEXT NOT NULL,
    "detail" TEXT,
    CONSTRAINT "AuditEvent_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Facility_code_key" ON "Facility"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_facilityId_code_key" ON "Unit"("facilityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SetTemplate_facilityId_code_key" ON "SetTemplate"("facilityId", "code");

-- CreateIndex
CREATE INDEX "SetComponent_setTemplateId_sortOrder_idx" ON "SetComponent"("setTemplateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoringPolicy_facilityId_method_key" ON "MonitoringPolicy"("facilityId", "method");

-- CreateIndex
CREATE UNIQUE INDEX "Tray_facilityId_code_key" ON "Tray"("facilityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Device_facilityId_code_key" ON "Device"("facilityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Location_facilityId_code_key" ON "Location"("facilityId", "code");

-- CreateIndex
CREATE INDEX "UnitRequest_facilityId_status_neededBy_idx" ON "UnitRequest"("facilityId", "status", "neededBy");

-- CreateIndex
CREATE UNIQUE INDEX "UnitRequest_facilityId_code_key" ON "UnitRequest"("facilityId", "code");

-- CreateIndex
CREATE INDEX "ReprocessingCase_facilityId_status_idx" ON "ReprocessingCase"("facilityId", "status");

-- CreateIndex
CREATE INDEX "ReprocessingCase_trayId_status_idx" ON "ReprocessingCase"("trayId", "status");

-- CreateIndex
CREATE INDEX "ReprocessingCase_facilityId_receivedAt_idx" ON "ReprocessingCase"("facilityId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReprocessingCase_facilityId_code_key" ON "ReprocessingCase"("facilityId", "code");

-- CreateIndex
CREATE INDEX "CleaningRun_caseId_idx" ON "CleaningRun"("caseId");

-- CreateIndex
CREATE INDEX "CleaningRun_occurredAt_idx" ON "CleaningRun"("occurredAt");

-- CreateIndex
CREATE INDEX "Inspection_caseId_idx" ON "Inspection"("caseId");

-- CreateIndex
CREATE INDEX "Inspection_occurredAt_idx" ON "Inspection"("occurredAt");

-- CreateIndex
CREATE INDEX "InspectionLine_inspectionId_idx" ON "InspectionLine"("inspectionId");

-- CreateIndex
CREATE INDEX "Load_facilityId_queueStatus_startedAt_idx" ON "Load"("facilityId", "queueStatus", "startedAt");

-- CreateIndex
CREATE INDEX "Load_facilityId_originUnitId_queueStatus_idx" ON "Load"("facilityId", "originUnitId", "queueStatus");

-- CreateIndex
CREATE INDEX "Load_facilityId_releasedAt_idx" ON "Load"("facilityId", "releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Load_facilityId_code_key" ON "Load"("facilityId", "code");

-- CreateIndex
CREATE INDEX "Package_loadId_idx" ON "Package"("loadId");

-- CreateIndex
CREATE INDEX "Package_facilityId_position_qualityStatus_idx" ON "Package"("facilityId", "position", "qualityStatus");

-- CreateIndex
CREATE INDEX "Package_facilityId_expiresAt_idx" ON "Package"("facilityId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Package_facilityId_code_key" ON "Package"("facilityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "StageEvent_loadId_stage_key" ON "StageEvent"("loadId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoringResult_loadId_kind_key" ON "MonitoringResult"("loadId", "kind");

-- CreateIndex
CREATE INDEX "QualityDecision_loadId_decidedAt_idx" ON "QualityDecision"("loadId", "decidedAt");

-- CreateIndex
CREATE INDEX "Handover_destinationUnitId_completedAt_idx" ON "Handover"("destinationUnitId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Handover_facilityId_code_key" ON "Handover"("facilityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "HandoverLine_handoverId_packageId_key" ON "HandoverLine"("handoverId", "packageId");

-- CreateIndex
CREATE INDEX "Recall_loadId_status_idx" ON "Recall"("loadId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Recall_facilityId_code_key" ON "Recall"("facilityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RecallItem_recallId_packageId_key" ON "RecallItem"("recallId", "packageId");

-- CreateIndex
CREATE INDEX "AuditEvent_facilityId_occurredAt_idx" ON "AuditEvent"("facilityId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_facilityId_actorId_occurredAt_idx" ON "AuditEvent"("facilityId", "actorId", "occurredAt");
