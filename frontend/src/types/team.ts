export interface TeamRoleLevel {
  id: number;
  name: string;
  slug: string;
  rank: number;
  can_manage_team: boolean;
  can_manage_members: boolean;
  can_manage_boards: boolean;
  can_edit_boards: boolean;
  member_count?: number;
}

export interface TeamMemberUser {
  id: number;
  username: string;
  email: string;
  avatar_emoji?: string;
}


export interface TeamMembership {
  id: number;
  user: TeamMemberUser;
  role_level: TeamRoleLevel;
  joined_at: string;
}

export interface TeamSummary {
  id: number;
  name: string;
  slug: string;
  description: string;
  member_count: number;
  my_role: TeamRoleLevel | null;
  created_at: string;
  updated_at: string;
}

export interface TeamDetail extends TeamSummary {
  role_levels: TeamRoleLevel[];
}

export interface TeamAdminDashboard {
  team: TeamDetail;
  stats: {
    member_count: number;
    board_count: number;
    role_level_count: number;
  };
  members: TeamMembership[];
  boards: {
    id: number;
    title: string;
    team_id: number | null;
    team_name: string | null;
    created_at: string;
    updated_at: string;
  }[];
  permissions: {
    can_manage_team: boolean;
    can_manage_members: boolean;
    can_manage_boards: boolean;
    can_edit_boards: boolean;
    is_owner: boolean;
  };
}
