import { z } from 'zod';
import { zodSchemaToJsonSchema } from '@poc-plattform-kit/forms';

export const createTenantSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  slug: z
    .string()
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens')
    .optional()
    .describe('URL-friendly identifier. Automatically generated if left blank.'),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

/** Normalizes raw JSON-Forms data before validation: blank slug becomes "omitted". */
export function toCreateTenantPayload(data: Record<string, unknown>): Record<string, unknown> {
  const slug = typeof data.slug === 'string' ? data.slug.trim() : data.slug;
  return { ...data, slug: slug || undefined };
}

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(120),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

export const createTenantJsonSchema = zodSchemaToJsonSchema(createTenantSchema);
export const updateTenantJsonSchema = zodSchemaToJsonSchema(updateTenantSchema);
