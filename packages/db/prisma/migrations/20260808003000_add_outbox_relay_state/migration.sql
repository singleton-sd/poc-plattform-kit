-- Relay leases prevent multiple API instances from publishing the same row.
-- Failed payloads are quarantined so poison rows do not block later events.
ALTER TABLE [dbo].[tenant_outbox] ADD
  [claimedAt] DATETIME2 NULL, [claimId] NVARCHAR(1000) NULL,
  [failedAt] DATETIME2 NULL, [failureReason] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[single_sign_on_outbox] ADD
  [claimedAt] DATETIME2 NULL, [claimId] NVARCHAR(1000) NULL,
  [failedAt] DATETIME2 NULL, [failureReason] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[subscriptions_outbox] ADD
  [claimedAt] DATETIME2 NULL, [claimId] NVARCHAR(1000) NULL,
  [failedAt] DATETIME2 NULL, [failureReason] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[contact_outbox] ADD
  [claimedAt] DATETIME2 NULL, [claimId] NVARCHAR(1000) NULL,
  [failedAt] DATETIME2 NULL, [failureReason] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[support_outbox] ADD
  [claimedAt] DATETIME2 NULL, [claimId] NVARCHAR(1000) NULL,
  [failedAt] DATETIME2 NULL, [failureReason] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[audit_outbox] ADD
  [claimedAt] DATETIME2 NULL, [claimId] NVARCHAR(1000) NULL,
  [failedAt] DATETIME2 NULL, [failureReason] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[reporting_outbox] ADD
  [claimedAt] DATETIME2 NULL, [claimId] NVARCHAR(1000) NULL,
  [failedAt] DATETIME2 NULL, [failureReason] NVARCHAR(1000) NULL;

CREATE TABLE [dbo].[permissions_outbox] (
  [id] NVARCHAR(1000) NOT NULL,
  [eventType] NVARCHAR(1000) NOT NULL,
  [payload] NVARCHAR(MAX) NOT NULL,
  [occurredAt] DATETIME2 NOT NULL CONSTRAINT [permissions_outbox_occurredAt_df] DEFAULT CURRENT_TIMESTAMP,
  [processedAt] DATETIME2 NULL,
  [claimedAt] DATETIME2 NULL,
  [claimId] NVARCHAR(1000) NULL,
  [failedAt] DATETIME2 NULL,
  [failureReason] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [permissions_outbox_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [permissions_outbox_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[notifications_outbox] (
  [id] NVARCHAR(1000) NOT NULL,
  [eventType] NVARCHAR(1000) NOT NULL,
  [payload] NVARCHAR(MAX) NOT NULL,
  [occurredAt] DATETIME2 NOT NULL CONSTRAINT [notifications_outbox_occurredAt_df] DEFAULT CURRENT_TIMESTAMP,
  [processedAt] DATETIME2 NULL,
  [claimedAt] DATETIME2 NULL,
  [claimId] NVARCHAR(1000) NULL,
  [failedAt] DATETIME2 NULL,
  [failureReason] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [notifications_outbox_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [notifications_outbox_pkey] PRIMARY KEY CLUSTERED ([id])
);
