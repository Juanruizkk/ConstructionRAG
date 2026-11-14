import { createClient } from '@ssi/db';
import { isMain } from '../is-main.js';

export async function refreshRisk(): Promise<void> {
  const { queryClient } = createClient();
  await queryClient`REFRESH MATERIALIZED VIEW contractor_risk`;
  await queryClient.end();
  console.log('contractor_risk refreshed');
}

if (isMain(import.meta.url)) {
  refreshRisk().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
