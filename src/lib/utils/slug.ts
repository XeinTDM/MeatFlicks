export function createCollectionSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}