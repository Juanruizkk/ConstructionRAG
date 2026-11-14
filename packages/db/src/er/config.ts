// Shared entity-resolution constants (used by ETL resolution AND runtime search_contractor).
export const GENERIC_TOKENS = new Set([
  'ROOFING', 'CONSTRUCTION', 'CONTRACTOR', 'CONTRACTORS', 'BUILDERS', 'BUILDING',
  'ELECTRIC', 'ELECTRICAL', 'PLUMBING', 'MECHANICAL', 'CONCRETE', 'MASONRY',
  'PAINTING', 'SERVICES', 'GROUP', 'ENTERPRISES', 'INDUSTRIES', 'COMPANY', 'AND',
]);

export const TRGM_FLOOR = 0.65; // below this trigram similarity: never a candidate
export const COHESION_TRGM = 0.80; // a cluster member must reach this (or share a distinctive token) vs the canonical
