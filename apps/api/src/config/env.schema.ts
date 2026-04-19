export function parseHttpAllowlist(
  disabledRaw: string | undefined,
  hostsRaw: string | undefined,
): Set<string> | null {
  const d = (disabledRaw || '').trim().toLowerCase();
  if (d === 'true' || d === '1' || d === 'yes') {
    return null;
  }
  const raw = (hostsRaw || '').trim();
  if (!raw) {
    return null;
  }
  const lower = raw.toLowerCase();
  if (lower === '*' || lower === '**' || lower === 'all') {
    return null;
  }
  return new Set(
    raw
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function loadEnv() {
  return {
    port: parseInt(process.env.PORT || '4000', 10),
    databaseUrl: process.env.DATABASE_URL || '',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    minio: {
      endpoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSsl: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minio',
      secretKey: process.env.MINIO_SECRET_KEY || 'minio12345',
      bucket: process.env.MINIO_BUCKET || 'reports',
    },
    gotenbergUrl: process.env.GOTENBERG_URL || 'http://localhost:3030',
    /** null = no hostname allowlist (any host except SSRF rules in assertUrlAllowed). */
    httpAllowlistHosts: parseHttpAllowlist(
      process.env.HTTP_ALLOWLIST_DISABLED,
      process.env.HTTP_ALLOWLIST_HOSTS,
    ),
    scriptTimeoutMs: parseInt(process.env.SCRIPT_TIMEOUT_MS || '12000', 10),
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    /** 仅当 AI_MOCK_ENABLED=true 时走 mock（默认关闭，请求真实模型）。 */
    aiMockEnabled: process.env.AI_MOCK_ENABLED === 'true',
    aiDailyLimit: parseInt(process.env.AI_DAILY_LIMIT || '100', 10),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  };
}
