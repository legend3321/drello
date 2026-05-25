from django.contrib.auth import get_user_model
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from boards.models import Board
from boards.serializers import BoardListSerializer

from .models import Team, TeamMembership, TeamRoleLevel, TeamInvitation
from .permissions import IsTeamAdmin, IsTeamMember
from .serializers import (
    TeamAdminDashboardSerializer,
    TeamCreateSerializer,
    TeamDetailSerializer,
    TeamListSerializer,
    TeamMembershipSerializer,
    TeamMembershipWriteSerializer,
    TeamRoleLevelSerializer,
    TeamRoleLevelWriteSerializer,
)
from .services import (
    can_assign_role,
    can_manage_member,
    create_role_level,
    create_team_with_defaults,
    get_membership,
    is_team_admin,
    sync_membership_group,
)

User = get_user_model()


class TeamViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Team.objects.filter(memberships__user=self.request.user)
            .distinct()
        )

    def get_serializer_class(self):
        if self.action == "list":
            return TeamListSerializer
        if self.action == "create":
            return TeamCreateSerializer
        return TeamDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        team = create_team_with_defaults(
            name=serializer.validated_data["name"],
            creator=request.user,
            description=serializer.validated_data.get("description", ""),
        )
        team = self.get_queryset().get(pk=team.pk)
        return Response(
            TeamDetailSerializer(team, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def get_permissions(self):
        if self.action in ("retrieve", "list"):
            return [IsAuthenticated()]
        if self.action in ("update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsTeamAdmin()]
        if self.action in (
            "admin_dashboard",
            "members",
            "add_member",
            "update_member",
            "remove_member",
            "role_levels",
            "add_role_level",
            "update_role_level",
            "delete_role_level",
            "create_invitation",
        ):
            return [IsAuthenticated(), IsTeamMember()]
        return super().get_permissions()

    def check_object_permissions(self, request, obj):
        membership = get_membership(request.user, obj)
        if self.action in ("update", "partial_update", "destroy"):
            if not is_team_admin(membership):
                raise PermissionDenied("Team admin access required.")
        elif self.action not in ("list", "create") and membership is None:
            raise PermissionDenied("You are not a member of this team.")

    def perform_destroy(self, instance):
        membership = get_membership(self.request.user, instance)
        if membership.role_level.rank != 0:
            raise PermissionDenied("Only the team owner can delete the team.")
        instance.delete()

    @action(detail=True, methods=["get"], url_path="admin-dashboard")
    def admin_dashboard(self, request, pk=None):
        team = self.get_object()
        membership = get_membership(request.user, team)
        if not is_team_admin(membership):
            raise PermissionDenied("Team admin dashboard requires admin or owner role.")

        members = (
            TeamMembership.objects.filter(team=team)
            .select_related("user", "role_level")
            .order_by("role_level__rank", "user__username")
        )
        boards = Board.objects.filter(team=team).order_by("-updated_at")
        board_data = BoardListSerializer(boards, many=True).data

        payload = {
            "team": TeamDetailSerializer(team, context={"request": request}).data,
            "stats": {
                "member_count": members.count(),
                "board_count": boards.count(),
                "role_level_count": team.role_levels.count(),
            },
            "members": TeamMembershipSerializer(members, many=True).data,
            "boards": board_data,
            "permissions": {
                "can_manage_team": membership.role_level.can_manage_team,
                "can_manage_members": membership.role_level.can_manage_members,
                "can_manage_boards": membership.role_level.can_manage_boards,
                "can_edit_boards": membership.role_level.can_edit_boards,
                "is_owner": membership.role_level.rank == 0,
            },
        }
        return Response(payload)

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, pk=None):
        team = self.get_object()
        qs = TeamMembership.objects.filter(team=team).select_related("user", "role_level")
        return Response(TeamMembershipSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="members/add")
    def add_member(self, request, pk=None):
        team = self.get_object()
        actor = get_membership(request.user, team)
        if not actor or not actor.role_level.can_manage_members:
            raise PermissionDenied("Cannot manage members.")

        serializer = TeamMembershipWriteSerializer(
            data=request.data,
            context={"team": team, "actor_membership": actor},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        role_level = serializer.validated_data["role_level"]

        if TeamMembership.objects.filter(team=team, user=user).exists():
            raise ValidationError({"user_id": "User is already on this team."})

        membership = TeamMembership.objects.create(
            user=user,
            team=team,
            role_level=role_level,
        )
        sync_membership_group(membership)
        return Response(
            TeamMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["patch"], url_path=r"members/(?P<user_id>\d+)")
    def update_member(self, request, pk=None, user_id=None):
        team = self.get_object()
        actor = get_membership(request.user, team)
        target = get_object_or_404(TeamMembership, team=team, user_id=user_id)

        if not actor or not can_manage_member(actor, target):
            raise PermissionDenied("Cannot update this member.")

        role_level_id = request.data.get("role_level_id")
        if role_level_id is None:
            raise ValidationError({"role_level_id": "Required."})

        role_level = get_object_or_404(TeamRoleLevel, pk=role_level_id, team=team)
        if not can_manage_member(actor, target) or not can_assign_role(actor, role_level):
            raise PermissionDenied("Cannot assign this role to the member.")

        target.role_level = role_level
        target.save(update_fields=["role_level"])
        sync_membership_group(target)
        return Response(TeamMembershipSerializer(target).data)

    @action(detail=True, methods=["delete"], url_path=r"members/(?P<user_id>\d+)/remove")
    def remove_member(self, request, pk=None, user_id=None):
        team = self.get_object()
        actor = get_membership(request.user, team)
        target = get_object_or_404(TeamMembership, team=team, user_id=user_id)

        if not actor or not can_manage_member(actor, target):
            raise PermissionDenied("Cannot remove this member.")

        sync_membership_group(target)
        target.user.groups.remove(target.role_level.group)
        target.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="role-levels")
    def role_levels(self, request, pk=None):
        team = self.get_object()
        levels = team.role_levels.all()
        return Response(TeamRoleLevelSerializer(levels, many=True).data)

    @action(detail=True, methods=["post"], url_path="role-levels/add")
    def add_role_level(self, request, pk=None):
        team = self.get_object()
        membership = get_membership(request.user, team)
        if not membership or membership.role_level.rank != 0:
            raise PermissionDenied("Only the team owner can change hierarchy.")

        serializer = TeamRoleLevelWriteSerializer(
            data=request.data,
            context={"team": team},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        slug = data["name"].lower().replace(" ", "-")[:100]
        level = create_role_level(
            team,
            {
                "name": data["name"],
                "slug": slug,
                "rank": data["rank"],
                "can_manage_team": data.get("can_manage_team", False),
                "can_manage_members": data.get("can_manage_members", False),
                "can_manage_boards": data.get("can_manage_boards", False),
                "can_edit_boards": data.get("can_edit_boards", False),
            },
        )
        return Response(TeamRoleLevelSerializer(level).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"], url_path=r"role-levels/(?P<level_id>\d+)")
    def update_role_level(self, request, pk=None, level_id=None):
        team = self.get_object()
        membership = get_membership(request.user, team)
        if not membership or membership.role_level.rank != 0:
            raise PermissionDenied("Only the team owner can change hierarchy.")

        level = get_object_or_404(TeamRoleLevel, pk=level_id, team=team)
        serializer = TeamRoleLevelWriteSerializer(
            level,
            data=request.data,
            partial=True,
            context={"team": team},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(TeamRoleLevelSerializer(level).data)

    @action(detail=True, methods=["delete"], url_path=r"role-levels/(?P<level_id>\d+)/remove")
    def delete_role_level(self, request, pk=None, level_id=None):
        team = self.get_object()
        membership = get_membership(request.user, team)
        if not membership or membership.role_level.rank != 0:
            raise PermissionDenied("Only the team owner can change hierarchy.")

        level = get_object_or_404(TeamRoleLevel, pk=level_id, team=team)
        if level.memberships.exists():
            raise ValidationError({"detail": "Remove or reassign members before deleting this role."})
        if level.rank == 0:
            raise ValidationError({"detail": "Cannot delete the owner role level."})
        level.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="invitations")
    def create_invitation(self, request, pk=None):
        team = self.get_object()
        actor = get_membership(request.user, team)
        if not actor or not actor.role_level.can_manage_members:
            raise PermissionDenied("Cannot manage members.")

        role_level_id = request.data.get("role_level_id")
        if role_level_id is None:
            raise ValidationError({"role_level_id": "Required."})

        role_level = get_object_or_404(TeamRoleLevel, pk=role_level_id, team=team)
        if not can_assign_role(actor, role_level):
            raise PermissionDenied("Cannot assign this role level.")

        invitation = TeamInvitation.objects.create(
            team=team,
            role_level=role_level,
            created_by=request.user,
        )

        return Response({
            "code": str(invitation.code),
            "role_level_id": role_level.id,
            "role_level_name": role_level.name,
            "team_name": team.name,
        }, status=status.HTTP_201_CREATED)


from rest_framework.views import APIView
from rest_framework.permissions import AllowAny


class InvitationDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, code):
        invitation = get_object_or_404(TeamInvitation, code=code, is_active=True)
        return Response({
            "code": str(invitation.code),
            "team_id": invitation.team.id,
            "team_name": invitation.team.name,
            "role_level_id": invitation.role_level.id,
            "role_level_name": invitation.role_level.name,
            "created_by_username": invitation.created_by.username,
        })


class InvitationAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, code):
        invitation = get_object_or_404(TeamInvitation, code=code, is_active=True)
        team = invitation.team
        user = request.user

        if TeamMembership.objects.filter(team=team, user=user).exists():
            return Response(
                {"detail": "You are already a member of this team."},
                status=status.HTTP_400_BAD_REQUEST
            )

        membership = TeamMembership.objects.create(
            user=user,
            team=team,
            role_level=invitation.role_level,
        )
        sync_membership_group(membership)

        return Response({
            "detail": "Successfully joined the team.",
            "team_id": team.id,
        }, status=status.HTTP_200_OK)

