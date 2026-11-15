-- Idempotent inspection column changes (runs before the risk view, which now reads violations_loaded_at).
-- Drop OSHA columns we don't surface anywhere.
ALTER TABLE inspection DROP COLUMN IF EXISTS insp_scope;
ALTER TABLE inspection DROP COLUMN IF EXISTS owner_type;
ALTER TABLE inspection DROP COLUMN IF EXISTS is_state_plan;
ALTER TABLE inspection DROP COLUMN IF EXISTS union_status;
ALTER TABLE inspection DROP COLUMN IF EXISTS safety_const;
ALTER TABLE inspection DROP COLUMN IF EXISTS nr_in_estab;
ALTER TABLE inspection DROP COLUMN IF EXISTS close_case_date;

-- Data-coverage flag.
ALTER TABLE inspection ADD COLUMN IF NOT EXISTS violations_loaded_at timestamptz;

-- Backfill coverage for data we already loaded: inspections that returned a violation,
-- or that belong to a matched contractor already on a bid (those were targeted for enrichment).
UPDATE inspection i SET violations_loaded_at = now()
WHERE violations_loaded_at IS NULL
  AND (
    EXISTS (SELECT 1 FROM violation v WHERE v.activity_nr = i.activity_nr)
    OR i.contractor_id IN (SELECT contractor_id FROM bid_contractor WHERE contractor_id IS NOT NULL)
  );
