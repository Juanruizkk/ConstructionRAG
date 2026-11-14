import { sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { violation } from '../schema/violations.js';

export type NewViolation = typeof violation.$inferInsert;

export class ViolationRepository {
  constructor(private readonly db: Database) {}

  async upsertMany(rows: NewViolation[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.insert(violation).values(rows)
      .onConflictDoUpdate({
        target: [violation.activityNr, violation.citationId],
        set: { currentPenalty: sql`excluded.current_penalty`, violType: sql`excluded.viol_type` },
      });
  }
}
