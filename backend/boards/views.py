from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from teams.services import get_membership

from .access import (
    boards_for_user,
    user_can_edit_board,
    user_can_manage_board_meta,
    user_can_manage_members,
    get_board_role,
    ROLE_HIERARCHY,
)
from .broadcast import broadcast_board_event
from .models import Board, BoardMembership, Card, List, Comment, ActivityLog
from .permissions import CanEditBoard, CanManageBoard, HasBoardAccess
from .serializers import (
    BoardListSerializer,
    BoardMembershipSerializer,
    BoardSerializer,
    CardMoveSerializer,
    CardSerializer,
    ListSerializer,
    CommentSerializer,
    ActivityLogSerializer,
)
from .services import move_card

from django.contrib.auth import get_user_model
User = get_user_model()


class BoardViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CanManageBoard]

    def get_queryset(self):
        return (
            boards_for_user(self.request.user)
            .prefetch_related("lists__cards", "team")
            .all()
        )

    def get_serializer_class(self):
        if self.action == "list":
            return BoardListSerializer
        return BoardSerializer

    def perform_create(self, serializer):
        team = serializer.validated_data.get("team")
        if team:
            membership = get_membership(self.request.user, team)
            if not membership or not membership.role_level.can_edit_boards:
                raise PermissionDenied("You cannot create boards for this team.")
        board = serializer.save(owner=self.request.user)
        # Auto-create owner BoardMembership
        BoardMembership.objects.get_or_create(
            board=board,
            user=self.request.user,
            defaults={"role": "owner"},
        )

    def perform_update(self, serializer):
        board = self.get_object()
        if not user_can_edit_board(self.request.user, board):
            raise PermissionDenied("Read-only access to this board.")
        old_title = board.title
        instance = serializer.save()
        if old_title != instance.title:
            ActivityLog.objects.create(
                board=instance,
                user=self.request.user,
                action="updated",
                detail=f"Renamed board from '{old_title}' to '{instance.title}'",
            )
        broadcast_board_event(
            instance.id,
            "board_updated",
            BoardListSerializer(instance).data,
        )

    def perform_destroy(self, instance):
        if not user_can_manage_board_meta(self.request.user, instance):
            raise PermissionDenied("You cannot delete this board.")
        board_id = instance.id
        instance.delete()
        broadcast_board_event(board_id, "board_deleted", {"id": board_id})

    @action(detail=True, methods=["post"])
    def seed(self, request, pk=None):
        """Create demo lists/cards for a new board."""
        board = self.get_object()
        if not user_can_edit_board(request.user, board):
            raise PermissionDenied("Read-only access to this board.")
        if board.lists.exists():
            return Response({"detail": "Board already has lists"}, status=400)

        defaults = [
            ("To Do", ["Design API", "Build UI", "Write tests"]),
            ("In Progress", ["WebSocket layer"]),
            ("Done", ["Project scaffold"]),
        ]
        with transaction.atomic():
            for list_index, (title, cards) in enumerate(defaults):
                list_obj = List.objects.create(board=board, title=title, position=list_index)
                for card_index, card_title in enumerate(cards):
                    Card.objects.create(list=list_obj, title=card_title, position=card_index)

        board.refresh_from_db()
        return Response(BoardSerializer(board).data)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        board = self.get_object()
        from .access import user_can_view_board
        if not user_can_view_board(request.user, board):
            raise PermissionDenied("You do not have access to this board's history.")
        activities = board.activities.select_related("user", "card").all()
        return Response(ActivityLogSerializer(activities, many=True).data)

    @action(detail=True, methods=["get"], url_path="chat")
    def chat_history(self, request, pk=None):
        board = self.get_object()
        from .access import user_can_view_board
        if not user_can_view_board(request.user, board):
            raise PermissionDenied("You cannot access this board's chat.")
        messages = board.chat_messages.select_related("user").all()[:100]
        payload = [{
            "id": msg.id,
            "username": msg.user.username,
            "avatar_emoji": getattr(getattr(msg.user, "profile", None), "avatar_emoji", "😀"),
            "text": msg.text,
            "created_at": msg.created_at.isoformat()
        } for msg in messages]

        return Response(payload)

    # ---- Board Member Management ----

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, pk=None):
        """List explicit board memberships."""
        board = self.get_object()
        from .access import user_can_view_board
        if not user_can_view_board(request.user, board):
            raise PermissionDenied("You cannot view this board.")
        memberships = board.memberships.select_related("user", "user__profile").all()
        return Response(BoardMembershipSerializer(memberships, many=True).data)

    @action(detail=True, methods=["post"], url_path="members/add")
    def add_member(self, request, pk=None):
        """Add a user to the board with a specific role."""
        board = self.get_object()
        if not user_can_manage_members(request.user, board):
            raise PermissionDenied("You cannot manage members on this board.")

        user_id = request.data.get("user_id")
        username = request.data.get("username")
        role = request.data.get("role", "viewer")

        if role not in ROLE_HIERARCHY:
            return Response({"detail": f"Invalid role: {role}"}, status=400)

        # Can't assign a role higher than your own
        actor_role = get_board_role(request.user, board)
        if ROLE_HIERARCHY.get(role, 99) < ROLE_HIERARCHY.get(actor_role, 99):
            raise PermissionDenied("You cannot assign a role higher than your own.")

        # Resolve user
        target_user = None
        if user_id:
            target_user = User.objects.filter(id=user_id).first()
        elif username:
            target_user = User.objects.filter(username=username).first()

        if not target_user:
            return Response({"detail": "User not found."}, status=404)

        # For team boards, verify the user is a team member
        if board.team_id:
            team_membership = get_membership(target_user, board.team)
            if not team_membership:
                return Response(
                    {"detail": "User must be a member of the team to be added to this board."},
                    status=400,
                )

        membership, created = BoardMembership.objects.get_or_create(
            board=board,
            user=target_user,
            defaults={"role": role},
        )
        if not created:
            return Response({"detail": "User is already a board member."}, status=400)

        ActivityLog.objects.create(
            board=board,
            user=request.user,
            action="member_added",
            detail=f"Added @{target_user.username} as {role} to the board",
        )

        return Response(BoardMembershipSerializer(membership).data, status=201)

    @action(detail=True, methods=["patch"], url_path=r"members/(?P<user_id>\d+)")
    def update_member(self, request, pk=None, user_id=None):
        """Update a board member's role."""
        board = self.get_object()
        if not user_can_manage_members(request.user, board):
            raise PermissionDenied("You cannot manage members on this board.")

        target_user_id = int(user_id)
        membership = BoardMembership.objects.filter(board=board, user_id=target_user_id).first()
        if not membership:
            return Response({"detail": "Board membership not found."}, status=404)

        new_role = request.data.get("role")
        if not new_role or new_role not in ROLE_HIERARCHY:
            return Response({"detail": f"Invalid role: {new_role}"}, status=400)

        # Can't modify someone with a higher or equal role (unless you're owner)
        actor_role = get_board_role(request.user, board)
        if actor_role != "owner":
            if ROLE_HIERARCHY.get(membership.role, 99) <= ROLE_HIERARCHY.get(actor_role, 99):
                raise PermissionDenied("You cannot modify this member's role.")
            if ROLE_HIERARCHY.get(new_role, 99) < ROLE_HIERARCHY.get(actor_role, 99):
                raise PermissionDenied("You cannot assign a role higher than your own.")

        # Can't change the owner's role
        if membership.role == "owner":
            raise PermissionDenied("Cannot change the board owner's role.")

        old_role = membership.role
        membership.role = new_role
        membership.save()

        ActivityLog.objects.create(
            board=board,
            user=request.user,
            action="member_updated",
            detail=f"Changed @{membership.user.username}'s role from {old_role} to {new_role}",
        )

        return Response(BoardMembershipSerializer(membership).data)

    @action(detail=True, methods=["delete"], url_path=r"members/(?P<user_id>\d+)/remove")
    def remove_member(self, request, pk=None, user_id=None):
        """Remove a user from the board."""
        board = self.get_object()
        if not user_can_manage_members(request.user, board):
            raise PermissionDenied("You cannot manage members on this board.")

        target_user_id = int(user_id)
        membership = BoardMembership.objects.filter(board=board, user_id=target_user_id).first()
        if not membership:
            return Response({"detail": "Board membership not found."}, status=404)

        # Can't remove the owner
        if membership.role == "owner":
            raise PermissionDenied("Cannot remove the board owner.")

        # Can't remove someone with a higher or equal role (unless you're owner)
        actor_role = get_board_role(request.user, board)
        if actor_role != "owner":
            if ROLE_HIERARCHY.get(membership.role, 99) <= ROLE_HIERARCHY.get(actor_role, 99):
                raise PermissionDenied("You cannot remove this member.")

        username = membership.user.username
        membership.delete()

        ActivityLog.objects.create(
            board=board,
            user=request.user,
            action="member_removed",
            detail=f"Removed @{username} from the board",
        )

        return Response(status=204)


