import { sql } from 'drizzle-orm';
import {
  pgTable, serial, integer, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { contractor } from './contractors.js';
import { bidStatusEnum } from './_shared.js';

export const bid = pgTable('bid', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const bidContractor = pgTable('bid_contractor', {
  id: serial('id').primaryKey(),
  bidId: integer('bid_id').notNull().references(() => bid.id),
  contractorId: integer('contractor_id').references(() => contractor.id),
  enteredName: text('entered_name').notNull(),
  trade: text('trade'),
  status: bidStatusEnum('status').notNull(),
}, (t) => [
  uniqueIndex('bid_contractor_uq')
    .on(t.bidId, t.contractorId)
    .where(sql`${t.contractorId} IS NOT NULL`),
]);
