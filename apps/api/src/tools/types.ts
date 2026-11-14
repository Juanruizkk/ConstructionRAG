import type { z } from 'zod';

export interface Citation {
  type: 'inspection' | 'incident' | 'cfr';
  activity_nr?: number;
  summary_nr?: number;
  section_code?: string;
  url: string;
}
export interface ToolResult { data: unknown; citations: Citation[] }

export interface Tool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: S;
  execute(args: z.infer<S>): Promise<ToolResult>;
}

export const oshaUrl = (activityNr: number) =>
  `https://www.osha.gov/ords/imis/establishment.inspection_detail?id=${activityNr}`;
