import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { heroes, items } from './mockApiData.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => response.json({ ok: true }));
app.get('/api/heroes', (_request, response) => response.json({ data: heroes, source: 'mock' }));
app.get('/api/items', (_request, response) => response.json({ data: items, source: 'mock' }));

app.post('/api/sync/deadlock-data', (_request, response) => {
  response.status(501).json({
    message: 'External Deadlock data sync is intentionally stubbed until a trusted API source and Supabase credentials are configured.',
    recommendedSchedule: 'weekly',
  });
});

app.listen(port, () => {
  console.log(`Deadlock build simulator API listening on http://localhost:${port}`);
});
