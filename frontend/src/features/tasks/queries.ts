import { useEffect } from 'react';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { tagsSchema, tasksSchema, type TaskPreview } from './contracts';

type Request = ReturnType<typeof useAuth>['request'];

export function useTaskApi(workspaceId: string) {
  const { request, session } = useAuth();
  const client = useQueryClient();
  const key = ['tasks', session.user?.id, workspaceId];
  return {
    request,
    key,
    refresh: () => client.invalidateQueries({ queryKey: key }),
  };
}
export type TaskFilters = {
  search: string;
  statuses: TaskPreview['status'][];
  tagIds: string[];
  dueFrom: string;
  dueTo: string;
  orderBy: string;
  direction: string;
  offset: number;
};

export const initialTaskFilters: TaskFilters = {
  search: '',
  statuses: ['to do', 'in_progress', 'blocked'],
  tagIds: [],
  dueFrom: '',
  dueTo: '',
  orderBy: 'due_at',
  direction: 'asc',
  offset: 0,
};

export function taskListOptions(
  request: Request,
  key: readonly unknown[],
  workspaceId: string,
  filters: TaskFilters,
) {
  return queryOptions({
    queryKey: [...key, 'list', filters],
    retry: false,
    staleTime: 30_000,
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        limit: '50',
        offset: String(filters.offset),
        order_by: filters.orderBy,
        direction: filters.direction,
      });
      if (filters.search) params.set('search', filters.search);
      filters.statuses.forEach((status) => params.append('statuses', status));
      filters.tagIds.forEach((id) => params.append('tag_ids', id));
      if (filters.dueFrom) params.set('due_from', filters.dueFrom);
      if (filters.dueTo) params.set('due_to', filters.dueTo);
      return request(`/tasks?${params}`, tasksSchema, { signal });
    },
  });
}

export function taskTagOptions(
  request: Request,
  key: readonly unknown[],
  workspaceId: string,
) {
  return queryOptions({
    queryKey: [...key, 'tags'],
    retry: false,
    staleTime: 30_000,
    queryFn: ({ signal }) =>
      request(`/tags?workspace_id=${workspaceId}`, tagsSchema, { signal }),
  });
}

export function useTasks(workspaceId: string, filters: TaskFilters) {
  const { request, key } = useTaskApi(workspaceId);
  return useQuery(taskListOptions(request, key, workspaceId, filters));
}

export function useTags(workspaceId: string) {
  const { request, key } = useTaskApi(workspaceId);
  return useQuery(taskTagOptions(request, key, workspaceId));
}

export function useWorkspaceTaskPrefetch(
  workspaceId: string,
  enabled: boolean,
) {
  const { request, session } = useAuth();
  const client = useQueryClient();
  const userId = session.user?.id;
  const authenticated = session.status === 'authenticated';
  useEffect(() => {
    if (!enabled || !authenticated || !userId) return;
    const key = ['tasks', userId, workspaceId];
    // Both endpoints enforce membership themselves; neither depends on the
    // workspace detail response. The board reuses these exact cache entries.
    void client.prefetchQuery(
      taskListOptions(request, key, workspaceId, initialTaskFilters),
    );
    void client.prefetchQuery(taskTagOptions(request, key, workspaceId));
  }, [client, request, workspaceId, userId, enabled, authenticated]);
}
