import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function loadConfig(value) {
  const source = readFileSync('src/lib/app-config.ts', 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const exports = {};
  runInNewContext(outputText, { exports, process: { env: { NEXT_PUBLIC_TEST_MODE: value, NEXT_PUBLIC_APP_YEAR: '2026' } } });
  return exports;
}

test('test mode never invokes a Firebase mutation', async () => {
  const config = loadConfig('true');
  assert.equal(config.IS_TEST_MODE, true);
  await config.runFirebaseWrite(() => { throw new Error('Firebase must not be called'); });
});

test('normal mode persists exactly once and waits for the write', async () => {
  const config = loadConfig('false');
  let calls = 0;
  await config.runFirebaseWrite(async () => { await Promise.resolve(); calls++; });
  assert.equal(calls, 1);
});

test('normal mode propagates Firebase write failures', async () => {
  await assert.rejects(loadConfig('false').runFirebaseWrite(async () => { throw new Error('permission-denied'); }), /permission-denied/);
});

test('test mode requires explicit true and is off by default', () => {
  for (const value of [undefined, 'false', '', 'TRUE']) assert.equal(loadConfig(value).IS_TEST_MODE, false);
});

test('private draw rejects before reading or writing Firebase in test mode', async () => {
  const { outputText } = ts.transpileModule(readFileSync('src/lib/secret-draw.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } });
  const exports = {};
  const unexpected = () => { throw new Error('Firebase must not be called'); };
  runInNewContext(outputText, { exports, require: (id) => {
    if (id === './app-config') return { IS_TEST_MODE: true, APP_YEAR: '2026' };
    if (id === 'firebase/firestore') return { collection: unexpected, getDocsFromServer: unexpected, runTransaction: unexpected };
    return {};
  } });
  await assert.rejects(exports.getOrCreatePrivateDraw('alice'), /modo teste não grava/);
});

test('test-mode login with an empty picked prepares only a local session', async () => {
  const { outputText } = ts.transpileModule(readFileSync('src/lib/draw-session.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } });
  const exports = {};
  const saved = new Map();
  const unexpected = () => { throw new Error('Firebase mutation must not be called'); };
  runInNewContext(outputText, { exports, sessionStorage: { setItem: (key, value) => saved.set(key, value) }, require: (id) => {
    if (id === './app-config') return { IS_TEST_MODE: true };
    if (id === './firebase') return { db: {} };
    if (id === 'firebase/firestore') return {
      doc: () => 'users/alice', getDoc: async () => ({ data: () => ({ picked: null }) }), runTransaction: unexpected,
    };
    if (id === '@/utils/crypto') return {
      createDrawIdentity: async () => ({ identity: { publicKey: 'public', privateKey: {} }, sessionKey: 'local-only' }),
      drawSessionKey: (id) => `secret-draw-key:${id}`,
      hashPassword: unexpected,
    };
    throw new Error(`Unexpected module ${id}`);
  } });
  await exports.prepareDrawSession('alice', 'password');
  assert.equal(saved.get('secret-draw-key:alice'), 'local-only');
});
