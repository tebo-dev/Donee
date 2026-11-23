import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { useAuth } from '../auth/auth-context';
import { initialTaskFilters, taskListOptions, taskTagOptions } from './queries';

const empty = {
  tasks: [],
  total: 0,
  counts: {
    total: 0,
    active: 0,
    to_do: 0,
    in_progress: 0,
    blocked: 0,
    done: 0,
    archived: 0,
  },
};

describe('task cache', () => {
  it('reuses fresh pages, invalidates every edited-workspace filter, and isolates accounts', async () => {
    const client = new QueryClient();
    const request: ReturnType<typeof useAuth>['request'] = vi.fn(
      async (path, schema) =>
        schema.parse(path.startsWith('/tags') ? { tags: [], total: 0 } : empty),
    );
    const key = ['tasks', 'alice', 'workspace'];
    const list = taskListOptions(request, key, 'workspace', initialTaskFilters);
    const filtered = taskListOptions(request, key, 'workspace', {
      ...initialTaskFilters,
      search: 'test',
    });
    const tags = taskTagOptions(request, key, 'workspace');
    const other = taskListOptions(
      request,
      ['tasks', 'bob', 'workspace'],
      'workspace',
      initialTaskFilters,
    );
    await Promise.all([
      client.fetchQuery(list),
      client.fetchQuery(filtered),
      client.fetchQuery(tags),
      client.fetchQuery(other),
    ]);
    expect(request).toHaveBeenCalledTimes(4);
    await client.fetchQuery(list);
    await client.fetchQuery(tags);
    expect(request).toHaveBeenCalledTimes(4);
    await client.invalidateQueries({ queryKey: key });
    await Promise.all([
      client.fetchQuery(list),
      client.fetchQuery(filtered),
      client.fetchQuery(tags),
      client.fetchQuery(other),
    ]);
    expect(request).toHaveBeenCalledTimes(7);
    // AuthProvider clears this client on account changes and session loss.
    client.clear();
    expect(client.getQueryData(list.queryKey)).toBeUndefined();
    expect(client.getQueryData(other.queryKey)).toBeUndefined();
  });
});
