"""Push real-time events to board rooms via Channels."""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def board_group_name(board_id: int) -> str:
    return f"board_{board_id}"


def broadcast_board_event(board_id: int, event_type: str, payload: dict) -> None:
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        board_group_name(board_id),
        {
            "type": "board.event",
            "event": event_type,
            "payload": payload,
        },
    )
