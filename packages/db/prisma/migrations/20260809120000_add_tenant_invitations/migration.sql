BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[tenant_invitations] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenantId] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [invitedByUserId] NVARCHAR(1000) NOT NULL,
    [token] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [tenant_invitations_status_df] DEFAULT 'pending',
    [expiresAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [tenant_invitations_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [respondedAt] DATETIME2,
    CONSTRAINT [tenant_invitations_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [tenant_invitations_token_key] UNIQUE NONCLUSTERED ([token])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [tenant_invitations_tenantId_email_idx] ON [dbo].[tenant_invitations]([tenantId], [email]);

-- CreateIndex
-- Filtered unique index: SQL Server's mechanism for "unique among a subset
-- of rows". Prisma's schema DSL has no native filtered-unique-index support,
-- so this is hand-written (see docs/db-practices.md "Single migration
-- system" -- deliberately documented deviation, not a parallel track).
-- Scoped to status = 'pending' only (a static predicate; it cannot also
-- check expiresAt against the clock), so it enforces "at most one pending
-- invitation per tenant+email at a time" and closes the two-concurrent-
-- POSTs race that a plain non-unique index can't catch. The service layer
-- eagerly flips expired-but-still-"pending" rows to 'expired' before
-- re-inviting, which keeps this index's notion of "pending" in sync with
-- the 7-day expiry window; on a residual race the insert throws P2002,
-- which the service translates into a 409 Conflict.
CREATE UNIQUE NONCLUSTERED INDEX [tenant_invitations_pending_email_key] ON [dbo].[tenant_invitations]([tenantId], [email]) WHERE [status] = 'pending';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
