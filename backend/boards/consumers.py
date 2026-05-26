import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .access import user_can_view_board
from .broadcast import board_group_name
from .models import Board


board_presences = {}


class BoardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.board_id = int(self.scope["url_route"]["kwargs"]["board_id"])
        has_access = await self.user_can_access_board(user, self.board_id)
        if not has_access:
            await self.close(code=4003)
            return

        self.group_name = board_group_name(self.board_id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        self.username = user.username
        if self.board_id not in board_presences:
            board_presences[self.board_id] = {}

        presences = board_presences[self.board_id]
        presences[self.username] = presences.get(self.username, 0) + 1

        # Send immediate presence list to this client
        await self.send(
            text_data=json.dumps(
                {
                    "type": "presence_updated",
                    "payload": {"online_users": list(presences.keys())},
                }
            )
        )

        # Broadcast update to group
        await self.broadcast_presence_update()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        if hasattr(self, "username") and hasattr(self, "board_id"):
            presences = board_presences.get(self.board_id, {})
            if self.username in presences:
                presences[self.username] -= 1
                if presences[self.username] <= 0:
                    del presences[self.username]
            if not presences and self.board_id in board_presences:
                del board_presences[self.board_id]

            await self.broadcast_presence_update()

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get("type")
        if msg_type == "chat_message":
            text = data.get("text", "").strip()
            if not text:
                return

            msg = await self.create_chat_message(self.scope["user"], self.board_id, text)

            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "board.event",
                    "event": "chat_message_created",
                    "payload": {
                        "id": msg.id,
                        "username": msg.user.username,
                        "avatar_emoji": getattr(getattr(msg.user, "profile", None), "avatar_emoji", "😀"),
                        "text": msg.text,
                        "created_at": msg.created_at.isoformat(),
                    },
                },
            )


    async def board_event(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": event["event"],
                    "payload": event["payload"],
                }
            )
        )

    async def broadcast_presence_update(self):
        presences = board_presences.get(self.board_id, {})
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "board.event",
                "event": "presence_updated",
                "payload": {"online_users": list(presences.keys())},
            },
        )

    @database_sync_to_async
    def user_can_access_board(self, user, board_id):
        try:
            board = Board.objects.select_related("team").get(pk=board_id)
        except Board.DoesNotExist:
            return False
        return user_can_view_board(user, board)

    @database_sync_to_async
    def create_chat_message(self, user, board_id, text):
        from .models import BoardChatMessage
        return BoardChatMessage.objects.create(board_id=board_id, user=user, text=text)

