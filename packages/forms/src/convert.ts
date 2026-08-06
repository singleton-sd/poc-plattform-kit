import type { JsonSchema } from '@jsonforms/core';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/** Convert a Zod schema to a flat JSON Schema document suitable for JSON Forms. */
export function zodSchemaToJsonSchema(schema: ZodTypeAny): JsonSchema {
  const converted = zodToJsonSchema(schema, {
    $refStrategy: 'none',
  });
  return converted as JsonSchema;
}
