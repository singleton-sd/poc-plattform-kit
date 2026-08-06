BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] NVARCHAR(1000) NOT NULL,
    [entraOid] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [users_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id])
);

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

-- CreateTable
CREATE TABLE [dbo].[tenant_outbox] (
    [id] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [payload] NVARCHAR(max) NOT NULL,
    [occurredAt] DATETIME2 NOT NULL CONSTRAINT [tenant_outbox_occurredAt_df] DEFAULT CURRENT_TIMESTAMP,
    [processedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [tenant_outbox_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [tenant_outbox_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[tenant_audit] (
    [id] NVARCHAR(1000) NOT NULL,
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000),
    [changes] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [tenant_audit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [tenant_audit_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[single_sign_on_outbox] (
    [id] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [payload] NVARCHAR(max) NOT NULL,
    [occurredAt] DATETIME2 NOT NULL CONSTRAINT [single_sign_on_outbox_occurredAt_df] DEFAULT CURRENT_TIMESTAMP,
    [processedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [single_sign_on_outbox_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [single_sign_on_outbox_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[single_sign_on_audit] (
    [id] NVARCHAR(1000) NOT NULL,
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000),
    [changes] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [single_sign_on_audit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [single_sign_on_audit_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[subscriptions_outbox] (
    [id] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [payload] NVARCHAR(max) NOT NULL,
    [occurredAt] DATETIME2 NOT NULL CONSTRAINT [subscriptions_outbox_occurredAt_df] DEFAULT CURRENT_TIMESTAMP,
    [processedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [subscriptions_outbox_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [subscriptions_outbox_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[subscriptions_audit] (
    [id] NVARCHAR(1000) NOT NULL,
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000),
    [changes] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [subscriptions_audit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [subscriptions_audit_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[contact_outbox] (
    [id] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [payload] NVARCHAR(max) NOT NULL,
    [occurredAt] DATETIME2 NOT NULL CONSTRAINT [contact_outbox_occurredAt_df] DEFAULT CURRENT_TIMESTAMP,
    [processedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [contact_outbox_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [contact_outbox_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[contact_audit] (
    [id] NVARCHAR(1000) NOT NULL,
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000),
    [changes] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [contact_audit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [contact_audit_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[support_outbox] (
    [id] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [payload] NVARCHAR(max) NOT NULL,
    [occurredAt] DATETIME2 NOT NULL CONSTRAINT [support_outbox_occurredAt_df] DEFAULT CURRENT_TIMESTAMP,
    [processedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [support_outbox_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [support_outbox_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[support_audit] (
    [id] NVARCHAR(1000) NOT NULL,
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000),
    [changes] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [support_audit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [support_audit_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_outbox] (
    [id] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [payload] NVARCHAR(max) NOT NULL,
    [occurredAt] DATETIME2 NOT NULL CONSTRAINT [audit_outbox_occurredAt_df] DEFAULT CURRENT_TIMESTAMP,
    [processedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [audit_outbox_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_outbox_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_audit] (
    [id] NVARCHAR(1000) NOT NULL,
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000),
    [changes] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [audit_audit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_audit_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[reporting_outbox] (
    [id] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [payload] NVARCHAR(max) NOT NULL,
    [occurredAt] DATETIME2 NOT NULL CONSTRAINT [reporting_outbox_occurredAt_df] DEFAULT CURRENT_TIMESTAMP,
    [processedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [reporting_outbox_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [reporting_outbox_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[reporting_audit] (
    [id] NVARCHAR(1000) NOT NULL,
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000),
    [changes] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [reporting_audit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [reporting_audit_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [users_entraOid_key] ON [dbo].[users]([entraOid]);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [users_email_key] ON [dbo].[users]([email]);

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
