from typing import Optional

from django.db.models import Q

from teams.services import get_membership, user_team_ids

from .models import Board, BoardMembership


# Lower number = higher authority
ROLE_HIERARCHY = {
    "owner": 0,
    "admin": 1,
    "editor": 2,
    "commenter": 3,
    "viewer": 4,
}


def get_board_role(user, board: Board) -> Optional[str]:
    """
    Return the user's effective board role.

    Priority:
      1. Explicit BoardMembership
      2. Team-role mapping (for team boards)
      3. Board owner fallback (for personal boards)
    """
    # 1. Explicit board membership
    membership = BoardMembership.objects.filter(board=board, user=user).first()
    if membership:
        return membership.role

    # 2. Team-role mapping
    if board.team_id:
        team_membership = get_membership(user, board.team)
        if team_membership:
            rl = team_membership.role_level
            if rl.can_manage_boards:
                return "admin"
            elif rl.can_edit_boards:
                return "editor"
            else:
                return "viewer"

    # 3. Personal board owner fallback
    if board.owner_id == user.id:
        return "owner"

    return None


def _has_role_at_least(user, board: Board, required_role: str) -> bool:
    """Check if user's effective board role meets or exceeds the required role."""
    role = get_board_role(user, board)
    if role is None:
        return False
    return ROLE_HIERARCHY.get(role, 99) <= ROLE_HIERARCHY[required_role]


def user_can_view_board(user, board: Board) -> bool:
    return get_board_role(user, board) is not None


def user_can_comment_board(user, board: Board) -> bool:
    return _has_role_at_least(user, board, "commenter")


def user_can_edit_board(user, board: Board) -> bool:
    return _has_role_at_least(user, board, "editor")


def user_can_manage_members(user, board: Board) -> bool:
    return _has_role_at_least(user, board, "admin")


def user_can_manage_board_meta(user, board: Board) -> bool:
    return _has_role_at_least(user, board, "owner")


def boards_for_user(user):
    team_ids = user_team_ids(user)
    # Include boards the user explicitly has membership on
    explicit_board_ids = BoardMembership.objects.filter(user=user).values_list("board_id", flat=True)
    return Board.objects.filter(
        Q(owner=user, team__isnull=True)
        | Q(team_id__in=team_ids)
        | Q(id__in=explicit_board_ids)
    ).distinct()
