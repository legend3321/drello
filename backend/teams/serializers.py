from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Team, TeamMembership, TeamRoleLevel
from .services import (
    can_assign_role,
    can_manage_member,
    create_role_level,
    get_membership,
    sync_membership_group,
    unique_team_slug,
)

User = get_user_model()


class TeamRoleLevelSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = TeamRoleLevel
        fields = [
            "id",
            "name",
            "slug",
            "rank",
            "can_manage_team",
            "can_manage_members",
            "can_manage_boards",
            "can_edit_boards",
            "member_count",
        ]
        read_only_fields = ["slug"]

    def get_member_count(self, obj):
        return obj.memberships.count()


class TeamMemberUserSerializer(serializers.ModelSerializer):
    avatar_emoji = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "avatar_emoji"]
        read_only_fields = fields

    def get_avatar_emoji(self, obj):
        try:
            return obj.profile.avatar_emoji
        except Exception:
            return "😀"



class TeamMembershipSerializer(serializers.ModelSerializer):
    user = TeamMemberUserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="user", write_only=True
    )
    role_level_id = serializers.PrimaryKeyRelatedField(
        queryset=TeamRoleLevel.objects.all(), source="role_level", write_only=True
    )
    role_level = TeamRoleLevelSerializer(read_only=True)

    class Meta:
        model = TeamMembership
        fields = [
            "id",
            "user",
            "user_id",
            "role_level",
            "role_level_id",
            "joined_at",
        ]
        read_only_fields = ["joined_at"]


class TeamListSerializer(serializers.ModelSerializer):
    my_role = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "member_count",
            "my_role",
            "created_at",
            "updated_at",
        ]

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_my_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        membership = get_membership(request.user, obj)
        if not membership:
            return None
        return TeamRoleLevelSerializer(membership.role_level).data


class TeamDetailSerializer(TeamListSerializer):
    role_levels = TeamRoleLevelSerializer(many=True, read_only=True)

    class Meta(TeamListSerializer.Meta):
        fields = TeamListSerializer.Meta.fields + ["role_levels"]


class TeamCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ["name", "description"]


class TeamRoleLevelWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeamRoleLevel
        fields = [
            "name",
            "rank",
            "can_manage_team",
            "can_manage_members",
            "can_manage_boards",
            "can_edit_boards",
        ]

    def validate_rank(self, value):
        team = self.context["team"]
        qs = TeamRoleLevel.objects.filter(team=team, rank=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This rank is already used in the team hierarchy.")
        return value


class TeamMembershipWriteSerializer(serializers.Serializer):
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="user", required=False
    )
    username = serializers.CharField(required=False, allow_blank=True)
    role_level_id = serializers.PrimaryKeyRelatedField(
        queryset=TeamRoleLevel.objects.none(), source="role_level"
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        team = self.context.get("team")
        if team is not None:
            self.fields["role_level_id"].queryset = TeamRoleLevel.objects.filter(team=team)

    def validate(self, attrs):
        team = self.context["team"]
        actor = self.context.get("actor_membership")
        role_level = attrs["role_level"]

        user = attrs.get("user")
        username = (self.initial_data.get("username") or "").strip()
        if user is None and username:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist as exc:
                raise serializers.ValidationError(
                    {"username": f"No user with username '{username}'."}
                ) from exc
            attrs["user"] = user
        elif user is None:
            raise serializers.ValidationError(
                {"username": "Provide username or user_id."}
            )

        if role_level.team_id != team.id:
            raise serializers.ValidationError({"role_level_id": "Role does not belong to this team."})
        if actor and not can_assign_role(actor, role_level):
            raise serializers.ValidationError(
                {"role_level_id": "You cannot assign a role at or above your level."}
            )
        return attrs


class TeamAdminDashboardSerializer(serializers.Serializer):
    team = TeamDetailSerializer()
    stats = serializers.DictField()
    members = TeamMembershipSerializer(many=True)
    boards = serializers.ListField()
    permissions = serializers.DictField()
