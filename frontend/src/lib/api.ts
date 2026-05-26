import { getAccessToken } from "@/lib/auth-storage";
import { useAuthStore } from "@/store/authStore";
import type { Board, BoardSummary, Card, ListColumn, Comment, ActivityLog, BoardChatMessage } from "@/types/board";
import type { User } from "@/types/auth";
import type {
  TeamAdminDashboard,
  TeamDetail,
  TeamMembership,
  TeamRoleLevel,
  TeamSummary,
} from "@/types/team";
import { API_URL } from "./config";

function parseApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;
  return fallback;
}

async function request<T>(path: string, init?: RequestInit, allowRetry = true): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && allowRetry) {
    const refreshed = await useAuthStore.getState().refreshAccessToken();
    if (refreshed) {
      return request<T>(path, init, false);
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(parseApiError(body, `Request failed (${response.status})`));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  listBoards: () => request<BoardSummary[]>("/api/boards/"),

  getBoard: (id: number) => request<Board>(`/api/boards/${id}/`),

  createBoard: (title: string, teamId?: number | null) =>
    request<BoardSummary>("/api/boards/", {
      method: "POST",
      body: JSON.stringify({
        title,
        ...(teamId != null ? { team_id: teamId } : {}),
      }),
    }),

  updateBoard: (id: number, title: string) =>
    request<BoardSummary>(`/api/boards/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),

  deleteBoard: (id: number) =>
    request<void>(`/api/boards/${id}/`, { method: "DELETE" }),

  createList: (boardId: number, title: string) =>
    request<ListColumn>("/api/lists/", {
      method: "POST",
      body: JSON.stringify({ board_id: boardId, title }),
    }),

  updateList: (id: number, title: string) =>
    request<ListColumn>(`/api/lists/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),

  deleteList: (id: number) => request<void>(`/api/lists/${id}/`, { method: "DELETE" }),

  createCard: (listId: number, title: string, description = "") =>
    request<Card>("/api/cards/", {
      method: "POST",
      body: JSON.stringify({ list_id: listId, title, description }),
    }),

  updateCard: (
    id: number,
    data: { 
      title?: string; 
      description?: string;
      priority?: "highest" | "medium" | "low";
      story_points?: number;
      labels?: { text: string; color: string }[];
      checklist?: { id: string; text: string; done: boolean }[];
      attachments?: { id: string; name: string; url: string }[];
      assigned_user_ids?: number[];
    },
  ) =>
    request<Card>(`/api/cards/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteCard: (id: number) => request<void>(`/api/cards/${id}/`, { method: "DELETE" }),

  moveCard: (cardId: number, listId: number, position: number) =>
    request<Card>(`/api/cards/${cardId}/move/`, {
      method: "PATCH",
      body: JSON.stringify({ list_id: listId, position }),
    }),

  getCardComments: (cardId: number) =>
    request<Comment[]>(`/api/cards/${cardId}/comments/`),

  createCardComment: (cardId: number, text: string) =>
    request<Comment>(`/api/cards/${cardId}/comments/`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  getCardHistory: (cardId: number) =>
    request<ActivityLog[]>(`/api/cards/${cardId}/history/`),

  getBoardHistory: (boardId: number) =>
    request<ActivityLog[]>(`/api/boards/${boardId}/history/`),

  listTeams: () => request<TeamSummary[]>("/api/teams/"),

  getTeam: (id: number) => request<TeamDetail>(`/api/teams/${id}/`),

  createTeam: (name: string, description = "") =>
    request<TeamDetail>("/api/teams/", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),

  getTeamAdminDashboard: (id: number) =>
    request<TeamAdminDashboard>(`/api/teams/${id}/admin-dashboard/`),

  addTeamMember: (
    teamId: number,
    roleLevelId: number,
    options: { userId?: number; username?: string },
  ) =>
    request<TeamMembership>(`/api/teams/${teamId}/members/add/`, {
      method: "POST",
      body: JSON.stringify({
        role_level_id: roleLevelId,
        ...(options.userId != null ? { user_id: options.userId } : {}),
        ...(options.username ? { username: options.username } : {}),
      }),
    }),

  updateTeamMember: (teamId: number, userId: number, roleLevelId: number) =>
    request<TeamMembership>(`/api/teams/${teamId}/members/${userId}/`, {
      method: "PATCH",
      body: JSON.stringify({ role_level_id: roleLevelId }),
    }),

  removeTeamMember: (teamId: number, userId: number) =>
    request<void>(`/api/teams/${teamId}/members/${userId}/remove/`, {
      method: "DELETE",
    }),

  listTeamRoleLevels: (teamId: number) =>
    request<TeamRoleLevel[]>(`/api/teams/${teamId}/role-levels/`),

  getTeamMembers: (teamId: number) =>
    request<TeamMembership[]>(`/api/teams/${teamId}/members/`),

  searchUsers: (query: string, excludeTeamId?: number) => {
    const params = new URLSearchParams({ q: query });
    if (excludeTeamId != null) {
      params.append("exclude_team_id", excludeTeamId.toString());
    }
    return request<User[]>(`/api/auth/users/search/?${params.toString()}`);
  },

  createTeamInvitation: (teamId: number, roleLevelId: number) =>
    request<{
      code: string;
      role_level_id: number;
      role_level_name: string;
      team_name: string;
    }>(`/api/teams/${teamId}/invitations/`, {
      method: "POST",
      body: JSON.stringify({ role_level_id: roleLevelId }),
    }),

  getInvitation: (code: string) =>
    request<{
      code: string;
      team_id: number;
      team_name: string;
      role_level_id: number;
      role_level_name: string;
      created_by_username: string;
    }>(`/api/invitations/${code}/`),

  acceptInvitation: (code: string) =>
    request<{
      detail: string;
      team_id: number;
    }>(`/api/invitations/${code}/accept/`, {
      method: "POST",
    }),

  getBoardChatHistory: (boardId: number) =>
    request<BoardChatMessage[]>(`/api/boards/${boardId}/chat/`),
};

