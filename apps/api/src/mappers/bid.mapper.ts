export interface BidRowDto {
  contractorId: number | null;
  name: string;
  status: string;
  riskRaw: number | null;
  riskScore: number | null;
  fatalities: number | null;
  serious: number | null;
  inspections: number | null;
}

export function toBidRowDto(r: Record<string, unknown>): BidRowDto {
  return {
    contractorId: (r['contractor_id'] as number) ?? null,
    name: (r['display_name'] as string) ?? (r['entered_name'] as string),
    status: r['status'] as string,
    riskRaw: r['risk_raw'] != null ? Number(r['risk_raw']) : null,
    riskScore: r['risk_score'] != null ? Number(r['risk_score']) : null,
    fatalities: r['n_fatalities'] != null ? Number(r['n_fatalities']) : null,
    serious: r['n_serious'] != null ? Number(r['n_serious']) : null,
    inspections: r['n_inspections'] != null ? Number(r['n_inspections']) : null,
  };
}
