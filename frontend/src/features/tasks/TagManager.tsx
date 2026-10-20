import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { FormError } from '../auth/FormParts';
import { messageSchema, tagSchema, type Tag } from './contracts';
import { useTags, useTaskApi } from './queries';

export function TagManager({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const { request, refresh } = useTaskApi(workspaceId);
  const tags = useTags(workspaceId);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#B5F36B');
  const mutation = useMutation({
    mutationFn: async () =>
      deleting
        ? request(`/tags/${deleting.id}`, messageSchema, { method: 'DELETE' })
        : request(editing ? `/tags/${editing.id}` : '/tags', tagSchema, {
            method: editing ? 'PATCH' : 'POST',
            body: {
              name: name.trim(),
              color: color.toUpperCase(),
              ...(!editing && { workspace_id: workspaceId }),
            },
          }),
    onSuccess: async () => {
      setName('');
      setEditing(null);
      setDeleting(null);
      await refresh();
    },
  });
  return (
    <Modal
      title="Small labels. Clear head."
      busy={mutation.isPending}
      onClose={onClose}
    >
      <p className="field-hint">
        Tags belong to this workspace. Each name and color must be unique.
      </p>
      {deleting ? (
        <>
          <p>
            Delete “{deleting.name}” from this workspace and every task using
            it?
          </p>
          <div className="task-actions">
            <button
              className="secondary"
              disabled={mutation.isPending}
              onClick={() => setDeleting(null)}
            >
              Keep tag
            </button>
            <button
              className="primary"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Delete tag
            </button>
          </div>
        </>
      ) : (
        <form
          className="task-form"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <fieldset disabled={mutation.isPending}>
            <label className="field">
              Tag name
              <input
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="field">
              Tag color
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            </label>
          </fieldset>
          <div className="task-actions">
            {editing && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditing(null);
                  setName('');
                }}
              >
                Cancel edit
              </button>
            )}
            <button
              className="primary"
              disabled={mutation.isPending || name.trim().length < 2}
            >
              {editing ? 'Save tag' : 'Create tag'}
            </button>
          </div>
        </form>
      )}
      <FormError message={mutation.error?.message || tags.error?.message} />
      {tags.isError && (
        <button className="secondary" onClick={() => void tags.refetch()}>
          Retry tags
        </button>
      )}
      <ul className="task-resource-list">
        {tags.data?.tags.map((tag) => (
          <li key={tag.id}>
            <span>
              <i
                className="tag-dot"
                style={{
                  backgroundColor: /^#[\da-f]{3}([\da-f]{3})?$/i.test(tag.color)
                    ? tag.color
                    : undefined,
                }}
              />
              {tag.name}
            </span>
            <div>
              <button
                className="secondary"
                disabled={mutation.isPending}
                aria-label={`Edit ${tag.name}`}
                onClick={() => {
                  mutation.reset();
                  setDeleting(null);
                  setEditing(tag);
                  setName(tag.name);
                  setColor(
                    /^#[\da-f]{6}$/i.test(tag.color) ? tag.color : '#B5F36B',
                  );
                }}
              >
                Edit
              </button>
              <button
                className="danger-button"
                disabled={mutation.isPending}
                aria-label={`Delete ${tag.name}`}
                onClick={() => {
                  mutation.reset();
                  setDeleting(tag);
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
