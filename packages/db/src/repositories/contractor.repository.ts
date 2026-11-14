import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { contractor } from '../schema/contractors.js';

export type NewContractor = typeof contractor.$inferInsert;
export type Contractor = typeof contractor.$inferSelect;

export class ContractorRepository {
  constructor(private readonly db: Database) {}

  async create(input: NewContractor): Promise<Contractor> {
    const [row] = await this.db.insert(contractor).values(input).returning();
    return row!;
  }

  async findById(id: number): Promise<Contractor | undefined> {
    const [row] = await this.db.select().from(contractor).where(eq(contractor.id, id));
    return row;
  }
}
