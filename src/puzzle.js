// Cardinal ports run clockwise: north, east, south, west.
export const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const LEVELS = [
  { name: 'First light', size: 3, source: [3, 3], targets: [[2, 1], [8, 1]],
    channels: { 1: 6, 2: 10, 3: 10, 4: 11, 5: 12, 8: 3 },
    note: 'One spring. Two gardens. Turn the channels until both bloom.' },
  { name: 'The branching tide', size: 4, source: [4, 3], targets: [[3, 1], [14, 2], [15, 1]],
    channels: { 1: 6, 2: 10, 3: 10, 4: 10, 5: 11, 6: 14, 7: 12, 10: 5, 11: 5, 14: 5, 15: 3 },
    note: 'Three gardens share the spring. Watch for water escaping at an edge.' },
  { name: 'A little archipelago', size: 5, source: [10, 3], targets: [[3, 0], [9, 1], [14, 1], [23, 2]],
    channels: { 3: 5, 6: 6, 7: 10, 8: 11, 9: 10, 10: 10, 11: 13, 13: 6, 14: 10, 16: 3, 17: 10, 18: 13, 23: 5 },
    note: 'Trace two branches through the islands. No timer; take your time.' },
];

export function rotateMask(mask, turns) {
  const n = ((turns % 4) + 4) % 4;
  return ((mask << n) | (mask >> (4 - n))) & 15;
}

export function initialRotations(level, seed = 19) {
  let state = (seed >>> 0) || 1;
  return Array.from({ length: level.size ** 2 }, (_, index) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return level.channels[index] ? 1 + (state % 3) : 0;
  });
}

export function traceWater(level, rotations) {
  const masks = rotations.map((r, i) => rotateMask(level.channels[i] || 0, r));
  const [start, inlet] = level.source;
  const wet = new Set();
  const distance = new Map();
  const edges = [];
  const leaks = [];
  const targetPorts = new Set(level.targets.map(([i, d]) => `${i}:${d}`));
  if (!(masks[start] & (1 << inlet))) {
    return { wet, distance, edges, leaks, fed: [], solved: false, inletBlocked: true };
  }
  const queue = [start]; wet.add(start); distance.set(start, 0);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    const x = index % level.size, y = Math.floor(index / level.size);
    for (let d = 0; d < 4; d++) {
      if (!(masks[index] & (1 << d))) continue;
      if ((index === start && d === inlet) || targetPorts.has(`${index}:${d}`)) continue;
      const [dx, dy] = DIRECTIONS[d]; const nx = x + dx, ny = y + dy;
      const next = ny * level.size + nx;
      if (nx < 0 || ny < 0 || nx >= level.size || ny >= level.size || !(masks[next] & (1 << ((d + 2) % 4)))) {
        leaks.push([index, d]); continue;
      }
      if (index < next) edges.push([index, next]);
      if (!wet.has(next)) { wet.add(next); distance.set(next, distance.get(index) + 1); queue.push(next); }
    }
  }
  const fed = level.targets.filter(([index, d]) => wet.has(index) && (masks[index] & (1 << d)));
  return { wet, distance, edges, leaks, fed, solved: fed.length === level.targets.length && leaks.length === 0, inletBlocked: false };
}

export function loadProgress(raw) {
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Number.isInteger(data.level) || !LEVELS[data.level]) return null;
    if (!Array.isArray(data.rotations) || data.rotations.length !== LEVELS[data.level].size ** 2) return null;
    if (!data.rotations.every(n => Number.isInteger(n) && n >= 0 && n <= 3)) return null;
    if (!Number.isInteger(data.turns) || data.turns < 0 || data.turns > 1000000) return null;
    return { level: data.level, rotations: [...data.rotations], turns: data.turns };
  } catch { return null; }
}
