"use client";

import { useState } from "react";
import { Draggable, type DraggableProvided } from "@hello-pangea/dnd";

import { useBoardStore } from "@/store/boardStore";
import type { Card } from "@/types/board";

import { InlineEdit } from "./InlineEdit";
import { CardModal } from "./CardModal";
import styles from "./CardItem.module.css";

type Props = {
  card: Card;
  index: number;
};

export function CardItem({ card, index }: Props) {
  const board = useBoardStore((s) => s.board);
  const canEdit = board?.permissions?.can_edit ?? false;

  const updateCardTitle = useBoardStore((s) => s.updateCardTitle);
  const deleteCard = useBoardStore((s) => s.deleteCard);

  const [showModal, setShowModal] = useState(false);

  const onDelete = (event: React.MouseEvent) => {
    if (!canEdit) return;
    event.stopPropagation();
    if (!window.confirm(`Delete card "${card.title}"?`)) return;
    void deleteCard(card.id);
  };

  return (
    <>
      <Draggable draggableId={String(card.id)} index={index} isDragDisabled={!canEdit}>
        {(provided: DraggableProvided, snapshot) => (
          <article
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={`${styles.card} ${snapshot.isDragging ? styles.dragging : ""}`}
          >
            <div className={styles.row}>
              {canEdit ? (
                <span
                  className={styles.handle}
                  {...provided.dragHandleProps}
                  aria-label="Drag card"
                >
                  ⠿
                </span>
              ) : null}
              <div className={styles.body} onClick={() => setShowModal(true)}>
                <InlineEdit
                  value={card.title}
                  onSave={(title) => updateCardTitle(card.id, title)}
                  className={styles.title}
                  disabled={!canEdit}
                />
                {card.description ? (
                  <p className={styles.description}>{card.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                className={styles.optionsBtn}
                onClick={() => setShowModal(true)}
                aria-label="Card options"
                title="Card options"
              >
                •••
              </button>
              {canEdit ? (
                <button
                  type="button"
                  className={styles.delete}
                  onClick={onDelete}
                  aria-label={`Delete ${card.title}`}
                >
                  &times;
                </button>
              ) : null}
            </div>
          </article>
        )}
      </Draggable>
      {showModal ? (
        <CardModal cardId={card.id} onClose={() => setShowModal(false)} />
      ) : null}
    </>
  );
}
