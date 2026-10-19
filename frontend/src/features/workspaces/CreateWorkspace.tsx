import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../components/Modal';
import { Field, FormError, Submit } from '../auth/FormParts';
import { useAuth } from '../auth/auth-context';
import {
  workspaceNameSchema,
  workspaceSchema,
  type WorkspaceName,
  type Workspace,
} from './contracts';
import { workspaceKeys } from './queries';

export function CreateWorkspace({
  onClose,
}: {
  onClose: (restoreFocus?: boolean) => void;
}) {
  const { session, request } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const keys = workspaceKeys(session.user?.id);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkspaceName>({
    resolver: zodResolver(workspaceNameSchema),
    defaultValues: { name: '' },
  });
  const mutation = useMutation({
    mutationFn: (body: WorkspaceName) =>
      request('/workspaces', workspaceSchema, { body }),
    onSuccess: (workspace) => {
      queryClient.setQueryData(keys.detail(workspace.id), workspace);
      queryClient.setQueryData<{ workspaces: Workspace[] }>(
        keys.list,
        (previous) =>
          previous
            ? {
                workspaces: [
                  ...previous.workspaces.filter(
                    (item) => item.id !== workspace.id,
                  ),
                  workspace,
                ],
              }
            : undefined,
      );
      void queryClient.invalidateQueries({ queryKey: keys.list });
      onClose(false);
      navigate(`/workspaces/${workspace.id}`, { state: { created: true } });
    },
  });
  return (
    <Modal
      title="Make a little space."
      onClose={onClose}
      busy={mutation.isPending}
    >
      <p className="dialog-description">
        Give your ideas a place to land. You can change the name later.
      </p>
      <form
        noValidate
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        aria-busy={mutation.isPending}
      >
        <Field
          label="Workspace name"
          autoComplete="off"
          placeholder="Side quests, Life admin, Big idea…"
          maxLength={50}
          disabled={mutation.isPending}
          registration={register('name')}
          error={errors.name?.message}
          hint="2–50 characters. A name that feels like you."
        />
        <FormError message={mutation.error?.message} />
        <Submit busy={mutation.isPending}>Create workspace</Submit>
        <button
          type="button"
          className="dialog-cancel text-button"
          disabled={mutation.isPending}
          onClick={() => onClose()}
        >
          Maybe later
        </button>
      </form>
    </Modal>
  );
}
