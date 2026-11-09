// Generate all assignments together: a public reservation list would leak pairs.
export function randomIndex(length: number) {
  if (!Number.isInteger(length) || length < 1 || length > 2 ** 32) throw new Error("Lista de participantes inválida.");
  const value = new Uint32Array(1);
  const limit = 2 ** 32 - (2 ** 32 % length);
  do { crypto.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % length;
}

export function assignParticipants(ids: string[], fixed: Record<string, string> = {}) {
  if (ids.length < 2 || new Set(ids).size !== ids.length) throw new Error("São necessários pelo menos dois participantes diferentes.");
  const assigned: Record<string, string> = Object.assign(Object.create(null), fixed);
  const used = new Set(Object.values(fixed));
  if (used.size !== Object.values(fixed).length || Object.entries(fixed).some(([id, target]) => !ids.includes(id) || !ids.includes(target) || id === target)) {
    throw new Error("Os resultados antigos têm conflitos. Nenhum resultado foi alterado.");
  }
  const remaining = ids.filter((id) => !assigned[id]);
  const shuffled = ids.filter((id) => !used.has(id));
  if (remaining.length === 1 && remaining[0] === shuffled[0]) throw new Error("Não é possível completar os resultados antigos sem repetir participantes. Nenhum resultado foi alterado.");
  // Rejection sampling gives every valid completion the same probability.
  do {
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomIndex(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  } while (remaining.some((id, i) => id === shuffled[i]));
  remaining.forEach((id, i) => { assigned[id] = shuffled[i]; });
  return assigned;
}
