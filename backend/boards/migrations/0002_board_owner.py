from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def assign_existing_boards(apps, schema_editor):
    Board = apps.get_model("boards", "Board")
    User = apps.get_model("auth", "User")
    user = User.objects.order_by("id").first()
    if user is None:
        user = User.objects.create_user(
            username="demo",
            email="demo@example.com",
            password="demo12345",
        )
    Board.objects.filter(owner__isnull=True).update(owner=user)


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("boards", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="board",
            name="owner",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="boards",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(assign_existing_boards, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="board",
            name="owner",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="boards",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
