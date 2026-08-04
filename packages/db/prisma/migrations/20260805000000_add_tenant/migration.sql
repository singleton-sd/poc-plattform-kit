BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[tenants] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [slug] NVARCHAR(1000) NOT NULL,
    [settings] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [tenants_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [tenants_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [tenants_slug_key] ON [dbo].[tenants]([slug]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
