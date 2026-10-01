import 'dotenv/config';
import { z } from 'zod';

const DEV_SECRET = 'dev-only-secret-change-me-dev-only-secret-change-me';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().optional(),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20)
});

export interface Config {
  env: 'development' | 'test' | 'production';
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigins: string[];
  uploadDir: string;
  maxUploadBytes: number;
  trustProxy: number;
  rateLimit: { windowMs: number; max: number; authMax: number };
}

/** Parse + validate environment. Throws with a readable message on misconfiguration. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const e = schema.parse(env);
  const prod = e.NODE_ENV === 'production';
  const problems: string[] = [];

  if (prod) {
    if (!e.DATABASE_URL) problems.push('DATABASE_URL is required in production');
    if (!e.JWT_SECRET || e.JWT_SECRET.length < 32) problems.push('JWT_SECRET (>= 32 chars) is required in production');
    if (e.JWT_SECRET === DEV_SECRET || /change[_-]?me/i.test(e.JWT_SECRET ?? '')) problems.push('JWT_SECRET must not be a placeholder value');
    if (!e.CORS_ORIGINS) problems.push('CORS_ORIGINS is required in production (comma-separated list of origins)');
    if (e.CORS_ORIGINS?.split(',').some(o => o.trim() === '*')) problems.push('CORS_ORIGINS must not contain "*" in production');
  }
  if (problems.length) throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);

  const corsDefault = 'http://localhost:4200,http://localhost:8081,http://localhost:19006';
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    jwtSecret: e.JWT_SECRET || DEV_SECRET,
    jwtExpiresIn: e.JWT_EXPIRES_IN,
    corsOrigins: (e.CORS_ORIGINS ?? corsDefault).split(',').map(s => s.trim()).filter(Boolean),
    uploadDir: e.UPLOAD_DIR,
    maxUploadBytes: Math.floor(e.MAX_UPLOAD_MB * 1024 * 1024),
    trustProxy: e.TRUST_PROXY,
    rateLimit: { windowMs: e.RATE_LIMIT_WINDOW_MS, max: e.RATE_LIMIT_MAX, authMax: e.AUTH_RATE_LIMIT_MAX }
  };
}
