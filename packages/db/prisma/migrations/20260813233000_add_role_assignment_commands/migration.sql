CREATE TABLE [permissions_role_revisions] (
  [tenantId] NVARCHAR(1000) NOT NULL,
  [revision] INT NOT NULL CONSTRAINT [permissions_role_revisions_revision_df] DEFAULT 0,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [permissions_role_revisions_pkey] PRIMARY KEY CLUSTERED ([tenantId])
);

CREATE TABLE [permissions_role_assignments] (
  [id] NVARCHAR(1000) NOT NULL, [tenantId] NVARCHAR(1000) NOT NULL,
  [principalType] NVARCHAR(1000) NOT NULL, [principalId] NVARCHAR(1000) NOT NULL,
  [roleId] NVARCHAR(1000) NOT NULL, [assigned] BIT NOT NULL,
  [syncStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [permissions_role_assignments_syncStatus_df] DEFAULT 'pending',
  [syncError] NVARCHAR(1000), [syncedAt] DATETIME2, [revision] INT NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [permissions_role_assignments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [permissions_role_assignments_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [permissions_role_assignments_tenant_principal_role_key] UNIQUE NONCLUSTERED ([tenantId], [principalType], [principalId], [roleId])
);
CREATE NONCLUSTERED INDEX [permissions_role_assignments_tenant_state_idx] ON [permissions_role_assignments]([tenantId], [assigned], [syncStatus]);

CREATE TABLE [permissions_role_commands] (
  [id] NVARCHAR(1000) NOT NULL, [tenantId] NVARCHAR(1000) NOT NULL,
  [idempotencyKey] NVARCHAR(1000) NOT NULL, [commandHash] NVARCHAR(1000) NOT NULL,
  [assignmentId] NVARCHAR(1000) NOT NULL, [consistencyVersion] NVARCHAR(1000) NOT NULL,
  [changed] BIT NOT NULL, [assigned] BIT NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [permissions_role_commands_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [permissions_role_commands_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [permissions_role_commands_tenant_key_key] UNIQUE NONCLUSTERED ([tenantId], [idempotencyKey])
);
CREATE NONCLUSTERED INDEX [permissions_role_commands_tenant_created_idx] ON [permissions_role_commands]([tenantId], [createdAt]);
