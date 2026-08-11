// Executes a resolved, ordered scenario list against a Prisma client.
// Deliberately tiny: all the interesting behaviour (ordering, dedup, cycle
// and conflict detection) lives in registry.mjs; this module just runs
// seed()/verify() in order and collects results.

export async function seedResolvedScenarios(prisma, resolved) {
  const results = [];
  for (const scenario of resolved) {
    await scenario.seed(prisma);
    results.push({ name: scenario.name });
  }
  return results;
}

export async function verifyResolvedScenarios(prisma, resolved) {
  const results = [];
  for (const scenario of resolved) {
    const result = await scenario.verify(prisma);
    results.push({ name: scenario.name, ok: result.ok, message: result.message });
  }
  return results;
}
