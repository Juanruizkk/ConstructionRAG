import { inArray, sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { inspection } from '../schema/inspections.js';

export type NewInspection = typeof inspection.$inferInsert;

export class InspectionRepository {
  constructor(private readonly db: Database) {}

  /** Mark these inspections as "violations queried" (data-coverage flag), whether or not any came back. */
  async markViolationsLoaded(activityNrs: number[]): Promise<void> {
    if (activityNrs.length === 0) return;
    await this.db.update(inspection)
      .set({ violationsLoadedAt: new Date() })
      .where(inArray(inspection.activityNr, activityNrs));
  }

  async upsertMany(rows: NewInspection[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.insert(inspection).values(rows)
      .onConflictDoUpdate({
        target: inspection.activityNr,
        set: {
          estabNameRaw: sql`excluded.estab_name_raw`,
          naicsCode: sql`excluded.naics_code`,
        },
      });
  }

  async allActivityNrs(): Promise<number[]> {
    const rows = await this.db.select({ id: inspection.activityNr }).from(inspection);
    return rows.map((r) => r.id);
  }
}
