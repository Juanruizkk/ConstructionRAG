import '../../config.js'; // loads the root .env (DATABASE_URL)
import { createClient, CfrRepository, type NewCfrSection } from '@ssi/db';
import { isMain } from '../is-main.js';

// Official source: the U.S. government's electronic CFR (eCFR). Static, public, no rate limit.
const ECFR_DATE = '2026-01-01';
const UA = 'SiteSafetyIntelligence/1.0 (take-home project)';

// The 29 CFR construction standards that actually appear in our loaded violations (+ OSHA top-10).
const SECTIONS: { code: string; part: '1926' | '1910' }[] = [
  { code: '1926.20', part: '1926' },   // general safety & health provisions
  { code: '1926.21', part: '1926' },   // safety training & education
  { code: '1926.95', part: '1926' },   // PPE criteria
  { code: '1926.100', part: '1926' },  // head protection
  { code: '1926.102', part: '1926' },  // eye & face protection
  { code: '1926.451', part: '1926' },  // scaffolds — general
  { code: '1926.453', part: '1926' },  // aerial lifts
  { code: '1926.454', part: '1926' },  // scaffold training
  { code: '1926.501', part: '1926' },  // duty to have fall protection
  { code: '1926.502', part: '1926' },  // fall protection systems criteria
  { code: '1926.503', part: '1926' },  // fall protection training
  { code: '1926.1052', part: '1926' }, // stairways
  { code: '1926.1053', part: '1926' }, // ladders
  { code: '1910.1200', part: '1910' }, // hazard communication (general industry)
];

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#8217;|&rsquo;/g, "'").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#167;|&sect;|&#xA7;/g, '§').replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '');
}

async function fetchSection(part: string, code: string): Promise<{ title: string; text: string }> {
  const url = `https://www.ecfr.gov/api/versioner/v1/full/${ECFR_DATE}/title-29.xml?chapter=XVII&part=${part}&section=${code}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`eCFR ${code} -> ${res.status}`);
  const xml = await res.text();
  const head = /<HEAD>([\s\S]*?)<\/HEAD>/.exec(xml)?.[1] ?? '';
  const title = decodeEntities(head).replace(/^§?\s*[\d.]+\s*/, '').trim(); // drop the "§ 1926.501 " prefix
  const text = decodeEntities(xml.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  if (!text) throw new Error(`eCFR ${code} -> empty text`);
  return { title: title || code, text };
}

export async function loadCfr(): Promise<void> {
  const { db, queryClient } = createClient();
  const repo = new CfrRepository(db);
  const rows: NewCfrSection[] = [];
  for (const { code, part } of SECTIONS) {
    const { title, text } = await fetchSection(part, code);
    rows.push({ sectionCode: code, title, text });
    await new Promise((r) => setTimeout(r, 200)); // be polite
  }
  await repo.upsertMany(rows);
  await queryClient.end();
  console.log(`cfr_section loaded: ${rows.length} sections (from eCFR, verbatim)`);
}

if (isMain(import.meta.url)) {
  loadCfr().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
