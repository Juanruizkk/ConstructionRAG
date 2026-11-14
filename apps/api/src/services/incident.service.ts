import { createClient } from '@ssi/db';
import { sql } from 'drizzle-orm';
import { TransformersEmbeddingProvider } from '../embeddings/transformers-provider.js';
import type { EmbeddingProvider } from '../embeddings/provider.js';

const THRESHOLD = 0.35; // cosine-similarity floor (config-tunable)

export interface IncidentHit {
  summary_nr: number; event_date: string | null; text: string;
  similarity: number; contractor_ids: number[];
}

export class IncidentService {
  private deps = createClient();
  private embedder: EmbeddingProvider;

  constructor(embedder?: EmbeddingProvider) {
    this.embedder = embedder ?? new TransformersEmbeddingProvider();
  }

  async search(query: string, contractorId?: number, k = 5): Promise<IncidentHit[]> {
    const [vec] = await this.embedder.embed([query]);
    const vecLit = `[${vec!.join(',')}]`;
    // With a contractor filter: exact filtered scan (small set; HNSW could drop matches).
    // Global: the HNSW index serves the ORDER BY. similarity = 1 - cosine distance.
    const rows = await this.deps.db.execute(sql`
      SELECT summary_nr, event_date, text, contractor_ids,
             1 - (embedding <=> ${vecLit}::vector) AS similarity
      FROM accident_chunk
      WHERE embedding IS NOT NULL
        ${contractorId ? sql`AND contractor_ids @> ARRAY[${contractorId}]::int[]` : sql``}
      ORDER BY embedding <=> ${vecLit}::vector
      LIMIT ${k}`);
    return (rows as unknown as IncidentHit[]).filter((h) => Number(h.similarity) >= THRESHOLD);
  }
}
