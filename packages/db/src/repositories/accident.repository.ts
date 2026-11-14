import { sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { accident, accidentInjury } from '../schema/accidents.js';

export type NewAccident = typeof accident.$inferInsert;
export type NewInjury = typeof accidentInjury.$inferInsert;

export class AccidentRepository {
  constructor(private readonly db: Database) {}

  async upsertAccidents(rows: NewAccident[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.insert(accident).values(rows)
      .onConflictDoUpdate({
        target: accident.summaryNr,
        set: { eventDate: sql`excluded.event_date`, narrative: sql`excluded.narrative` },
      });
  }

  async insertInjuries(rows: NewInjury[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.insert(accidentInjury).values(rows).onConflictDoNothing();
  }
}
