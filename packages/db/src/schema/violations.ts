import {
  pgTable, serial, bigint, integer, text, numeric, date, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { inspection } from './inspections.js';

export const violation = pgTable('violation', {
  id: serial('id').primaryKey(),
  activityNr: bigint('activity_nr', { mode: 'number' })
    .notNull()
    .references(() => inspection.activityNr),
  citationId: text('citation_id').notNull(),
  standard: text('standard'),
  violType: text('viol_type'), // S|W|R|O|U (raw OSHA code, kept as text)
  currentPenalty: numeric('current_penalty'),
  initialPenalty: numeric('initial_penalty'),
  nrInstances: integer('nr_instances'),
  nrExposed: integer('nr_exposed'),
  gravity: integer('gravity'),
  issuanceDate: date('issuance_date', { mode: 'string' }),
  abateDate: date('abate_date', { mode: 'string' }),
  finalOrderDate: date('final_order_date', { mode: 'string' }),
}, (t) => [
  uniqueIndex('violation_activity_citation_uq').on(t.activityNr, t.citationId),
  index('violation_activity_idx').on(t.activityNr),
  index('violation_type_idx').on(t.violType),
]);
