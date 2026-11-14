import './config.js'; // loads root .env (DATABASE_URL, GROQ_API_KEY, ...)
import Fastify from 'fastify';
import { z } from 'zod';
import { BidService } from './services/bid.service.js';
import { ContractorService } from './services/contractor.service.js';
import { toBidRowDto } from './mappers/bid.mapper.js';
import { GroqProvider } from './agent/groq-provider.js';
import { runAgent } from './agent/loop.js';
import { buildTools } from './tools/index.js';
import { isMain } from './etl/is-main.js';

export function buildServer() {
  const app = Fastify({ logger: true });
  const bids = new BidService();
  const contractors = new ContractorService();
  const provider = new GroqProvider();

  app.get('/health', async () => ({ ok: true }));

  app.get('/bids/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    return (await bids.getBid(id)).map(toBidRowDto);
  });

  app.post('/bids/:id/contractors', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const body = z.object({
      contractorId: z.number().int().optional(),
      enteredName: z.string().optional(),
      trade: z.string().optional(),
    }).parse(req.body);
    return (await bids.addContractor(id, body)).map(toBidRowDto);
  });

  app.get('/contractors/search', async (req) => {
    const q = z.object({ name: z.string(), state: z.string().optional() }).parse(req.query);
    return contractors.search(q.name, q.state);
  });

  app.get('/contractors/:id/summary', async (req) => {
    const id = Number((req.params as { id: string }).id);
    return contractors.summary(id);
  });

  app.post('/chat', async (req) => {
    const body = z.object({
      bidId: z.number(),
      bidName: z.string().default('current bid'),
      message: z.string(),
    }).parse(req.body);
    const tools = buildTools(body.bidId);
    return runAgent({ provider, tools, bidName: body.bidName, userMessage: body.message });
  });

  return app;
}

if (isMain(import.meta.url)) {
  const app = buildServer();
  app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
    .catch((e) => { app.log.error(e); process.exit(1); });
}
