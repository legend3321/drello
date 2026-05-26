"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import { useBoardStore } from "@/store/boardStore";
import type { ActivityLog, Card, Comment } from "@/types/board";

import { InlineEdit } from "./InlineEdit";
import { EmojiAvatar } from "./EmojiAvatar";
import styles from "./CardModal.module.css";


type Props = {
  cardId: number;
  onClose: () => void;
};

export function CardModal({ cardId, onClose }: Props) {
  const board = useBoardStore((s) => s.board);
  const applyRemoteCard = useBoardStore((s) => s.applyRemoteCard);
  const updateCardTitle = useBoardStore((s) => s.updateCardTitle);

  const canEdit = board?.permissions?.can_edit ?? false;

  // Find the card inside the board store state
  const card = board?.lists
    .flatMap((l) => l.cards)
    .find((c) => c.id === cardId);

  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<ActivityLog[]>([]);
  const [commentText, setCommentText] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState(card?.description ?? "");
  const [descriptionEditing, setDescriptionEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "history">("comments");

  // Load comments
  const loadComments = useCallback(async () => {
    try {
      setComments(await api.getCardComments(cardId));
    } catch (e) {
      console.error("Failed to load comments", e);
    }
  }, [cardId]);

  // Load history
  const loadHistory = useCallback(async () => {
    try {
      setHistory(await api.getCardHistory(cardId));
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, [cardId]);

  useEffect(() => {
    if (!card) return;
    void loadComments();
    void loadHistory();
    setDescriptionDraft(card.description ?? "");
    setDescriptionEditing(false);
  }, [cardId, card?.description, loadComments, loadHistory]);

  // Real-time event syncing for comments/activities
  useEffect(() => {
    const handleBoardEvent = (e: Event) => {
      const event = (e as CustomEvent).detail;
      if (event.type === "comment_created" && event.payload.card === cardId) {
        setComments((prev) => {
          if (prev.some((c) => c.id === event.payload.id)) return prev;
          return [...prev, event.payload];
        });
      } else if (event.type === "activity_created") {
        void loadHistory();
      }
    };
    window.addEventListener("drello_board_event", handleBoardEvent);
    return () => window.removeEventListener("drello_board_event", handleBoardEvent);
  }, [cardId, loadHistory]);

  if (!card) return null;

  const handleSaveDescription = async () => {
    try {
      const updated = await api.updateCard(cardId, { description: descriptionDraft });
      applyRemoteCard(updated);
      setDescriptionEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update description");
    }
  };

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed) return;
    try {
      const comment = await api.createCardComment(cardId, trimmed);
      setComments((prev) => [...prev, comment]);
      setCommentText("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to post comment");
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.titleArea}>
            <InlineEdit
              as="heading"
              value={card.title}
              onSave={(title) => updateCardTitle(card.id, title)}
              className={styles.title}
              disabled={!canEdit}
            />
            <span className={styles.subtitle}>
              in column <strong>{board?.lists.find((l) => l.id === card.list_id)?.title}</strong>
            </span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </header>

        <main className={styles.content}>
          {/* Description Section */}
          <section className={styles.section}>
            <h3>Description</h3>
            {descriptionEditing ? (
              <div className={styles.descriptionEdit}>
                <textarea
                  className={styles.textarea}
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  placeholder="Add a more detailed description…"
                  rows={4}
                />
                <div className={styles.editControls}>
                  <button type="button" className={styles.saveBtn} onClick={handleSaveDescription}>
                    Save
                  </button>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => {
                      setDescriptionDraft(card.description ?? "");
                      setDescriptionEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`${styles.descriptionDisplay} ${canEdit ? styles.clickable : ""}`}
                onClick={() => canEdit && setDescriptionEditing(true)}
              >
                {card.description ? (
                  <p className={styles.descriptionText}>{card.description}</p>
                ) : (
                  <p className={styles.placeholderText}>
                    {canEdit ? "Add a more detailed description…" : "No description provided."}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Navigation Tabs */}
          <nav className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "comments" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("comments")}
            >
              Comments ({comments.length})
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "history" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Activity ({history.length})
            </button>
          </nav>

          {/* Tab Content */}
          <div className={styles.tabContent}>
            {activeTab === "comments" ? (
              <section className={styles.commentSection}>
                {canEdit ? (
                  <form onSubmit={handleAddComment} className={styles.commentForm}>
                    <textarea
                      className={styles.textarea}
                      placeholder="Write a comment…"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={2}
                      required
                    />
                    <button type="submit" className={styles.saveBtn} disabled={!commentText.trim()}>
                      Comment
                    </button>
                  </form>
                ) : null}

                {comments.length === 0 ? (
                  <p className={styles.placeholderText}>No comments yet.</p>
                ) : (
                  <ul className={styles.commentList}>
                    {comments.map((comment) => (
                      <li key={comment.id} className={styles.commentItem}>
                        <EmojiAvatar emoji={comment.avatar_emoji || "😀"} username={comment.username} size={28} />
                        <div className={styles.commentContent}>
                          <div className={styles.commentMeta}>
                            <span className={styles.author}>@{comment.username}</span>
                            <span className={styles.date}>
                              {new Date(comment.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className={styles.commentText}>{comment.text}</p>
                        </div>
                      </li>
                    ))}

                  </ul>
                )}
              </section>
            ) : (
              <section className={styles.historySection}>
                {history.length === 0 ? (
                  <p className={styles.placeholderText}>No logs recorded.</p>
                ) : (
                  <ul className={styles.historyList}>
                    {history.map((log) => (
                      <li key={log.id} className={styles.historyItem}>
                        <div className={styles.historyMeta}>
                          <span className={styles.author}>@{log.username}</span>
                          <span className={styles.date}>
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className={styles.historyText}>{log.detail}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
