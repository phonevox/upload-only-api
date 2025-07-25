import { z } from 'zod'

export const registerUserSchema = z.object({
  username: z.string().min(1, 'User name is required').regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.email('Invalid email address').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'user', 'client', 'superadmin']).optional().default('user')
}).strict();

export const loginUserSchema = z.object({
  username: z.string().min(1, 'User name is required'),
  password: z.string()
}).strict();

export const updateUserSchema = z.object({
  username: z.string().min(1, 'User name is required'),
  email: z.string().email('Invalid email address').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.enum(['admin', 'user', 'client', 'superadmin']).optional()
}).strict();

export const deleteUserSchema = z.object({
  username: z.string().min(1, 'User name is required')
}).strict();