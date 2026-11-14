import { sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { accidentChunk } from '../schema/rag.js';

export type NewChunk = typeof accidentChunk.$inferInsert;

export class ChunkRepository {
  constructor(private readonly db: Database) {}

  async existingTextBySummary(): Promise<Map<number, string>> {
    const rows = await this.db.select({ s: accidentChunk.summaryNr, t: accidentChunk.text }).from(accidentChunk);
    return new Map(rows.map((r) => [r.s, r.t]));
  }

  async deleteBySummary(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.delete(accidentChunk).where(sql`summary_nr = ANY(${ids})`);
  }

  async insert(rows: NewChunk[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.insert(accidentChunk).values(rows);
  }
}
