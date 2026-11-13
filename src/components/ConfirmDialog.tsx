/**
 * "Are you sure?" popup, used before anything that can't be undone (e.g. deleting a job).
 *
 *   <ConfirmDialog
 *     open={...} title="Delete JOB-0007?" confirmLabel="Delete job" danger
 *     onConfirm={async () => ...} onCancel={() => ...}>
 *     This removes the job and its 23 candidates.
 *   </ConfirmDialog>
 *
 * Built on the browser's <dialog>: focus stays inside, Esc cancels, and the page behind is
 * dimmed. The Cancel button gets focus first, so pressing Enter by accident is safe.
 * While `onConfirm` runs, both buttons are disabled and its error (if any) is shown.
 */
import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../api';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Red styling for destructive actions. */
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, children, confirmLabel, danger = false, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setError(null);
      dialog.showModal();
      cancelRef.current?.focus(); // the safe choice has focus
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        // Esc: don't let the browser close it behind React's back; tell the parent instead.
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className={`confirm-dialog__panel ${danger ? 'confirm-dialog__panel--danger' : ''}`}>
        <h2 id="confirm-title" className="confirm-dialog__title">
          {danger && <AlertTriangle size={20} aria-hidden="true" />} {title}
        </h2>
        <div className="confirm-dialog__body">{children}</div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="confirm-dialog__actions">
          <button ref={cancelRef} type="button" className="button button--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={`button ${danger ? 'button--danger' : ''}`} onClick={confirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
