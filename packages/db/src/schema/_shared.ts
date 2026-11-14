import { customType, pgEnum } from 'drizzle-orm/pg-core';

// Postgres tsvector has no native Drizzle type; declare a minimal custom type.
export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// Enums ONLY for fields we control (never for raw OSHA codes — messy data).
export const matchMethodEnum = pgEnum('match_method', ['exact', 'trgm', 'typo']);
export const bidStatusEnum = pgEnum('bid_status', ['matched', 'not_found']);
