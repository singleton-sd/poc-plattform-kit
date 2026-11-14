-- Align stored emails with Keycloak (which lowercases). Unique email stays
-- case-sensitive at the index; this rewrite plus case-insensitive lookup
-- prevents first-login P2002 after mixed-case Entra leftovers.
-- Abort first if two rows would collide after lower() — otherwise migrate
-- deploy fails with an opaque unique_violation in production.
DO $$
DECLARE
  dup_emails text;
BEGIN
  SELECT string_agg(grouped.email, ', ' ORDER BY grouped.email)
  INTO dup_emails
  FROM (
    SELECT lower(email) AS email
    FROM users
    GROUP BY lower(email)
    HAVING COUNT(*) > 1
  ) AS grouped;

  IF dup_emails IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot lowercase users.email: case-insensitive duplicates exist (%). Resolve those rows before migrating.',
      dup_emails;
  END IF;
END $$;

UPDATE users SET email = lower(email) WHERE email <> lower(email);
