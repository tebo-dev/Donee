import { z } from 'zod';

export const workspaceIdSchema = z.string().uuid();
export const workspaceSchema = z.object({
  id: workspaceIdSchema,
  name: z.string(),
  created_at: z.string().datetime({ offset: true, local: true }),
});
export const workspaceListSchema = z.object({
  workspaces: z.array(workspaceSchema),
});
export const workspaceNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Use at least 2 characters.')
    .max(50, 'Use no more than 50 characters.'),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export type WorkspaceName = z.infer<typeof workspaceNameSchema>;

export function createdDate(value: string) {
  // FastAPI may serialize a naive UTC datetime without an offset.
  const date = new Date(
    /[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`,
  );
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
