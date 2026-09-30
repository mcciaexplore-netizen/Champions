-- Upgrades a nominations table created by the original schema:
--   * id: BIGSERIAL -> random UUID
--   * award: drop the old "Award 1..10" check (real award names are validated in the API)
--   * award_link: new column
-- Backward compatible with the previous app version (award_link is optional, id is still returned).
-- Run once: npm run db:migrate
ALTER TABLE nominations ADD COLUMN IF NOT EXISTS award_link TEXT CHECK (award_link LIKE 'https://mcciapune.com/awards/%');
ALTER TABLE nominations DROP CONSTRAINT IF EXISTS nominations_award_check;
ALTER TABLE nominations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE nominations ALTER COLUMN id TYPE UUID USING gen_random_uuid();
ALTER TABLE nominations ALTER COLUMN id SET DEFAULT gen_random_uuid();
DROP SEQUENCE IF EXISTS nominations_id_seq;
