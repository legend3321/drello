from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from boards.models import Board, Card, List
from teams.services import create_team_with_defaults

User = get_user_model()


class Command(BaseCommand):
    help = "Create a demo board with lists and cards for a user"

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            default="demo",
            help="Username that will own the demo board (created if missing)",
        )

    def handle(self, *args, **options):
        username = options["username"]
        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": f"{username}@example.com"},
        )
        if created:
            user.set_password("demo12345")
            user.save()
            self.stdout.write(
                self.style.WARNING(f"Created user '{username}' with password 'demo12345'")
            )

        team, team_created = _get_or_create_demo_team(user)
        if team_created:
            self.stdout.write(self.style.SUCCESS(f"Created demo team '{team.name}' (id={team.id})"))

        board, board_created = Board.objects.get_or_create(
            owner=user,
            team=team,
            title="Product Roadmap",
        )
        if not board_created and board.lists.exists():
            self.stdout.write(self.style.WARNING(f"Board {board.id} already seeded"))
            return

        board.lists.all().delete()
        columns = [
            ("Backlog", [
                ("Research competitors", "Analyze leading task management tools to identify gaps in user experience, collaborative features, and workflow customization options for modern teams."),
                ("Draft PRD", "Document key technical architecture, MVP scope, WebSocket synchronization protocol, and access control models for the product milestone release.")
            ]),
            ("In Progress", [
                ("Kanban UI", "Create responsive drag-and-drop board interface with smooth animations, column state management, and detailed card inspect panel."),
                ("Django API", "Implement RESTful endpoints and serializers with authentication, permissions checks, and relational models supporting real-time team collaboration.")
            ]),
            ("Review", [
                ("Code review", "Audit code quality, accessibility labels, query performance, and security rules across all backend views and frontend components.")
            ]),
            ("Done", [
                ("Repo scaffold", "Set up the monorepo configuration with Docker containers, CI pipelines, linting workflows, and local developer environment setup scripts.")
            ]),
        ]
        for list_index, (title, cards) in enumerate(columns):
            list_obj = List.objects.create(board=board, title=title, position=list_index)
            for card_index, (card_title, card_desc) in enumerate(cards):
                Card.objects.create(list=list_obj, title=card_title, description=card_desc, position=card_index)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded board id={board.id} on team '{team.name}' for user '{username}' "
                f"(password: demo12345 if new)"
            )
        )


def _get_or_create_demo_team(user):
    from teams.models import Team

    existing = Team.objects.filter(slug="demo-team", memberships__user=user).first()
    if existing:
        return existing, False
    team = create_team_with_defaults("Demo Team", user, description="Sample team with default hierarchy")
    team.slug = "demo-team"
    team.save(update_fields=["slug"])
    return team, True
