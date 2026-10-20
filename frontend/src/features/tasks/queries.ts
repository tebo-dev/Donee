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
export function useTasks(workspaceId: string) {
  const { request, key } = useTaskApi(workspaceId);
  return useQuery({
    queryKey: [...key, 'list'],
    retry: false,
    queryFn: async ({ signal }) => {
      // Load every server page before offering workspace-wide search and filters.
      const tasks: TaskPreview[] = [];
      let total: number;
      do {
        const page = await request(
          `/tasks?workspace_id=${workspaceId}&limit=100&offset=${tasks.length}`,
          tasksSchema,
          { signal },
        );
        tasks.push(...page.tasks);
        total = page.total;
        if (!page.tasks.length) break;
      } while (tasks.length < total);
      return [...new Map(tasks.map((task) => [task.id, task])).values()];
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
