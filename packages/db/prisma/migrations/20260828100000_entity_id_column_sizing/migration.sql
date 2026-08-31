BEGIN TRY

BEGIN TRAN;

-- Preflight: documented limits in docs/db-practices.md / ADR 0005.
-- Full report: packages/db/scripts/preflight-entity-id-column-sizing.sql
-- SQL Server blocks narrowing NVARCHAR columns that participate in PK/unique/index
-- definitions; drop and recreate those objects around the ALTER COLUMN batch.
IF EXISTS (
  SELECT 1
  FROM (
    SELECT 1 AS issue WHERE 1 = 0
    UNION ALL SELECT 1 FROM [dbo].[access_requests] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([tenantId]) > 128 OR DATALENGTH([requesterId]) > 128 OR DATALENGTH([requesterEntraOid]) > 72 OR DATALENGTH([action]) > 400 OR DATALENGTH([resource]) > 400 OR DATALENGTH([status]) > 100 OR DATALENGTH([decidedById]) > 128 OR DATALENGTH([denyReason]) > 1000 OR DATALENGTH([grantType]) > 100 OR DATALENGTH([preferredGrantType]) > 100
    UNION ALL SELECT 1 FROM [dbo].[audit_audit] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([entityType]) > 200 OR DATALENGTH([entityId]) > 128 OR DATALENGTH([action]) > 400 OR DATALENGTH([actorId]) > 128
    UNION ALL SELECT 1 FROM [dbo].[audit_outbox] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([eventType]) > 400 OR DATALENGTH([claimId]) > 128 OR DATALENGTH([failureReason]) > 1000
    UNION ALL SELECT 1 FROM [dbo].[contact_audit] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([entityType]) > 200 OR DATALENGTH([entityId]) > 128 OR DATALENGTH([action]) > 400 OR DATALENGTH([actorId]) > 128
    UNION ALL SELECT 1 FROM [dbo].[contact_outbox] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([eventType]) > 400 OR DATALENGTH([claimId]) > 128 OR DATALENGTH([failureReason]) > 1000
    UNION ALL SELECT 1 FROM [dbo].[notifications_outbox] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([eventType]) > 400 OR DATALENGTH([claimId]) > 128 OR DATALENGTH([failureReason]) > 1000
    UNION ALL SELECT 1 FROM [dbo].[permissions_audit] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([entityType]) > 200 OR DATALENGTH([entityId]) > 128 OR DATALENGTH([action]) > 400 OR DATALENGTH([actorId]) > 128
    UNION ALL SELECT 1 FROM [dbo].[permissions_outbox] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([eventType]) > 400 OR DATALENGTH([claimId]) > 128 OR DATALENGTH([failureReason]) > 1000
    UNION ALL SELECT 1 FROM [dbo].[permissions_role_assignments] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([tenantId]) > 128 OR DATALENGTH([principalType]) > 100 OR DATALENGTH([principalId]) > 128 OR DATALENGTH([roleId]) > 400 OR DATALENGTH([syncStatus]) > 100 OR DATALENGTH([syncError]) > 1000
    UNION ALL SELECT 1 FROM [dbo].[permissions_role_commands] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([tenantId]) > 128 OR DATALENGTH([idempotencyKey]) > 400 OR DATALENGTH([commandHash]) > 128 OR DATALENGTH([assignmentId]) > 128 OR DATALENGTH([consistencyVersion]) > 100
    UNION ALL SELECT 1 FROM [dbo].[permissions_role_revisions] WHERE DATALENGTH([tenantId]) > 128
    UNION ALL SELECT 1 FROM [dbo].[reporting_audit] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([entityType]) > 200 OR DATALENGTH([entityId]) > 128 OR DATALENGTH([action]) > 400 OR DATALENGTH([actorId]) > 128
    UNION ALL SELECT 1 FROM [dbo].[reporting_outbox] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([eventType]) > 400 OR DATALENGTH([claimId]) > 128 OR DATALENGTH([failureReason]) > 1000
    UNION ALL SELECT 1 FROM [dbo].[single_sign_on_audit] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([entityType]) > 200 OR DATALENGTH([entityId]) > 128 OR DATALENGTH([action]) > 400 OR DATALENGTH([actorId]) > 128
    UNION ALL SELECT 1 FROM [dbo].[single_sign_on_outbox] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([eventType]) > 400 OR DATALENGTH([claimId]) > 128 OR DATALENGTH([failureReason]) > 1000
    UNION ALL SELECT 1 FROM [dbo].[subscriptions_audit] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([entityType]) > 200 OR DATALENGTH([entityId]) > 128 OR DATALENGTH([action]) > 400 OR DATALENGTH([actorId]) > 128
    UNION ALL SELECT 1 FROM [dbo].[subscriptions_outbox] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([eventType]) > 400 OR DATALENGTH([claimId]) > 128 OR DATALENGTH([failureReason]) > 1000
    UNION ALL SELECT 1 FROM [dbo].[support_audit] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([entityType]) > 200 OR DATALENGTH([entityId]) > 128 OR DATALENGTH([action]) > 400 OR DATALENGTH([actorId]) > 128
    UNION ALL SELECT 1 FROM [dbo].[support_outbox] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([eventType]) > 400 OR DATALENGTH([claimId]) > 128 OR DATALENGTH([failureReason]) > 1000
    UNION ALL SELECT 1 FROM [dbo].[tenant_audit] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([entityType]) > 200 OR DATALENGTH([entityId]) > 128 OR DATALENGTH([action]) > 400 OR DATALENGTH([actorId]) > 128
    UNION ALL SELECT 1 FROM [dbo].[tenant_group_memberships] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([tenantId]) > 128 OR DATALENGTH([groupId]) > 128 OR DATALENGTH([userId]) > 128 OR DATALENGTH([syncStatus]) > 100 OR DATALENGTH([syncError]) > 1000
    UNION ALL SELECT 1 FROM [dbo].[tenant_groups] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([tenantId]) > 128 OR DATALENGTH([name]) > 400 OR DATALENGTH([description]) > 1000
    UNION ALL SELECT 1 FROM [dbo].[tenant_invitations] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([tenantId]) > 128 OR DATALENGTH([email]) > 640 OR DATALENGTH([role]) > 100 OR DATALENGTH([invitedByUserId]) > 128 OR DATALENGTH([token]) > 128 OR DATALENGTH([status]) > 100
    UNION ALL SELECT 1 FROM [dbo].[tenant_memberships] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([tenantId]) > 128 OR DATALENGTH([userId]) > 128 OR DATALENGTH([role]) > 100
    UNION ALL SELECT 1 FROM [dbo].[tenant_outbox] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([eventType]) > 400 OR DATALENGTH([claimId]) > 128 OR DATALENGTH([failureReason]) > 1000
    UNION ALL SELECT 1 FROM [dbo].[tenants] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([name]) > 400 OR DATALENGTH([slug]) > 200
    UNION ALL SELECT 1 FROM [dbo].[users] WHERE DATALENGTH([id]) > 128 OR DATALENGTH([entraOid]) > 72 OR DATALENGTH([email]) > 640 OR DATALENGTH([name]) > 400
  ) AS preflight_issues
)
BEGIN
  THROW 51000, 'entity_id_column_sizing preflight failed — run packages/db/scripts/preflight-entity-id-column-sizing.sql', 1;
