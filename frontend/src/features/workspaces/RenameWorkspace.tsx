import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../auth/auth-context';
import { messageSchema } from '../auth/contracts';
import { Field, FormError } from '../auth/FormParts';
import {
  workspaceNameSchema,
  type Workspace,
  type WorkspaceName,
} from './contracts';
import { workspaceKeys } from './queries';

export function RenameWorkspace({ workspace }: { workspace: Workspace }) {
  const { session, request } = useAuth();
  const client = useQueryClient();
  const keys = workspaceKeys(session.user?.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<WorkspaceName>({
    resolver: zodResolver(workspaceNameSchema),
    values: { name: workspace.name },
    resetOptions: { keepDirtyValues: true },
  });
  const mutation = useMutation({
    mutationFn: (body: WorkspaceName) =>
      request(`/workspaces/${workspace.id}`, messageSchema, {
        method: 'PATCH',
        body,
      }),
    onSuccess: (_message, values) => {
      const updated = { ...workspace, name: values.name };
      client.setQueryData(keys.detail(workspace.id), updated);
      client.setQueryData<{ workspaces: Workspace[] }>(keys.list, (previous) =>
        previous
          ? {
              workspaces: previous.workspaces.map((item) =>
                item.id === workspace.id ? updated : item,
              ),
            }
          : undefined,
      );
      reset(values);
      void client.invalidateQueries({ queryKey: keys.all });
    },
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      aria-busy={mutation.isPending}
    >
      <Field
        label="Workspace name"
        autoComplete="off"
        maxLength={50}
        disabled={mutation.isPending}
        registration={register('name', { onChange: () => mutation.reset() })}
        error={errors.name?.message}
        hint="2–50 characters. Whatever feels right."
      />
      <FormError message={mutation.error?.message} />
      {mutation.isSuccess && (
        <p className="workspace-success" role="status">
          Name saved. Same space, a fresh little label.
        </p>
      )}
      <div className="settings-actions">
        <button
          className="primary"
          type="submit"
          disabled={mutation.isPending || !isDirty}
        >
          {mutation.isPending ? 'Saving…' : 'Save changes'}
          <span aria-hidden="true">↵</span>
        </button>
        <button
          type="button"
          className="text-button"
          disabled={!isDirty || mutation.isPending}
          onClick={() => {
            reset({ name: workspace.name });
            mutation.reset();
          }}
        >
          Discard changes
        </button>
      </div>
    </form>
  );
}
