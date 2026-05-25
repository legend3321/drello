export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:8000";

export function boardWebSocketUrl(boardId: number): string {
  const base = WS_URL.replace(/\/$/, "");
  return `${base}/ws/boards/${boardId}/`;
}
