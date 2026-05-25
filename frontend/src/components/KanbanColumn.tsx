"use client";

import { Droppable, type DroppableProvided } from "@hello-pangea/dnd";
import { FormEvent, useState } from "react";

import { useBoardStore } from "@/store/boardStore";
import type { ListColumn } from "@/types/board";

import { CardItem } from "./CardItem";
import { InlineEdit } from "./InlineEdit";
import styles from "./KanbanColumn.module.css";

type Props = {
  list: ListColumn;
};

export function KanbanColumn({ list }: Props) {
  const board = useBoardStore((s) => s.board);
  const canEdit = board?.permissions?.can_edit ?? false;

  const updateListTitle = useBoardStore((s) => s.updateListTitle);
  const deleteList = useBoardStore((s) => s.deleteList);
  const addCard = useBoardStore((s) => s.addCard);
  const [newCardTitle, setNewCardTitle] = useState("");

  const onAddCard = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    const title = newCardTitle.trim();
    if (!title) return;
    void addCard(list.id, title).then(() => setNewCardTitle(""));
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
        <div className={styles.pill}>
          <InlineEdit
            as="heading"
            value={list.title}
            onSave={(title) => updateListTitle(list.id, title)}
            className={styles.pillTitle}
            disabled={!canEdit}
          />
          <span className={styles.count}>{list.cards.length}</span>
        </div>
        {canEdit ? (
          <button
            type="button"
            className={styles.deleteColumn}
            onClick={onDeleteColumn}
            aria-label={`Delete column ${list.title}`}
            title="Delete column"
          >
            ×
          </button>
        ) : null}
      </header>

      <Droppable droppableId={String(list.id)} isDropDisabled={!canEdit}>
        {(provided: DroppableProvided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`${styles.cards} ${snapshot.isDraggingOver ? styles.over : ""}`}
          >
            {list.cards.map((card, index) => (
              <CardItem key={card.id} card={card} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {canEdit ? (
        <form className={styles.addCard} onSubmit={onAddCard}>
          <input
            className={styles.addInput}
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            placeholder="Add a card…"
          />
          <button type="submit" className={styles.addBtn} disabled={!newCardTitle.trim()}>
            Add card
          </button>
        </form>
      ) : null}
    </section>
  );
}
