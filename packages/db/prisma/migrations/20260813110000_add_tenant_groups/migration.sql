BEGIN TRY

BEGIN TRAN;

CREATE TABLE [dbo].[tenant_groups] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenantId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [tenant_groups_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [tenant_groups_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [tenant_groups_tenantId_name_key] UNIQUE NONCLUSTERED ([tenantId], [name])
);

CREATE NONCLUSTERED INDEX [tenant_groups_tenantId_createdAt_idx]
ON [dbo].[tenant_groups]([tenantId], [createdAt]);

CREATE TABLE [dbo].[tenant_group_memberships] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenantId] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [syncStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [tenant_group_memberships_syncStatus_df] DEFAULT 'pending',
    [syncError] NVARCHAR(1000),
    [syncedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [tenant_group_memberships_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [tenant_group_memberships_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [tenant_group_memberships_groupId_userId_key] UNIQUE NONCLUSTERED ([groupId], [userId])
);

CREATE NONCLUSTERED INDEX [tenant_group_memberships_tenantId_userId_idx]
ON [dbo].[tenant_group_memberships]([tenantId], [userId]);

CREATE NONCLUSTERED INDEX [tenant_group_memberships_syncStatus_updatedAt_idx]
ON [dbo].[tenant_group_memberships]([syncStatus], [updatedAt]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
