import { sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { normalizeName } from '../er/normalize.js';

export interface RiskRow {
  contractor_id: number; display_name: string; primary_state: string | null;
  risk_raw: number; risk_score: number; history_loaded: boolean;
  n_inspections: number; n_inspections_loaded: number; n_inspections_clean: number;
  n_serious: number; n_willful: number; n_repeat: number; n_other: number; n_unclassified: number;
  n_pending_contested: number; total_current_penalty: string;
  n_fatalities: number; n_fatalities_cited: number; n_fatalities_no_citation: number;
  n_hospitalizations: number; last_inspection_date: string | null; score_as_of: string;
}

export interface SearchHit { contractor_id: number; display_name: string; primary_state: string | null; confidence: number }

export class RiskRepository {
  constructor(private readonly db: Database) {}

  async summary(contractorId: number): Promise<RiskRow | null> {
    const rows = await this.db.execute(sql`
      SELECT r.*, c.display_name, c.primary_state FROM contractor_risk r
      JOIN contractor c ON c.id = r.contractor_id WHERE r.contractor_id = ${contractorId}`);
    return (rows as unknown as RiskRow[])[0] ?? null;
  }

  /** A6: normalize like the ETL, match against contractor AND alias norm_names (trigram). */
  async search(name: string, state?: string): Promise<SearchHit[]> {
    const norm = normalizeName(name);
    if (!norm) return [];
    const rows = await this.db.execute(sql`
      SELECT c.id AS contractor_id, c.display_name, c.primary_state,
             GREATEST(similarity(c.norm_name, ${norm}),
                      COALESCE(MAX(similarity(a.norm_name, ${norm})), 0)) AS confidence
      FROM contractor c
      LEFT JOIN contractor_alias a ON a.contractor_id = c.id
      WHERE (c.norm_name % ${norm} OR a.norm_name % ${norm})
        ${state ? sql`AND c.primary_state = ${state}` : sql``}
      GROUP BY c.id, c.display_name, c.primary_state, c.norm_name
      ORDER BY confidence DESC LIMIT 10`);
    return rows as unknown as SearchHit[];
  }

  async compare(ids: number[], metric: string): Promise<{ contractor_id: number; display_name: string; value: number }[]> {
    const allowed: Record<string, string> = {
      risk_raw: 'r.risk_raw', fatalities: 'r.n_fatalities', serious: 'r.n_serious',
      repeat: 'r.n_repeat', willful: 'r.n_willful', total_penalty: 'r.total_current_penalty',
    };
    const col = allowed[metric] ?? 'r.risk_raw';
    const rows = await this.db.execute(sql`
      SELECT r.contractor_id, c.display_name, ${sql.raw(col)}::numeric AS value
      FROM contractor_risk r JOIN contractor c ON c.id = r.contractor_id
      WHERE r.contractor_id = ANY(${ids}) ORDER BY value DESC`);
    return rows as unknown as { contractor_id: number; display_name: string; value: number }[];
  }
}
