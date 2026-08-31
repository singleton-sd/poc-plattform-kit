-- Preflight for migration 20260828100000_entity_id_column_sizing.
-- Run against the target Azure SQL database before `prisma migrate deploy`:
--   sqlcmd / az sql ... / SSMS — execute this script read-only.
-- Lists any rows that would block NVARCHAR length narrows (see docs/db-practices.md).
-- Uses DATALENGTH (bytes) > n * 2 for NVARCHAR(n) capacity; LEN ignores trailing spaces.

SET NOCOUNT ON;

DECLARE @issues TABLE (
  table_name NVARCHAR(128) NOT NULL,
  column_name NVARCHAR(128) NOT NULL,
  max_len INT NOT NULL,
  sample_value NVARCHAR(4000) NULL
);

INSERT INTO @issues (table_name, column_name, max_len, sample_value)
SELECT 'users', 'id', 64, MIN([id]) FROM [dbo].[users] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'users', 'entraOid', 36, MIN([entraOid]) FROM [dbo].[users] WHERE DATALENGTH([entraOid]) > 72
UNION ALL SELECT 'users', 'email', 320, MIN([email]) FROM [dbo].[users] WHERE DATALENGTH([email]) > 640
UNION ALL SELECT 'users', 'name', 200, MIN([name]) FROM [dbo].[users] WHERE DATALENGTH([name]) > 400
UNION ALL SELECT 'tenants', 'id', 64, MIN([id]) FROM [dbo].[tenants] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'tenants', 'name', 200, MIN([name]) FROM [dbo].[tenants] WHERE DATALENGTH([name]) > 400
UNION ALL SELECT 'tenants', 'slug', 100, MIN([slug]) FROM [dbo].[tenants] WHERE DATALENGTH([slug]) > 200
UNION ALL SELECT 'tenant_memberships', 'id', 64, MIN([id]) FROM [dbo].[tenant_memberships] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'tenant_memberships', 'tenantId', 64, MIN([tenantId]) FROM [dbo].[tenant_memberships] WHERE DATALENGTH([tenantId]) > 128
UNION ALL SELECT 'tenant_memberships', 'userId', 64, MIN([userId]) FROM [dbo].[tenant_memberships] WHERE DATALENGTH([userId]) > 128
UNION ALL SELECT 'tenant_memberships', 'role', 50, MIN([role]) FROM [dbo].[tenant_memberships] WHERE DATALENGTH([role]) > 100
UNION ALL SELECT 'tenant_groups', 'id', 64, MIN([id]) FROM [dbo].[tenant_groups] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'tenant_groups', 'tenantId', 64, MIN([tenantId]) FROM [dbo].[tenant_groups] WHERE DATALENGTH([tenantId]) > 128
UNION ALL SELECT 'tenant_groups', 'name', 200, MIN([name]) FROM [dbo].[tenant_groups] WHERE DATALENGTH([name]) > 400
UNION ALL SELECT 'tenant_groups', 'description', 500, MIN([description]) FROM [dbo].[tenant_groups] WHERE DATALENGTH([description]) > 1000
UNION ALL SELECT 'tenant_group_memberships', 'id', 64, MIN([id]) FROM [dbo].[tenant_group_memberships] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'tenant_group_memberships', 'tenantId', 64, MIN([tenantId]) FROM [dbo].[tenant_group_memberships] WHERE DATALENGTH([tenantId]) > 128
UNION ALL SELECT 'tenant_group_memberships', 'groupId', 64, MIN([groupId]) FROM [dbo].[tenant_group_memberships] WHERE DATALENGTH([groupId]) > 128
UNION ALL SELECT 'tenant_group_memberships', 'userId', 64, MIN([userId]) FROM [dbo].[tenant_group_memberships] WHERE DATALENGTH([userId]) > 128
UNION ALL SELECT 'tenant_group_memberships', 'syncStatus', 50, MIN([syncStatus]) FROM [dbo].[tenant_group_memberships] WHERE DATALENGTH([syncStatus]) > 100
UNION ALL SELECT 'tenant_group_memberships', 'syncError', 500, MIN([syncError]) FROM [dbo].[tenant_group_memberships] WHERE DATALENGTH([syncError]) > 1000
UNION ALL SELECT 'tenant_invitations', 'id', 64, MIN([id]) FROM [dbo].[tenant_invitations] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'tenant_invitations', 'tenantId', 64, MIN([tenantId]) FROM [dbo].[tenant_invitations] WHERE DATALENGTH([tenantId]) > 128
UNION ALL SELECT 'tenant_invitations', 'email', 320, MIN([email]) FROM [dbo].[tenant_invitations] WHERE DATALENGTH([email]) > 640
UNION ALL SELECT 'tenant_invitations', 'role', 50, MIN([role]) FROM [dbo].[tenant_invitations] WHERE DATALENGTH([role]) > 100
UNION ALL SELECT 'tenant_invitations', 'invitedByUserId', 64, MIN([invitedByUserId]) FROM [dbo].[tenant_invitations] WHERE DATALENGTH([invitedByUserId]) > 128
UNION ALL SELECT 'tenant_invitations', 'token', 64, MIN([token]) FROM [dbo].[tenant_invitations] WHERE DATALENGTH([token]) > 128
UNION ALL SELECT 'tenant_invitations', 'status', 50, MIN([status]) FROM [dbo].[tenant_invitations] WHERE DATALENGTH([status]) > 100
UNION ALL SELECT 'tenant_outbox', 'id', 64, MIN([id]) FROM [dbo].[tenant_outbox] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'tenant_outbox', 'eventType', 200, MIN([eventType]) FROM [dbo].[tenant_outbox] WHERE DATALENGTH([eventType]) > 400
UNION ALL SELECT 'tenant_outbox', 'claimId', 64, MIN([claimId]) FROM [dbo].[tenant_outbox] WHERE DATALENGTH([claimId]) > 128
UNION ALL SELECT 'tenant_outbox', 'failureReason', 500, MIN([failureReason]) FROM [dbo].[tenant_outbox] WHERE DATALENGTH([failureReason]) > 1000
UNION ALL SELECT 'tenant_audit', 'id', 64, MIN([id]) FROM [dbo].[tenant_audit] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'tenant_audit', 'entityType', 100, MIN([entityType]) FROM [dbo].[tenant_audit] WHERE DATALENGTH([entityType]) > 200
UNION ALL SELECT 'tenant_audit', 'entityId', 64, MIN([entityId]) FROM [dbo].[tenant_audit] WHERE DATALENGTH([entityId]) > 128
UNION ALL SELECT 'tenant_audit', 'action', 200, MIN([action]) FROM [dbo].[tenant_audit] WHERE DATALENGTH([action]) > 400
UNION ALL SELECT 'tenant_audit', 'actorId', 64, MIN([actorId]) FROM [dbo].[tenant_audit] WHERE DATALENGTH([actorId]) > 128
UNION ALL SELECT 'single_sign_on_outbox', 'id', 64, MIN([id]) FROM [dbo].[single_sign_on_outbox] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'single_sign_on_outbox', 'eventType', 200, MIN([eventType]) FROM [dbo].[single_sign_on_outbox] WHERE DATALENGTH([eventType]) > 400
UNION ALL SELECT 'single_sign_on_outbox', 'claimId', 64, MIN([claimId]) FROM [dbo].[single_sign_on_outbox] WHERE DATALENGTH([claimId]) > 128
UNION ALL SELECT 'single_sign_on_outbox', 'failureReason', 500, MIN([failureReason]) FROM [dbo].[single_sign_on_outbox] WHERE DATALENGTH([failureReason]) > 1000
UNION ALL SELECT 'single_sign_on_audit', 'id', 64, MIN([id]) FROM [dbo].[single_sign_on_audit] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'single_sign_on_audit', 'entityType', 100, MIN([entityType]) FROM [dbo].[single_sign_on_audit] WHERE DATALENGTH([entityType]) > 200
UNION ALL SELECT 'single_sign_on_audit', 'entityId', 64, MIN([entityId]) FROM [dbo].[single_sign_on_audit] WHERE DATALENGTH([entityId]) > 128
UNION ALL SELECT 'single_sign_on_audit', 'action', 200, MIN([action]) FROM [dbo].[single_sign_on_audit] WHERE DATALENGTH([action]) > 400
UNION ALL SELECT 'single_sign_on_audit', 'actorId', 64, MIN([actorId]) FROM [dbo].[single_sign_on_audit] WHERE DATALENGTH([actorId]) > 128
UNION ALL SELECT 'subscriptions_outbox', 'id', 64, MIN([id]) FROM [dbo].[subscriptions_outbox] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'subscriptions_outbox', 'eventType', 200, MIN([eventType]) FROM [dbo].[subscriptions_outbox] WHERE DATALENGTH([eventType]) > 400
UNION ALL SELECT 'subscriptions_outbox', 'claimId', 64, MIN([claimId]) FROM [dbo].[subscriptions_outbox] WHERE DATALENGTH([claimId]) > 128
UNION ALL SELECT 'subscriptions_outbox', 'failureReason', 500, MIN([failureReason]) FROM [dbo].[subscriptions_outbox] WHERE DATALENGTH([failureReason]) > 1000
UNION ALL SELECT 'subscriptions_audit', 'id', 64, MIN([id]) FROM [dbo].[subscriptions_audit] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'subscriptions_audit', 'entityType', 100, MIN([entityType]) FROM [dbo].[subscriptions_audit] WHERE DATALENGTH([entityType]) > 200
UNION ALL SELECT 'subscriptions_audit', 'entityId', 64, MIN([entityId]) FROM [dbo].[subscriptions_audit] WHERE DATALENGTH([entityId]) > 128
UNION ALL SELECT 'subscriptions_audit', 'action', 200, MIN([action]) FROM [dbo].[subscriptions_audit] WHERE DATALENGTH([action]) > 400
UNION ALL SELECT 'subscriptions_audit', 'actorId', 64, MIN([actorId]) FROM [dbo].[subscriptions_audit] WHERE DATALENGTH([actorId]) > 128
UNION ALL SELECT 'contact_outbox', 'id', 64, MIN([id]) FROM [dbo].[contact_outbox] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'contact_outbox', 'eventType', 200, MIN([eventType]) FROM [dbo].[contact_outbox] WHERE DATALENGTH([eventType]) > 400
UNION ALL SELECT 'contact_outbox', 'claimId', 64, MIN([claimId]) FROM [dbo].[contact_outbox] WHERE DATALENGTH([claimId]) > 128
UNION ALL SELECT 'contact_outbox', 'failureReason', 500, MIN([failureReason]) FROM [dbo].[contact_outbox] WHERE DATALENGTH([failureReason]) > 1000
UNION ALL SELECT 'contact_audit', 'id', 64, MIN([id]) FROM [dbo].[contact_audit] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'contact_audit', 'entityType', 100, MIN([entityType]) FROM [dbo].[contact_audit] WHERE DATALENGTH([entityType]) > 200
UNION ALL SELECT 'contact_audit', 'entityId', 64, MIN([entityId]) FROM [dbo].[contact_audit] WHERE DATALENGTH([entityId]) > 128
UNION ALL SELECT 'contact_audit', 'action', 200, MIN([action]) FROM [dbo].[contact_audit] WHERE DATALENGTH([action]) > 400
UNION ALL SELECT 'contact_audit', 'actorId', 64, MIN([actorId]) FROM [dbo].[contact_audit] WHERE DATALENGTH([actorId]) > 128
UNION ALL SELECT 'support_outbox', 'id', 64, MIN([id]) FROM [dbo].[support_outbox] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'support_outbox', 'eventType', 200, MIN([eventType]) FROM [dbo].[support_outbox] WHERE DATALENGTH([eventType]) > 400
UNION ALL SELECT 'support_outbox', 'claimId', 64, MIN([claimId]) FROM [dbo].[support_outbox] WHERE DATALENGTH([claimId]) > 128
UNION ALL SELECT 'support_outbox', 'failureReason', 500, MIN([failureReason]) FROM [dbo].[support_outbox] WHERE DATALENGTH([failureReason]) > 1000
UNION ALL SELECT 'support_audit', 'id', 64, MIN([id]) FROM [dbo].[support_audit] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'support_audit', 'entityType', 100, MIN([entityType]) FROM [dbo].[support_audit] WHERE DATALENGTH([entityType]) > 200
UNION ALL SELECT 'support_audit', 'entityId', 64, MIN([entityId]) FROM [dbo].[support_audit] WHERE DATALENGTH([entityId]) > 128
UNION ALL SELECT 'support_audit', 'action', 200, MIN([action]) FROM [dbo].[support_audit] WHERE DATALENGTH([action]) > 400
UNION ALL SELECT 'support_audit', 'actorId', 64, MIN([actorId]) FROM [dbo].[support_audit] WHERE DATALENGTH([actorId]) > 128
UNION ALL SELECT 'access_requests', 'id', 64, MIN([id]) FROM [dbo].[access_requests] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'access_requests', 'tenantId', 64, MIN([tenantId]) FROM [dbo].[access_requests] WHERE DATALENGTH([tenantId]) > 128
UNION ALL SELECT 'access_requests', 'requesterId', 64, MIN([requesterId]) FROM [dbo].[access_requests] WHERE DATALENGTH([requesterId]) > 128
UNION ALL SELECT 'access_requests', 'requesterEntraOid', 36, MIN([requesterEntraOid]) FROM [dbo].[access_requests] WHERE DATALENGTH([requesterEntraOid]) > 72
UNION ALL SELECT 'access_requests', 'action', 200, MIN([action]) FROM [dbo].[access_requests] WHERE DATALENGTH([action]) > 400
UNION ALL SELECT 'access_requests', 'resource', 200, MIN([resource]) FROM [dbo].[access_requests] WHERE DATALENGTH([resource]) > 400
UNION ALL SELECT 'access_requests', 'status', 50, MIN([status]) FROM [dbo].[access_requests] WHERE DATALENGTH([status]) > 100
UNION ALL SELECT 'access_requests', 'decidedById', 64, MIN([decidedById]) FROM [dbo].[access_requests] WHERE DATALENGTH([decidedById]) > 128
UNION ALL SELECT 'access_requests', 'denyReason', 500, MIN([denyReason]) FROM [dbo].[access_requests] WHERE DATALENGTH([denyReason]) > 1000
UNION ALL SELECT 'access_requests', 'grantType', 50, MIN([grantType]) FROM [dbo].[access_requests] WHERE DATALENGTH([grantType]) > 100
UNION ALL SELECT 'access_requests', 'preferredGrantType', 50, MIN([preferredGrantType]) FROM [dbo].[access_requests] WHERE DATALENGTH([preferredGrantType]) > 100
UNION ALL SELECT 'permissions_outbox', 'id', 64, MIN([id]) FROM [dbo].[permissions_outbox] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'permissions_outbox', 'eventType', 200, MIN([eventType]) FROM [dbo].[permissions_outbox] WHERE DATALENGTH([eventType]) > 400
UNION ALL SELECT 'permissions_outbox', 'claimId', 64, MIN([claimId]) FROM [dbo].[permissions_outbox] WHERE DATALENGTH([claimId]) > 128
UNION ALL SELECT 'permissions_outbox', 'failureReason', 500, MIN([failureReason]) FROM [dbo].[permissions_outbox] WHERE DATALENGTH([failureReason]) > 1000
UNION ALL SELECT 'permissions_audit', 'id', 64, MIN([id]) FROM [dbo].[permissions_audit] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'permissions_audit', 'entityType', 100, MIN([entityType]) FROM [dbo].[permissions_audit] WHERE DATALENGTH([entityType]) > 200
UNION ALL SELECT 'permissions_audit', 'entityId', 64, MIN([entityId]) FROM [dbo].[permissions_audit] WHERE DATALENGTH([entityId]) > 128
UNION ALL SELECT 'permissions_audit', 'action', 200, MIN([action]) FROM [dbo].[permissions_audit] WHERE DATALENGTH([action]) > 400
UNION ALL SELECT 'permissions_audit', 'actorId', 64, MIN([actorId]) FROM [dbo].[permissions_audit] WHERE DATALENGTH([actorId]) > 128
UNION ALL SELECT 'permissions_role_revisions', 'tenantId', 64, MIN([tenantId]) FROM [dbo].[permissions_role_revisions] WHERE DATALENGTH([tenantId]) > 128
UNION ALL SELECT 'permissions_role_assignments', 'id', 64, MIN([id]) FROM [dbo].[permissions_role_assignments] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'permissions_role_assignments', 'tenantId', 64, MIN([tenantId]) FROM [dbo].[permissions_role_assignments] WHERE DATALENGTH([tenantId]) > 128
UNION ALL SELECT 'permissions_role_assignments', 'principalType', 50, MIN([principalType]) FROM [dbo].[permissions_role_assignments] WHERE DATALENGTH([principalType]) > 100
UNION ALL SELECT 'permissions_role_assignments', 'principalId', 64, MIN([principalId]) FROM [dbo].[permissions_role_assignments] WHERE DATALENGTH([principalId]) > 128
UNION ALL SELECT 'permissions_role_assignments', 'roleId', 200, MIN([roleId]) FROM [dbo].[permissions_role_assignments] WHERE DATALENGTH([roleId]) > 400
UNION ALL SELECT 'permissions_role_assignments', 'syncStatus', 50, MIN([syncStatus]) FROM [dbo].[permissions_role_assignments] WHERE DATALENGTH([syncStatus]) > 100
UNION ALL SELECT 'permissions_role_assignments', 'syncError', 500, MIN([syncError]) FROM [dbo].[permissions_role_assignments] WHERE DATALENGTH([syncError]) > 1000
UNION ALL SELECT 'permissions_role_commands', 'id', 64, MIN([id]) FROM [dbo].[permissions_role_commands] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'permissions_role_commands', 'tenantId', 64, MIN([tenantId]) FROM [dbo].[permissions_role_commands] WHERE DATALENGTH([tenantId]) > 128
UNION ALL SELECT 'permissions_role_commands', 'idempotencyKey', 200, MIN([idempotencyKey]) FROM [dbo].[permissions_role_commands] WHERE DATALENGTH([idempotencyKey]) > 400
UNION ALL SELECT 'permissions_role_commands', 'commandHash', 64, MIN([commandHash]) FROM [dbo].[permissions_role_commands] WHERE DATALENGTH([commandHash]) > 128
UNION ALL SELECT 'permissions_role_commands', 'assignmentId', 64, MIN([assignmentId]) FROM [dbo].[permissions_role_commands] WHERE DATALENGTH([assignmentId]) > 128
UNION ALL SELECT 'permissions_role_commands', 'consistencyVersion', 50, MIN([consistencyVersion]) FROM [dbo].[permissions_role_commands] WHERE DATALENGTH([consistencyVersion]) > 100
UNION ALL SELECT 'notifications_outbox', 'id', 64, MIN([id]) FROM [dbo].[notifications_outbox] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'notifications_outbox', 'eventType', 200, MIN([eventType]) FROM [dbo].[notifications_outbox] WHERE DATALENGTH([eventType]) > 400
UNION ALL SELECT 'notifications_outbox', 'claimId', 64, MIN([claimId]) FROM [dbo].[notifications_outbox] WHERE DATALENGTH([claimId]) > 128
UNION ALL SELECT 'notifications_outbox', 'failureReason', 500, MIN([failureReason]) FROM [dbo].[notifications_outbox] WHERE DATALENGTH([failureReason]) > 1000
UNION ALL SELECT 'audit_outbox', 'id', 64, MIN([id]) FROM [dbo].[audit_outbox] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'audit_outbox', 'eventType', 200, MIN([eventType]) FROM [dbo].[audit_outbox] WHERE DATALENGTH([eventType]) > 400
UNION ALL SELECT 'audit_outbox', 'claimId', 64, MIN([claimId]) FROM [dbo].[audit_outbox] WHERE DATALENGTH([claimId]) > 128
UNION ALL SELECT 'audit_outbox', 'failureReason', 500, MIN([failureReason]) FROM [dbo].[audit_outbox] WHERE DATALENGTH([failureReason]) > 1000
UNION ALL SELECT 'audit_audit', 'id', 64, MIN([id]) FROM [dbo].[audit_audit] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'audit_audit', 'entityType', 100, MIN([entityType]) FROM [dbo].[audit_audit] WHERE DATALENGTH([entityType]) > 200
UNION ALL SELECT 'audit_audit', 'entityId', 64, MIN([entityId]) FROM [dbo].[audit_audit] WHERE DATALENGTH([entityId]) > 128
UNION ALL SELECT 'audit_audit', 'action', 200, MIN([action]) FROM [dbo].[audit_audit] WHERE DATALENGTH([action]) > 400
UNION ALL SELECT 'audit_audit', 'actorId', 64, MIN([actorId]) FROM [dbo].[audit_audit] WHERE DATALENGTH([actorId]) > 128
UNION ALL SELECT 'reporting_outbox', 'id', 64, MIN([id]) FROM [dbo].[reporting_outbox] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'reporting_outbox', 'eventType', 200, MIN([eventType]) FROM [dbo].[reporting_outbox] WHERE DATALENGTH([eventType]) > 400
UNION ALL SELECT 'reporting_outbox', 'claimId', 64, MIN([claimId]) FROM [dbo].[reporting_outbox] WHERE DATALENGTH([claimId]) > 128
UNION ALL SELECT 'reporting_outbox', 'failureReason', 500, MIN([failureReason]) FROM [dbo].[reporting_outbox] WHERE DATALENGTH([failureReason]) > 1000
UNION ALL SELECT 'reporting_audit', 'id', 64, MIN([id]) FROM [dbo].[reporting_audit] WHERE DATALENGTH([id]) > 128
UNION ALL SELECT 'reporting_audit', 'entityType', 100, MIN([entityType]) FROM [dbo].[reporting_audit] WHERE DATALENGTH([entityType]) > 200
UNION ALL SELECT 'reporting_audit', 'entityId', 64, MIN([entityId]) FROM [dbo].[reporting_audit] WHERE DATALENGTH([entityId]) > 128
UNION ALL SELECT 'reporting_audit', 'action', 200, MIN([action]) FROM [dbo].[reporting_audit] WHERE DATALENGTH([action]) > 400
UNION ALL SELECT 'reporting_audit', 'actorId', 64, MIN([actorId]) FROM [dbo].[reporting_audit] WHERE DATALENGTH([actorId]) > 128;

IF EXISTS (SELECT 1 FROM @issues)
BEGIN
  SELECT table_name, column_name, max_len, sample_value FROM @issues ORDER BY table_name, column_name;
  THROW 51000, 'entity_id_column_sizing preflight failed — remediate over-length values listed above, then re-run migrate deploy', 1;
END;

PRINT 'entity_id_column_sizing preflight passed';
