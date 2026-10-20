const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const parsePagination = (query = {}, defaultPageSize = 20) => {
  const page = toPositiveInt(query.page, 1);
  const requestedPageSize = toPositiveInt(query.pageSize || query.limit, defaultPageSize);
  const pageSize = Math.min(requestedPageSize, 100);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
};

export const buildPaginationMeta = ({ page, pageSize, total }) => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
  hasMore: page * pageSize < total,
});
