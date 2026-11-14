import {
  pgTable, serial, bigint, integer, text, date, boolean, index,
} from 'drizzle-orm/pg-core';

export const accident = pgTable('accident', {
  summaryNr: bigint('summary_nr', { mode: 'number' }).primaryKey(),
  eventDate: date('event_date', { mode: 'string' }),
  eventDesc: text('event_desc'),
  narrative: text('narrative'), // reassembled accident_abstract (the RAG source text)
  projectType: text('project_type'),
  buildStories: integer('build_stories'),
  nonbuildHt: integer('nonbuild_ht'),
  fatalityFlag: boolean('fatality_flag'),
});

export const accidentInjury = pgTable('accident_injury', {
  id: serial('id').primaryKey(),
  summaryNr: bigint('summary_nr', { mode: 'number' })
    .notNull()
    .references(() => accident.summaryNr),
  relInspNr: bigint('rel_insp_nr', { mode: 'number' }), // = inspection.activity_nr, FK NOT forced
  degreeOfInj: text('degree_of_inj'), // 1=Fatality,2=Hospitalized,3=NonHosp (raw code)
  natureOfInj: text('nature_of_inj'),
  partOfBody: text('part_of_body'),
  faultCause: text('fat_cause'),
  fallHt: integer('fall_ht'),
  fallDistance: integer('fall_distance'),
  age: integer('age'),
  sex: text('sex'),
}, (t) => [
  index('accident_injury_summary_idx').on(t.summaryNr),
  index('accident_injury_rel_insp_idx').on(t.relInspNr),
]);
