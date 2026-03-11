export const hasIntegrationEnv = Boolean(process.env.DATABASE_URL) && Boolean(process.env.REDIS_URL);
