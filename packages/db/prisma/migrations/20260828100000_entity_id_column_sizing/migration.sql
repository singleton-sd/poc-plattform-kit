BEGIN TRY

BEGIN TRAN;

-- Preflight: documented limits in docs/db-practices.md / ADR 0005.
-- Full report: packages/db/scripts/preflight-entity-id-column-sizing.sql
-- Azure SQL supports NVARCHAR length narrows on PK/FK columns when values fit;
-- constraint drop/recreate is not required for NVARCHAR(1000) -> NVARCHAR(n).
IF EXISTS (
  SELECT 1
  FROM (
    SELECT 1 AS issue FROM [dbo].[users] WHERE LEN([id]) > 64 OR LEN([entraOid]) > 36 OR LEN([email]) > 320 OR LEN([name]) > 200
    UNION ALL SELECT 1 FROM [dbo].[tenants] WHERE LEN([id]) > 64 OR LEN([name]) > 200 OR LEN([slug]) > 100
    UNION ALL SELECT 1 FROM [dbo].[tenant_memberships] WHERE LEN([id]) > 64 OR LEN([tenantId]) > 64 OR LEN([userId]) > 64 OR LEN([role]) > 50
    UNION ALL SELECT 1 FROM [dbo].[tenant_invitations] WHERE LEN([email]) > 320 OR LEN([token]) > 64
    UNION ALL SELECT 1 FROM [dbo].[access_requests] WHERE LEN([requesterEntraOid]) > 36
    UNION ALL SELECT 1 FROM [dbo].[permissions_role_assignments] WHERE LEN([roleId]) > 200
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
