import { zodSchemaToJsonSchema } from '@poc-plattform-kit/forms';
import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(2).max(80),
  category: z.enum(['Internal', 'Customer', 'Research']),
  active: z.boolean().default(true),
  launchDate: z.string().date(),
  tags: z.array(z.string().min(1)).min(1),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export const createProjectJsonSchema = zodSchemaToJsonSchema(createProjectSchema);
