"""Domain logic for card/list ordering."""
from django.db import transaction

from .models import Card, List


@transaction.atomic
def move_card(card: Card, target_list_id: int, position: int) -> Card:
    target_list = List.objects.select_related("board").get(pk=target_list_id)
    source_list = card.list

    if source_list.board_id != target_list.board_id:
        raise ValueError("Cannot move card across boards")

    card.list = target_list
    card.position = position
    card.save(update_fields=["list", "position", "updated_at"])

    _reindex_list(source_list)
    if source_list.pk != target_list.pk:
        _reindex_list(target_list)

    card.refresh_from_db()
    return card


def _reindex_list(list_obj: List) -> None:
    cards = list(list_obj.cards.order_by("position", "id"))
    for index, item in enumerate(cards):
        if item.position != index:
            item.position = index
            item.save(update_fields=["position"])
