CREATE OR REPLACE VIEW accident_inspection AS
  SELECT DISTINCT summary_nr, rel_insp_nr FROM accident_injury WHERE rel_insp_nr IS NOT NULL;

DROP MATERIALIZED VIEW IF EXISTS contractor_risk;
CREATE MATERIALIZED VIEW contractor_risk AS
WITH v AS (
  SELECT i.contractor_id,
         vi.viol_type,
         vi.final_order_date,
         -- A4: fall back to the inspection open_date when issuance_date is null, so severity is not zeroed.
         POWER(0.5, GREATEST(0, (CURRENT_DATE - COALESCE(vi.issuance_date, i.open_date))) / 365.0 / 5.0) AS decay
  FROM violation vi JOIN inspection i ON i.activity_nr = vi.activity_nr
  WHERE i.contractor_id IS NOT NULL
),
vagg AS (
  SELECT contractor_id,
    COUNT(*) FILTER (WHERE viol_type='S') AS n_serious,
    COUNT(*) FILTER (WHERE viol_type='W') AS n_willful,
    COUNT(*) FILTER (WHERE viol_type='R') AS n_repeat,
    COUNT(*) FILTER (WHERE viol_type='O') AS n_other,
    COUNT(*) FILTER (WHERE viol_type='U') AS n_unclassified,
    COUNT(*) FILTER (WHERE final_order_date IS NULL) AS n_pending_contested,
    COALESCE(SUM(decay * CASE viol_type WHEN 'W' THEN 10 WHEN 'R' THEN 7 WHEN 'S' THEN 3 ELSE 1 END), 0) AS vss
  FROM v GROUP BY contractor_id
),
cited AS (
  SELECT ai.summary_nr, ai.rel_insp_nr,
         bool_or(vi.viol_type IN ('S','W','R')) AS has_swr
  FROM accident_injury ai
  LEFT JOIN violation vi ON vi.activity_nr = ai.rel_insp_nr
  GROUP BY ai.summary_nr, ai.rel_insp_nr
),
h AS (
  SELECT i.contractor_id, ai.degree_of_inj,
         -- A4: event_date fallback to the employer inspection open_date.
         POWER(0.5, GREATEST(0, (CURRENT_DATE - COALESCE(a.event_date, i.open_date))) / 365.0 / 5.0) AS decay,
         COALESCE(c.has_swr, false) AS has_swr
  FROM accident_injury ai
  JOIN inspection i ON i.activity_nr = ai.rel_insp_nr AND i.contractor_id IS NOT NULL
  JOIN accident a ON a.summary_nr = ai.summary_nr
  LEFT JOIN cited c ON c.summary_nr = ai.summary_nr AND c.rel_insp_nr = ai.rel_insp_nr
),
hagg AS (
  SELECT contractor_id,
    COUNT(*) FILTER (WHERE degree_of_inj='1') AS n_fatalities,
    COUNT(*) FILTER (WHERE degree_of_inj='1' AND has_swr) AS n_fatalities_cited,
    COUNT(*) FILTER (WHERE degree_of_inj='1' AND NOT has_swr) AS n_fatalities_no_citation,
    COUNT(*) FILTER (WHERE degree_of_inj='2') AS n_hospitalizations,
    COALESCE(SUM(COALESCE(decay,0)
        * CASE degree_of_inj WHEN '1' THEN 50 WHEN '2' THEN 15 WHEN '3' THEN 3 ELSE 0 END
        * CASE WHEN has_swr THEN 1.0 ELSE 0.3 END), 0) AS hs
  FROM h GROUP BY contractor_id
),
insp AS (
  SELECT i.contractor_id,
    COUNT(*) AS n_inspections,
    COUNT(*) FILTER (WHERE i.violations_loaded_at IS NOT NULL) AS n_inspections_loaded,
    COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM violation vv WHERE vv.activity_nr=i.activity_nr)) AS n_inspections_clean,
    MAX(i.open_date) AS last_inspection_date
  FROM inspection i WHERE i.contractor_id IS NOT NULL GROUP BY i.contractor_id
)
SELECT c.id AS contractor_id,
  COALESCE(insp.n_inspections,0) AS n_inspections,
  COALESCE(insp.n_inspections_loaded,0) AS n_inspections_loaded,
  (COALESCE(insp.n_inspections_loaded,0) > 0) AS history_loaded,
  COALESCE(insp.n_inspections_clean,0) AS n_inspections_clean,
  COALESCE(vagg.n_serious,0) AS n_serious,
  COALESCE(vagg.n_willful,0) AS n_willful,
  COALESCE(vagg.n_repeat,0) AS n_repeat,
  COALESCE(vagg.n_other,0) AS n_other,
  COALESCE(vagg.n_unclassified,0) AS n_unclassified,
  COALESCE(vagg.n_pending_contested,0) AS n_pending_contested,
  COALESCE((SELECT SUM(current_penalty::numeric) FROM violation vi JOIN inspection i2 ON i2.activity_nr=vi.activity_nr WHERE i2.contractor_id=c.id),0) AS total_current_penalty,
  COALESCE(hagg.n_fatalities,0) AS n_fatalities,
  COALESCE(hagg.n_fatalities_cited,0) AS n_fatalities_cited,
  COALESCE(hagg.n_fatalities_no_citation,0) AS n_fatalities_no_citation,
  COALESCE(hagg.n_hospitalizations,0) AS n_hospitalizations,
  insp.last_inspection_date,
  (10 * COALESCE(vagg.vss,0) / GREATEST(COALESCE(insp.n_inspections,0),3) + COALESCE(hagg.hs,0)) AS risk_raw,
  LEAST(100, ROUND(10 * COALESCE(vagg.vss,0) / GREATEST(COALESCE(insp.n_inspections,0),3) + COALESCE(hagg.hs,0)))::int AS risk_score,
  NOW() AS score_as_of
FROM contractor c
LEFT JOIN insp ON insp.contractor_id = c.id
LEFT JOIN vagg ON vagg.contractor_id = c.id
LEFT JOIN hagg ON hagg.contractor_id = c.id;

CREATE UNIQUE INDEX IF NOT EXISTS contractor_risk_pk ON contractor_risk (contractor_id);
