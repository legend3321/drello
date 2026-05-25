from typing import Optional

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import transaction
from django.utils.text import slugify

from .models import Team, TeamMembership, TeamRoleLevel

User = get_user_model()

DEFAULT_HIERARCHY = [
    {
        "name": "Owner",
        "slug": "owner",
        "rank": 0,
        "can_manage_team": True,
        "can_manage_members": True,
        "can_manage_boards": True,
        "can_edit_boards": True,
    },
    {
        "name": "Admin",
        "slug": "admin",
        "rank": 1,
        "can_manage_team": True,
        "can_manage_members": True,
        "can_manage_boards": True,
        "can_edit_boards": True,
    },
    {
        "name": "Member",
        "slug": "member",
        "rank": 2,
        "can_manage_team": False,
        "can_manage_members": False,
        "can_manage_boards": False,
        "can_edit_boards": True,
    },
    {
        "name": "Viewer",
        "slug": "viewer",
        "rank": 3,
        "can_manage_team": False,
        "can_manage_members": False,
        "can_manage_boards": False,
        "can_edit_boards": False,
    },
]


def unique_team_slug(name: str) -> str:
    base = slugify(name) or "team"
    slug = base
    counter = 1
    while Team.objects.filter(slug=slug).exists():
        slug = f"{base}-{counter}"
        counter += 1
    return slug


def group_name_for_role(team_id: int, role_slug: str) -> str:
    return f"drello_team_{team_id}_{role_slug}"


def create_role_level(team: Team, spec: dict) -> TeamRoleLevel:
    group, _ = Group.objects.get_or_create(name=group_name_for_role(team.id, spec["slug"]))
    return TeamRoleLevel.objects.create(
        team=team,
        name=spec["name"],
        slug=spec["slug"],
        rank=spec["rank"],
        group=group,
        can_manage_team=spec.get("can_manage_team", False),
        can_manage_members=spec.get("can_manage_members", False),
        can_manage_boards=spec.get("can_manage_boards", False),
        can_edit_boards=spec.get("can_edit_boards", False),
    )


@transaction.atomic
def create_team_with_defaults(name: str, creator: User, description: str = "") -> Team:
    team = Team.objects.create(
        name=name,
        slug=unique_team_slug(name),
        description=description,
        created_by=creator,
    )
    levels = []
    for spec in DEFAULT_HIERARCHY:
        levels.append(create_role_level(team, spec))
    owner_level = levels[0]
    membership = TeamMembership.objects.create(
        user=creator,
        team=team,
        role_level=owner_level,
    )
    sync_membership_group(membership)
    return team


def sync_membership_group(membership: TeamMembership) -> None:
    team_groups = Group.objects.filter(team_role_level__team=membership.team)
    membership.user.groups.remove(*team_groups)
    membership.user.groups.add(membership.role_level.group)


def get_membership(user: User, team: Team) -> Optional[TeamMembership]:
    if not user or not user.is_authenticated:
        return None
    return (
        TeamMembership.objects.filter(user=user, team=team)
        .select_related("role_level")
        .first()
    )


def user_team_ids(user: User) -> list[int]:
    return list(
        TeamMembership.objects.filter(user=user).values_list("team_id", flat=True)
    )


def can_assign_role(actor: TeamMembership, target_level: TeamRoleLevel) -> bool:
    if not actor.role_level.can_manage_members:
        return False
    return target_level.rank > actor.role_level.rank


def can_manage_member(actor: TeamMembership, target: TeamMembership) -> bool:
    if actor.user_id == target.user_id:
        return False
    if not actor.role_level.can_manage_members:
        return False
    return target.role_level.rank > actor.role_level.rank


def is_team_admin(membership: Optional[TeamMembership]) -> bool:
    if membership is None:
        return False
    return membership.role_level.can_manage_team