END;

-- Drop dependent unique indexes and nonclustered indexes before narrowing NVARCHAR columns.
DROP INDEX [users_entraOid_key] ON [dbo].[users];
DROP INDEX [users_email_key] ON [dbo].[users];
DROP INDEX [tenants_slug_key] ON [dbo].[tenants];
DROP INDEX [tenant_invitations_pending_email_key] ON [dbo].[tenant_invitations];
ALTER TABLE [dbo].[tenant_memberships] DROP CONSTRAINT [tenant_memberships_tenantId_userId_key];
ALTER TABLE [dbo].[tenant_invitations] DROP CONSTRAINT [tenant_invitations_token_key];
ALTER TABLE [dbo].[tenant_groups] DROP CONSTRAINT [tenant_groups_tenantId_name_key];
ALTER TABLE [dbo].[tenant_group_memberships] DROP CONSTRAINT [tenant_group_memberships_groupId_userId_key];
ALTER TABLE [dbo].[permissions_role_assignments] DROP CONSTRAINT [permissions_role_assignments_tenant_principal_role_key];
ALTER TABLE [dbo].[permissions_role_commands] DROP CONSTRAINT [permissions_role_commands_tenant_key_key];
DROP INDEX [access_requests_tenantId_status_idx] ON [dbo].[access_requests];
DROP INDEX [access_requests_requesterId_status_idx] ON [dbo].[access_requests];
DROP INDEX [access_requests_requesterId_action_resource_status_idx] ON [dbo].[access_requests];
DROP INDEX [tenant_invitations_tenantId_email_idx] ON [dbo].[tenant_invitations];
DROP INDEX [tenant_groups_tenantId_createdAt_idx] ON [dbo].[tenant_groups];
DROP INDEX [tenant_group_memberships_tenantId_userId_idx] ON [dbo].[tenant_group_memberships];
DROP INDEX [tenant_group_memberships_syncStatus_updatedAt_idx] ON [dbo].[tenant_group_memberships];
DROP INDEX [permissions_role_assignments_tenant_state_idx] ON [permissions_role_assignments];
DROP INDEX [permissions_role_commands_tenant_created_idx] ON [permissions_role_commands];
-- Drop primary keys before narrowing clustered key columns.
ALTER TABLE [dbo].[access_requests] DROP CONSTRAINT [access_requests_pkey];
ALTER TABLE [dbo].[audit_audit] DROP CONSTRAINT [audit_audit_pkey];
ALTER TABLE [dbo].[audit_outbox] DROP CONSTRAINT [audit_outbox_pkey];
ALTER TABLE [dbo].[contact_audit] DROP CONSTRAINT [contact_audit_pkey];
ALTER TABLE [dbo].[contact_outbox] DROP CONSTRAINT [contact_outbox_pkey];
ALTER TABLE [dbo].[notifications_outbox] DROP CONSTRAINT [notifications_outbox_pkey];
ALTER TABLE [dbo].[permissions_audit] DROP CONSTRAINT [permissions_audit_pkey];
ALTER TABLE [dbo].[permissions_outbox] DROP CONSTRAINT [permissions_outbox_pkey];
ALTER TABLE [dbo].[permissions_role_assignments] DROP CONSTRAINT [permissions_role_assignments_pkey];
ALTER TABLE [dbo].[permissions_role_commands] DROP CONSTRAINT [permissions_role_commands_pkey];
ALTER TABLE [dbo].[permissions_role_revisions] DROP CONSTRAINT [permissions_role_revisions_pkey];
ALTER TABLE [dbo].[reporting_audit] DROP CONSTRAINT [reporting_audit_pkey];
ALTER TABLE [dbo].[reporting_outbox] DROP CONSTRAINT [reporting_outbox_pkey];
ALTER TABLE [dbo].[single_sign_on_audit] DROP CONSTRAINT [single_sign_on_audit_pkey];
ALTER TABLE [dbo].[single_sign_on_outbox] DROP CONSTRAINT [single_sign_on_outbox_pkey];
ALTER TABLE [dbo].[subscriptions_audit] DROP CONSTRAINT [subscriptions_audit_pkey];
ALTER TABLE [dbo].[subscriptions_outbox] DROP CONSTRAINT [subscriptions_outbox_pkey];
ALTER TABLE [dbo].[support_audit] DROP CONSTRAINT [support_audit_pkey];
ALTER TABLE [dbo].[support_outbox] DROP CONSTRAINT [support_outbox_pkey];
ALTER TABLE [dbo].[tenant_audit] DROP CONSTRAINT [tenant_audit_pkey];
ALTER TABLE [dbo].[tenant_group_memberships] DROP CONSTRAINT [tenant_group_memberships_pkey];
ALTER TABLE [dbo].[tenant_groups] DROP CONSTRAINT [tenant_groups_pkey];
ALTER TABLE [dbo].[tenant_invitations] DROP CONSTRAINT [tenant_invitations_pkey];
ALTER TABLE [dbo].[tenant_memberships] DROP CONSTRAINT [tenant_memberships_pkey];
ALTER TABLE [dbo].[tenant_outbox] DROP CONSTRAINT [tenant_outbox_pkey];
ALTER TABLE [dbo].[tenants] DROP CONSTRAINT [tenants_pkey];
ALTER TABLE [dbo].[users] DROP CONSTRAINT [users_pkey];

