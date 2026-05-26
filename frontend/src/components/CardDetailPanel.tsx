"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  X, 
  Calendar, 
  Plus, 
  Trash2, 
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
  cardId?: number;
  listId?: number;
  isCreate?: boolean;
  onClose: () => void;
};

// Available mockup label colors
const LABEL_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#db2777", "#a855f7", "#ef4444"];

export function CardDetailPanel({ cardId, listId, isCreate = false, onClose }: Props) {
  const board = useBoardStore((s) => s.board);
  const applyRemoteCard = useBoardStore((s) => s.applyRemoteCard);
  const updateCardTitle = useBoardStore((s) => s.updateCardTitle);
  const addToast = useBoardStore((s) => s.addToast);

  const card = board?.lists
    .flatMap((l) => l.cards)
    .find((c) => c.id === cardId);

  const canEdit = board?.permissions?.can_edit ?? false;

  // Local state for editing description
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descriptionEditing, setDescriptionEditing] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMembership[]>([]);

  // Checklist adding state
  const [newChecklistText, setNewChecklistText] = useState("");
  
  // Labels adding state
  const [addingLabel, setAddingLabel] = useState(false);
  const [newLabelText, setNewLabelText] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#3b82f6");

  // Create Mode States
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"highest" | "medium" | "low">("medium");
  const [storyPoints, setStoryPoints] = useState<number>(0);
  const [labels, setLabels] = useState<{ text: string; color: string }[]>([]);
  const [checklist, setChecklist] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [attachments, setAttachments] = useState<{ id: string; name: string; url: string }[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<{ id: number; username: string; email: string; avatar_emoji?: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  // Getters resolving between Create and Edit modes
  const currentTitle = isCreate ? title : (card?.title || "");
  const currentDescription = isCreate ? description : (card?.description || "");
  const currentPriority = isCreate ? priority : (card?.priority || "medium");
  const currentStoryPoints = isCreate ? storyPoints : (card?.story_points || 0);
  const currentLabels = isCreate ? labels : (card?.labels || []);
  const currentChecklist = isCreate ? checklist : (card?.checklist || []);
  const currentAttachments = isCreate ? attachments : (card?.attachments || []);
  const currentAssignedUsers = isCreate ? assignedUsers : (card?.assigned_users || []);

  if (!isCreate && !card) return null;

  // Actions routing
  const handleUpdate = async (patch: Partial<Card> & { assigned_user_ids?: number[] }) => {
    if (!cardId) return;
    try {
      const updated = await api.updateCard(cardId, patch);
      applyRemoteCard(updated);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to update card", "error");
    }
  };

  const handleTitleSave = (newTitle: string) => {
    if (isCreate) {
      setTitle(newTitle);
    } else if (card) {
      void updateCardTitle(card.id, newTitle);
    }
  };

  const handleSaveDescription = () => {
    if (isCreate) {
      setDescription(descriptionDraft);
      setDescriptionEditing(false);
    } else {
      void handleUpdate({ description: descriptionDraft });
      setDescriptionEditing(false);
    }
  };

  const handlePriorityChange = (newVal: "highest" | "medium" | "low") => {
    if (isCreate) {
      setPriority(newVal);
    } else {
      void handleUpdate({ priority: newVal });
    }
  };

  const handleStoryPointsChange = (newVal: number) => {
    if (isCreate) {
      setStoryPoints(newVal);
    } else {
      void handleUpdate({ story_points: newVal });
    }
  };

  // Checklist Actions
  const handleToggleChecklistItem = (itemId: string) => {
    if (isCreate) {
      setChecklist(prev => prev.map(item => item.id === itemId ? { ...item, done: !item.done } : item));
    } else if (card) {
      const nextList = (card.checklist || []).map((item) => 
        item.id === itemId ? { ...item, done: !item.done } : item
      );
      void handleUpdate({ checklist: nextList });
    }
  };

  const handleDeleteChecklistItem = (itemId: string) => {
    if (isCreate) {
      setChecklist(prev => prev.filter(item => item.id !== itemId));
    } else if (card) {
      const nextList = (card.checklist || []).filter((item) => item.id !== itemId);
      void handleUpdate({ checklist: nextList });
    }
  };

  const handleAddChecklistItem = (text: string) => {
    const newItem = { id: String(Date.now()), text, done: false };
    if (isCreate) {
      setChecklist(prev => [...prev, newItem]);
    } else if (card) {
      const nextList = [...(card.checklist || []), newItem];
      void handleUpdate({ checklist: nextList });
    }
  };

  const addChecklistItem = (e: FormEvent) => {
    e.preventDefault();
    const text = newChecklistText.trim();
    if (!text) return;
    handleAddChecklistItem(text);
    setNewChecklistText("");
  };

  // Label Actions
  const handleAddLabel = (text: string, color: string) => {
    const newLabel = { text, color };
    if (isCreate) {
      setLabels(prev => [...prev, newLabel]);
    } else if (card) {
      const nextList = [...(card.labels || []), newLabel];
      void handleUpdate({ labels: nextList });
    }
  };

  const addLabel = (e: FormEvent) => {
    e.preventDefault();
    const text = newLabelText.trim();
    if (!text) return;
    handleAddLabel(text, newLabelColor);
    setNewLabelText("");
    setAddingLabel(false);
  };

  const handleDeleteLabel = (text: string) => {
    if (isCreate) {
      setLabels(prev => prev.filter(l => l.text !== text));
    } else if (card) {
      const nextList = (card.labels || []).filter((label) => label.text !== text);
      void handleUpdate({ labels: nextList });
    }
  };

  // Assigned Users Actions
  const handleAssignUser = (userId: number) => {
    const match = teamMembers.find(tm => tm.user.id === userId);
    if (!match) return;
    const userObj = {
      id: match.user.id,
      username: match.user.username,
      email: match.user.email,
      avatar_emoji: match.user.avatar_emoji
    };
    if (isCreate) {
      if (!assignedUsers.some(u => u.id === userId)) {
        setAssignedUsers(prev => [...prev, userObj]);
      }
    } else if (card) {
      const ids = (card.assigned_users || []).map((u) => u.id);
      if (ids.includes(userId)) return;
      void handleUpdate({ assigned_user_ids: [...ids, userId] });
    }
  };

  const handleUnassignUser = (userId: number) => {
    if (isCreate) {
      setAssignedUsers(prev => prev.filter(u => u.id !== userId));
    } else if (card) {
      const ids = (card.assigned_users || []).map((u) => u.id).filter((id) => id !== userId);
      void handleUpdate({ assigned_user_ids: ids });
    }
  };

  // Attachments Actions
  const handleAddAttachment = () => {
    const mockImages = [
      { name: "inception_flow.png", url: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=128&auto=format&fit=crop&q=60" },
      { name: "brand_colors.png", url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=128&auto=format&fit=crop&q=60" },
      { name: "user_journey.png", url: "https://images.unsplash.com/photo-1541462608143-67571c6738dd?w=128&auto=format&fit=crop&q=60" }
    ];
    const count = isCreate ? attachments.length : (card?.attachments || []).length;
    const pick = mockImages[count % mockImages.length];
    const newItem = { id: String(Date.now()), name: pick.name, url: pick.url };
    if (isCreate) {
      setAttachments(prev => [...prev, newItem]);
    } else if (card) {
      const nextList = [...(card.attachments || []), newItem];
      void handleUpdate({ attachments: nextList });
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    if (isCreate) {
      setAttachments(prev => prev.filter(att => att.id !== attId));
    } else if (card) {
      const nextList = (card.attachments || []).filter((att) => att.id !== attId);
      void handleUpdate({ attachments: nextList });
    }
  };

  // Creation Submit
  const handleCreateCard = async () => {
    if (!listId || !title.trim()) return;
    setSubmitting(true);
    try {
      const newCard = await api.createCard(listId, title.trim(), description);
      
      const hasPatches = 
        priority !== "medium" || 
        storyPoints !== 0 || 
        labels.length > 0 || 
        checklist.length > 0 || 
        attachments.length > 0 || 
        assignedUsers.length > 0;
      
      if (hasPatches) {
        const patchData = {
          priority,
          story_points: storyPoints,
          labels,
          checklist,
          attachments,
          assigned_user_ids: assignedUsers.map(u => u.id)
        };
        const updated = await api.updateCard(newCard.id, patchData);
        applyRemoteCard(updated);
      } else {
        applyRemoteCard(newCard);
      }
      addToast("Task created successfully", "success");
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to create task", "error");
    } finally {
      setSubmitting(false);
    }
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
              {isCreate ? (
                <input
                  type="text"
                  placeholder="Task title..."
                  value={title}
                  onChange={(e) => handleTitleSave(e.target.value)}
                  className={styles.titleInput}
                  autoFocus
                />
              ) : (
                <InlineEdit
                  as="heading"
                  value={currentTitle}
                  onSave={handleTitleSave}
                  className={styles.title}
                  disabled={!canEdit}
                />
              )}
              <div className={styles.subtitle}>
                in column <strong>{board?.lists.find((l) => l.id === (isCreate ? listId : card?.list_id))?.title}</strong>
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
                  {isCreate 
                    ? new Date().toLocaleDateString([], { month: "short", day: "2-digit" })
                    : new Date(card!.created_at).toLocaleDateString([], { month: "short", day: "2-digit" })}
                </span>
              </span>
            </div>

            <div className={styles.metaBlock}>
              <span className={styles.metaLabel}>Priority</span>
              {canEdit || isCreate ? (
                <select
                  className={styles.selectInput}
                  value={currentPriority}
                  onChange={(e) => handlePriorityChange(e.target.value as any)}
                >
                  <option value="highest">Highest</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              ) : (
                <span className={styles.metaValue} style={{ textTransform: "capitalize" }}>
                  {currentPriority}
                </span>
              )}
            </div>

            <div className={styles.metaBlock}>
              <span className={styles.metaLabel}>Story Points</span>
              {canEdit || isCreate ? (
                <input
                  type="number"
                  min="0"
                  className={styles.pointsInput}
                  value={currentStoryPoints}
                  onChange={(e) => handleStoryPointsChange(Number(e.target.value))}
                />
              ) : (
                <span className={styles.metaValue}>{currentStoryPoints}</span>
              )}
            </div>
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
                  disabled={!canEdit && !isCreate}
                />
                {(canEdit || isCreate) && (
                  <div className={styles.editControls}>
                    <button type="button" className={styles.saveBtn} onClick={handleSaveDescription}>
                      Save
                    </button>
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={() => {
                        setDescriptionDraft(currentDescription);
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
                onClick={() => (canEdit || isCreate) && setDescriptionEditing(true)}
              >
                {currentDescription ? (
                  <p style={{ margin: 0 }}>{currentDescription}</p>
                ) : (
                  <p className={styles.placeholderText}>
                    {(canEdit || isCreate) ? "Add a more detailed description…" : "No description provided."}
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
              {currentLabels.map((label, i) => (
                <span 
                  key={i} 
                  className={styles.labelBadge}
                  style={{ background: `${label.color}20`, color: label.color, border: `1px solid ${label.color}35` }}
                >
                  {label.text}
                  {(canEdit || isCreate) && (
                    <span 
                      className={styles.labelDelete}
                      onClick={(e) => { e.stopPropagation(); handleDeleteLabel(label.text); }}
                    >
                      &times;
                    </span>
                  )}
                </span>
              ))}

              {(canEdit || isCreate) && !addingLabel && (
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
              {currentAssignedUsers.map((u) => (
                <div key={u.id} className={styles.memberPill}>
                  <EmojiAvatar emoji={u.avatar_emoji || "😀"} username={u.username} size={24} />
                  <div className={styles.memberPillInfo}>
                    <span className={styles.memberPillName}>@{u.username}</span>
                    <span className={styles.memberPillRole}>
                      {u.id === board?.owner_id ? "Owner" : "Member"}
                    </span>
                  </div>
                  {(canEdit || isCreate) && (
                    <button 
                      type="button" 
                      className={styles.removeMemberBtn}
                      onClick={() => handleUnassignUser(u.id)}
                      title="Unassign user"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}

              {(canEdit || isCreate) && board?.team_id && (
                <div className={styles.addMemberContainer}>
                  <select
                    className={styles.addMemberSelect}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAssignUser(Number(e.target.value));
                      }
                    }}
                  >
                    <option value="">+ Assign Member</option>
                    {teamMembers
                      .filter((tm) => !currentAssignedUsers.some((u) => u.id === tm.user.id))
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
              <h3>Attachments ({currentAttachments.length})</h3>
            </div>
            <div className={styles.attachmentsGrid}>
              {currentAttachments.map((att) => (
                <div 
                  key={att.id} 
                  className={styles.attachmentThumb} 
                  style={{ backgroundImage: `url(${att.url})` }}
                  title={att.name}
                >
                  {(canEdit || isCreate) && (
                    <button 
                      type="button" 
                      className={styles.removeAttachmentBtn}
                      onClick={() => handleRemoveAttachment(att.id)}
                      title="Remove attachment"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              
              {(canEdit || isCreate) && (
                <button 
                  type="button" 
                  className={styles.addAttachmentBtn}
                  onClick={handleAddAttachment}
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
              {currentChecklist.map((item) => (
                <div key={item.id} className={styles.checklistItem}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => handleToggleChecklistItem(item.id)}
                    className={styles.checklistCheckbox}
                    disabled={!canEdit && !isCreate}
                  />
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (isCreate) {
                        setChecklist(prev => prev.map(c => c.id === item.id ? { ...c, text: val } : c));
                      } else {
                        const next = (card!.checklist || []).map((c) => 
                          c.id === item.id ? { ...c, text: val } : c
                        );
                        void handleUpdate({ checklist: next });
                      }
                    }}
                    className={`${styles.checklistItemText} ${item.done ? styles.checklistItemTextDone : ""}`}
                    disabled={!canEdit && !isCreate}
                  />
                  {(canEdit || isCreate) && (
                    <button
                      type="button"
                      className={styles.deleteChecklistItemBtn}
                      onClick={() => handleDeleteChecklistItem(item.id)}
                      title="Delete subtask"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}

              {currentChecklist.length === 0 && (
                <p className={styles.noItemsHint}>No tasks added yet.</p>
              )}

              {(canEdit || isCreate) && (
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

        {isCreate && (
          <footer className={styles.footer}>
            <button
              type="button"
              className={styles.createBtn}
              onClick={handleCreateCard}
              disabled={submitting || !title.trim()}
            >
              {submitting ? "Creating…" : "Create Task"}
            </button>
            <button
              type="button"
              className={styles.cancelCreateBtn}
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
          </footer>
        )}
      </motion.div>
    </>
  );
}
