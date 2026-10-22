// Local development launcher. It runs the same push server, but with the port the
// Vite proxy expects (PUSH_SERVER_PORT) and the Vite dev server as allowed origin,
// so subscribing works on http://localhost without editing server/.env.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readValue } from './setupEnv.js';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(serverDir, '..');

const readEnvFile = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');

const serverEnv = readEnvFile(path.join(serverDir, '.env'));
const rootEnv = readEnvFile(path.join(rootDir, '.env'));

for (const key of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'REFRESH_MINUTES']) {
  const value = readValue(serverEnv, key);
  if (value && !process.env[key]) process.env[key] = value;
}

const vitePort = readValue(rootEnv, 'PORT') || '7115';
process.env.PORT = readValue(rootEnv, 'PUSH_SERVER_PORT') || '3100';
process.env.HOST = '127.0.0.1';
process.env.ALLOWED_ORIGIN = [`http://localhost:${vitePort}`, `http://127.0.0.1:${vitePort}`].join(
  ',',
);
// Local subscriptions never mix with a copy of the production data.
process.env.DATA_DIR = path.join(serverDir, 'data-dev');

console.log(`Dev push server for the Vite app on port ${vitePort}`);
await import('./index.js');
