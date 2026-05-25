from rest_framework.permissions import BasePermission

from .access import user_can_edit_board, user_can_manage_board_meta, user_can_view_board
from .models import Board


class HasBoardAccess(BasePermission):
    """View boards the user owns (personal) or belongs to via team membership."""

    def has_object_permission(self, request, view, obj):
        board = obj if isinstance(obj, Board) else getattr(obj, "board", None)
        if board is None and hasattr(obj, "list"):
            board = obj.list.board
        if board is None:
            return False
        return user_can_view_board(request.user, board)


class CanEditBoard(BasePermission):
    def has_object_permission(self, request, view, obj):
        board = obj if isinstance(obj, Board) else getattr(obj, "board", None)
        if board is None and hasattr(obj, "list"):
            board = obj.list.board
        if board is None:
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return user_can_view_board(request.user, board)
        return user_can_edit_board(request.user, board)


class CanManageBoard(BasePermission):
    def has_object_permission(self, request, view, obj):
        if not isinstance(obj, Board):
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return user_can_view_board(request.user, obj)
        if request.method == "DELETE":
            return user_can_manage_board_meta(request.user, obj)
        return user_can_edit_board(request.user, obj)
