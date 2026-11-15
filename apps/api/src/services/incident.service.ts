import { createClient } from '@ssi/db';
import { sql } from 'drizzle-orm';
import { TransformersEmbeddingProvider } from '../embeddings/transformers-provider.js';
import type { EmbeddingProvider } from '../embeddings/provider.js';

const THRESHOLD = 0.35; // cosine-similarity floor (config-tunable)

export interface IncidentHit {
  summary_nr: number; event_date: string | null; text: string;
  similarity: number; contractor_ids: number[];
  rel_insp_nr: number | null; // a related inspection (for a working osha.gov link)
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
      SELECT ac.summary_nr, ac.event_date, ac.text, ac.contractor_ids,
             1 - (ac.embedding <=> ${vecLit}::vector) AS similarity,
             (SELECT ai.rel_insp_nr FROM accident_injury ai
                JOIN inspection i ON i.activity_nr = ai.rel_insp_nr
                WHERE ai.summary_nr = ac.summary_nr
                  ${contractorId ? sql`AND i.contractor_id = ${contractorId}` : sql``}
                LIMIT 1) AS rel_insp_nr
      FROM accident_chunk ac
      WHERE ac.embedding IS NOT NULL
        ${contractorId ? sql`AND ac.contractor_ids @> ARRAY[${contractorId}]::int[]` : sql``}
      ORDER BY ac.embedding <=> ${vecLit}::vector
      LIMIT ${k}`);
    return (rows as unknown as IncidentHit[]).filter((h) => Number(h.similarity) >= THRESHOLD);
  }
}
