const SLUG_PATTERN = /[^a-z0-9]+/g;

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function toSlug(value: string): string {
  const normalized = normalize(value);
  return normalized.replace(SLUG_PATTERN, '-').replace(/^-+|-+$/g, '');
}

export function fromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function createCollectionSlug(name: string): string {
  return toSlug(name);
}
