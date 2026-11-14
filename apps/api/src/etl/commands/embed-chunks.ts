import { createClient, ChunkRepository } from '@ssi/db';
import { TransformersEmbeddingProvider } from '../../embeddings/transformers-provider.js';
import { isMain } from '../is-main.js';

/** Build one chunk per accident from event_desc + reassembled narrative (A3), embed new/changed only. */
export async function embedChunks(): Promise<void> {
  const { db, queryClient: sql } = createClient();
  const repo = new ChunkRepository(db);
  const provider = new TransformersEmbeddingProvider();

  const accidents = await sql<{ summary_nr: string; event_date: string | null; event_desc: string | null; narrative: string | null }[]>`
    SELECT summary_nr, event_date, event_desc, narrative FROM accident`;
  const links = await sql<{ summary_nr: string; contractor_id: number }[]>`
    SELECT DISTINCT ai.summary_nr, i.contractor_id
    FROM accident_injury ai JOIN inspection i ON i.activity_nr = ai.rel_insp_nr
    WHERE i.contractor_id IS NOT NULL`;

  const contractorsBy = new Map<number, number[]>();
  for (const l of links) {
    const sn = Number(l.summary_nr);
    const arr = contractorsBy.get(sn) ?? [];
    arr.push(l.contractor_id);
    contractorsBy.set(sn, arr);
  }

  const built = accidents.map((a) => {
    const text = [a.event_desc, a.narrative].filter((t) => t && t.trim()).join('\n\n').trim();
    return { summaryNr: Number(a.summary_nr), eventDate: a.event_date, text };
  }).filter((a) => a.text.length > 0);

  const existing = await repo.existingTextBySummary();
  const toEmbed = built.filter((b) => existing.get(b.summaryNr) !== b.text);

  const batchSize = 64;
  for (let i = 0; i < toEmbed.length; i += batchSize) {
    const batch = toEmbed.slice(i, i + batchSize);
    const vectors = await provider.embed(batch.map((b) => b.text));
    await repo.deleteBySummary(batch.map((b) => b.summaryNr));
    await repo.insert(batch.map((b, j) => ({
      summaryNr: b.summaryNr,
      contractorIds: contractorsBy.get(b.summaryNr) ?? [],
      eventDate: b.eventDate,
      text: b.text,
      embedding: vectors[j]!,
      embeddingModel: provider.model,
    })));
  }

  await sql.end();
  console.log(`chunks embedded: ${toEmbed.length}`);
}

if (isMain(import.meta.url)) {
  embedChunks().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
