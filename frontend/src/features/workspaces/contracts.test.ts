import { describe, expect, it } from 'vitest';
import { workspaceNameSchema, workspaceSchema } from './contracts';

describe('workspace API contracts', () => {
  it('normalizes names and enforces the backend limits', () => {
    expect(workspaceNameSchema.parse({ name: '  Side quests  ' })).toEqual({
      name: 'Side quests',
    });
    for (const name of ['', ' x ', 'x'.repeat(51)])
      expect(workspaceNameSchema.safeParse({ name }).success).toBe(false);
    expect(
      workspaceNameSchema.safeParse({ name: 'x'.repeat(50) }).success,
    ).toBe(true);
  });
  it('accepts the backend datetime formats and rejects malformed detail responses', () => {
    const workspace = {
      id: '7ac6e402-c83a-4c15-8c8d-531fb3ae5989',
      name: 'My Space',
      created_at: '2026-10-19T14:00:00',
    };
    expect(workspaceSchema.safeParse(workspace).success).toBe(true);
    expect(
      workspaceSchema.safeParse({
        ...workspace,
        created_at: `${workspace.created_at}Z`,
      }).success,
    ).toBe(true);
    expect(
      workspaceSchema.safeParse({ ...workspace, created_at: 'yesterday' })
        .success,
    ).toBe(false);
    expect(
      workspaceSchema.safeParse({ ...workspace, id: 'not-a-uuid' }).success,
    ).toBe(false);
  });
});
