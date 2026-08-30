BEGIN TRY

BEGIN TRAN;

-- Preflight: documented limits in docs/db-practices.md / ADR 0005.
-- Full report: packages/db/scripts/preflight-entity-id-column-sizing.sql
-- Azure SQL supports NVARCHAR length narrows on PK/FK columns when values fit;
-- constraint drop/recreate is not required for NVARCHAR(1000) -> NVARCHAR(n).
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

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
