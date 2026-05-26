from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    avatar_emoji = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "avatar_emoji"]
        read_only_fields = ["id", "username"]

    def get_avatar_emoji(self, obj):
        try:
            return obj.profile.avatar_emoji
        except Exception:
            return "😀"


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    avatar_emoji = serializers.CharField(required=False, default="😀", write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "password_confirm", "avatar_emoji"]

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        avatar_emoji = validated_data.pop("avatar_emoji", "😀")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )
        # Update the profile (created by signal) with the chosen emoji
        from .models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.avatar_emoji = avatar_emoji
        profile.save()
        return user

