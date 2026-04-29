type CorsOriginEntry = string | RegExp;

const CLOUDFLARE_PAGES_REGEX =
  /^https?:\/\/([a-z0-9]+)\.what-where-when-client\.pages\.dev$/;

export function getAllowedOrigins(): Array<CorsOriginEntry> {
  const origins: Array<CorsOriginEntry> = ['http://localhost:8081'];

  if (process.env.CLIENT_PUBLIC_API_URL) {
    origins.push(process.env.CLIENT_PUBLIC_API_URL);
  }

  if (process.env.CORS_EXTRA_ORIGINS) {
    for (const o of process.env.CORS_EXTRA_ORIGINS.split(',')) {
      const trimmed = o.trim();
      if (trimmed) origins.push(trimmed);
    }
  }

  origins.push(CLOUDFLARE_PAGES_REGEX);
  return origins;
}

export function isOriginAllowed(
  origin: string | undefined,
  allowed: Array<CorsOriginEntry> = getAllowedOrigins(),
): boolean {
  if (!origin) return true;
  return allowed.some((entry) =>
    entry instanceof RegExp ? entry.test(origin) : entry === origin,
  );
}
