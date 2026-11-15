import { eq, sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { cfrSection } from '../schema/rag.js';

export type NewCfrSection = typeof cfrSection.$inferInsert;
export type CfrSection = typeof cfrSection.$inferSelect;

export class CfrRepository {
  constructor(private readonly db: Database) {}

  async upsertMany(rows: NewCfrSection[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.insert(cfrSection).values(rows)
      .onConflictDoUpdate({
        target: cfrSection.sectionCode,
        set: { title: sql`excluded.title`, text: sql`excluded.text` },
      });
  }

  async findByCode(code: string): Promise<CfrSection | undefined> {
    const [row] = await this.db.select().from(cfrSection).where(eq(cfrSection.sectionCode, code));
    return row;
  }
}
