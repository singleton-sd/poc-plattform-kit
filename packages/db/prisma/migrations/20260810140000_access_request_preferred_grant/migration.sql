BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[access_requests] ADD [preferredGrantType] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[access_requests] ADD [preferredGrantExpiresAt] DATETIME2 NULL;

CREATE NONCLUSTERED INDEX [access_requests_requesterId_action_resource_status_idx]
  ON [dbo].[access_requests]([requesterId], [action], [resource], [status]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
