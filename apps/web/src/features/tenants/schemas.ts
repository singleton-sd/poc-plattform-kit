import { z } from 'zod';
import { zodSchemaToJsonSchema } from '@poc-plattform-kit/forms';

export const createTenantSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens'),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(120),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

export const createTenantJsonSchema = zodSchemaToJsonSchema(createTenantSchema);
export const updateTenantJsonSchema = zodSchemaToJsonSchema(updateTenantSchema);
