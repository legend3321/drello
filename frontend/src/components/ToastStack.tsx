"use client";

import { useBoardStore } from "@/store/boardStore";

import styles from "./ToastStack.module.css";

export function ToastStack() {
  const toasts = useBoardStore((s) => s.toasts);
  const dismissToast = useBoardStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`${styles.toast} ${styles[toast.type]}`}
          onClick={() => dismissToast(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
