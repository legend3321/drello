from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response([])

        from django.contrib.auth import get_user_model
        User = get_user_model()
        users = User.objects.filter(username__icontains=query)

        exclude_team_id = request.query_params.get("exclude_team_id")
        if exclude_team_id:
            from teams.models import TeamMembership
            member_user_ids = TeamMembership.objects.filter(team_id=exclude_team_id).values_list("user_id", flat=True)
            users = users.exclude(id__in=member_user_ids)

        users = users[:20]
        return Response(UserSerializer(users, many=True).data)

