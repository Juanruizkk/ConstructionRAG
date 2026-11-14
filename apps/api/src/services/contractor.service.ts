import { createClient, RiskRepository } from '@ssi/db';
import { sql } from 'drizzle-orm';

export class ContractorService {
  private deps = createClient();
  private risk = new RiskRepository(this.deps.db);

  async search(name: string, state?: string) { return this.risk.search(name, state); }
  async summary(contractorId: number) { return this.risk.summary(contractorId); }

  async compare(ids: number[], metric: string) {
    if (metric === 'falls') {
      // A5: a fall is identified by fall height/distance only. fat_cause is the cause of ANY fatality.
      const rows = await this.deps.db.execute(sql`
        SELECT i.contractor_id, c.display_name,
               COUNT(*) FILTER (WHERE ai.fall_ht IS NOT NULL OR ai.fall_distance IS NOT NULL) AS value
        FROM accident_injury ai
        JOIN inspection i ON i.activity_nr = ai.rel_insp_nr
        JOIN contractor c ON c.id = i.contractor_id
        WHERE i.contractor_id = ANY(${ids}) GROUP BY 1, 2 ORDER BY value DESC`);
      return rows as unknown as { contractor_id: number; display_name: string; value: number }[];
    }
    return this.risk.compare(ids, metric);
  }

  async listViolations(contractorId: number, since?: string, type?: string) {
    const rows = await this.deps.db.execute(sql`
      SELECT v.activity_nr, v.citation_id, v.standard, v.viol_type, v.current_penalty,
             v.issuance_date, (v.final_order_date IS NULL) AS pending
      FROM violation v JOIN inspection i ON i.activity_nr = v.activity_nr
      WHERE i.contractor_id = ${contractorId}
        ${since ? sql`AND v.issuance_date >= ${since}` : sql``}
        ${type ? sql`AND v.viol_type = ${type}` : sql``}
      ORDER BY v.issuance_date DESC NULLS LAST LIMIT 100`);
    return rows as unknown as Record<string, unknown>[];
  }
}
