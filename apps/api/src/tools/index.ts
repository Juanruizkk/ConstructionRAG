import { z } from 'zod';
import { ContractorService } from '../services/contractor.service.js';
import { IncidentService } from '../services/incident.service.js';
import { BidService } from '../services/bid.service.js';
import { oshaUrl, type Citation, type Tool } from './types.js';

const contractor = new ContractorService();
const incidents = new IncidentService();
const bids = new BidService();

export function buildTools(bidId: number): Tool[] {
  return [
    {
      name: 'get_bid',
      description: 'List the subcontractors on the current bid (matched + not_found), with risk.',
      schema: z.object({}),
      async execute() { return { data: await bids.getBid(bidId), citations: [] }; },
    },
    {
      name: 'search_contractor',
      description: 'Find contractors by name. Returns candidates with a confidence score (0-1).',
      schema: z.object({ name: z.string(), state: z.string().length(2).optional() }),
      async execute(a) { return { data: await contractor.search(a.name, a.state), citations: [] }; },
    },
    {
      name: 'get_contractor_summary',
      description: 'Risk breakdown for one contractor: counts by violation type, penalties, fatalities, risk score.',
      schema: z.object({ contractor_id: z.number().int() }),
      async execute(a) { return { data: await contractor.summary(a.contractor_id), citations: [] }; },
    },
    {
      name: 'list_violations',
      description: 'List citation items for a contractor (optionally since a date / by type S|W|R|O|U).',
      schema: z.object({ contractor_id: z.number().int(), since: z.string().optional(), type: z.string().optional() }),
      async execute(a) {
        const rows = await contractor.listViolations(a.contractor_id, a.since, a.type);
        const cits: Citation[] = [...new Set(rows.map((r) => Number(r['activity_nr'])))]
          .map((nr) => ({ type: 'inspection' as const, activity_nr: nr, url: oshaUrl(nr) }));
        return { data: rows, citations: cits };
      },
    },
    {
      name: 'compare_contractors',
      description: 'Rank contractors by a metric: risk_raw|fatalities|serious|repeat|willful|total_penalty|falls.',
      schema: z.object({ contractor_ids: z.array(z.number().int()), metric: z.string() }),
      async execute(a) { return { data: await contractor.compare(a.contractor_ids, a.metric), citations: [] }; },
    },
    {
      name: 'search_incidents',
      description: 'Semantic search over accident narratives. Optionally filter by contractor_id.',
      schema: z.object({ query: z.string(), contractor_id: z.number().int().optional() }),
      async execute(a) {
        const hits = await incidents.search(a.query, a.contractor_id);
        const cits: Citation[] = hits.map((h) => ({ type: 'incident', summary_nr: h.summary_nr, url: `https://www.osha.gov/ords/imis/accidentsearch.accident_detail?id=${h.summary_nr}` }));
        return { data: hits.length ? hits : 'no relevant incidents', citations: cits };
      },
    },
  ];
}
