import { createClient, CfrRepository } from '@ssi/db';
import { parseStandardToCfr } from '../cfr/parse-standard.js';

export interface ExplainResult {
  found: boolean;
  reason?: 'not_cfr' | 'not_in_corpus';
  message?: string;
  section_code?: string;
  title?: string;
  text?: string;
  url?: string;
}

const oshaStandardUrl = (part: string, code: string) =>
  `https://www.osha.gov/laws-regs/regulations/standardnumber/${part}/${code}`;

export class StandardService {
  private deps = createClient();
  private repo = new CfrRepository(this.deps.db);

  async explain(input: string): Promise<ExplainResult> {
    const code = parseStandardToCfr(input);
    if (!code) {
      return { found: false, reason: 'not_cfr', message: 'Not a federal 29 CFR standard — likely a state-plan or general-duty code.' };
    }
    const part = code.split('.')[0]!;
    const url = oshaStandardUrl(part, code);
    const row = await this.repo.findByCode(code);
    if (!row) return { found: false, reason: 'not_in_corpus', section_code: code, url };
    // Trim the verbatim text so a long section doesn't blow the LLM token budget; full text + link are the citation.
    const text = row.text.length > 1200 ? `${row.text.slice(0, 1200)}…` : row.text;
    return { found: true, section_code: code, title: row.title ?? undefined, text, url };
  }
}
