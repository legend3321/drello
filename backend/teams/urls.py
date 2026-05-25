from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import InvitationAcceptView, InvitationDetailView, TeamViewSet

router = DefaultRouter()
router.register("teams", TeamViewSet, basename="team")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "invitations/<uuid:code>/",
        InvitationDetailView.as_view(),
        name="invitation-detail",
    ),
    path(
        "invitations/<uuid:code>/accept/",
        InvitationAcceptView.as_view(),
        name="invitation-accept",
    ),
]

