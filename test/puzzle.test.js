import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, rotateMask, initialRotations, traceWater, loadProgress } from '../src/puzzle.js';

test('every authored island has a complete, leak-free route to its gardens', () => {
  for (const level of LEVELS) {
    const result = traceWater(level, Array(level.size ** 2).fill(0));
    assert.equal(result.solved, true, level.name);
    assert.equal(result.leaks.length, 0);
    assert.equal(result.fed.length, level.targets.length);
    assert.equal(result.wet.size, Object.keys(level.channels).length);
  }
});
test('all shipped starting positions require play and a blocked inlet feeds nothing', () => {
  for (const level of LEVELS) {
    assert.equal(traceWater(level, initialRotations(level)).solved, false);
    const rotations = Array(level.size ** 2).fill(0); rotations[level.source[0]] = 1;
    const result = traceWater(level, rotations);
    assert.equal(result.wet.size, 0); assert.equal(result.solved, false);
  }
});
test('a turned branch cannot irrigate a disconnected garden', () => {
  const level = LEVELS[0]; const rotations = Array(9).fill(0); rotations[1] = 1;
  const result = traceWater(level, rotations);
  assert.ok(result.fed.length < level.targets.length);
  assert.ok(result.leaks.length > 0); assert.equal(result.solved, false);
});
test('rotation closes after four turns, including counterclockwise turns', () => {
  for (let mask = 0; mask < 16; mask++) {
    assert.equal(rotateMask(mask, 4), mask);
    assert.equal(rotateMask(rotateMask(mask, -1), 1), mask);
  }
});
test('saved progress accepts a valid game and rejects corrupt or unexpected data', () => {
  const valid = {version: 1, level: 0, rotations: initialRotations(LEVELS[0]), turns: 3};
  assert.deepEqual(loadProgress(JSON.stringify(valid)), {level:0,rotations:valid.rotations,turns:3});
  for (const invalid of ['oops', JSON.stringify({...valid,level:99}), JSON.stringify({...valid,rotations:[1]}), JSON.stringify({...valid,turns:-2})]) assert.equal(loadProgress(invalid), null);
});