ALTER TABLE [dbo].[users] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[users] ALTER COLUMN [entraOid] NVARCHAR(36) NOT NULL;
ALTER TABLE [dbo].[users] ALTER COLUMN [email] NVARCHAR(320) NOT NULL;
ALTER TABLE [dbo].[users] ALTER COLUMN [name] NVARCHAR(200) NULL;
ALTER TABLE [dbo].[tenants] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenants] ALTER COLUMN [name] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[tenants] ALTER COLUMN [slug] NVARCHAR(100) NOT NULL;
ALTER TABLE [dbo].[tenant_memberships] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_memberships] ALTER COLUMN [tenantId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_memberships] ALTER COLUMN [userId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_memberships] ALTER COLUMN [role] NVARCHAR(50) NOT NULL;
ALTER TABLE [dbo].[tenant_groups] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_groups] ALTER COLUMN [tenantId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_groups] ALTER COLUMN [name] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[tenant_groups] ALTER COLUMN [description] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[tenant_group_memberships] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_group_memberships] ALTER COLUMN [tenantId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_group_memberships] ALTER COLUMN [groupId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_group_memberships] ALTER COLUMN [userId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_group_memberships] ALTER COLUMN [syncStatus] NVARCHAR(50) NOT NULL;
ALTER TABLE [dbo].[tenant_group_memberships] ALTER COLUMN [syncError] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[tenant_invitations] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_invitations] ALTER COLUMN [tenantId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_invitations] ALTER COLUMN [email] NVARCHAR(320) NOT NULL;
ALTER TABLE [dbo].[tenant_invitations] ALTER COLUMN [role] NVARCHAR(50) NOT NULL;
ALTER TABLE [dbo].[tenant_invitations] ALTER COLUMN [invitedByUserId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_invitations] ALTER COLUMN [token] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_invitations] ALTER COLUMN [status] NVARCHAR(50) NOT NULL;
ALTER TABLE [dbo].[tenant_outbox] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_outbox] ALTER COLUMN [eventType] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[tenant_outbox] ALTER COLUMN [claimId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[tenant_outbox] ALTER COLUMN [failureReason] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[tenant_audit] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_audit] ALTER COLUMN [entityType] NVARCHAR(100) NOT NULL;
ALTER TABLE [dbo].[tenant_audit] ALTER COLUMN [entityId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[tenant_audit] ALTER COLUMN [action] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[tenant_audit] ALTER COLUMN [actorId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[single_sign_on_outbox] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[single_sign_on_outbox] ALTER COLUMN [eventType] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[single_sign_on_outbox] ALTER COLUMN [claimId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[single_sign_on_outbox] ALTER COLUMN [failureReason] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[single_sign_on_audit] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[single_sign_on_audit] ALTER COLUMN [entityType] NVARCHAR(100) NOT NULL;
ALTER TABLE [dbo].[single_sign_on_audit] ALTER COLUMN [entityId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[single_sign_on_audit] ALTER COLUMN [action] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[single_sign_on_audit] ALTER COLUMN [actorId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[subscriptions_outbox] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[subscriptions_outbox] ALTER COLUMN [eventType] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[subscriptions_outbox] ALTER COLUMN [claimId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[subscriptions_outbox] ALTER COLUMN [failureReason] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[subscriptions_audit] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[subscriptions_audit] ALTER COLUMN [entityType] NVARCHAR(100) NOT NULL;
ALTER TABLE [dbo].[subscriptions_audit] ALTER COLUMN [entityId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[subscriptions_audit] ALTER COLUMN [action] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[subscriptions_audit] ALTER COLUMN [actorId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[contact_outbox] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[contact_outbox] ALTER COLUMN [eventType] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[contact_outbox] ALTER COLUMN [claimId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[contact_outbox] ALTER COLUMN [failureReason] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[contact_audit] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[contact_audit] ALTER COLUMN [entityType] NVARCHAR(100) NOT NULL;
ALTER TABLE [dbo].[contact_audit] ALTER COLUMN [entityId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[contact_audit] ALTER COLUMN [action] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[contact_audit] ALTER COLUMN [actorId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[support_outbox] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[support_outbox] ALTER COLUMN [eventType] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[support_outbox] ALTER COLUMN [claimId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[support_outbox] ALTER COLUMN [failureReason] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[support_audit] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[support_audit] ALTER COLUMN [entityType] NVARCHAR(100) NOT NULL;
ALTER TABLE [dbo].[support_audit] ALTER COLUMN [entityId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[support_audit] ALTER COLUMN [action] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[support_audit] ALTER COLUMN [actorId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[access_requests] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[access_requests] ALTER COLUMN [tenantId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[access_requests] ALTER COLUMN [requesterId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[access_requests] ALTER COLUMN [requesterEntraOid] NVARCHAR(36) NOT NULL;
ALTER TABLE [dbo].[access_requests] ALTER COLUMN [action] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[access_requests] ALTER COLUMN [resource] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[access_requests] ALTER COLUMN [status] NVARCHAR(50) NOT NULL;
ALTER TABLE [dbo].[access_requests] ALTER COLUMN [decidedById] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[access_requests] ALTER COLUMN [denyReason] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[access_requests] ALTER COLUMN [grantType] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[access_requests] ALTER COLUMN [preferredGrantType] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[permissions_outbox] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[permissions_outbox] ALTER COLUMN [eventType] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[permissions_outbox] ALTER COLUMN [claimId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[permissions_outbox] ALTER COLUMN [failureReason] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[permissions_audit] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[permissions_audit] ALTER COLUMN [entityType] NVARCHAR(100) NOT NULL;
ALTER TABLE [dbo].[permissions_audit] ALTER COLUMN [entityId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[permissions_audit] ALTER COLUMN [action] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[permissions_audit] ALTER COLUMN [actorId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[permissions_role_revisions] ALTER COLUMN [tenantId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[permissions_role_assignments] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[permissions_role_assignments] ALTER COLUMN [tenantId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[permissions_role_assignments] ALTER COLUMN [principalType] NVARCHAR(50) NOT NULL;
ALTER TABLE [dbo].[permissions_role_assignments] ALTER COLUMN [principalId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[permissions_role_assignments] ALTER COLUMN [roleId] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[permissions_role_assignments] ALTER COLUMN [syncStatus] NVARCHAR(50) NOT NULL;
ALTER TABLE [dbo].[permissions_role_assignments] ALTER COLUMN [syncError] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[permissions_role_commands] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[permissions_role_commands] ALTER COLUMN [tenantId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[permissions_role_commands] ALTER COLUMN [idempotencyKey] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[permissions_role_commands] ALTER COLUMN [commandHash] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[permissions_role_commands] ALTER COLUMN [assignmentId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[permissions_role_commands] ALTER COLUMN [consistencyVersion] NVARCHAR(50) NOT NULL;
ALTER TABLE [dbo].[notifications_outbox] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[notifications_outbox] ALTER COLUMN [eventType] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[notifications_outbox] ALTER COLUMN [claimId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[notifications_outbox] ALTER COLUMN [failureReason] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[audit_outbox] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[audit_outbox] ALTER COLUMN [eventType] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[audit_outbox] ALTER COLUMN [claimId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[audit_outbox] ALTER COLUMN [failureReason] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[audit_audit] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[audit_audit] ALTER COLUMN [entityType] NVARCHAR(100) NOT NULL;
ALTER TABLE [dbo].[audit_audit] ALTER COLUMN [entityId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[audit_audit] ALTER COLUMN [action] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[audit_audit] ALTER COLUMN [actorId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[reporting_outbox] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[reporting_outbox] ALTER COLUMN [eventType] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[reporting_outbox] ALTER COLUMN [claimId] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[reporting_outbox] ALTER COLUMN [failureReason] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[reporting_audit] ALTER COLUMN [id] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[reporting_audit] ALTER COLUMN [entityType] NVARCHAR(100) NOT NULL;
ALTER TABLE [dbo].[reporting_audit] ALTER COLUMN [entityId] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[reporting_audit] ALTER COLUMN [action] NVARCHAR(200) NOT NULL;
ALTER TABLE [dbo].[reporting_audit] ALTER COLUMN [actorId] NVARCHAR(64) NULL;

-- Recreate primary keys after column narrows.
ALTER TABLE [dbo].[access_requests] ADD CONSTRAINT [access_requests_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[audit_audit] ADD CONSTRAINT [audit_audit_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[audit_outbox] ADD CONSTRAINT [audit_outbox_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[contact_audit] ADD CONSTRAINT [contact_audit_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[contact_outbox] ADD CONSTRAINT [contact_outbox_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[notifications_outbox] ADD CONSTRAINT [notifications_outbox_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[permissions_audit] ADD CONSTRAINT [permissions_audit_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[permissions_outbox] ADD CONSTRAINT [permissions_outbox_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[permissions_role_assignments] ADD CONSTRAINT [permissions_role_assignments_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[permissions_role_commands] ADD CONSTRAINT [permissions_role_commands_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[permissions_role_revisions] ADD CONSTRAINT [permissions_role_revisions_pkey] PRIMARY KEY CLUSTERED ([tenantId]);
ALTER TABLE [dbo].[reporting_audit] ADD CONSTRAINT [reporting_audit_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[reporting_outbox] ADD CONSTRAINT [reporting_outbox_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[single_sign_on_audit] ADD CONSTRAINT [single_sign_on_audit_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[single_sign_on_outbox] ADD CONSTRAINT [single_sign_on_outbox_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[subscriptions_audit] ADD CONSTRAINT [subscriptions_audit_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[subscriptions_outbox] ADD CONSTRAINT [subscriptions_outbox_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[support_audit] ADD CONSTRAINT [support_audit_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[support_outbox] ADD CONSTRAINT [support_outbox_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[tenant_audit] ADD CONSTRAINT [tenant_audit_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[tenant_group_memberships] ADD CONSTRAINT [tenant_group_memberships_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[tenant_groups] ADD CONSTRAINT [tenant_groups_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[tenant_invitations] ADD CONSTRAINT [tenant_invitations_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[tenant_memberships] ADD CONSTRAINT [tenant_memberships_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[tenant_outbox] ADD CONSTRAINT [tenant_outbox_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[tenants] ADD CONSTRAINT [tenants_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]);
-- Recreate unique constraints and indexes.
ALTER TABLE [dbo].[tenant_memberships] ADD CONSTRAINT [tenant_memberships_tenantId_userId_key] UNIQUE NONCLUSTERED ([tenantId],[userId]);
ALTER TABLE [dbo].[tenant_invitations] ADD CONSTRAINT [tenant_invitations_token_key] UNIQUE NONCLUSTERED ([token]);
ALTER TABLE [dbo].[tenant_groups] ADD CONSTRAINT [tenant_groups_tenantId_name_key] UNIQUE NONCLUSTERED ([tenantId], [name]);
ALTER TABLE [dbo].[tenant_group_memberships] ADD CONSTRAINT [tenant_group_memberships_groupId_userId_key] UNIQUE NONCLUSTERED ([groupId], [userId]);
ALTER TABLE [dbo].[permissions_role_assignments] ADD CONSTRAINT [permissions_role_assignments_tenant_principal_role_key] UNIQUE NONCLUSTERED ([tenantId], [principalType], [principalId], [roleId]);
ALTER TABLE [dbo].[permissions_role_commands] ADD CONSTRAINT [permissions_role_commands_tenant_key_key] UNIQUE NONCLUSTERED ([tenantId], [idempotencyKey]);
CREATE UNIQUE NONCLUSTERED INDEX [users_entraOid_key] ON [dbo].[users]([entraOid]);
CREATE UNIQUE NONCLUSTERED INDEX [users_email_key] ON [dbo].[users]([email]);
CREATE UNIQUE NONCLUSTERED INDEX [tenants_slug_key] ON [dbo].[tenants]([slug]);
CREATE UNIQUE NONCLUSTERED INDEX [tenant_invitations_pending_email_key] ON [dbo].[tenant_invitations]([tenantId], [email]) WHERE [status] = 'pending';
CREATE NONCLUSTERED INDEX [access_requests_tenantId_status_idx] ON [dbo].[access_requests]([tenantId], [status]);
CREATE NONCLUSTERED INDEX [access_requests_requesterId_status_idx] ON [dbo].[access_requests]([requesterId], [status]);
CREATE NONCLUSTERED INDEX [access_requests_requesterId_action_resource_status_idx] ON [dbo].[access_requests]([requesterId], [action], [resource], [status]);
CREATE NONCLUSTERED INDEX [tenant_invitations_tenantId_email_idx] ON [dbo].[tenant_invitations]([tenantId], [email]);
CREATE NONCLUSTERED INDEX [tenant_groups_tenantId_createdAt_idx] ON [dbo].[tenant_groups]([tenantId], [createdAt]);
CREATE NONCLUSTERED INDEX [tenant_group_memberships_tenantId_userId_idx] ON [dbo].[tenant_group_memberships]([tenantId], [userId]);
CREATE NONCLUSTERED INDEX [tenant_group_memberships_syncStatus_updatedAt_idx] ON [dbo].[tenant_group_memberships]([syncStatus], [updatedAt]);
CREATE NONCLUSTERED INDEX [permissions_role_assignments_tenant_state_idx] ON [permissions_role_assignments]([tenantId], [assigned], [syncStatus]);
CREATE NONCLUSTERED INDEX [permissions_role_commands_tenant_created_idx] ON [permissions_role_commands]([tenantId], [createdAt]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
