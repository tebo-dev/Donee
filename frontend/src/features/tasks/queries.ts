import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { tagsSchema, tasksSchema, type TaskPreview } from './contracts';

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
export function useTasks(workspaceId: string, filters: TaskFilters) {
  const { request, key } = useTaskApi(workspaceId);
  return useQuery({
    queryKey: [...key, 'list', filters],
    retry: false,
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
export function useTags(workspaceId: string) {
  const { request, key } = useTaskApi(workspaceId);
  return useQuery({
    queryKey: [...key, 'tags'],
    retry: false,
    queryFn: ({ signal }) =>
      request(`/tags?workspace_id=${workspaceId}`, tagsSchema, { signal }),
  });
}
