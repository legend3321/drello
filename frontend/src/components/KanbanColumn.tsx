"use client";

import { Droppable, type DroppableProvided } from "@hello-pangea/dnd";
import { FormEvent, useState, useRef, useEffect } from "react";
import { 
  ClipboardList, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  MoreHorizontal, 
  Plus,
  Trash2,
  Smile
} from "lucide-react";

import { useBoardStore } from "@/store/boardStore";
import type { ListColumn } from "@/types/board";

import { CardItem } from "./CardItem";
import { InlineEdit } from "./InlineEdit";
import styles from "./KanbanColumn.module.css";

type Props = {
  list: ListColumn;
  onSelectCard: (id: number) => void;
  onCreateCard?: (listId: number) => void;
};

const COLUMN_EMOJIS = [
  "📋", "🚀", "⚡", "🎯", "🔥", "✨",
  "⏳", "🔨", "👀", "✅", "🎉", "💡",
  "📌", "🐛", "🎨", "📦", "🛑", "⭐",
];

function parseTitleEmoji(rawTitle: string): { emoji: string | null; cleanTitle: string } {
  const trimmed = rawTitle.trim();
  // Match an emoji at start of title followed by a space
  const emojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation})\s+/u;
  const match = trimmed.match(emojiRegex);
  if (match) {
    return { emoji: match[1], cleanTitle: trimmed.slice(match[0].length).trim() };
  }
  return { emoji: null, cleanTitle: trimmed };
}

function getDefaultColumnIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("todo") || t.includes("new") || t.includes("backlog")) {
    return <ClipboardList size={16} className={styles.columnIcon} style={{ color: "#3b82f6" }} />;
  }
  if (t.includes("progress") || t.includes("working") || t.includes("active")) {
    return <Play size={16} className={styles.columnIcon} style={{ color: "#f59e0b" }} />;
  }
  if (t.includes("done") || t.includes("completed") || t.includes("complete")) {
    return <CheckCircle2 size={16} className={styles.columnIcon} style={{ color: "#10b981" }} />;
  }
  return <AlertTriangle size={16} className={styles.columnIcon} style={{ color: "#a855f7" }} />;
}

export function KanbanColumn({ list, onSelectCard, onCreateCard }: Props) {
  const board = useBoardStore((s) => s.board);
  const canEdit = board?.permissions?.can_edit ?? false;

  const updateListTitle = useBoardStore((s) => s.updateListTitle);
  const deleteList = useBoardStore((s) => s.deleteList);
  const addCard = useBoardStore((s) => s.addCard);

  const [newCardTitle, setNewCardTitle] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const { emoji: customEmoji, cleanTitle } = parseTitleEmoji(list.title);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelectEmoji = (emoji: string) => {
    setShowEmojiPicker(false);
    if (!canEdit) return;
    const newTitle = `${emoji} ${cleanTitle}`;
    void updateListTitle(list.id, newTitle);
  };

  const handleResetEmoji = () => {
    setShowEmojiPicker(false);
    if (!canEdit) return;
    void updateListTitle(list.id, cleanTitle);
  };

  const onAddCard = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    const title = newCardTitle.trim();
    if (!title) return;
    void addCard(list.id, title).then(() => {
      setNewCardTitle("");
      setShowAddForm(false);
    });
  };

  const onDeleteColumn = () => {
    if (!canEdit) return;
    if (
      !window.confirm(
        `Delete column "${list.title}"? Cards in this column will be removed.`,
      )
    ) {
      return;
    }
    void deleteList(list.id);
  };

  return (
    <section className={styles.column}>
      <header className={styles.header}>
        <div className={styles.headerTitleArea}>
          <div className={styles.iconWrapper} ref={emojiPickerRef}>
            <button
              type="button"
              className={styles.columnEmojiBtn}
              onClick={() => canEdit && setShowEmojiPicker(!showEmojiPicker)}
              title={canEdit ? "Click to change column icon/emoji" : undefined}
              style={{ cursor: canEdit ? "pointer" : "default" }}
            >
              {customEmoji ? (
                <span>{customEmoji}</span>
              ) : (
                getDefaultColumnIcon(cleanTitle)
              )}
            </button>

            {canEdit && showEmojiPicker && (
              <div className={styles.emojiPopover}>
                <span className={styles.emojiPopoverTitle}>Choose Column Icon</span>
                <div className={styles.emojiGrid}>
                  {COLUMN_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={`${styles.emojiOption} ${customEmoji === emoji ? styles.emojiOptionActive : ""}`}
                      onClick={() => handleSelectEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                {customEmoji && (
                  <button
                    type="button"
                    className={styles.resetIconBtn}
                    onClick={handleResetEmoji}
                  >
                    Reset to Default Icon
                  </button>
                )}
              </div>
            )}
          </div>

          <InlineEdit
            as="heading"
            value={cleanTitle}
            onSave={(title) => {
              const newFullTitle = customEmoji ? `${customEmoji} ${title}` : title;
              return updateListTitle(list.id, newFullTitle);
            }}
            className={styles.columnTitle}
            disabled={!canEdit}
          />
          <span className={styles.count}>({list.cards.length})</span>
        </div>
        <div className={styles.headerActions}>
          {canEdit && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => {
                if (onCreateCard) {
                  onCreateCard(list.id);
                } else {
                  setShowAddForm(!showAddForm);
                }
              }}
              title="Add card"
            >
              <Plus size={16} />
            </button>
          )}
          {canEdit && (
            <div className={styles.menuContainer} ref={menuRef}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setShowMenu(!showMenu)}
                title="Column options"
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <div className={styles.dropdownMenu}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      setShowMenu(false);
                      setShowEmojiPicker(true);
                    }}
                  >
                    <Smile size={14} /> Change Emoji / Icon
                  </button>
                  <button
                    type="button"
                    className={styles.menuItemDanger}
                    onClick={() => {
                      onDeleteColumn();
                      setShowMenu(false);
                    }}
                  >
                    <Trash2 size={14} /> Delete Column
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <Droppable droppableId={String(list.id)} isDropDisabled={!canEdit}>
        {(provided: DroppableProvided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`${styles.cards} ${snapshot.isDraggingOver ? styles.over : ""}`}
          >
            {list.cards.map((card, index) => (
              <CardItem key={card.id} card={card} index={index} onSelectCard={onSelectCard} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {canEdit && showAddForm && (
        <form className={styles.addCard} onSubmit={onAddCard}>
          <input
            className={styles.addInput}
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            placeholder="Add a card title…"
            autoFocus
          />
          <div className={styles.addFormActions}>
            <button type="submit" className={styles.saveCardBtn} disabled={!newCardTitle.trim()}>
              Add card
            </button>
            <button type="button" className={styles.cancelCardBtn} onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
