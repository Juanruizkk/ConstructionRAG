import {
  pgTable, serial, bigint, integer, text, date, vector, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { accident } from './accidents.js';
import { tsvector } from './_shared.js';

export const accidentChunk = pgTable('accident_chunk', {
  id: serial('id').primaryKey(),
  summaryNr: bigint('summary_nr', { mode: 'number' })
    .notNull()
    .references(() => accident.summaryNr),
  contractorIds: integer('contractor_ids').array(),
  eventDate: date('event_date', { mode: 'string' }),
  text: text('text').notNull(),
  tsv: tsvector('tsv'),
  embedding: vector('embedding', { dimensions: 384 }),
  embeddingModel: text('embedding_model'),
}, (t) => [
  index('accident_chunk_embedding_hnsw')
    .using('hnsw', t.embedding.op('vector_cosine_ops')),
  index('accident_chunk_contractors_gin').using('gin', t.contractorIds),
  index('accident_chunk_tsv_gin').using('gin', t.tsv),
]);

export const cfrSection = pgTable('cfr_section', {
  id: serial('id').primaryKey(),
  sectionCode: text('section_code').notNull(),
  title: text('title'),
  text: text('text').notNull(),
}, (t) => [
  uniqueIndex('cfr_section_code_uq').on(t.sectionCode),
]);
