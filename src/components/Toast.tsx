import type { ToastState } from "../hooks/useToast";

/** The message from useToast, as a pill at the top of the screen. */
export default function Toast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div role="status" className="toast" key={toast.message}>
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.run();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
