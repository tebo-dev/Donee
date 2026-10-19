import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import {
  workspaceIdSchema,
  workspaceListSchema,
  workspaceSchema,
} from './contracts';

export function workspaceKeys(userId?: string) {
  return {
    all: ['workspaces', userId] as const,
    list: ['workspaces', userId, 'list'] as const,
    detail: (id: string) => ['workspaces', userId, 'detail', id] as const,
  };
}

export function useWorkspaces() {
  const { session, request } = useAuth();
  return useQuery({
    queryKey: workspaceKeys(session.user?.id).list,
    queryFn: ({ signal }) =>
      request('/workspaces', workspaceListSchema, { signal }),
    enabled: session.status === 'authenticated',
    retry: false,
    staleTime: 30_000,
  });
}

export function useWorkspace(id: string) {
  const { session, request } = useAuth();
  const valid = workspaceIdSchema.safeParse(id).success;
  const query = useQuery({
    queryKey: workspaceKeys(session.user?.id).detail(id),
    queryFn: ({ signal }) =>
      request(`/workspaces/${id}`, workspaceSchema, { signal }),
    enabled: valid && session.status === 'authenticated',
    retry: false,
    staleTime: 30_000,
  });
  return { ...query, valid };
}
