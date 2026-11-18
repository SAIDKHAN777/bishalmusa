import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address format').optional(),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(4, 'New password must be at least 4 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
