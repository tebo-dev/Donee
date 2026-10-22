import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { Field, FormError } from '../auth/FormParts';
import {
  localToday,
  messageSchema,
  statuses,
  statusLabels,
  tagPatch,
  taskFormSchema,
  taskSchema,
  type Task,
  type TaskForm,
} from './contracts';
import { useTags, useTaskApi } from './queries';
import { Attachments } from './Attachments';

export function TaskEditor({
  workspaceId,
  taskId,
  canEdit,
  onClose,
}: {
  workspaceId: string;
  taskId?: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const { request, key } = useTaskApi(workspaceId);
  const query = useQuery({
    queryKey: [...key, 'detail', taskId],
    enabled: Boolean(taskId),
    retry: false,
    queryFn: ({ signal }) =>
      request(`/tasks/${taskId}`, taskSchema, { signal }),
  });
  if (taskId && !query.data)
    return (
      <Modal title="Open task" onClose={onClose}>
        {query.isError ? (
          <>
            <FormError message={query.error.message} />
            <button className="secondary" onClick={() => void query.refetch()}>
              Try again
            </button>
          </>
        ) : (
          <p role="status">Opening task…</p>
        )}
      </Modal>
    );
  if (query.data && query.data.workspace_id !== workspaceId)
    return (
      <Modal title="Task unavailable" onClose={onClose}>
        <p role="alert">This task belongs to a different workspace.</p>
      </Modal>
    );
  return (
    <EditorForm
      key={taskId || 'new'}
      workspaceId={workspaceId}
      task={query.data}
      canEdit={canEdit}
      onClose={onClose}
    />
  );
}

function EditorForm({
  workspaceId,
  task: initialTask,
  canEdit,
  onClose,
}: {
  workspaceId: string;
  task?: Task;
  canEdit: boolean;
  onClose: () => void;
}) {
  const { request, refresh } = useTaskApi(workspaceId);
  // Keep the editing baseline stable if a background refetch finishes mid-draft.
  const [task] = useState(initialTask);
  const tags = useTags(workspaceId);
  const [confirm, setConfirm] = useState<'discard' | 'delete' | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const form = useForm<TaskForm>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title || '',
      description: task?.description || '',
      priority: task?.priority ?? 'normal',
      due_at: task?.due_at || localToday(),
      status: task?.status || 'to do',
      tagIds: task?.tags.tags.map((tag) => tag.id) || [],
    },
  });
  const save = useMutation({
    mutationFn: (values: TaskForm) => {
      const { tagIds, status, ...fields } = values;
      const changes = task
        ? Object.fromEntries(
            Object.entries({ ...fields, status }).filter(
              ([field, value]) => value !== task[field as keyof Task],
            ),
          )
        : { ...fields, workspace_id: workspaceId };
      return request(task ? `/tasks/${task.id}` : '/tasks', taskSchema, {
        method: task ? 'PATCH' : 'POST',
        body: {
          ...changes,
          tags: tagPatch(task?.tags.tags.map((tag) => tag.id) || [], tagIds),
        },
      });
    },
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      request(`/tasks/${task!.id}`, messageSchema, { method: 'DELETE' }),
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  const busy = save.isPending || remove.isPending || attachmentBusy;
  const close = () => {
    if (busy) return;
    if (form.formState.isDirty) setConfirm('discard');
    else onClose();
  };
  return (
    <Modal
      title={task ? 'A little closer.' : 'One thing at a time.'}
      busy={busy}
      onClose={close}
    >
      {confirm ? (
        <div className="task-confirm">
          <h3>
            {confirm === 'delete'
              ? 'Delete this task?'
              : 'Discard your changes?'}
          </h3>
          <p>
            {confirm === 'delete'
              ? `“${task?.title}” and its attachments will be permanently deleted.`
              : 'Your unsaved edits will be lost.'}
          </p>
          <FormError message={remove.error?.message} />
          <div className="task-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Keep editing
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                confirm === 'delete' ? remove.mutate() : onClose()
              }
            >
              {busy
                ? 'Deleting…'
                : confirm === 'delete'
                  ? 'Delete permanently'
                  : 'Discard changes'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <form
            className="task-form"
            noValidate
            onSubmit={form.handleSubmit((values) => save.mutate(values))}
            onKeyDown={(event) => {
              if (
                (event.ctrlKey || event.metaKey) &&
                event.key === 'Enter' &&
                canEdit &&
                !busy
              ) {
                event.preventDefault();
                void form.handleSubmit((values) => save.mutate(values))();
              }
            }}
          >
            <fieldset disabled={busy || !canEdit}>
              <Field
                label="Task title"
                maxLength={80}
                autoFocus
                registration={form.register('title')}
                error={form.formState.errors.title?.message}
              />
              <label className="field">
                Description
                <textarea
                  rows={4}
                  maxLength={10000}
                  {...form.register('description')}
                />
              </label>
              <div className="task-field-grid">
                <Field
                  label="Due date"
                  type="date"
                  registration={form.register('due_at')}
                  error={form.formState.errors.due_at?.message}
                />
                <label className="field">
                  Priority
                  <select {...form.register('priority')}>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </label>
              </div>
              {task && (
                <label className="field">
                  Status
                  <select {...form.register('status')}>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="field">
                <span>Tags</span>
                {tags.isPending ? (
                  <p>Loading tags…</p>
                ) : tags.isError ? (
                  <p role="alert">
                    Tags could not load. Existing assignments will be preserved.
                  </p>
                ) : (
                  <div className="task-tag-picker">
                    {tags.data.tags.length ? (
                      tags.data.tags.map((tag) => (
                        <label key={tag.id}>
                          <input
                            type="checkbox"
                            value={tag.id}
                            {...form.register('tagIds')}
                          />
                          {tag.name}
                        </label>
                      ))
                    ) : (
                      <p className="field-hint">
                        No tags yet. Add them using Manage tags in your task
                        list.
                      </p>
                    )}
                  </div>
                )}
                <FormError message={form.formState.errors.tagIds?.message} />
              </div>
            </fieldset>
            <FormError message={save.error?.message} />
            <div className="task-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={close}
              >
                {canEdit ? 'Cancel' : 'Close'}
              </button>
              {canEdit && (
                <button
                  className="primary"
                  disabled={busy || (Boolean(task) && !form.formState.isDirty)}
                >
                  {save.isPending
                    ? 'Saving…'
                    : task
                      ? 'Save task'
                      : 'Create task'}
                </button>
              )}
            </div>
          </form>
          {task && (
            <>
              <Attachments
                taskId={task.id}
                workspaceId={workspaceId}
                canEdit={canEdit}
                onBusy={setAttachmentBusy}
              />
              <div className="task-editor-footer">
                <span>
                  Created {task.created_at.slice(0, 10)}
                  {task.completed_at ? ` · Completed ${task.completed_at}` : ''}
                </span>
                {canEdit && (
                  <button
                    className="danger-button"
                    disabled={busy}
                    onClick={() => setConfirm('delete')}
                  >
                    Delete task
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
