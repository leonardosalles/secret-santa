import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

function load(path) {
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } });
  const exports = {};
  runInNewContext(outputText, { exports, crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, Uint32Array, btoa, atob });
  return exports;
}
const crypto = load('src/utils/crypto.ts');
const draw = load('src/utils/draw.ts');
let alice;
let bob;
test('private keys are sealed with the participant password and cannot use the public password hash', async () => {
  alice = await crypto.createDrawIdentity('alice strong password', 'alice');
  bob = await crypto.createDrawIdentity('bob strong password', 'bob');
  assert.equal(await crypto.unlockDrawIdentity('alice strong password', 'alice', alice.identity.privateKey), alice.sessionKey);
  await assert.rejects(crypto.unlockDrawIdentity('wrong password', 'alice', alice.identity.privateKey));
  await assert.rejects(crypto.unlockDrawIdentity(await crypto.sha256('alice strong password'), 'alice', alice.identity.privateKey));
  await assert.rejects(crypto.unlockDrawIdentity('alice strong password', 'bob', alice.identity.privateKey));
});

test('only the intended participant decrypts, and the year and owner are bound to the ciphertext', async () => {
  const sealed = await crypto.encryptPicked(alice.identity.publicKey, 'bob', 'alice', '2026');
  assert.equal(await crypto.decryptPicked(alice.sessionKey, sealed, 'alice', '2026'), 'bob');
  await assert.rejects(crypto.decryptPicked(bob.sessionKey, sealed, 'alice', '2026'));
  await assert.rejects(crypto.decryptPicked(alice.sessionKey, sealed, 'bob', '2026'));
  await assert.rejects(crypto.decryptPicked(alice.sessionKey, sealed, 'alice', '2027'));
  const nextYear = { ...sealed, year: '2027' };
  await assert.rejects(crypto.decryptPicked(alice.sessionKey, nextYear, 'alice', '2027'));
  const second = await crypto.encryptPicked(alice.identity.publicKey, 'bob', 'alice', '2026');
  assert.notEqual(sealed.ciphertext, second.ciphertext);
  const tampered = { ...sealed, ciphertext: (sealed.ciphertext[0] === 'A' ? 'B' : 'A') + sealed.ciphertext.slice(1) };
  await assert.rejects(crypto.decryptPicked(alice.sessionKey, tampered, 'alice', '2026'));
});

test('password hashes use independent salts and keep legacy login compatibility', async () => {
  const password = 'a strong example password';
  const first = await crypto.hashPassword(password);
  assert.notEqual(first, await crypto.hashPassword(password));
  assert.equal(await crypto.verifyPassword(password, first), true);
  assert.equal(await crypto.verifyPassword('wrong password', first), false);
  assert.equal(await crypto.verifyPassword(password, await crypto.sha256(password)), true);
  assert.equal(await crypto.verifyPassword(password, 'invalid'), false);
});

test('complete assignments have no self-picks or duplicates, including two-person groups', () => {
  for (let size = 2; size <= 25; size++) {
    const ids = Array.from({ length: size }, (_, i) => String(i));
    for (let attempt = 0; attempt < 10; attempt++) {
      const assignments = draw.assignParticipants(ids);
      assert.equal(Object.keys(assignments).length, size);
      assert.equal(new Set(Object.values(assignments)).size, size);
      for (const id of ids) assert.notEqual(assignments[id], id);
    }
  }
});

test('migration preserves legacy results or refuses to modify conflicting ones', () => {
  const assignments = draw.assignParticipants(['a', 'b', 'c', 'd'], { a: 'b', b: 'c' });
  assert.equal(assignments.a, 'b');
  assert.equal(assignments.b, 'c');
  assert.equal(new Set(Object.values(assignments)).size, 4);
  assert.throws(() => draw.assignParticipants(['a', 'b', 'c'], { a: 'b', c: 'b' }));
  assert.throws(() => draw.assignParticipants(['a', 'b', 'c'], { a: 'b', b: 'a' }));
  assert.throws(() => draw.assignParticipants(['a']));
});

function loadPrivateDraw({ testMode = false, missingKey = false, failEncryption = false } = {}) {
  const records = new Map([
    ['users/alice', { name: 'Alice', drawIdentity: { publicKey: 'public-alice' } }],
    ['users/bob', { name: 'Bob', ...(missingKey ? {} : { drawIdentity: { publicKey: 'public-bob' } }) }],
  ]);
  let writes = 0;
  const snapshot = (reference) => {
    const path = typeof reference === 'string' ? reference : reference.path;
    const id = path.split('/').at(-1);
    return { id, ref: { path, id }, exists: () => records.has(path), data: () => records.get(path) };
  };
  const firestore = {
    collection: (_db, ...parts) => parts.join('/'),
    doc: (_db, ...parts) => ({ path: parts.join('/'), id: parts.at(-1) }),
    getDocsFromServer: async () => ({ docs: ['users/alice', 'users/bob'].map(snapshot) }),
    serverTimestamp: () => 'server-time',
    runTransaction: async (_db, callback) => {
      const pending = [];
      const result = await callback({
        get: async (path) => snapshot(path),
        update: (ref, values) => pending.push([ref.path, { ...records.get(ref.path), ...values }]),
        set: (ref, values) => pending.push([ref.path, values]),
      });
      for (const [path, values] of pending) { records.set(path, values); writes++; }
      return result;
    },
  };
  const { outputText } = ts.transpileModule(readFileSync('src/lib/secret-draw.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } });
  const exports = {};
  runInNewContext(outputText, { exports, require: (id) => {
    if (id === 'firebase/firestore') return firestore;
    if (id === './firebase') return { db: {} };
    if (id === './app-config') return { IS_TEST_MODE: testMode, APP_YEAR: '2026' };
    if (id === '@/utils/draw') return draw;
    if (id === '@/utils/crypto') return { encryptPicked: async (_key, _target, owner, year) => {
      if (failEncryption) throw new Error('Encryption failed');
      return { version: 1, algorithm: 'RSA-OAEP-256', year, ciphertext: `opaque-${owner}` };
    } };
    throw new Error(`Unexpected module: ${id}`);
  } });
  return { records, exports, writes: () => writes };
}

test('one atomic draw stores opaque picked values and later requests reuse them', async () => {
  const { exports, records, writes } = loadPrivateDraw();
  const first = await exports.getOrCreatePrivateDraw('alice');
  assert.equal(first.ciphertext, 'opaque-alice');
  assert.equal(writes(), 3);
  const edition = records.get('editions/2026/draws/secret');
  assert.equal(edition.version, 1);
  assert.equal('assignments' in edition, false);
  for (const id of ['alice', 'bob']) assert.equal(typeof records.get(`users/${id}`).picked, 'object');
  const second = await exports.getOrCreatePrivateDraw('bob');
  assert.equal(second.ciphertext, 'opaque-bob');
  assert.equal(writes(), 3);
});

test('missing keys and encryption errors leave every original record untouched', async () => {
  for (const options of [{ missingKey: true }, { failEncryption: true }]) {
    const { exports, records, writes } = loadPrivateDraw(options);
    await assert.rejects(exports.getOrCreatePrivateDraw('alice'));
    assert.equal(writes(), 0);
    assert.equal(records.size, 2);
    assert.equal(records.get('users/alice').picked, undefined);
  }
});
