"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  X, 
  Calendar, 
  ChevronUp, 
  ChevronsUp, 
  ChevronDown, 
  Plus, 
  Trash2, 
  MessageSquare,
  Tag, 
  Paperclip, 
  UserPlus, 
  AlignLeft, 
  CheckSquare 
} from "lucide-react";

import { api } from "@/lib/api";
import { useBoardStore } from "@/store/boardStore";
import type { Card } from "@/types/board";
import type { TeamMembership } from "@/types/team";
import { EmojiAvatar } from "./EmojiAvatar";
import { InlineEdit } from "./InlineEdit";
import styles from "./CardDetailPanel.module.css";

type Props = {
  cardId: number;
  onClose: () => void;
};

// Available mockup label colors
const LABEL_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#db2777", "#a855f7", "#ef4444"];

export function CardDetailPanel({ cardId, onClose }: Props) {
  const board = useBoardStore((s) => s.board);
  const applyRemoteCard = useBoardStore((s) => s.applyRemoteCard);
  const updateCardTitle = useBoardStore((s) => s.updateCardTitle);
  const addToast = useBoardStore((s) => s.addToast);

  const card = board?.lists
    .flatMap((l) => l.cards)
    .find((c) => c.id === cardId);

  const canEdit = board?.permissions?.can_edit ?? false;

  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descriptionEditing, setDescriptionEditing] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMembership[]>([]);

  // Checklist adding state
  const [newChecklistText, setNewChecklistText] = useState("");
  
  // Labels adding state
  const [addingLabel, setAddingLabel] = useState(false);
  const [newLabelText, setNewLabelText] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#3b82f6");

  // Load team members on mount
  useEffect(() => {
    if (!board?.team_id) return;
    api.getTeamMembers(board.team_id)
      .then(setTeamMembers)
      .catch((err) => console.error("Failed to load team members in card detail panel", err));
  }, [board?.team_id]);

  // Sync draft states when card description changes
  useEffect(() => {
    if (card) {
      setDescriptionDraft(card.description || "");
      setDescriptionEditing(false);
    }
  }, [cardId, card?.description]);

  if (!card) return null;

  const handleUpdate = async (patch: Partial<Card> & { assigned_user_ids?: number[] }) => {
    try {
      const updated = await api.updateCard(cardId, patch);
      applyRemoteCard(updated);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to update card", "error");
    }
  };

  const handleSaveDescription = async () => {
    await handleUpdate({ description: descriptionDraft });
    setDescriptionEditing(false);
  };

  // Checklist Actions
  const toggleChecklistItem = (itemId: string) => {
    const nextList = (card.checklist || []).map((item) => 
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    void handleUpdate({ checklist: nextList });
  };

  const deleteChecklistItem = (itemId: string) => {
    const nextList = (card.checklist || []).filter((item) => item.id !== itemId);
    void handleUpdate({ checklist: nextList });
  };

  const addChecklistItem = (e: FormEvent) => {
    e.preventDefault();
    const text = newChecklistText.trim();
    if (!text) return;
    const newItem = { id: String(Date.now()), text, done: false };
    const nextList = [...(card.checklist || []), newItem];
    void handleUpdate({ checklist: nextList }).then(() => setNewChecklistText(""));
  };

  // Label Actions
  const addLabel = (e: FormEvent) => {
    e.preventDefault();
    const text = newLabelText.trim();
    if (!text) return;
    const nextList = [...(card.labels || []), { text, color: newLabelColor }];
    void handleUpdate({ labels: nextList }).then(() => {
      setNewLabelText("");
      setAddingLabel(false);
    });
  };

  const deleteLabel = (text: string) => {
    const nextList = (card.labels || []).filter((label) => label.text !== text);
    void handleUpdate({ labels: nextList });
  };

  // Assigned Users Actions
  const assignUser = (userId: number) => {
    const ids = (card.assigned_users || []).map((u) => u.id);
    if (ids.includes(userId)) return;
    void handleUpdate({ assigned_user_ids: [...ids, userId] });
  };

  const unassignUser = (userId: number) => {
    const ids = (card.assigned_users || []).map((u) => u.id).filter((id) => id !== userId);
    void handleUpdate({ assigned_user_ids: ids });
  };

  // Attachments Actions
  const addAttachment = () => {
    const mockImages = [
      { name: "inception_flow.png", url: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=128&auto=format&fit=crop&q=60" },
      { name: "brand_colors.png", url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=128&auto=format&fit=crop&q=60" },
      { name: "user_journey.png", url: "https://images.unsplash.com/photo-1541462608143-67571c6738dd?w=128&auto=format&fit=crop&q=60" }
    ];
    const pick = mockImages[(card.attachments || []).length % mockImages.length];
    const newItem = { id: String(Date.now()), name: pick.name, url: pick.url };
    const nextList = [...(card.attachments || []), newItem];
    void handleUpdate({ attachments: nextList });
  };

  const removeAttachment = (attId: string) => {
    const nextList = (card.attachments || []).filter((att) => att.id !== attId);
    void handleUpdate({ attachments: nextList });
  };

  return (
    <>
      {/* Dimmed Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Side Slide-out Panel */}
      <motion.div
        initial={{ x: 480, opacity: 0.9 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 480, opacity: 0.9 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
      >
        {/* Panel Header */}
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <div className={styles.titleArea}>
              <InlineEdit
                as="heading"
                value={card.title}
                onSave={(title) => updateCardTitle(card.id, title)}
                className={styles.title}
                disabled={!canEdit}
              />
              <div className={styles.subtitle}>
                in column <strong>{board?.lists.find((l) => l.id === card.list_id)?.title}</strong>
              </div>
            </div>
            <button 
              type="button" 
              className={styles.closeBtn} 
              onClick={onClose} 
              aria-label="Close panel"
            >
              <X size={18} />
            </button>
          </div>

          {/* Metadata Grid */}
          <div className={styles.metaGrid}>
            <div className={styles.metaBlock}>
              <span className={styles.metaLabel}>Created Date</span>
              <span className={styles.metaValue}>
                <Calendar size={14} style={{ color: "#64748b" }} />
                <span>
                  {new Date(card.created_at).toLocaleDateString([], { month: "short", day: "2-digit" })}
                </span>
              </span>
            </div>

            <div className={styles.metaBlock}>
              <span className={styles.metaLabel}>Priority</span>
              {canEdit ? (
                <select
                  className={styles.selectInput}
                  value={card.priority || "medium"}
                  onChange={(e) => void handleUpdate({ priority: e.target.value as any })}
                >
                  <option value="highest">Highest</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              ) : (
                <span className={styles.metaValue} style={{ textTransform: "capitalize" }}>
                  {card.priority || "medium"}
                </span>
              )}
            </div>

            <div className={styles.metaBlock}>
              <span className={styles.metaLabel}>Story Points</span>
              {canEdit ? (
                <input
                  type="number"
                  min="0"
                  className={styles.pointsInput}
                  value={card.story_points ?? 0}
                  onChange={(e) => void handleUpdate({ story_points: Number(e.target.value) })}
                />
              ) : (
                <span className={styles.metaValue}>{card.story_points ?? 0}</span>
              )}
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className={styles.actionsRow}>
            <button type="button" className={styles.actionBadgeBtn}>
              <Plus size={12} /> Add child issue
            </button>
            <button type="button" className={styles.actionBadgeBtn}>
              <Paperclip size={12} /> Link issue
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className={styles.content}>
          
          {/* Description Section */}
          <section className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <AlignLeft size={16} className={styles.sectionIcon} />
              <h3>Description</h3>
            </div>
            
            {descriptionEditing ? (
              <div className={styles.section}>
                <textarea
                  className={styles.textarea}
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  placeholder="Add a more detailed description…"
                  rows={4}
                  disabled={!canEdit}
                />
                {canEdit && (
                  <div className={styles.editControls}>
                    <button type="button" className={styles.saveBtn} onClick={handleSaveDescription}>
                      Save
                    </button>
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={() => {
                        setDescriptionDraft(card.description || "");
                        setDescriptionEditing(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div
                className={styles.descriptionDisplay}
                onClick={() => canEdit && setDescriptionEditing(true)}
              >
                {card.description ? (
                  <p style={{ margin: 0 }}>{card.description}</p>
                ) : (
                  <p className={styles.placeholderText}>
                    {canEdit ? "Add a more detailed description…" : "No description provided."}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Labels Tags Section */}
          <section className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <Tag size={16} className={styles.sectionIcon} />
              <h3>Labels</h3>
            </div>
            <div className={styles.labelsList}>
              {card.labels && card.labels.map((label, i) => (
                <span 
                  key={i} 
                  className={styles.labelBadge}
                  style={{ background: `${label.color}20`, color: label.color, border: `1px solid ${label.color}35` }}
                >
                  {label.text}
                  {canEdit && (
                    <span 
                      className={styles.labelDelete}
                      onClick={(e) => { e.stopPropagation(); deleteLabel(label.text); }}
                    >
                      &times;
                    </span>
                  )}
                </span>
              ))}

              {canEdit && !addingLabel && (
                <button 
                  type="button" 
                  className={styles.actionBadgeBtn}
                  onClick={() => setAddingLabel(true)}
                  style={{ padding: "0.25rem 0.5rem", borderRadius: "6px" }}
                >
                  + Add Label
                </button>
              )}

              {addingLabel && (
                <form onSubmit={addLabel} className={styles.addLabelContainer} style={{ display: "flex", gap: "0.25rem" }}>
                  <input
                    className={styles.addLabelInput}
                    value={newLabelText}
                    onChange={(e) => setNewLabelText(e.target.value)}
                    placeholder="Tag name…"
                    autoFocus
                  />
                  <select 
                    className={styles.selectInput}
                    style={{ width: "fit-content", padding: "0.15rem 0.35rem" }}
                    value={newLabelColor}
                    onChange={(e) => setNewLabelColor(e.target.value)}
                  >
                    {LABEL_COLORS.map(c => (
                      <option key={c} value={c} style={{ color: c }}>Color</option>
                    ))}
                  </select>
                  <button type="submit" className={styles.saveBtn} style={{ padding: "0.15rem 0.45rem", fontSize: "0.7rem" }}>
                    Add
                  </button>
                  <button type="button" className={styles.cancelBtn} onClick={() => setAddingLabel(false)} style={{ padding: "0.15rem 0.35rem", fontSize: "0.7rem" }}>
                    Cancel
                  </button>
                </form>
              )}
            </div>
          </section>

          {/* Assigned Members Section */}
          <section className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <UserPlus size={16} className={styles.sectionIcon} />
              <h3>Assigned Members</h3>
            </div>
            <div className={styles.membersList}>
              {card.assigned_users && card.assigned_users.map((u) => (
                <div key={u.id} className={styles.memberPill}>
                  <EmojiAvatar emoji={u.avatar_emoji || "😀"} username={u.username} size={24} />
                  <div className={styles.memberPillInfo}>
                    <span className={styles.memberPillName}>@{u.username}</span>
                    <span className={styles.memberPillRole}>
                      {u.id === board?.owner_id ? "Owner" : "Member"}
                    </span>
                  </div>
                  {canEdit && (
                    <button 
                      type="button" 
                      className={styles.removeMemberBtn}
                      onClick={() => unassignUser(u.id)}
                      title="Unassign user"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}

              {canEdit && board?.team_id && (
                <div className={styles.addMemberContainer}>
                  <select
                    className={styles.addMemberSelect}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        assignUser(Number(e.target.value));
                      }
                    }}
                  >
                    <option value="">+ Assign Member</option>
                    {teamMembers
                      .filter((tm) => !(card.assigned_users || []).some((u) => u.id === tm.user.id))
                      .map((tm) => (
                        <option key={tm.user.id} value={tm.user.id}>
                          @{tm.user.username}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* Attachments Section */}
          <section className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <Paperclip size={16} className={styles.sectionIcon} />
              <h3>Attachments ({card.attachments?.length || 0})</h3>
            </div>
            <div className={styles.attachmentsGrid}>
              {card.attachments && card.attachments.map((att) => (
                <div 
                  key={att.id} 
                  className={styles.attachmentThumb} 
                  style={{ backgroundImage: `url(${att.url})` }}
                  title={att.name}
                >
                  {canEdit && (
                    <button 
                      type="button" 
                      className={styles.removeAttachmentBtn}
                      onClick={() => removeAttachment(att.id)}
                      title="Remove attachment"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              
              {canEdit && (
                <button 
                  type="button" 
                  className={styles.addAttachmentBtn}
                  onClick={addAttachment}
                  title="Mock Add Attachment"
                >
                  <Plus size={16} />
                  <span>Add Mock</span>
                </button>
              )}
            </div>
          </section>

          {/* Checklist To Do Lists Section */}
          <section className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <CheckSquare size={16} className={styles.sectionIcon} />
              <h3>To do lists</h3>
            </div>
            <div className={styles.checklistContainer}>
              {card.checklist && card.checklist.map((item) => (
                <div key={item.id} className={styles.checklistItem}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleChecklistItem(item.id)}
                    className={styles.checklistCheckbox}
                    disabled={!canEdit}
                  />
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => {
                      if (!canEdit) return;
                      const val = e.target.value;
                      const next = (card.checklist || []).map((c) => 
                        c.id === item.id ? { ...c, text: val } : c
                      );
                      void handleUpdate({ checklist: next });
                    }}
                    className={`${styles.checklistItemText} ${item.done ? styles.checklistItemTextDone : ""}`}
                    disabled={!canEdit}
                  />
                  {canEdit && (
                    <button
                      type="button"
                      className={styles.deleteChecklistItemBtn}
                      onClick={() => deleteChecklistItem(item.id)}
                      title="Delete subtask"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}

              {card.checklist && card.checklist.length === 0 && (
                <p className={styles.noItemsHint}>No tasks added yet.</p>
              )}

              {canEdit && (
                <form onSubmit={addChecklistItem} className={styles.addChecklistItemForm}>
                  <input
                    className={styles.addChecklistItemInput}
                    placeholder="Add a new task to do…"
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    required
                  />
                  <button type="submit" className={styles.addChecklistItemSubmit}>
                    Add
                  </button>
                </form>
              )}
            </div>
          </section>

        </main>
      </motion.div>
    </>
  );
}
