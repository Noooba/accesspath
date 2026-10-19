import nextEnv from '@next/env';
import { initializeDatabase, closeDatabases } from '../src/lib/database/client';
nextEnv.loadEnvConfig(process.cwd());
try { const db = await initializeDatabase(); console.info(`Database migrations applied (${db.mode}).`); }
finally { await closeDatabases(); }
