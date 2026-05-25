import { create } from "zustand";

import { api } from "@/lib/api";
import type { Board, Card, DragResult, ListColumn } from "@/types/board";

type Toast = { id: number; message: string; type: "error" | "success" };

type BoardState = {
  board: Board | null;
  loading: boolean;
  connected: boolean;
  toasts: Toast[];
  snapshot: Board | null;
  loadBoard: (id: number) => Promise<void>;
  setConnected: (connected: boolean) => void;
  updateBoardTitle: (title: string) => Promise<void>;
  addList: (title: string) => Promise<void>;
  updateListTitle: (listId: number, title: string) => Promise<void>;
  deleteList: (listId: number) => Promise<void>;
  addCard: (listId: number, title: string) => Promise<void>;
  updateCardTitle: (cardId: number, title: string) => Promise<void>;
  deleteCard: (cardId: number) => Promise<void>;
  applyRemoteBoardUpdate: (payload: { id: number; title: string }) => void;
  removeRemoteList: (listId: number) => void;
  applyRemoteList: (list: ListColumn) => void;
  applyRemoteCard: (card: Card) => void;
  removeRemoteCard: (cardId: number) => void;
  moveCardOptimistic: (result: DragResult) => void;
  persistCardMove: (result: DragResult) => Promise<void>;
  addToast: (message: string, type?: Toast["type"]) => void;
  dismissToast: (id: number) => void;
};

let toastCounter = 0;

function cloneBoard(board: Board): Board {
  return JSON.parse(JSON.stringify(board)) as Board;
}

function reorderLists(board: Board): Board {
  board.lists.sort((a, b) => a.position - b.position);
  for (const list of board.lists) {
    list.cards.sort((a, b) => a.position - b.position);
  }
  return board;
}

function applyDragLocally(board: Board, result: DragResult): Board {
  const next = cloneBoard(board);
  const sourceList = next.lists.find((l) => l.id === result.sourceListId);
  const destList = next.lists.find((l) => l.id === result.destListId);
  if (!sourceList || !destList) return board;

  const [moved] = sourceList.cards.splice(result.sourceIndex, 1);
  if (!moved) return board;

  moved.list_id = result.destListId;
  destList.cards.splice(result.destIndex, 0, moved);

  sourceList.cards.forEach((card, index) => {
    card.position = index;
    card.list_id = sourceList.id;
  });
  destList.cards.forEach((card, index) => {
    card.position = index;
    card.list_id = destList.id;
  });

  return reorderLists(next);
}

