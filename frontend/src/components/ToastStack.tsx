"use client";

import { useBoardStore } from "@/store/boardStore";
import { motion, AnimatePresence } from "framer-motion";

import styles from "./ToastStack.module.css";

export function ToastStack() {
  const toasts = useBoardStore((s) => s.toasts);
  const dismissToast = useBoardStore((s) => s.dismissToast);

  return (
    <div className={styles.stack} role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            type="button"
            className={`${styles.toast} ${styles[toast.type]}`}
            onClick={() => dismissToast(toast.id)}
          >
            {toast.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
