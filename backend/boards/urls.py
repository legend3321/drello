from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BoardViewSet, CardViewSet, ListViewSet

router = DefaultRouter()
router.register("boards", BoardViewSet, basename="board")
router.register("lists", ListViewSet, basename="list")
router.register("cards", CardViewSet, basename="card")

urlpatterns = [
    path("", include(router.urls)),
]
