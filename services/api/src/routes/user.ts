import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const userRouter = Router();

userRouter.put('/', requireAuth, async (req: AuthRequest, res) => {
  const { fullName, userName, isSolver } = req.body as {
    fullName?: string;
    userName?: string;
    isSolver?: boolean;
  };
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { fullName, userName, isSolver },
  });
  res.json({
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    userName: user.userName,
    isSolver: user.isSolver,
  });
});

userRouter.put('/updatepassword', requireAuth, async (req: AuthRequest, res) => {
  const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword?: string };
  if (!oldPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const ok = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Current password is incorrect' });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.json({ message: 'Password updated' });
});