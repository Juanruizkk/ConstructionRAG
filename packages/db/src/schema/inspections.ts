import {
  pgTable, bigint, integer, text, date, timestamp, index,
} from 'drizzle-orm/pg-core';
import { contractor } from './contractors.js';

export const inspection = pgTable('inspection', {
  activityNr: bigint('activity_nr', { mode: 'number' }).primaryKey(),
  contractorId: integer('contractor_id').references(() => contractor.id),
  estabNameRaw: text('estab_name_raw'),
  siteAddress: text('site_address'),
  siteCity: text('site_city'),
  siteState: text('site_state'),
  siteZip: text('site_zip'),
  naicsCode: text('naics_code'),
  inspType: text('insp_type'),
  openDate: date('open_date', { mode: 'string' }),
  // Data-coverage flag: set when we query the violation endpoint for this inspection.
  // Lets the app distinguish "looked, found nothing" (safe-ish) from "never loaded" (unknown).
  violationsLoadedAt: timestamp('violations_loaded_at', { withTimezone: true }),
}, (t) => [
  index('inspection_contractor_idx').on(t.contractorId),
  index('inspection_state_idx').on(t.siteState),
  index('inspection_naics_idx').on(t.naicsCode),
]);
