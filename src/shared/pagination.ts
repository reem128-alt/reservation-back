export type PaginationQuery = {
  page?: string | number;
  limit?: string | number;
  search?: string;
};

export type PaginationParams = {
  page: number;
  limit: number;
  skip: number;
  search?: string;
};

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function toInt(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function parsePaginationQuery(
  query: PaginationQuery,
  options?: { defaultLimit?: number; maxLimit?: number },
): PaginationParams {
  const defaultLimit = options?.defaultLimit ?? 10;
  const maxLimit = options?.maxLimit ?? 100;

  const pageRaw = toInt(query.page);
  const limitRaw = toInt(query.limit);

  const page = Math.max(1, pageRaw ?? 1);
  const limit = Math.min(maxLimit, Math.max(1, limitRaw ?? defaultLimit));

  const skip = (page - 1) * limit;
  const search = typeof query.search === 'string' && query.search.trim() !== '' ? query.search.trim() : undefined;

  return { page, limit, skip, search };
}

export function buildPaginationMeta(params: { total: number; page: number; limit: number }): PaginationMeta {
  const total = Math.max(0, Math.trunc(params.total));
  const page = Math.max(1, Math.trunc(params.page));
  const limit = Math.max(1, Math.trunc(params.limit));

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return { total, page, limit, totalPages };
}
