from django.contrib import admin

from .models import Team, TeamMembership, TeamRoleLevel


class TeamRoleLevelInline(admin.TabularInline):
    model = TeamRoleLevel
    extra = 0
    readonly_fields = ("group",)


class TeamMembershipInline(admin.TabularInline):
    model = TeamMembership
    extra = 0


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_by", "created_at")
    search_fields = ("name", "slug")
    inlines = [TeamRoleLevelInline, TeamMembershipInline]


@admin.register(TeamMembership)
class TeamMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "team", "role_level", "joined_at")
    list_filter = ("team", "role_level")
