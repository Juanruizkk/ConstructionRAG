import { createClient } from '@ssi/db';
import { sql } from 'drizzle-orm';
import { loadViolations } from '../etl/commands/load-violations.js';
import { loadAccidents } from '../etl/commands/load-accidents.js';

export class BidService {
  private deps = createClient();

  /** Best-effort: pull OSHA history for a just-added contractor so it stops showing as "not loaded". */
  async enrichContractor(contractorId: number): Promise<void> {
    const rows = await this.deps.db.execute(sql`
      SELECT activity_nr FROM inspection WHERE contractor_id = ${contractorId}`);
    const anrs = (rows as unknown as { activity_nr: string }[]).map((r) => Number(r.activity_nr));
    if (anrs.length === 0) return;
    await loadViolations(anrs);  // marks violations_loaded_at per batch (coverage), partial-tolerant
    await loadAccidents(anrs);
    await this.deps.queryClient`REFRESH MATERIALIZED VIEW contractor_risk`;
  }

  async getBid(bidId: number) {
    const rows = await this.deps.db.execute(sql`
      SELECT bc.contractor_id, bc.entered_name, bc.trade, bc.status,
             c.display_name, c.primary_state, r.risk_raw, r.risk_score, r.history_loaded,
             r.n_fatalities, r.n_serious, r.n_inspections
      FROM bid_contractor bc
      LEFT JOIN contractor c ON c.id = bc.contractor_id
      LEFT JOIN contractor_risk r ON r.contractor_id = bc.contractor_id
      WHERE bc.bid_id = ${bidId}
      ORDER BY r.risk_raw DESC NULLS LAST`);
    return rows as unknown as Record<string, unknown>[];
  }

  /** A7: add a sub to a bid — matched (by contractor_id) or not_found (typed name). */
  async addContractor(bidId: number, input: { contractorId?: number; enteredName?: string; trade?: string }) {
    if (input.contractorId != null) {
      await this.deps.db.execute(sql`
        INSERT INTO bid_contractor (bid_id, contractor_id, entered_name, trade, status)
        SELECT ${bidId}, ${input.contractorId}, display_name, ${input.trade ?? null}, 'matched'
        FROM contractor WHERE id = ${input.contractorId}
        ON CONFLICT (bid_id, contractor_id) WHERE contractor_id IS NOT NULL DO NOTHING`);
    } else if (input.enteredName) {
      await this.deps.db.execute(sql`
        INSERT INTO bid_contractor (bid_id, contractor_id, entered_name, trade, status)
        VALUES (${bidId}, NULL, ${input.enteredName}, ${input.trade ?? null}, 'not_found')`);
    }
    return this.getBid(bidId);
  }
}
