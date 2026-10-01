import { z } from 'zod';

export const email = z.string().trim().toLowerCase().email().max(254);
export const password = z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters');
const name = z.string().trim().min(1).max(100);
const label = z.string().trim().min(1).max(50);

export const registerBody = z.object({
  email,
  password,
  flname: name,
  isSeeker: z.boolean().optional().default(true),
  isSolver: z.boolean().optional().default(false)
});

export const loginBody = z.object({ email, password: z.string().min(1).max(200) });

export const postQuestionBody = z.object({
  message: z.string().trim().min(1).max(5000),
  tag: z.array(z.object({ tagName: label })).max(20).optional().default([])
});

export const postMessageBody = z.object({
  messageText: z.string().trim().min(1).max(5000),
  sessionId: z.coerce.number().int().positive()
});

export const uploadImageBody = z.object({ sessionId: z.coerce.number().int().positive() });

export const addUserTagsBody = z
  .array(z.object({ tagId: z.number().int().nonnegative().optional(), tagName: label.optional(), userId: z.number().int().optional() }))
  .min(1)
  .max(50);

export const addUserPlaceBody = z.object({ placeName: label, userId: z.number().int().optional() });
export const addUserPlaceTagBody = z.object({ tagName: label, userId: z.number().int().optional() });

export const updateUserBody = z.object({
  id: z.number().int().optional(),
  fullName: name.optional(),
  userName: z.string().trim().regex(/^[a-zA-Z0-9_.-]{3,30}$/, '3-30 chars: letters, digits, _ . -').nullable().optional(),
  isSolver: z.boolean().optional()
});

export const updatePasswordBody = z.object({
  userId: z.number().int().optional(),
  oldPassword: z.string().min(1).max(200),
  newPassword: password
});

export const newsletterBody = z.object({ email });
