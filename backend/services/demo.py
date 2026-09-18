"""Private sample workspaces: opt-in, local only, and never shared credentials."""

import secrets
from datetime import timedelta

from sqlalchemy.orm import Session

from backend.db.models import Event, Note, Reminder, Task, User, utcnow
from backend.services.auth_service import get_password_hash


def create_demo_user(db: Session) -> User:
    now = utcnow()
    user = User(
        email=f"demo-{secrets.token_hex(12)}@example.invalid",
        username="Alex",
        avatar="1",
        timezone="UTC",
        is_demo=True,
        hashed_password=get_password_hash(secrets.token_urlsafe(48)),
    )
    db.add(user)
    db.flush()
    tasks = [
        ("Prepare the product launch brief", "high", now + timedelta(hours=4), "pending"),
        ("Review the new website concepts", "medium", now + timedelta(days=1), "pending"),
        ("Book a little time for deep work", "medium", now + timedelta(hours=2), "pending"),
        ("Send the weekly team update", "low", now + timedelta(days=2), "pending"),
        ("Organize project research", "low", now - timedelta(hours=2), "completed"),
    ]
    for title, priority, due_at, status in tasks:
        db.add(Task(user_id=user.id, title=title, priority=priority, due_at=due_at, status=status))
    db.add_all(
        [
            Note(
                user_id=user.id,
                title="A few ideas worth keeping",
                content="Keep the launch focused on one clear story.\n\nShow the everyday value, not just the features. Include a short customer walkthrough and leave time for questions.",
                summary="A focused launch story with a practical customer walkthrough.",
                action_items=["Draft the walkthrough outline", "Collect two customer examples"],
            ),
            Note(
                user_id=user.id,
                title="Weekly planning ritual",
                content="Start with the three things that matter most.\nBlock time for focused work, leave a little breathing room, and end the week with a quick review.",
                action_items=[],
            ),
            Event(
                user_id=user.id,
                title="Design catch-up",
                start_time=now + timedelta(hours=1),
                end_time=now + timedelta(hours=1, minutes=30),
                description="A quick check-in on the launch concepts.",
            ),
            Event(
                user_id=user.id,
                title="Deep work · launch brief",
                start_time=now + timedelta(hours=3),
                end_time=now + timedelta(hours=4),
                description="One clear goal. Notifications off.",
            ),
            Event(
                user_id=user.id,
                title="Weekly team planning",
                start_time=now + timedelta(days=1),
                end_time=now + timedelta(days=1, minutes=45),
                description="Priorities, progress, and a little space for new ideas.",
            ),
            Reminder(
                user_id=user.id,
                title="Share the launch brief with Maya",
                due_at=now + timedelta(hours=5),
                urgency="high",
                suggestion="Review the brief before sharing.",
            ),
        ]
    )
    db.commit()
    return user
