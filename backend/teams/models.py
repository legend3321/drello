import uuid
from django.conf import settings
from django.contrib.auth.models import Group
from django.db import models
from django.utils.text import slugify


class Team(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_teams",
        on_delete=models.PROTECT,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class TeamRoleLevel(models.Model):
    """Per-team hierarchy tier backed by a Django auth Group."""

    team = models.ForeignKey(Team, related_name="role_levels", on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)
    rank = models.PositiveIntegerField(
        help_text="Lower rank = higher authority (0 is top of hierarchy)."
    )
    group = models.OneToOneField(
        Group,
        related_name="team_role_level",
        on_delete=models.CASCADE,
    )
    can_manage_team = models.BooleanField(default=False)
    can_manage_members = models.BooleanField(default=False)
    can_manage_boards = models.BooleanField(default=False)
    can_edit_boards = models.BooleanField(default=False)

    class Meta:
        ordering = ["rank", "id"]
        unique_together = [
            ("team", "slug"),
            ("team", "rank"),
            ("team", "name"),
        ]

    def __str__(self):
        return f"{self.team.name} — {self.name}"


class TeamMembership(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="team_memberships",
        on_delete=models.CASCADE,
    )
    team = models.ForeignKey(Team, related_name="memberships", on_delete=models.CASCADE)
    role_level = models.ForeignKey(
        TeamRoleLevel,
        related_name="memberships",
        on_delete=models.PROTECT,
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("user", "team")]
        ordering = ["role_level__rank", "user__username"]

    def __str__(self):
        return f"{self.user} @ {self.team} ({self.role_level.name})"


class TeamInvitation(models.Model):
    team = models.ForeignKey(Team, related_name="invitations", on_delete=models.CASCADE)
    role_level = models.ForeignKey(
        TeamRoleLevel,
        related_name="invitations",
        on_delete=models.CASCADE,
    )
    code = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_invitations",
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Invite to {self.team.name} as {self.role_level.name} (Code: {self.code})"