export const useBoardStore = create<BoardState>((set, get) => ({
  board: null,
  loading: false,
  connected: false,
  toasts: [],
  snapshot: null,

  loadBoard: async (id) => {
    set({ loading: true });
    try {
      const board = await api.getBoard(id);
      set({ board: reorderLists(board), loading: false });
    } catch (error) {
      set({ loading: false });
      get().addToast(
        error instanceof Error ? error.message : "Failed to load board",
        "error",
      );
    }
  },

  setConnected: (connected) => set({ connected }),

  updateBoardTitle: async (title) => {
    const { board } = get();
    if (!board) return;
    const previous = board.title;
    set({ board: { ...board, title } });
    try {
      await api.updateBoard(board.id, title);
      get().addToast("Board renamed", "success");
    } catch (error) {
      set({ board: { ...board, title: previous } });
      get().addToast(
        error instanceof Error ? error.message : "Failed to rename board",
        "error",
      );
    }
  },

  addList: async (title) => {
    const { board } = get();
    if (!board) return;
    try {
      const list = await api.createList(board.id, title);
      get().applyRemoteList({ ...list, cards: list.cards ?? [] });
      get().addToast("Column added", "success");
    } catch (error) {
      get().addToast(
        error instanceof Error ? error.message : "Failed to add column",
        "error",
      );
    }
  },

  updateListTitle: async (listId, title) => {
    const { board } = get();
    if (!board) return;
    const list = board.lists.find((l) => l.id === listId);
    if (!list) return;
    const previous = list.title;
    const next = cloneBoard(board);
    const target = next.lists.find((l) => l.id === listId);
    if (target) target.title = title;
    set({ board: next });
    try {
      await api.updateList(listId, title);
    } catch (error) {
      const revert = cloneBoard(board);
      const revTarget = revert.lists.find((l) => l.id === listId);
      if (revTarget) revTarget.title = previous;
      set({ board: revert });
      get().addToast(
        error instanceof Error ? error.message : "Failed to rename column",
        "error",
      );
    }
  },

  deleteList: async (listId) => {
    const { board } = get();
    if (!board) return;
    const previous = cloneBoard(board);
    set({
      board: reorderLists({
        ...board,
        lists: board.lists.filter((l) => l.id !== listId),
      }),
    });
    try {
      await api.deleteList(listId);
      get().addToast("Column deleted", "success");
    } catch (error) {
      set({ board: previous });
      get().addToast(
        error instanceof Error ? error.message : "Failed to delete column",
        "error",
      );
    }
  },

  addCard: async (listId, title) => {
    try {
      const card = await api.createCard(listId, title);
      get().applyRemoteCard(card);
      get().addToast("Card added", "success");
    } catch (error) {
      get().addToast(
        error instanceof Error ? error.message : "Failed to add card",
        "error",
      );
    }
  },

  updateCardTitle: async (cardId, title) => {
    const { board } = get();
    if (!board) return;
    let previous = "";
    const next = cloneBoard(board);
    for (const list of next.lists) {
      const card = list.cards.find((c) => c.id === cardId);
      if (card) {
        previous = card.title;
        card.title = title;
      }
    }
    set({ board: next });
    try {
      const updated = await api.updateCard(cardId, { title });
      get().applyRemoteCard(updated);
    } catch (error) {
      const revert = cloneBoard(board);
      for (const list of revert.lists) {
        const card = list.cards.find((c) => c.id === cardId);
        if (card) card.title = previous;
      }
      set({ board: revert });
      get().addToast(
        error instanceof Error ? error.message : "Failed to rename card",
        "error",
      );
    }
  },

  deleteCard: async (cardId) => {
    const { board } = get();
    if (!board) return;
    const previous = cloneBoard(board);
    const next = cloneBoard(board);
    for (const list of next.lists) {
      list.cards = list.cards.filter((c) => c.id !== cardId);
    }
    set({ board: reorderLists(next) });
    try {
      await api.deleteCard(cardId);
      get().addToast("Card deleted", "success");
    } catch (error) {
      set({ board: previous });
      get().addToast(
        error instanceof Error ? error.message : "Failed to delete card",
        "error",
      );
    }
  },

  applyRemoteBoardUpdate: (payload) => {
    const { board } = get();
    if (!board || board.id !== payload.id) return;
    set({ board: { ...board, title: payload.title } });
  },

  removeRemoteList: (listId) => {
    const { board } = get();
    if (!board) return;
    set({
      board: reorderLists({
        ...board,
        lists: board.lists.filter((l) => l.id !== listId),
      }),
    });
  },

  applyRemoteList: (list) => {
    const { board } = get();
    if (!board || list.board_id !== board.id) return;

    const next = cloneBoard(board);
    const index = next.lists.findIndex((l) => l.id === list.id);
    const normalized = { ...list, cards: list.cards ?? [] };

    if (index >= 0) {
      next.lists[index] = { ...next.lists[index], ...normalized };
    } else {
      next.lists.push(normalized);
    }
    set({ board: reorderLists(next) });
  },

  applyRemoteCard: (card) => {
    const { board } = get();
    if (!board || card.board_id !== board.id) return;

    const next = cloneBoard(board);
    for (const list of next.lists) {
      list.cards = list.cards.filter((c) => c.id !== card.id);
    }
    const targetList = next.lists.find((l) => l.id === card.list_id);
    if (!targetList) return;

    targetList.cards.push(card);
    set({ board: reorderLists(next) });
  },

  removeRemoteCard: (cardId) => {
    const { board } = get();
    if (!board) return;
    const next = cloneBoard(board);
    for (const list of next.lists) {
      list.cards = list.cards.filter((c) => c.id !== cardId);
    }
    set({ board: reorderLists(next) });
  },

  moveCardOptimistic: (result) => {
    const { board } = get();
    if (!board) return;
    set({
      snapshot: cloneBoard(board),
      board: applyDragLocally(board, result),
    });
  },

  persistCardMove: async (result) => {
    const { board, snapshot } = get();
    if (!board) return;

    try {
      const updated = await api.moveCard(
        result.cardId,
        result.destListId,
        result.destIndex,
      );
      get().applyRemoteCard(updated);
      set({ snapshot: null });
    } catch (error) {
      if (snapshot) {
        set({ board: snapshot, snapshot: null });
      }
      get().addToast(
        error instanceof Error ? error.message : "Failed to move card",
        "error",
      );
    }
  },

  addToast: (message, type = "error") => {
    const id = ++toastCounter;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    window.setTimeout(() => get().dismissToast(id), 4000);
  },

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
