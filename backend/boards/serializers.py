from rest_framework import serializers
from teams.models import Team

from .models import Board, Card, List, Comment, ActivityLog


class CardSerializer(serializers.ModelSerializer):
    list_id = serializers.PrimaryKeyRelatedField(
        source="list", queryset=List.objects.all(), write_only=True
    )
    board_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Card
        fields = [
            "id",
            "list_id",
            "board_id",
            "title",
            "description",
            "position",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["position", "created_at", "updated_at", "board_id"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["list_id"] = instance.list_id
        return data


class ListSerializer(serializers.ModelSerializer):
    cards = CardSerializer(many=True, read_only=True)
    board_id = serializers.PrimaryKeyRelatedField(
        source="board", queryset=Board.objects.all(), write_only=True
    )

    class Meta:
        model = List
        fields = ["id", "board_id", "title", "position", "cards"]
        read_only_fields = ["position"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["board_id"] = instance.board_id
        return data


class BoardSerializer(serializers.ModelSerializer):
    lists = ListSerializer(many=True, read_only=True)
    team_id = serializers.PrimaryKeyRelatedField(
        source="team",
        queryset=Team.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = Board
        fields = ["id", "title", "team_id", "lists", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["team_id"] = instance.team_id
        data["team_name"] = instance.team.name if instance.team_id else None
        data["owner_username"] = instance.owner.username
        data["owner_email"] = instance.owner.email
        
        request = self.context.get("request")
        user = request.user if request else None
        if user and user.is_authenticated:
            from .access import user_can_edit_board, user_can_manage_board_meta
            data["permissions"] = {
                "can_edit": user_can_edit_board(user, instance),
                "can_delete": user_can_manage_board_meta(user, instance),
            }
        else:
            data["permissions"] = {
                "can_edit": False,
                "can_delete": False,
            }
        return data


class BoardListSerializer(serializers.ModelSerializer):
    team_id = serializers.IntegerField(read_only=True, allow_null=True)
    team_name = serializers.SerializerMethodField()

    class Meta:
        model = Board
        fields = ["id", "title", "team_id", "team_name", "created_at", "updated_at"]

    def get_team_name(self, obj):
        return obj.team.name if obj.team_id else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = request.user if request else None
        if user and user.is_authenticated:
            from .access import user_can_edit_board, user_can_manage_board_meta
            data["permissions"] = {
                "can_edit": user_can_edit_board(user, instance),
                "can_delete": user_can_manage_board_meta(user, instance),
            }
        else:
            data["permissions"] = {
                "can_edit": False,
                "can_delete": False,
            }
        return data


class CardMoveSerializer(serializers.Serializer):
    list_id = serializers.IntegerField()
    position = serializers.IntegerField(min_value=0)


class CommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "card", "username", "text", "created_at", "updated_at"]
        read_only_fields = ["id", "card", "created_at", "updated_at"]


class ActivityLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    card_title = serializers.CharField(source="card.title", read_only=True, allow_null=True)

    class Meta:
        model = ActivityLog
        fields = ["id", "username", "action", "detail", "card_title", "created_at"]
        read_only_fields = fields