class ListViewSet(viewsets.ModelViewSet):
    serializer_class = ListSerializer
    permission_classes = [IsAuthenticated, CanEditBoard]

    def get_queryset(self):
        return (
            List.objects.filter(board__in=boards_for_user(self.request.user))
            .select_related("board", "board__team")
            .prefetch_related("cards")
        )

    def perform_create(self, serializer):
        board = serializer.validated_data["board"]
        if not user_can_edit_board(self.request.user, board):
            raise PermissionDenied("Not allowed to add lists to this board.")
        position = board.lists.count()
        instance = serializer.save(position=position)
        ActivityLog.objects.create(
            board=board,
            user=self.request.user,
            action="created",
            detail=f"Created column '{instance.title}'",
        )
        broadcast_board_event(
            board.id,
            "list_created",
            ListSerializer(instance).data,
        )

    def perform_update(self, serializer):
        board = serializer.instance.board
        if not user_can_edit_board(self.request.user, board):
            raise PermissionDenied("Read-only access to this board.")
        old_title = serializer.instance.title
        instance = serializer.save()
        if old_title != instance.title:
            ActivityLog.objects.create(
                board=board,
                user=self.request.user,
                action="updated",
                detail=f"Renamed column from '{old_title}' to '{instance.title}'",
            )
        instance = (
            List.objects.filter(pk=instance.pk)
            .prefetch_related("cards")
            .get()
        )
        broadcast_board_event(
            instance.board_id,
            "list_updated",
            ListSerializer(instance).data,
        )

    def perform_destroy(self, instance):
        if not user_can_edit_board(self.request.user, instance.board):
            raise PermissionDenied("Read-only access to this board.")
        board_id = instance.board_id
        list_id = instance.id
        title = instance.title
        instance.delete()
        ActivityLog.objects.create(
            board_id=board_id,
            user=self.request.user,
            action="deleted",
            detail=f"Deleted column '{title}'",
        )
        broadcast_board_event(board_id, "list_deleted", {"id": list_id})


