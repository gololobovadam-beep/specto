export function slugify(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0400-\u04ff]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  return base || "untitled";
}

export function sortByOrder<T extends { sortOrder: number }>(items: T[]) {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder);
}

export function sortByUpdated<T extends { updatedAt: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export function clampIndex(index: number, length: number) {
  return Math.max(0, Math.min(index, length - 1));
}

