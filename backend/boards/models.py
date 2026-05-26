from django.conf import settings
from django.db import models


class Board(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="boards",
        on_delete=models.CASCADE,
    )
    team = models.ForeignKey(
        "teams.Team",
        related_name="boards",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title


class List(models.Model):
    board = models.ForeignKey(Board, related_name="lists", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return f"{self.board.title} — {self.title}"


def default_json_list():
    return []


class Card(models.Model):
    list = models.ForeignKey(List, related_name="cards", on_delete=models.CASCADE)
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, default="")
    position = models.PositiveIntegerField(default=0)
    priority = models.CharField(max_length=20, default="medium")  # highest, medium, low
    story_points = models.PositiveIntegerField(default=0, null=True, blank=True)
    labels = models.JSONField(default=default_json_list, blank=True)  # e.g., [{"text": "inception", "color": "#10b981"}]
    checklist = models.JSONField(default=default_json_list, blank=True)  # e.g., [{"id": "1", "text": "Task", "done": false}]
    attachments = models.JSONField(default=default_json_list, blank=True)  # e.g., [{"id": "1", "name": "Preview.png", "url": "/..."}]
    assigned_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="assigned_cards",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return self.title

    @property
    def board_id(self):
        return self.list.board_id

    @property
    def board(self):
        return self.list.board


class Comment(models.Model):
    card = models.ForeignKey(Card, related_name="comments", on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="comments",
        on_delete=models.CASCADE,
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment by {self.user.username} on card {self.card.title}"


class ActivityLog(models.Model):
    board = models.ForeignKey(Board, related_name="activities", on_delete=models.CASCADE)
    card = models.ForeignKey(
        Card,
        related_name="activities",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="activities",
        on_delete=models.CASCADE,
    )
    action = models.CharField(max_length=50)  # e.g., 'created', 'updated', 'moved', 'deleted', 'commented'
    detail = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} {self.action} on {self.board.title}"


from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=ActivityLog)
def broadcast_activity_log(sender, instance, created, **kwargs):
    if created:
        from .broadcast import broadcast_board_event
        from .serializers import ActivityLogSerializer
        broadcast_board_event(
            instance.board_id,
            "activity_created",
            ActivityLogSerializer(instance).data,
        )


class BoardChatMessage(models.Model):
    board = models.ForeignKey(Board, related_name="chat_messages", on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="board_chat_messages",
        on_delete=models.CASCADE,
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Chat message by {self.user.username} on board {self.board.title}"

