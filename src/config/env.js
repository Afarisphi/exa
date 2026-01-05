import dotenv from 'dotenv';

dotenv.config();

const requiredEnvs = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET'
];

requiredEnvs.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing env variable: ${key}`);
  }
});

export const env = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  jwtSecret: process.env.JWT_SECRET
};
