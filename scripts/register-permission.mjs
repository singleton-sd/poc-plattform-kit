#!/usr/bin/env node
/**
 * Register (or dry-run) a new {resource}:{action} in the permissions catalog.
 *
 * Default: dry-run (print planned changes). Pass --apply to write files.
 *
 * Example:
 *   node scripts/register-permission.mjs --method PATCH --path /contacts/:id \
 *     --action update --resourceType contact --resourceIdParam id
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseModelFgaRelations } from './check-permissions-catalog.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MANIFEST_REL = 'infra/openfga/permissions.manifest.json';
const API_MANIFEST_REL = 'apps/api/src/permissions/permissions.manifest.json';
const MODEL_FGA_REL = 'infra/openfga/model.fga';
const MODEL_JSON_REL = 'infra/openfga/model.json';

/**
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const out = { apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      out.apply = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for --${key}`);
      }
      out[key] = value;
      i += 1;
    }
  }
  return out;
}

/**
 * @param {Record<string, string | boolean>} args
 */
export function buildEntryFromArgs(args) {
  const method = String(args.method ?? '').toUpperCase();
  const path = String(args.path ?? '');
  const action = String(args.action ?? '');
  const resourceType = String(args.resourceType ?? '');
  const resourceIdParam = args.resourceIdParam != null ? String(args.resourceIdParam) : undefined;
  const id =
    args.id != null
      ? String(args.id)
      : `${resourceType}.${method.toLowerCase()}.${path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

  if (!method || !path || !action || !resourceType) {
    throw new Error(
      'Required: --method --path --action --resourceType (optional: --resourceIdParam --id --apply)',
    );
  }

  /** @type {Record<string, string>} */
  const entry = { id, method, path, action, resourceType };
  if (resourceIdParam) {
    entry.resourceIdParam = resourceIdParam;
  }
  return entry;
}

/**
 * @param {string} dsl
 * @param {string} resourceType
 * @param {string} action
 */
export function planModelFgaUpdate(dsl, resourceType, action) {
  const relations = parseModelFgaRelations(dsl);
  const existing = relations.get(resourceType);
  if (existing?.has(action)) {
    return { dsl, changed: false, note: `type ${resourceType} already has define ${action}` };
  }

  const defineLine = `    define ${action}: [user, user with not_yet_expired] or admin`;

  if (!existing) {
    const block = [
      '',
      `type ${resourceType}`,
      '  relations',
      '    define admin: [user, user with not_yet_expired]',
      '    define member: [user, user with not_yet_expired] or admin',
      defineLine,
      '',
    ].join('\n');

    // Insert before conditions (or append before trailing conditions block).
    const conditionIdx = dsl.search(/\ncondition\s+/);
    if (conditionIdx >= 0) {
      return {
        dsl: `${dsl.slice(0, conditionIdx).replace(/\s*$/, '\n')}${block}${dsl.slice(conditionIdx)}`,
        changed: true,
        note: `added type ${resourceType} with ${action}`,
      };
    }
    return {
      dsl: `${dsl.replace(/\s*$/, '\n')}${block}`,
      changed: true,
      note: `added type ${resourceType} with ${action}`,
    };
  }

  // Type exists — insert define after the type's relations block start.
  const typeRegex = new RegExp(`(type\\s+${resourceType}\\s*\\n\\s*relations\\n)`);
  if (!typeRegex.test(dsl)) {
    throw new Error(
      `Could not locate relations block for type ${resourceType} in ${MODEL_FGA_REL}`,
    );
  }
  const next = dsl.replace(typeRegex, `$1${defineLine}\n`);
  return { dsl: next, changed: true, note: `added define ${action} on type ${resourceType}` };
}

/**
 * Best-effort model.json patch for a new relation on an existing type (or new type).
 * Full fidelity still comes from model.fga; redeploy pushes model.json after transform/hand sync.
 * @param {object} modelJson
 * @param {string} resourceType
 * @param {string} action
 */
export function planModelJsonUpdate(modelJson, resourceType, action) {
  const types = Array.isArray(modelJson.type_definitions) ? modelJson.type_definitions : [];
  let typeDef = types.find((t) => t.type === resourceType);
  const relationThis = { this: {} };
  const relationWithAdmin = {
    union: {
      child: [{ this: {} }, { computedUserset: { object: '', relation: 'admin' } }],
    },
  };
  const userWithExpiry = [{ type: 'user' }, { type: 'user', condition: 'not_yet_expired' }];

  if (!typeDef) {
    typeDef = {
      type: resourceType,
      relations: {
        admin: relationThis,
        member: relationWithAdmin,
        [action]:
          action === 'admin'
            ? relationThis
            : action === 'member'
              ? relationWithAdmin
              : relationWithAdmin,
      },
      metadata: {
        relations: {
          admin: { directly_related_user_types: userWithExpiry },
          member: { directly_related_user_types: userWithExpiry },
          [action]: { directly_related_user_types: userWithExpiry },
        },
      },
    };
    return {
      modelJson: {
        ...modelJson,
        type_definitions: [...types, typeDef],
      },
      changed: true,
      note: `model.json: added type ${resourceType}`,
    };
  }

  if (typeDef.relations?.[action]) {
    return {
      modelJson,
      changed: false,
      note: `model.json: ${resourceType}.${action} already present`,
    };
  }

  const nextType = {
    ...typeDef,
    relations: {
      ...typeDef.relations,
      [action]: relationWithAdmin,
    },
    metadata: {
      ...typeDef.metadata,
      relations: {
        ...(typeDef.metadata?.relations ?? {}),
        [action]: { directly_related_user_types: userWithExpiry },
      },
    },
  };

  return {
    modelJson: {
      ...modelJson,
      type_definitions: types.map((t) => (t.type === resourceType ? nextType : t)),
    },
    changed: true,
    note: `model.json: added ${resourceType}.${action}`,
  };
}

/**
 * @param {{ root?: string, args: Record<string, string | boolean> }} options
 */
export function registerPermission({ root = ROOT, args }) {
  const entry = buildEntryFromArgs(args);
  const apply = Boolean(args.apply);

  const manifestPath = resolve(root, MANIFEST_REL);
  const apiManifestPath = resolve(root, API_MANIFEST_REL);
  const modelFgaPath = resolve(root, MODEL_FGA_REL);
  const modelJsonPath = resolve(root, MODEL_JSON_REL);

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const existing = (manifest.entries ?? []).find(
    (row) =>
      row.id === entry.id ||
      `${String(row.method).toUpperCase()} ${row.path}` === `${entry.method} ${entry.path}`,
  );

  let manifestChanged = false;
  if (existing) {
    Object.assign(existing, entry);
    manifestChanged = true;
  } else {
    manifest.entries = [...(manifest.entries ?? []), entry];
    manifestChanged = true;
  }

  const dsl = readFileSync(modelFgaPath, 'utf8');
  const fgaPlan = planModelFgaUpdate(dsl, entry.resourceType, entry.action);
  const modelJson = JSON.parse(readFileSync(modelJsonPath, 'utf8'));
  const jsonPlan = planModelJsonUpdate(modelJson, entry.resourceType, entry.action);

  const summary = {
    entry,
    apply,
    manifestChanged,
    modelFga: fgaPlan.note,
    modelJson: jsonPlan.note,
  };

  if (!apply) {
    console.log('Dry-run (pass --apply to write):');
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  writeFileSync(apiManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  if (fgaPlan.changed) {
    writeFileSync(
      modelFgaPath,
      fgaPlan.dsl.endsWith('\n') ? fgaPlan.dsl : `${fgaPlan.dsl}\n`,
      'utf8',
    );
  }
  if (jsonPlan.changed) {
    writeFileSync(modelJsonPath, `${JSON.stringify(jsonPlan.modelJson, null, 2)}\n`, 'utf8');
  }

  console.log('Applied:');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\nNext: pnpm permissions:check && ./infra/deploy-openfga.sh (push model).');
  return summary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    registerPermission({ args: parseArgs(process.argv.slice(2)) });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
