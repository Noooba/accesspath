import nextEnv from '@next/env';
import { initializeDatabase, closeDatabases } from '../src/lib/database/client';
import { seedDatabase } from '../src/lib/database/repository';
import { DEMO_GRAPH, SITES } from '../src/data/demo-campus';
nextEnv.loadEnvConfig(process.cwd());
try {
  const db = await initializeDatabase();
  await seedDatabase([DEMO_GRAPH, ...SITES.filter((site) => site.id !== DEMO_GRAPH.site.id).map((site) => ({ site, nodes: [], edges: [] }))], db);
  console.info('Synthetic campus and empty pilot sites seeded idempotently. No real accessibility observations were added.');
} finally { await closeDatabases(); }
