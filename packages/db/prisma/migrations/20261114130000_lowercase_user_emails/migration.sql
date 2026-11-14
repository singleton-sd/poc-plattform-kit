-- Align stored emails with Keycloak (which lowercases). Unique email stays
-- case-sensitive at the index; this rewrite plus case-insensitive lookup
-- prevents first-login P2002 after mixed-case Entra leftovers.
UPDATE users SET email = lower(email) WHERE email <> lower(email);
