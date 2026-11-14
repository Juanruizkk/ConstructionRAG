import {
  pgTable, bigint, integer, text, date, boolean, index,
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
  inspScope: text('insp_scope'),
  ownerType: text('owner_type'),
  isStatePlan: boolean('is_state_plan'),
  unionStatus: text('union_status'),
  safetyConst: text('safety_const'),
  nrInEstab: integer('nr_in_estab'),
  openDate: date('open_date', { mode: 'string' }),
  closeCaseDate: date('close_case_date', { mode: 'string' }),
}, (t) => [
  index('inspection_contractor_idx').on(t.contractorId),
  index('inspection_state_idx').on(t.siteState),
  index('inspection_naics_idx').on(t.naicsCode),
]);
