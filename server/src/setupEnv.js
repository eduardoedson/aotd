import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

// Creates server/.env from .env.example on the first deploy and fills in a new
// VAPID key pair when the keys are empty. An existing .env keeps its values, so
// running this on every deploy is safe and never changes the keys (changing them
// would invalidate every browser subscription).

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function setValue(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) return content.replace(pattern, line);
  return `${content.replace(/\s*$/, '')}\n${line}\n`;
}

export function readValue(content, key) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim().replace(/^(['"])(.*)\1$/, '$2') : '';
}

export function prepareEnv(current, example, overrides = {}) {
  let content = current ?? example;
  const created = current === null;
  const changes = [];

  if (created) {
    for (const [key, value] of Object.entries(overrides)) {
      if (value) content = setValue(content, key, value);
    }
    changes.push('created from .env.example');
  }

  if (!readValue(content, 'VAPID_PUBLIC_KEY') || !readValue(content, 'VAPID_PRIVATE_KEY')) {
    const { publicKey, privateKey } = webpush.generateVAPIDKeys();
    content = setValue(content, 'VAPID_PUBLIC_KEY', publicKey);
    content = setValue(content, 'VAPID_PRIVATE_KEY', privateKey);
    changes.push('generated a new VAPID key pair');
  }

  return { content, changes };
}

function main() {
  const envPath = path.join(serverDir, '.env');
  const examplePath = path.join(serverDir, '.env.example');
  const current = existsSync(envPath) ? readFileSync(envPath, 'utf8') : null;
  const example = readFileSync(examplePath, 'utf8');

  // PUSH_PORT lets the deploy match the port of the vhost proxy on the first run.
  const { content, changes } = prepareEnv(current, example, { PORT: process.env.PUSH_PORT });

  if (changes.length === 0) {
    console.log('server/.env is ready (no changes)');
    return;
  }
  writeFileSync(envPath, content, { mode: 0o600 });
  console.log(`server/.env: ${changes.join(', ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
