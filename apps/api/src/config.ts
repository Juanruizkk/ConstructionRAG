import { z } from 'zod';

export const SCOPE = {
  states: ['CA', 'TX', 'NY'] as const,
  naicsPrefix: '23',
  // ~10 years back; verify the API's accepted date format during impl.
  openDateFrom: '2015-01-01',
  batchSize: 200,          // activity_nr / summary_nr per `in` request
  pageLimit: 10_000,       // API hard cap per page
};

export const ER = {
  trgmFloor: 0.65,         // below this: never a candidate
  cohesionTrgm: 0.80,      // member must reach this (or share a distinctive token) vs canonical
  genericTokens: new Set([
    'ROOFING', 'CONSTRUCTION', 'CONTRACTOR', 'CONTRACTORS', 'BUILDERS', 'BUILDING',
    'ELECTRIC', 'ELECTRICAL', 'PLUMBING', 'MECHANICAL', 'CONCRETE', 'MASONRY',
    'PAINTING', 'SERVICES', 'GROUP', 'ENTERPRISES', 'INDUSTRIES', 'COMPANY', 'AND',
  ]),
};

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_KEY_ODP: z.string().min(1),
  EMBEDDING_MODEL: z.string().default('Xenova/bge-small-en-v1.5'),
});
export const env = envSchema.parse(process.env);
export const API_BASE = 'https://apiprod.dol.gov/v4';
