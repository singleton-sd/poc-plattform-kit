// Fixed synthetic epoch for scenario fixtures that want a stable, readable
// timeline (e.g. audit history) regardless of when a preview is built.
// Never derived from Date.now() — that would make "deterministic" seed
// output vary by build time for no reason.
export const SEED_EPOCH = new Date('2024-01-01T00:00:00.000Z');

export function atOffsetMinutes(minutes) {
  return new Date(SEED_EPOCH.getTime() + minutes * 60_000);
}
