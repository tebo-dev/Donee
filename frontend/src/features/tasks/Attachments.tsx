import { useEffect, useState } from 'react';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';
import { FormError } from '../auth/FormParts';
import { messageSchema, safeUrl } from './contracts';
import { useTaskApi } from './queries';

const attachmentSchema = z.object({
  id: z.string().uuid(),
  attachment_type: z.enum(['link', 'file']),
  attachment_name: z.string(),
  url: z.string().optional(),
  status: z.string().optional(),
  size_bytes: z.number().optional(),
});
const attachmentsSchema = z.object({ attachments: z.array(attachmentSchema) });
const uploadSchema = z.object({
  attachment_id: z.string().uuid(),
  upload_url: z.string().url(),
  upload_fields: z.record(z.string(), z.string()),
  upload_method: z.literal('POST'),
});
const types = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
];
type Attachment = z.infer<typeof attachmentSchema>;
type Action =
  | { type: 'link' }
  | { type: 'file'; file: File }
  | { type: 'rename' | 'delete' | 'download' | 'verify'; item: Attachment };

export function Attachments({
  taskId,
  workspaceId,
  canEdit,
  onBusy,
}: {
  taskId: string;
  workspaceId: string;
  canEdit: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const { request, key } = useTaskApi(workspaceId);
  const client = useQueryClient();
  const deleting =
    useIsMutating({ mutationKey: ['workspace-delete', workspaceId] }) > 0;
  const path = `/tasks/${taskId}/attachments`;
  const query = useQuery({
    queryKey: [...key, 'attachments', taskId],
    retry: false,
    queryFn: ({ signal }) => request(path, attachmentsSchema, { signal }),
  });
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [editing, setEditing] = useState<Attachment | null>(null);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const [notice, setNotice] = useState('');
  const [download, setDownload] = useState<string>();
  const mutation = useMutation({
    mutationKey: ['task-attachment', workspaceId],
    mutationFn: async (action: Action) => {
      if (client.isMutating({ mutationKey: ['workspace-delete', workspaceId] }))
        throw new Error('This workspace is being deleted.');
      setNotice('');
      setDownload(undefined);
      if (action.type === 'link') {
        if (!safeUrl(url))
          throw new Error('Use a complete http or https address.');
        await request(
          `/tasks/attachments/link?task_id=${taskId}`,
          messageSchema,
          {
            body: {
              attachment_name: name.trim() || 'Untitled link',
              url: url.trim(),
            },
          },
        );
        setName('');
        setUrl('');
      } else if (action.type === 'file') {
        const file = action.file;
        if (
          !types.includes(file.type) ||
          file.size < 1 ||
          file.size > 10 * 1024 * 1024 ||
          file.name.length > 155
        )
          throw new Error(
            'Choose a PDF, PNG, JPEG, WebP, or text file between 1 byte and 10 MB, with a filename under 156 characters.',
          );
        const upload = await request(
          `/tasks/attachments/file?task_id=${taskId}`,
          uploadSchema,
          {
            body: {
              original_filename: file.name,
              content_type: file.type,
              size_bytes: file.size,
            },
          },
        );
        try {
          if (!safeUrl(upload.upload_url))
            throw new Error('Invalid upload address.');
          const data = new FormData();
          Object.entries(upload.upload_fields).forEach(([field, value]) =>
            data.append(field, value),
          );
          data.append('file', file);
          const response = await fetch(upload.upload_url, {
            method: 'POST',
            body: data,
            credentials: 'omit',
            signal: AbortSignal.timeout(120_000),
          });
          if (!response.ok) throw new Error('File transfer failed.');
        } catch {
          await request(
            `${path}/${upload.attachment_id}/failed`,
            messageSchema,
            { method: 'PATCH' },
          ).catch(() => undefined);
          throw new Error(
            'Upload could not finish. Check its status below; verify a pending upload or remove it before trying again.',
          );
        }
        await request(
          `${path}/${upload.attachment_id}/uploaded`,
          messageSchema,
          { method: 'PATCH' },
        );
      } else if (action.type === 'download') {
        const result = await request(
          `${path}/${action.item.id}/download`,
          z.object({
            download_url: z.string(),
            expires_in_seconds: z.number(),
          }),
        );
        const target = safeUrl(result.download_url);
        if (!target) throw new Error('Invalid download address.');
        setDownload(target);
        setNotice('Your download is ready. The link expires shortly.');
      } else if (action.type === 'verify') {
        await request(`${path}/${action.item.id}/uploaded`, messageSchema, {
          method: 'PATCH',
        });
      } else {
        await request(
          `${path}/${action.item.id}${action.type === 'delete' ? '/' : ''}`,
          messageSchema,
          {
            method: action.type === 'delete' ? 'DELETE' : 'PATCH',
            ...(action.type === 'rename' && {
              body: {
                attachment_new_name: name.trim() || 'Untitled attachment',
              },
            }),
          },
        );
        setEditing(null);
        setRemoving(null);
        setName('');
      }
    },
    onSettled: () => query.refetch(),
  });
  useEffect(() => {
    onBusy(mutation.isPending);
    return () => onBusy(false);
  }, [mutation.isPending, onBusy]);
  return (
    <section className="task-attachments" aria-label="Task attachments">
      <h3>Keep it close.</h3>
      <p className="field-hint">Links and files for this task.</p>
      {query.isPending && <p role="status">Loading attachments…</p>}
      <FormError message={query.error?.message || mutation.error?.message} />
      {query.isError && (
        <button className="secondary" onClick={() => void query.refetch()}>
          Retry attachments
        </button>
      )}
      {notice && (
        <p role="status">
          {notice}{' '}
          {download && (
            <a href={download} target="_blank" rel="noreferrer">
              Download file
            </a>
          )}
        </p>
      )}
      <ul className="task-resource-list">
        {query.data?.attachments.map((item) => (
          <li key={item.id}>
            <span>
              {item.attachment_type === 'link' &&
              item.url &&
              safeUrl(item.url) ? (
                <a href={safeUrl(item.url)} target="_blank" rel="noreferrer">
                  {item.attachment_name} ↗
                </a>
              ) : (
                item.attachment_name
              )}
              {item.attachment_type === 'file' && (
                <small>
                  {item.status} · {Math.ceil((item.size_bytes || 0) / 1024)} KB
                </small>
              )}
            </span>
            <div>
              {item.attachment_type === 'file' &&
                item.status === 'uploaded' && (
                  <button
                    className="secondary"
                    disabled={mutation.isPending || deleting}
                    onClick={() => mutation.mutate({ type: 'download', item })}
                  >
                    Download
                  </button>
                )}
              {canEdit && (
                <>
                  {item.status === 'pending' && (
                    <button
                      className="secondary"
                      disabled={mutation.isPending || deleting}
                      onClick={() => mutation.mutate({ type: 'verify', item })}
                    >
                      Verify upload
                    </button>
                  )}
                  <button
                    className="secondary"
                    disabled={mutation.isPending || deleting}
                    aria-label={`Rename ${item.attachment_name}`}
                    onClick={() => {
                      setEditing(item);
                      setRemoving(null);
                      setName(item.attachment_name);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className="danger-button"
                    disabled={mutation.isPending || deleting}
                    aria-label={`Remove ${item.attachment_name}`}
                    onClick={() => {
                      setRemoving(item);
                      setEditing(null);
                    }}
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {canEdit &&
        (removing ? (
          <div>
            <p>Remove “{removing.attachment_name}” permanently?</p>
            <div className="task-actions">
              <button
                className="secondary"
                disabled={mutation.isPending || deleting}
                onClick={() => setRemoving(null)}
              >
                Keep attachment
              </button>
              <button
                className="primary"
                disabled={mutation.isPending || deleting}
                onClick={() =>
                  mutation.mutate({ type: 'delete', item: removing })
                }
              >
                Remove attachment
              </button>
            </div>
          </div>
        ) : (
          <>
            <form
              className="task-form"
              onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate(
                  editing
                    ? { type: 'rename', item: editing }
                    : { type: 'link' },
                );
              }}
            >
              <fieldset disabled={mutation.isPending || deleting}>
                <label className="field">
                  Attachment name
                  <input
                    maxLength={155}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                {!editing && (
                  <label className="field">
                    Link address
                    <input
                      type="url"
                      required
                      maxLength={2000}
                      placeholder="https://"
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                    />
                  </label>
                )}
              </fieldset>
              <div className="task-actions">
                {editing && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={mutation.isPending || deleting}
                    onClick={() => {
                      setEditing(null);
                      setName('');
                    }}
                  >
                    Cancel rename
                  </button>
                )}
                <button
                  className="secondary"
                  disabled={mutation.isPending || deleting}
                >
                  {editing ? 'Rename attachment' : 'Add link'}
                </button>
              </div>
            </form>
            {!editing && (
              <label className="field task-upload">
                Upload file{' '}
                <span className="field-hint">
                  PDF, images, or text · up to 10 MB
                </span>
                <input
                  type="file"
                  accept={types.join(',')}
                  disabled={mutation.isPending || deleting}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) mutation.mutate({ type: 'file', file });
                    event.target.value = '';
                  }}
                />
              </label>
            )}
          </>
        ))}
      {mutation.isPending && <p role="status">Updating attachment…</p>}
    </section>
  );
}
