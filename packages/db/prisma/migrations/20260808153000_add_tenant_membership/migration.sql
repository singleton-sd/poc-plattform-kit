BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[tenant_memberships] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenantId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [tenant_memberships_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [tenant_memberships_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [tenant_memberships_tenantId_userId_key] UNIQUE NONCLUSTERED ([tenantId],[userId])
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

