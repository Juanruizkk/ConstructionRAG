import {
  pgTable, serial, integer, text, timestamp, numeric, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { matchMethodEnum } from './_shared.js';

export const contractor = pgTable('contractor', {
  id: serial('id').primaryKey(),
  canonicalName: text('canonical_name').notNull(),
  displayName: text('display_name').notNull(),
  normName: text('norm_name').notNull(),
  primaryState: text('primary_state'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('contractor_norm_name_trgm_idx').using('gin', t.normName.op('gin_trgm_ops')),
]);

export const contractorAlias = pgTable('contractor_alias', {
  id: serial('id').primaryKey(),
  contractorId: integer('contractor_id').notNull().references(() => contractor.id),
  rawName: text('raw_name').notNull(),
  normName: text('norm_name').notNull(),
  occurrences: integer('occurrences').notNull().default(1),
  firstSeen: timestamp('first_seen', { withTimezone: true }),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  matchMethod: matchMethodEnum('match_method').notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 }),
}, (t) => [
  uniqueIndex('contractor_alias_uq').on(t.contractorId, t.normName),
  index('contractor_alias_norm_trgm_idx').using('gin', t.normName.op('gin_trgm_ops')),
]);
