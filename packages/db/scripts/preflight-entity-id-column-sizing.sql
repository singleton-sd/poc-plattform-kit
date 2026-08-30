-- Preflight for migration 20260828100000_entity_id_column_sizing.
-- Run against the target Azure SQL database before `prisma migrate deploy`:
--   sqlcmd / az sql ... / SSMS — execute this script read-only.
-- Lists any rows that would block NVARCHAR length narrows (see docs/db-practices.md).

SET NOCOUNT ON;

DECLARE @issues TABLE (
  table_name NVARCHAR(128) NOT NULL,
  column_name NVARCHAR(128) NOT NULL,
  max_len INT NOT NULL,
  sample_value NVARCHAR(4000) NULL
);

INSERT INTO @issues (table_name, column_name, max_len, sample_value)
SELECT 'users', 'id', 64, MIN([id]) FROM [dbo].[users] WHERE LEN([id]) > 64
UNION ALL SELECT 'users', 'entraOid', 36, MIN([entraOid]) FROM [dbo].[users] WHERE LEN([entraOid]) > 36
UNION ALL SELECT 'users', 'email', 320, MIN([email]) FROM [dbo].[users] WHERE LEN([email]) > 320
UNION ALL SELECT 'users', 'name', 200, MIN([name]) FROM [dbo].[users] WHERE LEN([name]) > 200
UNION ALL SELECT 'tenants', 'id', 64, MIN([id]) FROM [dbo].[tenants] WHERE LEN([id]) > 64
UNION ALL SELECT 'tenants', 'name', 200, MIN([name]) FROM [dbo].[tenants] WHERE LEN([name]) > 200
UNION ALL SELECT 'tenants', 'slug', 100, MIN([slug]) FROM [dbo].[tenants] WHERE LEN([slug]) > 100
UNION ALL SELECT 'tenant_memberships', 'id', 64, MIN([id]) FROM [dbo].[tenant_memberships] WHERE LEN([id]) > 64
UNION ALL SELECT 'tenant_memberships', 'tenantId', 64, MIN([tenantId]) FROM [dbo].[tenant_memberships] WHERE LEN([tenantId]) > 64
UNION ALL SELECT 'tenant_memberships', 'userId', 64, MIN([userId]) FROM [dbo].[tenant_memberships] WHERE LEN([userId]) > 64
UNION ALL SELECT 'tenant_memberships', 'role', 50, MIN([role]) FROM [dbo].[tenant_memberships] WHERE LEN([role]) > 50
UNION ALL SELECT 'tenant_invitations', 'email', 320, MIN([email]) FROM [dbo].[tenant_invitations] WHERE LEN([email]) > 320
UNION ALL SELECT 'tenant_invitations', 'token', 64, MIN([token]) FROM [dbo].[tenant_invitations] WHERE LEN([token]) > 64
UNION ALL SELECT 'access_requests', 'requesterEntraOid', 36, MIN([requesterEntraOid]) FROM [dbo].[access_requests] WHERE LEN([requesterEntraOid]) > 36
UNION ALL SELECT 'permissions_role_assignments', 'roleId', 200, MIN([roleId]) FROM [dbo].[permissions_role_assignments] WHERE LEN([roleId]) > 200;

IF EXISTS (SELECT 1 FROM @issues)
BEGIN
  SELECT table_name, column_name, max_len, sample_value FROM @issues ORDER BY table_name, column_name;
  THROW 51000, 'entity_id_column_sizing preflight failed — remediate over-length values listed above, then re-run migrate deploy', 1;
END;

PRINT 'entity_id_column_sizing preflight passed';
