import { useState } from 'react';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { ApiError } from '../../lib/api';
import { useAuth } from '../auth/auth-context';
import { messageSchema } from '../auth/contracts';
import { FormError } from '../auth/FormParts';
import { workspaceKeys } from './queries';
export function DeleteWorkspace({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const { request, session } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const transfers = useIsMutating({ mutationKey: ['task-attachment', id] });
  const deletion = useMutation({
    mutationKey: ['workspace-delete', id],
    mutationFn: () => {
      if (client.isMutating({ mutationKey: ['task-attachment', id] }))
        throw new Error(
          'Wait for attachments to finish before deleting this workspace.',
        );
      return request(`/workspaces/${id}`, messageSchema, { method: 'DELETE' });
    },
    onSuccess: async () => {
      const tasks = ['tasks', session.user?.id, id];
      const keys = workspaceKeys(session.user?.id);
      await client.cancelQueries({ queryKey: tasks });
      await client.cancelQueries({ queryKey: keys.detail(id) });
      client.removeQueries({ queryKey: tasks });
      client.removeQueries({ queryKey: keys.detail(id) });
      navigate('/workspaces', { replace: true });
      await client.invalidateQueries({ queryKey: keys.list });
    },
  });
  return (
    <section className="workspace-delete" aria-label="Delete workspace">
      <h3>Close this space.</h3>
      <p>
        Deleting a workspace permanently removes its tasks, tags and attached
        files.
      </p>
      {transfers > 0 && (
        <p role="status">
          Wait for attachments to finish before deleting this workspace.
        </p>
      )}
      <button
        className="danger-button"
        disabled={transfers > 0 || deletion.isPending}
        onClick={() => {
          setConfirmation('');
          deletion.reset();
          setConfirming(true);
        }}
      >
        Delete workspace
      </button>
      {confirming && (
        <Modal
          title={`Delete ${name}?`}
          busy={deletion.isPending}
          onClose={() => setConfirming(false)}
        >
          <p>
            This permanently deletes this workspace and everything in it. This
            cannot be undone.
          </p>
          <form
            className="task-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (confirmation === name && !deletion.isPending && !transfers)
                deletion.mutate();
            }}
          >
            <label className="field">
              Type the workspace name to confirm
              <input
                value={confirmation}
                disabled={deletion.isPending}
                autoComplete="off"
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            <p className="field-hint">{name}</p>
            <FormError
              message={
                deletion.error instanceof ApiError &&
                deletion.error.status === 503
                  ? 'File cleanup could not finish. Your workspace is still here, but some files may already be removed. Retry deletion to finish.'
                  : deletion.error?.message
              }
            />
            <div className="task-actions">
              <button
                type="button"
                className="secondary"
                disabled={deletion.isPending}
                onClick={() => setConfirming(false)}
              >
                Keep workspace
              </button>
              <button
                className="danger-button"
                disabled={
                  confirmation !== name || deletion.isPending || transfers > 0
                }
              >
                {deletion.isPending
                  ? 'Deleting…'
                  : 'Permanently delete workspace'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
