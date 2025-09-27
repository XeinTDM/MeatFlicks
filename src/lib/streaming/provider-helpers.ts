type PathSegment = string | number;

type ExtractPaths = Array<Array<PathSegment>>;

export const DEFAULT_STREAM_PATHS: ExtractPaths = [
  ['stream'],
  ['url'],
  ['file'],
  ['src'],
  ['result', 'stream'],
  ['result', 'url'],
  ['result', 'file'],
  ['data', 'stream'],
  ['data', 'url'],
  ['data', 'file'],
  ['data', 'sources', 0, 'file'],
  ['data', 'sources', 0, 'url'],
  ['sources', 0, 'file'],
  ['sources', 0, 'url'],
  ['source', 'file'],
  ['source', 'url'],
  ['streaming', 'file'],
  ['streaming', 'url']
];

export const DEFAULT_EMBED_PATHS: ExtractPaths = [
  ['embed'],
  ['player'],
  ['data', 'embed'],
  ['result', 'embed'],
  ['result', 'player'],
  ['links', 0, 'embed'],
  ['links', 0, 'url']
];

export function extractFirstUrl(payload: unknown, paths: ExtractPaths): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  for (const path of paths) {
    let current: any = payload;
    let valid = true;

    for (const segment of path) {
      if (Array.isArray(current) && typeof segment === 'number') {
        current = current[segment];
      } else if (
        current &&
        typeof current === 'object' &&
        segment in current
      ) {
        current = (current as Record<string | number, unknown>)[segment as any];
      } else {
        valid = false;
        break;
      }
    }

    if (!valid) continue;

    if (typeof current === 'string') {
      const normalized = current.startsWith('//') ? `https:${current}` : current;
      if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('/')) {
        return normalized;
      }
    }
  }

  return null;
}

export function ensureAbsoluteUrl(baseUrl: string, candidate: string | null): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate, baseUrl);
    return url.toString();
  } catch (error) {
    return candidate;
  }
}

export async function fetchWithTimeout(
  input: URL | string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 8000, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...rest, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
