import { useDeferredValue } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

export const AREA_PAGE_SIZE = 50;

export const useInfiniteAreaList = ({
  queryKey,
  queryFn,
  search = '',
  extraParams = {},
  enabled = true,
  pageSize = AREA_PAGE_SIZE,
}) => {
  const deferredSearch = useDeferredValue(search);
  const query = useInfiniteQuery({
    queryKey: [...queryKey, { search: deferredSearch, pageSize, ...extraParams }],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await queryFn({
        page: pageParam,
        pageSize,
        search: deferredSearch.trim(),
        ...extraParams,
      });
      return response?.data ?? response;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (
      lastPage?.meta?.hasMore ? lastPage.meta.page + 1 : undefined
    ),
    enabled,
    staleTime: 30_000,
  });

  return {
    ...query,
    rows: query.data?.pages?.flatMap((page) => (
      Array.isArray(page?.data) ? page.data : []
    )) || [],
  };
};
