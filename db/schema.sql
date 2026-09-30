-- Award nominations submitted from the form.
-- Column names match the form field names: name, company, email, phone, award.
-- id is a random UUID (unique, not guessable, no gaps to explain).
-- Award names/links are validated against public/awards.js in the API.
CREATE TABLE IF NOT EXISTS nominations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  company      TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  phone        TEXT        NOT NULL,
  award        TEXT        NOT NULL,
  award_link   TEXT        CHECK (award_link LIKE 'https://mcciapune.com/awards/%'),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups / counts per selected award
CREATE INDEX IF NOT EXISTS nominations_award_idx ON nominations (award);
CREATE INDEX IF NOT EXISTS nominations_submitted_at_idx ON nominations (submitted_at DESC);