class CardViewSet(viewsets.ModelViewSet):
    serializer_class = CardSerializer
    permission_classes = [IsAuthenticated, CanEditBoard]

    def get_queryset(self):
        return Card.objects.filter(
            list__board__in=boards_for_user(self.request.user)
        ).select_related("list__board", "list__board__team")

    def perform_create(self, serializer):
        list_obj = serializer.validated_data["list"]
        if not user_can_edit_board(self.request.user, list_obj.board):
            raise PermissionDenied("Not allowed to add cards to this board.")
        position = list_obj.cards.count()
        instance = serializer.save(position=position)
        ActivityLog.objects.create(
            board=list_obj.board,
            card=instance,
            user=self.request.user,
            action="created",
            detail=f"Created card '{instance.title}' in column '{list_obj.title}'",
        )
        broadcast_board_event(
            list_obj.board_id,
            "card_created",
            CardSerializer(instance).data,
        )

    def perform_update(self, serializer):
        if not user_can_edit_board(self.request.user, serializer.instance.list.board):
            raise PermissionDenied("Read-only access to this board.")
        old_title = serializer.instance.title
        old_desc = serializer.instance.description
        old_priority = serializer.instance.priority
        old_points = serializer.instance.story_points
        instance = serializer.save()

        detail_messages = []
        if old_title != instance.title:
            detail_messages.append(f"Renamed card from '{old_title}' to '{instance.title}'")
        if old_desc != instance.description:
            detail_messages.append(f"Updated description of card '{instance.title}'")
        if old_priority != instance.priority:
            detail_messages.append(f"Changed priority of card '{instance.title}' to '{instance.priority}'")
        if old_points != instance.story_points:
            detail_messages.append(f"Changed story points of card '{instance.title}' to {instance.story_points}")

        if detail_messages:
            ActivityLog.objects.create(
                board=instance.list.board,
                card=instance,
                user=self.request.user,
                action="updated",
                detail="; ".join(detail_messages),
            )

        broadcast_board_event(
            instance.board_id,
            "card_updated",
            CardSerializer(instance).data,
        )

    def perform_destroy(self, instance):
        if not user_can_edit_board(self.request.user, instance.list.board):
            raise PermissionDenied("Read-only access to this board.")
        board_id = instance.board_id
        card_id = instance.id
        title = instance.title
        instance.delete()
        ActivityLog.objects.create(
            board_id=board_id,
            user=self.request.user,
            action="deleted",
            detail=f"Deleted card '{title}'",
        )
        broadcast_board_event(board_id, "card_deleted", {"id": card_id})

    @action(detail=True, methods=["patch"], url_path="move")
    def move(self, request, pk=None):
        card = self.get_object()
        if not user_can_edit_board(request.user, card.list.board):
            raise PermissionDenied("Read-only access to this board.")
        serializer = CardMoveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            old_list_title = card.list.title
            updated = move_card(
                card,
                serializer.validated_data["list_id"],
                serializer.validated_data["position"],
            )
            if old_list_title != updated.list.title:
                detail = f"Moved card '{updated.title}' from '{old_list_title}' to '{updated.list.title}'"
            else:
                detail = f"Reordered card '{updated.title}' in column '{updated.list.title}'"
            ActivityLog.objects.create(
                board=updated.list.board,
                card=updated,
                user=request.user,
                action="moved",
                detail=detail,
            )
        except (List.DoesNotExist, ValueError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if not user_can_edit_board(request.user, updated.list.board):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)

        data = CardSerializer(updated).data
        broadcast_board_event(updated.board_id, "card_moved", data)
        return Response(data)

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        card = self.get_object()
        from .access import user_can_view_board, user_can_edit_board
        if request.method == "GET":
            if not user_can_view_board(request.user, card.list.board):
                raise PermissionDenied("You cannot view this board.")
            comments = card.comments.select_related("user").all()
            return Response(CommentSerializer(comments, many=True).data)

        elif request.method == "POST":
            if not user_can_edit_board(request.user, card.list.board):
                raise PermissionDenied("You cannot comment on this board.")
            serializer = CommentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            comment = serializer.save(card=card, user=request.user)

            # Log activity
            ActivityLog.objects.create(
                board=card.list.board,
                card=card,
                user=request.user,
                action="commented",
                detail=f"Commented on card '{card.title}': \"{comment.text[:60]}{( '...' if len(comment.text) > 60 else '')}\""
            )

            # Broadcast websocket event
            broadcast_board_event(
                card.list.board_id,
                "comment_created",
                CommentSerializer(comment).data,
            )

            return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        card = self.get_object()
        from .access import user_can_view_board
        if not user_can_view_board(request.user, card.list.board):
            raise PermissionDenied("You cannot view this card's history.")
        activities = card.activities.select_related("user").all()
        return Response(ActivityLogSerializer(activities, many=True).data)
