// Provider-neutral preview scenario registry: named, composable seed
// declarations with dependency resolution, cycle/conflict detection, and a
// uniform seed/verify contract. See docs/preview-scenarios.md for the
// naming convention (pillar/<pillar>/<scenario>, feature/<slug>/<scenario>,
// bug/<ticket-id>/<scenario>) and how to add a new scenario.
//
// A scenario is a plain object:
//   {
//     name: 'pillar/tenant/owner',
//     description: '...',
//     dependsOn: ['pillar/tenant/base'],   // optional, defaults to []
//     conflictsWith: ['pillar/tenant/x'],  // optional, defaults to []
//     testInstructions: '...',             // human-readable, for PR comments/docs
//     seed: async (prisma) => { ... },     // idempotent — safe to re-run
//     verify: async (prisma) => { ok, message },
//   }
//
// Seeding is provider-neutral: `seed`/`verify` only ever call standard
// Prisma Client APIs, so the same scenario code runs unchanged against the
// SQLite preview client or (in principle) the canonical SQL Server client.

export class UnknownScenarioError extends Error {
  constructor(name, knownNames) {
    super(
      `Unknown preview scenario "${name}". Supported scenarios:\n${knownNames
        .map((n) => `  - ${n}`)
        .join('\n')}`,
    );
    this.name = 'UnknownScenarioError';
    this.scenarioName = name;
    this.knownNames = knownNames;
  }
}

export class ScenarioCycleError extends Error {
  constructor(cyclePath) {
    super(`Preview scenario dependency cycle: ${cyclePath.join(' -> ')}`);
    this.name = 'ScenarioCycleError';
    this.cyclePath = cyclePath;
  }
}

export class ScenarioConflictError extends Error {
  constructor(a, b) {
    super(`Preview scenarios "${a}" and "${b}" conflict and cannot be composed together.`);
    this.name = 'ScenarioConflictError';
    this.scenarios = [a, b];
  }
}

export class DuplicateScenarioError extends Error {
  constructor(name) {
    super(`Preview scenario "${name}" is already registered.`);
    this.name = 'DuplicateScenarioError';
    this.scenarioName = name;
  }
}

export function createScenarioRegistry() {
  const scenarios = new Map();

  function define(scenario) {
    if (!scenario || typeof scenario.name !== 'string' || scenario.name.length === 0) {
      throw new Error('Scenario must have a non-empty string "name".');
    }
    if (typeof scenario.seed !== 'function') {
      throw new Error(`Scenario "${scenario.name}" must define a seed(prisma) function.`);
    }
    if (scenarios.has(scenario.name)) {
      throw new DuplicateScenarioError(scenario.name);
    }
    scenarios.set(scenario.name, {
      dependsOn: [],
      conflictsWith: [],
      description: '',
      testInstructions: '',
      verify: async () => ({ ok: true, message: 'no verification defined' }),
      ...scenario,
    });
    return registry;
  }

  function has(name) {
    return scenarios.has(name);
  }

  function get(name) {
    const scenario = scenarios.get(name);
    if (!scenario) {
      throw new UnknownScenarioError(name, listNames());
    }
    return scenario;
  }

  function listNames() {
    return [...scenarios.keys()].sort();
  }

  function list() {
    return listNames().map((name) => scenarios.get(name));
  }

  /**
   * Resolves a set of requested scenario names into a deterministic,
   * dependency-ordered, deduplicated list. Throws UnknownScenarioError,
   * ScenarioCycleError, or ScenarioConflictError on invalid input.
   */
  function resolve(names) {
    const requested = [...new Set(names)].sort();
    const order = [];
    const settled = new Set();
    const stack = [];

    function visit(name) {
      if (settled.has(name)) return;
      if (stack.includes(name)) {
        throw new ScenarioCycleError([...stack, name]);
      }
      const scenario = get(name);
      stack.push(name);
      for (const dep of scenario.dependsOn) visit(dep);
      stack.pop();
      settled.add(name);
      order.push(scenario);
    }

    for (const name of requested) visit(name);

    const resolvedNames = new Set(order.map((s) => s.name));
    for (const scenario of order) {
      for (const conflict of scenario.conflictsWith) {
        if (resolvedNames.has(conflict)) {
          throw new ScenarioConflictError(scenario.name, conflict);
        }
      }
    }

    return order;
  }

  const registry = { define, has, get, list, listNames, resolve };
  return registry;
}
