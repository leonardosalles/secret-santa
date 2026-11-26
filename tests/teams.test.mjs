import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
function load(path, require = () => {}) {
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const exports = {};
  runInNewContext(outputText, { exports, require, crypto: webcrypto, Uint32Array });
  return exports;
}
const random = load('src/utils/draw.ts');
const { drawTeams } = load('src/utils/teams.ts', () => random);
test('equal teams include every selected player exactly once with unique identities', () => {
  for (let count = 2; count <= 8; count++) {
    for (let size = 1; size <= 10; size++) {
      const players = Array.from({ length: count * size }, (_, i) => ({ id: String(i), name: `Player ${i}`, secret: 'private' }));
      const before = JSON.stringify(players);
      const teams = drawTeams(players, size);
      assert.equal(teams.length, count);
      assert.deepEqual(Array.from(teams, team => team.name), ['Alfa', 'Beta', 'Gama', 'Delta', 'Épsilon', 'Zeta', 'Eta', 'Teta'].slice(0, count));
      assert.equal(new Set(teams.map(t => t.name)).size, count);
      assert.equal(new Set(teams.map(t => t.emblem)).size, count);
      const members = teams.flatMap(t => t.members);
      assert.equal(members.length, players.length);
      assert.equal(new Set(members.map(p => p.id)).size, players.length);
      for (const team of teams) assert.equal(team.members.length, size);
      for (const member of members) assert.deepEqual(Object.keys(member).sort(), ['id', 'name']);
      assert.equal(JSON.stringify(players), before);
    }
  }
});
test('remaining players form a smaller last team, including a single player', () => {
  for (const total of [1, 2, 9, 15, 17, 40]) {
    const players = Array.from({ length: total }, (_, i) => ({ id: String(i), name: String(i) }));
    const teams = drawTeams(players, 4);
    assert.equal(teams.length, Math.ceil(total / 4));
    for (const team of teams.slice(0, -1)) assert.equal(team.members.length, 4);
    assert.equal(teams.at(-1).members.length, total % 4 || 4);
    assert.equal(new Set(teams.flatMap(t => t.members.map(p => p.id))).size, total);
    assert.equal(new Set(teams.map(t => t.name)).size, teams.length);
  }
});
test('one team can contain fewer than the requested number and size one includes everyone', () => {
  const players = Array.from({ length: 3 }, (_, i) => ({ id: String(i), name: String(i) }));
  assert.equal(drawTeams(players, 10)[0].members.length, 3);
  assert.equal(drawTeams(players, 1).length, 3);
});
test('invalid sizes, empty selections and duplicate players are rejected', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: String(i) }));
  for (const size of [0, -1, 2.5, NaN, Infinity]) assert.throws(() => drawTeams(players, size));
  assert.throws(() => drawTeams([], 2));
  assert.throws(() => drawTeams([players[0], players[0]], 2));
});
