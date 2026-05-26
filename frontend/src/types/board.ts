export interface Card {
  id: number;
  list_id: number;
  board_id: number;
  title: string;
  description: string;
  position: number;
  priority?: "highest" | "medium" | "low";
  story_points?: number;
  labels?: { text: string; color: string }[];
  checklist?: { id: string; text: string; done: boolean }[];
  attachments?: { id: string; name: string; url: string }[];
  assigned_users?: { id: number; username: string; email: string; avatar_emoji?: string }[];
  comments_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ListColumn {
  id: number;
  board_id: number;
  title: string;
  position: number;
  cards: Card[];
}

export interface Board {
  id: number;
  title: string;
  lists: ListColumn[];
  created_at: string;
  updated_at: string;
  team_id?: number | null;
  team_name?: string | null;
  owner_id?: number;
  owner_username?: string;
  owner_email?: string;
  owner_avatar_emoji?: string;
  permissions?: {
    can_edit: boolean;
    can_delete: boolean;
  };
}


export interface BoardSummary {
  id: number;
  title: string;
  team_id: number | null;
  team_name: string | null;
  created_at: string;
  updated_at: string;
  permissions?: {
    can_edit: boolean;
    can_delete: boolean;
  };
}

export type DragResult = {
  cardId: number;
  sourceListId: number;
  destListId: number;
  sourceIndex: number;
  destIndex: number;
};

export interface Comment {
  id: number;
  card: number;
  username: string;
  avatar_emoji?: string;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  username: string;
  action: string;
  detail: string;
  card_title: string | null;
  created_at: string;
}

export interface BoardChatMessage {
  id: number;
  username: string;
  avatar_emoji?: string;
  text: string;
  created_at: string;
}


