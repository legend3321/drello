"use client";

import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { FormEvent, useCallback, useState } from "react";

import { useBoardStore } from "@/store/boardStore";
import type { DragResult as MovePayload } from "@/types/board";

import { KanbanColumn } from "./KanbanColumn";
import styles from "./KanbanBoard.module.css";

export function KanbanBoard() {
  const board = useBoardStore((s) => s.board);
  const addList = useBoardStore((s) => s.addList);
  const moveCardOptimistic = useBoardStore((s) => s.moveCardOptimistic);
  const persistCardMove = useBoardStore((s) => s.persistCardMove);
  const [newColumnTitle, setNewColumnTitle] = useState("");

  const canEdit = board?.permissions?.can_edit ?? false;

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination || !board) return;
      if (!canEdit) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const payload: MovePayload = {
        cardId: Number(draggableId),
        sourceListId: Number(source.droppableId),
        destListId: Number(destination.droppableId),
        sourceIndex: source.index,
        destIndex: destination.index,
      };

      moveCardOptimistic(payload);
      void persistCardMove(payload);
    },
    [board, canEdit, moveCardOptimistic, persistCardMove],
  );

  const onAddColumn = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    const title = newColumnTitle.trim() || "New column";
    void addList(title).then(() => setNewColumnTitle(""));
  };

  if (!board) return null;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className={styles.board}>
        {board.lists.map((list) => (
          <KanbanColumn key={list.id} list={list} />
        ))}

        {canEdit ? (
          <section className={styles.addColumn}>
            <form onSubmit={onAddColumn}>
              <h3 className={styles.addTitle}>Add column</h3>
              <input
                className={styles.addInput}
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder="Column name…"
              />
              <button type="submit" className={styles.addBtn}>
                + Add column
              </button>
            </form>
          </section>
        ) : null}
      </div>
    </DragDropContext>
  );
}
