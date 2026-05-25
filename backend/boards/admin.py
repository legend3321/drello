from django.contrib import admin

from .models import Board, Card, List


@admin.register(Board)
class BoardAdmin(admin.ModelAdmin):
    list_display = ("title", "created_at", "updated_at")


@admin.register(List)
class ListAdmin(admin.ModelAdmin):
    list_display = ("title", "board", "position")


@admin.register(Card)
class CardAdmin(admin.ModelAdmin):
    list_display = ("title", "list", "position", "updated_at")
