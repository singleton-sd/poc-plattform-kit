BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[access_requests] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenantId] NVARCHAR(1000) NOT NULL,
    [requesterId] NVARCHAR(1000) NOT NULL,
    [requesterEntraOid] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [resource] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [decidedById] NVARCHAR(1000),
    [decidedAt] DATETIME2,
    [denyReason] NVARCHAR(1000),
    [grantType] NVARCHAR(1000),
    [expiresAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [access_requests_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [access_requests_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [access_requests_tenantId_status_idx] ON [dbo].[access_requests]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [access_requests_requesterId_status_idx] ON [dbo].[access_requests]([requesterId], [status]);

-- CreateTable
CREATE TABLE [dbo].[permissions_audit] (
    [id] NVARCHAR(1000) NOT NULL,
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000),
    [changes] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [permissions_audit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [permissions_audit_pkey] PRIMARY KEY CLUSTERED ([id])
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
