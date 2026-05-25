from django.db.models import Q

from teams.services import get_membership, user_team_ids

from .models import Board


def user_can_view_board(user, board: Board) -> bool:
    if board.team_id:
        return get_membership(user, board.team) is not None
    return board.owner_id == user.id


def user_can_edit_board(user, board: Board) -> bool:
    if board.team_id:
        membership = get_membership(user, board.team)
        return membership is not None and membership.role_level.can_edit_boards
    return board.owner_id == user.id


def user_can_manage_board_meta(user, board: Board) -> bool:
    if board.team_id:
        membership = get_membership(user, board.team)
        return membership is not None and membership.role_level.can_manage_boards
    return board.owner_id == user.id


def boards_for_user(user):
    team_ids = user_team_ids(user)
    return Board.objects.filter(
        Q(owner=user, team__isnull=True) | Q(team_id__in=team_ids)
    ).distinct()
