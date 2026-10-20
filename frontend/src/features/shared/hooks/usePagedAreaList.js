import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

export function usePagedAreaList({
  queryKey,
  queryFn,
  search = '',
  extraParams = {},
  page = 1,
  onPageChange,
  pageSize = 10,
}) {
  const query = useQuery({
    queryKey: [...queryKey, { search, ...extraParams, page, pageSize }],
    queryFn: async () =>
      (await queryFn({ search: search.trim(), ...extraParams, page, pageSize })).data,
  });
  const meta = query.data?.meta || {};
  const pages = Math.max(1, Math.ceil((meta.total || 0) / pageSize));
  useEffect(() => {
    if (query.isSuccess && page > pages) onPageChange?.(pages);
  }, [query.isSuccess, page, pages, onPageChange]);
  return { ...query, rows: query.data?.data || [], meta: { ...meta, pageSize }, pages };
}
