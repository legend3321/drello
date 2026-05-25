import { getAccessToken } from "@/lib/auth-storage";
import type { BoardSummary, Card, ListColumn, Comment, ActivityLog, BoardChatMessage } from "@/types/board";

import { boardWebSocketUrl } from "./config";

export type BoardSocketEvent =
  | { type: "board_updated"; payload: BoardSummary }
  | { type: "board_deleted"; payload: { id: number } }
  | { type: "list_created"; payload: ListColumn }
  | { type: "list_updated"; payload: ListColumn }
  | { type: "list_deleted"; payload: { id: number } }
  | { type: "card_created"; payload: Card }
  | { type: "card_updated"; payload: Card }
  | { type: "card_moved"; payload: Card }
  | { type: "card_deleted"; payload: { id: number } }
  | { type: "comment_created"; payload: Comment }
  | { type: "activity_created"; payload: ActivityLog }
  | { type: "presence_updated"; payload: { online_users: string[] } }
  | { type: "chat_message_created"; payload: BoardChatMessage };

type Handler = (event: BoardSocketEvent) => void;

export interface BoardSocketConnection {
  disconnect: () => void;
  sendJson: (data: any) => void;
}

export function connectBoardSocket(
  boardId: number,
  onEvent: Handler,
  onStatus?: (connected: boolean) => void,
): BoardSocketConnection {
  const token = getAccessToken();
  const url = new URL(boardWebSocketUrl(boardId));
  if (token) {
    url.searchParams.set("token", token);
  }

  const socket = new WebSocket(url.toString());

  socket.onopen = () => onStatus?.(true);
  socket.onclose = () => onStatus?.(false);
  socket.onerror = () => onStatus?.(false);

  socket.onmessage = (message) => {
    try {
      const data = JSON.parse(message.data as string) as BoardSocketEvent;
      if (data?.type && data.payload !== undefined) {
        onEvent(data);
      }
    } catch {
      // ignore malformed frames
    }
  };

  return {
    disconnect: () => {
      socket.close();
    },
    sendJson: (data: any) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
      }
    }
  };
}

