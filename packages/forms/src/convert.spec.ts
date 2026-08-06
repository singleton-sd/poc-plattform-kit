import { z } from 'zod';
import { zodSchemaToJsonSchema } from './convert';

describe('zodSchemaToJsonSchema', () => {
  it('converts object fields, constraints, and required properties', () => {
    const schema = z.object({
      name: z.string().min(2).max(80),
      category: z.enum(['internal', 'external']),
      active: z.boolean().default(true),
      launchDate: z.string().date(),
      tags: z.array(z.string()).min(1),
      note: z.string().optional(),
    });

    expect(zodSchemaToJsonSchema(schema)).toEqual(
      expect.objectContaining({
        type: 'object',
        required: ['name', 'category', 'launchDate', 'tags'],
        properties: expect.objectContaining({
          name: expect.objectContaining({ type: 'string', minLength: 2, maxLength: 80 }),
          category: expect.objectContaining({ enum: ['internal', 'external'] }),
          active: expect.objectContaining({ type: 'boolean', default: true }),
          launchDate: expect.objectContaining({ type: 'string', format: 'date' }),
          tags: expect.objectContaining({ type: 'array', minItems: 1 }),
        }),
      }),
    );
  });

  it('inlines nested schemas instead of emitting references', () => {
    const schema = z.object({ profile: z.object({ displayName: z.string() }) });
    const converted = zodSchemaToJsonSchema(schema);

    expect(JSON.stringify(converted)).not.toContain('$ref');
    expect(converted.properties?.profile).toEqual(
      expect.objectContaining({ type: 'object', properties: { displayName: { type: 'string' } } }),
    );
  });
});
