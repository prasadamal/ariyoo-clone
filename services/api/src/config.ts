import 'dotenv/config';

const production = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || 'dev_secret_change_me';
if (production && (jwtSecret.length < 32 || /dev_secret|change.me|placeholder/i.test(jwtSecret))) {
  throw new Error('Production requires a random JWT_SECRET of at least 32 characters');
}
if (production && !process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
if (production && (!allowedOrigins.length || allowedOrigins.includes('*'))) {
  throw new Error('Production requires explicit CORS_ORIGINS');
}
export const config = {
  port: Number(process.env.PORT || 3333),
  jwtSecret,
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  corsOrigin: allowedOrigins.length ? allowedOrigins : !production,
};
