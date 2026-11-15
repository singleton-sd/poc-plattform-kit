-- Align stored emails with Keycloak (which lowercases). Unique email stays
-- case-sensitive at the index; this rewrite plus case-insensitive lookup
-- prevents first-login P2002 after mixed-case Entra leftovers.
-- Abort first if two rows would collide after lower() — otherwise migrate
-- deploy fails with an opaque unique_violation in production.
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*)
  INTO dup_count
  FROM (
    SELECT 1
    FROM users
    GROUP BY lower(email)
    HAVING COUNT(*) > 1
  ) AS grouped;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot lowercase users.email: % case-insensitive duplicate group(s). Resolve those rows before migrating.',
      dup_count;
  END IF;
END $$;

UPDATE users SET email = lower(email) WHERE email <> lower(email);
