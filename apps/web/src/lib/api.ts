const base = import.meta.env.VITE_API_URL ?? '/api';

export interface BidRow {
  contractorId: number | null;
  name: string;
  state: string | null;
  status: string;
  riskRaw: number | null;
  riskScore: number | null;
  fatalities: number | null;
  serious: number | null;
  inspections: number | null;
}
export interface SearchHit { contractor_id: number; display_name: string; primary_state: string | null; confidence: number }
export interface Citation { type: string; activity_nr?: number; summary_nr?: number; url: string }
export interface ChatResponse { answer: string; citations: Citation[] }

export async function getBid(id: number): Promise<BidRow[]> {
  return (await fetch(`${base}/bids/${id}`)).json();
}
export async function searchContractor(name: string, state?: string): Promise<SearchHit[]> {
  const q = new URLSearchParams({ name, ...(state ? { state } : {}) });
  return (await fetch(`${base}/contractors/search?${q}`)).json();
}
export async function addToBid(bidId: number, body: { contractorId?: number; enteredName?: string }): Promise<BidRow[]> {
  return (await fetch(`${base}/bids/${bidId}/contractors`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })).json();
}
export async function chat(bidId: number, bidName: string, message: string): Promise<ChatResponse> {
  return (await fetch(`${base}/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bidId, bidName, message }),
  })).json();
}
