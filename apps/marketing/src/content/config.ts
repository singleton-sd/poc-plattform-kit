import { defineCollection, z } from 'astro:content';

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    brand: z.string().optional(),
    headline: z.string().optional(),
    ctaLabel: z.string().optional(),
    ctaUrl: z.string().url().optional(),
    updated: z.string().optional(),
  }),
});

export const collections = { pages };
