from rest_framework.permissions import BasePermission

from .services import get_membership, is_team_admin


class IsTeamMember(BasePermission):
    def has_object_permission(self, request, view, obj):
        membership = get_membership(request.user, obj)
        return membership is not None


class IsTeamAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        membership = get_membership(request.user, obj)
        return is_team_admin(membership)
