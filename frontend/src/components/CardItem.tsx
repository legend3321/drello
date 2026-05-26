"use client";

import React from "react";
import { Draggable, type DraggableProvided } from "@hello-pangea/dnd";
import { 
  Calendar, 
  MessageSquare, 
  ChevronsUp, 
  ChevronUp, 
  ChevronDown, 
  CheckCircle2, 
  Circle,
  Paperclip
} from "lucide-react";

import { useBoardStore } from "@/store/boardStore";
import type { Card } from "@/types/board";
import { EmojiAvatar } from "./EmojiAvatar";
import styles from "./CardItem.module.css";

type Props = {
  card: Card;
  index: number;
  onSelectCard: (id: number) => void;
};

export function CardItem({ card, index, onSelectCard }: Props) {
  const board = useBoardStore((s) => s.board);
  const canEdit = board?.permissions?.can_edit ?? false;
  const deleteCard = useBoardStore((s) => s.deleteCard);

  const onDelete = (event: React.MouseEvent) => {
    if (!canEdit) return;
    event.stopPropagation();
    if (!window.confirm(`Delete card "${card.title}"?`)) return;
    void deleteCard(card.id);
  };

  // Helper to format priority icon/label
  const renderPriority = () => {
    if (!card.priority) return null;
    const pri = card.priority.toLowerCase();
    let icon = <ChevronUp size={12} />;
    if (pri === "highest") icon = <ChevronsUp size={12} />;
    if (pri === "low") icon = <ChevronDown size={12} />;

    return (
      <span className={`${styles.priorityBadge} ${styles["priority" + pri]}`}>
        {icon}
        {card.priority}
      </span>
    );
  };

  // Format date nicely (e.g. Apr 12)
  const formatCardDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    } catch {
      return "Apr 12";
    }
  };

  return (
    <Draggable draggableId={String(card.id)} index={index} isDragDisabled={!canEdit}>
      {(provided: DraggableProvided, snapshot) => (
        <article
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`${styles.card} ${snapshot.isDragging ? styles.dragging : ""}`}
          onClick={() => onSelectCard(card.id)}
        >
          {/* Labels Row */}
          {card.labels && card.labels.length > 0 && (
            <div className={styles.labelsList}>
              {card.labels.map((label, i) => (
                <span 
                  key={i} 
                  className={styles.labelBadge} 
                  style={{ 
                    background: label.color ? `${label.color}25` : "rgba(255,255,255,0.05)",
                    color: label.color || "#94a3b8",
                    border: `1px solid ${label.color ? `${label.color}40` : "transparent"}`
                  }}
                >
                  {label.text}
                </span>
              ))}
            </div>
          )}

          {/* Title Area */}
          <div className={styles.row}>
            <div className={styles.cardHeader}>
              {canEdit && (
                <span
                  className={styles.handle}
                  {...provided.dragHandleProps}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Drag card"
                >
                  ⠿
                </span>
              )}
              <h4 className={styles.title}>{card.title}</h4>
            </div>
            {canEdit && (
              <button
                type="button"
                className={styles.delete}
                onClick={onDelete}
                aria-label={`Delete ${card.title}`}
                title="Delete card"
              >
                &times;
              </button>
            )}
          </div>

          {/* Description Snippet */}
          {card.description && (
            <p className={styles.description}>{card.description}</p>
          )}

          {/* Attachments Preview Grid */}
          {card.attachments && card.attachments.length > 0 && (
            <div className={styles.attachmentsGrid}>
              {card.attachments.slice(0, 3).map((att, i) => (
                <div 
                  key={i} 
                  className={styles.attachmentThumb} 
                  style={{ backgroundImage: `url(${att.url})` }}
                  title={att.name}
                />
              ))}
              {card.attachments.length > 3 && (
                <div className={styles.attachmentOverflow}>
                  +{card.attachments.length - 3}
                </div>
              )}
            </div>
          )}

          {/* Subtask / Checklist List Preview */}
          {card.checklist && card.checklist.length > 0 && (
            <div className={styles.checklistPreview}>
              {card.checklist.slice(0, 3).map((item) => (
                <div 
                  key={item.id} 
                  className={`${styles.checklistItem} ${item.done ? styles.checklistItemDone : ""}`}
                >
                  {item.done ? (
                    <CheckCircle2 size={13} className={styles.checkIcon} />
                  ) : (
                    <Circle size={13} className={styles.circleIcon} />
                  )}
                  <span>{item.text}</span>
                </div>
              ))}
              {card.checklist.length > 3 && (
                <div className={styles.checklistItem} style={{ color: "#475569", fontSize: "0.7rem" }}>
                  + {card.checklist.length - 3} more items
                </div>
              )}
            </div>
          )}

          {/* Metadata Footer Row */}
          <div className={styles.metadataRow}>
            <div className={styles.metaLeft}>
              <span className={styles.metaItem} title="Created date">
                <Calendar size={13} />
                <span>{formatCardDate(card.created_at)}</span>
              </span>
              
              {renderPriority()}

              {card.attachments && card.attachments.length > 0 && (
                <span className={styles.metaItem} title="Attachments">
                  <Paperclip size={13} />
                  <span>{card.attachments.length}</span>
                </span>
              )}
            </div>

            <div className={styles.metaRight}>
              {card.comments_count ? (
                <div className={styles.commentsCount} title="Comments">
                  <MessageSquare size={13} />
                  <span>{card.comments_count}</span>
                </div>
              ) : null}

              {/* Stacked Member Avatar Bubbles */}
              {card.assigned_users && card.assigned_users.length > 0 && (
                <div className={styles.assignedMembers}>
                  {card.assigned_users.slice(0, 3).map((u) => (
                    <div key={u.id} className={styles.avatarWrapper}>
                      <EmojiAvatar 
                        emoji={u.avatar_emoji || "😀"} 
                        username={u.username} 
                        size={20} 
                      />
                    </div>
                  ))}
                  {card.assigned_users.length > 3 && (
                    <div 
                      className={styles.avatarWrapper}
                      style={{ 
                        background: "#1f2937", 
                        fontSize: "8px", 
                        fontWeight: "bold",
                        color: "#94a3b8",
                        width: "20px",
                        height: "20px",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      +{card.assigned_users.length - 3}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </article>
      )}
    </Draggable>
  );
}
