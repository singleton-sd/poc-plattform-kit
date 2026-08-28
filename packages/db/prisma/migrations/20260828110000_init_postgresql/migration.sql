-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(64) NOT NULL,
    "entraOid" VARCHAR(36) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "settings" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_memberships" (
    "id" VARCHAR(64) NOT NULL,
    "tenantId" VARCHAR(64) NOT NULL,
    "userId" VARCHAR(64) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_groups" (
    "id" VARCHAR(64) NOT NULL,
    "tenantId" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_group_memberships" (
    "id" VARCHAR(64) NOT NULL,
    "tenantId" VARCHAR(64) NOT NULL,
    "groupId" VARCHAR(64) NOT NULL,
    "userId" VARCHAR(64) NOT NULL,
    "syncStatus" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "syncError" VARCHAR(500),
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_invitations" (
    "id" VARCHAR(64) NOT NULL,
    "tenantId" VARCHAR(64) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "invitedByUserId" VARCHAR(64) NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "tenant_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_outbox" (
    "id" VARCHAR(64) NOT NULL,
    "eventType" VARCHAR(200) NOT NULL,
    "payload" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimId" VARCHAR(64),
    "failedAt" TIMESTAMP(3),
    "failureReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_audit" (
    "id" VARCHAR(64) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "action" VARCHAR(200) NOT NULL,
    "actorId" VARCHAR(64),
    "changes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "single_sign_on_outbox" (
    "id" VARCHAR(64) NOT NULL,
    "eventType" VARCHAR(200) NOT NULL,
    "payload" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimId" VARCHAR(64),
    "failedAt" TIMESTAMP(3),
    "failureReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "single_sign_on_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "single_sign_on_audit" (
    "id" VARCHAR(64) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "action" VARCHAR(200) NOT NULL,
    "actorId" VARCHAR(64),
    "changes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "single_sign_on_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions_outbox" (
    "id" VARCHAR(64) NOT NULL,
    "eventType" VARCHAR(200) NOT NULL,
    "payload" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimId" VARCHAR(64),
    "failedAt" TIMESTAMP(3),
    "failureReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions_audit" (
    "id" VARCHAR(64) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "action" VARCHAR(200) NOT NULL,
    "actorId" VARCHAR(64),
    "changes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_outbox" (
    "id" VARCHAR(64) NOT NULL,
    "eventType" VARCHAR(200) NOT NULL,
    "payload" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimId" VARCHAR(64),
    "failedAt" TIMESTAMP(3),
    "failureReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_audit" (
    "id" VARCHAR(64) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "action" VARCHAR(200) NOT NULL,
    "actorId" VARCHAR(64),
    "changes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_outbox" (
    "id" VARCHAR(64) NOT NULL,
    "eventType" VARCHAR(200) NOT NULL,
    "payload" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimId" VARCHAR(64),
    "failedAt" TIMESTAMP(3),
    "failureReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_audit" (
    "id" VARCHAR(64) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "action" VARCHAR(200) NOT NULL,
    "actorId" VARCHAR(64),
    "changes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" VARCHAR(64) NOT NULL,
    "tenantId" VARCHAR(64) NOT NULL,
    "requesterId" VARCHAR(64) NOT NULL,
    "requesterEntraOid" VARCHAR(36) NOT NULL,
    "action" VARCHAR(200) NOT NULL,
    "resource" VARCHAR(200) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "decidedById" VARCHAR(64),
    "decidedAt" TIMESTAMP(3),
    "denyReason" VARCHAR(500),
    "grantType" VARCHAR(50),
    "requestExpiresAt" TIMESTAMP(3),
    "grantExpiresAt" TIMESTAMP(3),
    "preferredGrantType" VARCHAR(50),
    "preferredGrantExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions_outbox" (
    "id" VARCHAR(64) NOT NULL,
    "eventType" VARCHAR(200) NOT NULL,
    "payload" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimId" VARCHAR(64),
    "failedAt" TIMESTAMP(3),
    "failureReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions_audit" (
    "id" VARCHAR(64) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "action" VARCHAR(200) NOT NULL,
    "actorId" VARCHAR(64),
    "changes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions_role_revisions" (
    "tenantId" VARCHAR(64) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_role_revisions_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "permissions_role_assignments" (
    "id" VARCHAR(64) NOT NULL,
    "tenantId" VARCHAR(64) NOT NULL,
    "principalType" VARCHAR(50) NOT NULL,
    "principalId" VARCHAR(64) NOT NULL,
    "roleId" VARCHAR(200) NOT NULL,
    "assigned" BOOLEAN NOT NULL,
    "syncStatus" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "syncError" VARCHAR(500),
    "syncedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions_role_commands" (
    "id" VARCHAR(64) NOT NULL,
    "tenantId" VARCHAR(64) NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "commandHash" VARCHAR(64) NOT NULL,
    "assignmentId" VARCHAR(64) NOT NULL,
    "consistencyVersion" VARCHAR(50) NOT NULL,
    "changed" BOOLEAN NOT NULL,
    "assigned" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_role_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications_outbox" (
    "id" VARCHAR(64) NOT NULL,
    "eventType" VARCHAR(200) NOT NULL,
    "payload" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimId" VARCHAR(64),
    "failedAt" TIMESTAMP(3),
    "failureReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_outbox" (
    "id" VARCHAR(64) NOT NULL,
    "eventType" VARCHAR(200) NOT NULL,
    "payload" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimId" VARCHAR(64),
    "failedAt" TIMESTAMP(3),
    "failureReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_audit" (
    "id" VARCHAR(64) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "action" VARCHAR(200) NOT NULL,
    "actorId" VARCHAR(64),
    "changes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_outbox" (
    "id" VARCHAR(64) NOT NULL,
    "eventType" VARCHAR(200) NOT NULL,
    "payload" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimId" VARCHAR(64),
    "failedAt" TIMESTAMP(3),
    "failureReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reporting_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_audit" (
    "id" VARCHAR(64) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "action" VARCHAR(200) NOT NULL,
    "actorId" VARCHAR(64),
    "changes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reporting_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_entraOid_key" ON "users"("entraOid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_memberships_tenantId_userId_key" ON "tenant_memberships"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "tenant_groups_tenantId_createdAt_idx" ON "tenant_groups"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_groups_tenantId_name_key" ON "tenant_groups"("tenantId", "name");

-- CreateIndex
CREATE INDEX "tenant_group_memberships_tenantId_userId_idx" ON "tenant_group_memberships"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "tenant_group_memberships_syncStatus_updatedAt_idx" ON "tenant_group_memberships"("syncStatus", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_group_memberships_groupId_userId_key" ON "tenant_group_memberships"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invitations_token_key" ON "tenant_invitations"("token");

-- CreateIndex
CREATE INDEX "tenant_invitations_tenantId_email_idx" ON "tenant_invitations"("tenantId", "email");

-- CreateIndex
CREATE INDEX "access_requests_tenantId_status_idx" ON "access_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "access_requests_requesterId_status_idx" ON "access_requests"("requesterId", "status");

-- CreateIndex
CREATE INDEX "access_requests_requesterId_action_resource_status_idx" ON "access_requests"("requesterId", "action", "resource", "status");

-- CreateIndex
CREATE INDEX "permissions_role_assignments_tenantId_assigned_syncStatus_idx" ON "permissions_role_assignments"("tenantId", "assigned", "syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_role_assignments_tenantId_principalType_princip_key" ON "permissions_role_assignments"("tenantId", "principalType", "principalId", "roleId");

-- CreateIndex
CREATE INDEX "permissions_role_commands_tenantId_createdAt_idx" ON "permissions_role_commands"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_role_commands_tenantId_idempotencyKey_key" ON "permissions_role_commands"("tenantId", "idempotencyKey");


-- Partial unique index: one pending invitation per tenant+email (see schema.prisma).
CREATE UNIQUE INDEX "tenant_invitations_pending_email_key" ON "tenant_invitations"("tenantId", "email") WHERE "status" = 'pending';
