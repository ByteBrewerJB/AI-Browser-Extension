import { z } from 'zod';

const badgeColorSchema = z.enum([
  'emerald',
  'sky',
  'violet',
  'amber',
  'slate',
  'rose',
]);

const guideTopicSchema = z.string().min(1, 'topic must not be empty');

export const guideResourceSchema = z.object({
  id: z.string().min(1, 'guide id is required'),
  url: z.string().url('guide url must be a valid URL'),
  title: z.string().min(1, 'guide title is required'),
  description: z.string().min(1, 'guide description is required'),
  badgeColor: badgeColorSchema,
  topics: z.array(guideTopicSchema).default([]),
  estimatedTimeMinutes: z
    .number()
    .int('estimated time must be an integer')
    .positive('estimated time must be positive')
    .optional(),
});

export type GuideResource = z.infer<typeof guideResourceSchema>;

export const guidesFileSchema = z.object({
  version: z
    .number()
    .int('version must be an integer')
    .positive('version must be positive'),
  guides: z.array(guideResourceSchema).min(1, 'at least one guide is required'),
});

export type GuidesFile = z.infer<typeof guidesFileSchema>;

export function parseGuidesFile(payload: unknown): GuidesFile {
  return guidesFileSchema.parse(payload);
}
