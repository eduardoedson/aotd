import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareEnv, readValue, setValue } from '../src/setupEnv.js';

const EXAMPLE = 'PORT=7115\nVAPID_PUBLIC_KEY=\nVAPID_PRIVATE_KEY=\nVAPID_SUBJECT=mailto:a@b.c\n';

test('creates .env from the example with new VAPID keys and the given port', () => {
  const { content, changes } = prepareEnv(null, EXAMPLE, { PORT: '7200' });
  assert.equal(readValue(content, 'PORT'), '7200');
  assert.ok(readValue(content, 'VAPID_PUBLIC_KEY').length > 40);
  assert.ok(readValue(content, 'VAPID_PRIVATE_KEY').length > 20);
  assert.equal(readValue(content, 'VAPID_SUBJECT'), 'mailto:a@b.c');
  assert.equal(changes.length, 2);
});

test('never changes an existing .env that already has keys', () => {
  const current = 'PORT=7115\nVAPID_PUBLIC_KEY=pub\nVAPID_PRIVATE_KEY="priv"\n';
  const { content, changes } = prepareEnv(current, EXAMPLE, { PORT: '9999' });
  assert.equal(content, current);
  assert.deepEqual(changes, []);
});

test('fills only the missing keys of an existing .env', () => {
  const { content, changes } = prepareEnv('PORT=8000\n', EXAMPLE);
  assert.equal(readValue(content, 'PORT'), '8000');
  assert.ok(readValue(content, 'VAPID_PUBLIC_KEY'));
  assert.deepEqual(changes, ['generated a new VAPID key pair']);
});

test('setValue replaces or appends a key', () => {
  assert.equal(setValue('A=1\nB=2\n', 'B', '3'), 'A=1\nB=3\n');
  assert.equal(setValue('A=1\n', 'C', '4'), 'A=1\nC=4\n');
});
