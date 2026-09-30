-- Award nominations submitted from the form.
-- Column names match the form field names: name, company, email, phone, award.
CREATE TABLE IF NOT EXISTS nominations (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT        NOT NULL,
  company      TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  phone        TEXT        NOT NULL,
  award        TEXT        NOT NULL CHECK (award ~ '^Award ([1-9]|10)$'),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups / counts per selected award
CREATE INDEX IF NOT EXISTS nominations_award_idx ON nominations (award);
CREATE INDEX IF NOT EXISTS nominations_submitted_at_idx ON nominations (submitted_at DESC);
