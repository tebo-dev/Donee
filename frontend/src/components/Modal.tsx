import { useEffect, useRef, type ReactNode } from 'react';
import { X } from '@phosphor-icons/react/dist/csr/X';

export function Modal({
  title,
  busy = false,
  onClose,
  children,
}: {
  title: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="workspace-dialog"
      aria-labelledby="workspace-dialog-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
    >
      <div className="workspace-dialog-heading">
        <div>
          <p className="eyebrow">A LITTLE ROOM TO BEGIN</p>
          <h2 id="workspace-dialog-title">{title}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          disabled={busy}
          aria-label="Close dialog"
          onClick={() => dialog.current?.close()}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
