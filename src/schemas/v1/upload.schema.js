import { z } from 'zod';

export const uploadSchema = z.object({
    path: z
    .string()
    .min(1, 'Path is required')
    .regex(/^\/?([a-zA-Z0-9_\-\/]+)$/, 'Invalid path format'),
})
