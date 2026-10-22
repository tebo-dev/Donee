import { z } from 'zod';

export const priorities = ['high', 'normal', 'low'] as const;
export const priorityLabels = { high: 'High', normal: 'Normal', low: 'Low' };
export const countsSchema = z.object({
  total: z.number(),
  active: z.number(),
  to_do: z.number(),
  in_progress: z.number(),
  blocked: z.number(),
  done: z.number(),
  archived: z.number(),
});

export const statuses = [
  'to do',
  'in_progress',
  'blocked',
  'done',
  'archived',
] as const;
export const statusLabels: Record<string, string> = {
  'to do': 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  archived: 'Archived',
};
export const messageSchema = z.object({ message: z.string() });
export const tagSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  created_at: z.string(),
});
export const tagsSchema = z.object({
  tags: z.array(tagSchema),
  total: z.number(),
});
export type Tag = z.infer<typeof tagSchema>;
export const previewSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  title: z.string(),
  status: z.enum(statuses),
  priority: z.enum(priorities),
  due_at: z.string(),
  tags: tagsSchema,
});
export const taskSchema = previewSchema.extend({
  description: z.string(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export const tasksSchema = z.object({
  tasks: z.array(previewSchema),
  total: z.number().int().nonnegative(),
  counts: countsSchema,
});
export type Task = z.infer<typeof taskSchema>;
export type TaskPreview = z.infer<typeof previewSchema>;
export const taskFormSchema = z.object({
  title: z.string().trim().min(2, 'Use at least 2 characters.').max(80),
  description: z.string().trim().max(10000),
  priority: z.enum(priorities),
  due_at: z.string().date('Choose a valid due date.'),
  status: z.enum(statuses),
  tagIds: z.array(z.string().uuid()).max(50, 'Choose up to 50 tags.'),
});
export type TaskForm = z.infer<typeof taskFormSchema>;
export function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function tagPatch(previous: string[], next: string[]) {
  return {
    add_tag_ids: next.filter((id) => !previous.includes(id)),
    remove_tag_ids: previous.filter((id) => !next.includes(id)),
  };
}
export function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
