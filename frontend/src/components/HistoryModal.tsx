"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { ActivityLog } from "@/types/board";

import styles from "./HistoryModal.module.css";

type Props = {
  boardId: number;
  onClose: () => void;
};

export function HistoryModal({ boardId, onClose }: Props) {
  const [history, setHistory] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      setHistory(await api.getBoardHistory(boardId));
    } catch (e) {
      console.error("Failed to load board history", e);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Real-time synchronization
  useEffect(() => {
    const handleBoardEvent = (e: Event) => {
      const event = (e as CustomEvent).detail;
      if (event.type === "activity_created") {
        void loadHistory();
      }
    };
    window.addEventListener("drello_board_event", handleBoardEvent);
    return () => window.removeEventListener("drello_board_event", handleBoardEvent);
  }, [boardId, loadHistory]);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2>Board Activity History</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close panel">
            &times;
          </button>
        </header>

        <main className={styles.content}>
          {loading && history.length === 0 ? (
            <p className={styles.hint}>Loading activity logs…</p>
          ) : null}

          {!loading && history.length === 0 ? (
            <p className={styles.hint}>No activity logged on this board yet.</p>
          ) : null}

          {history.length > 0 ? (
            <ul className={styles.list}>
              {history.map((log) => (
                <li key={log.id} className={styles.item}>
                  <div className={styles.meta}>
                    <span className={styles.author}>@{log.username}</span>
                    <span className={styles.date}>
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className={styles.text}>{log.detail}</p>
                  {log.card_title ? (
                    <span className={styles.cardTag}>Card: {log.card_title}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </main>
      </div>
    </div>
  );
}
