"""Explicit, aggregate-only BigQuery snapshots; never in an HTTP request path."""

import argparse
import json
import re
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.config.settings import Settings
from backend.db.database import Database
from backend.db.models import Event, Note, Reminder, Task, User


def collect_metrics(db: Session) -> dict:
    def count(model, *conditions):
        return db.scalar(
            select(func.count())
            .select_from(model)
            .join(User)
            .where(User.is_demo.is_(False), *conditions)
        )

    now = datetime.now(UTC)
    return {
        "snapshot_date": now.date().isoformat(),
        "recorded_at": now.isoformat(),
        "tasks": count(Task),
        "completed_tasks": count(Task, Task.status == "completed"),
        "notes": count(Note),
        "events": count(Event),
        "pending_reminders": count(Reminder, Reminder.status == "pending"),
    }


def write_snapshot(metrics: dict, settings: Settings, initialize: bool = False):
    # Only identifiers use interpolation. All values are typed parameters.
    if not re.fullmatch(r"[a-z][a-z0-9-]{4,61}[a-z0-9]", settings.google_cloud_project):
        raise ValueError("Set a valid GOOGLE_CLOUD_PROJECT before exporting")
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,1023}", settings.bigquery_dataset):
        raise ValueError("BIGQUERY_DATASET must be a valid dataset identifier")
    from google.cloud import bigquery

    client = bigquery.Client(
        project=settings.google_cloud_project, location=settings.bigquery_location
    )
    dataset_id = f"{settings.google_cloud_project}.{settings.bigquery_dataset}"
    table_id = f"{dataset_id}.workspace_daily_metrics"
    try:
        if initialize:
            dataset = bigquery.Dataset(dataset_id)
            dataset.location = settings.bigquery_location
            client.create_dataset(dataset, exists_ok=True)
            table = bigquery.Table(
                table_id,
                schema=[
                    bigquery.SchemaField("snapshot_date", "DATE", mode="REQUIRED"),
                    bigquery.SchemaField("recorded_at", "TIMESTAMP", mode="REQUIRED"),
                    *[
                        bigquery.SchemaField(name, "INTEGER", mode="REQUIRED")
                        for name in (
                            "tasks",
                            "completed_tasks",
                            "notes",
                            "events",
                            "pending_reminders",
                        )
                    ],
                ],
            )
            table.time_partitioning = bigquery.TimePartitioning(field="snapshot_date")
            table.require_partition_filter = True
            client.create_table(table, exists_ok=True)
        parameters = [
            bigquery.ScalarQueryParameter(
                name,
                "DATE"
                if name == "snapshot_date"
                else "TIMESTAMP"
                if name == "recorded_at"
                else "INT64",
                value,
            )
            for name, value in metrics.items()
        ]
        fields = list(metrics)
        source = ", ".join(f"@{name} AS {name}" for name in fields)
        updates = ", ".join(f"{name} = S.{name}" for name in fields if name != "snapshot_date")
        query = f"""
            MERGE `{table_id}` T USING (SELECT {source}) S
            ON T.snapshot_date = @snapshot_date
            WHEN MATCHED THEN UPDATE SET {updates}
            WHEN NOT MATCHED THEN INSERT ({", ".join(fields)})
                VALUES ({", ".join("S." + name for name in fields)})
        """
        job = client.query(
            query,
            job_config=bigquery.QueryJobConfig(
                query_parameters=parameters, maximum_bytes_billed=100_000_000
            ),
            timeout=20,
        )
        job.result(timeout=30)
    finally:
        client.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--write",
        action="store_true",
        help="Opt in to a billed BigQuery MERGE; otherwise print a local dry run",
    )
    parser.add_argument(
        "--initialize",
        action="store_true",
        help="Also create the analytics dataset/table; requires provisioning permissions",
    )
    args = parser.parse_args()
    if args.initialize and not args.write:
        parser.error("--initialize requires --write")
    settings = Settings()
    database = Database(settings)
    try:
        with database.sessions() as db:
            metrics = collect_metrics(db)
        if args.write:
            write_snapshot(metrics, settings, args.initialize)
        print(json.dumps({"written": args.write, "metrics": metrics}, indent=2))
    finally:
        database.engine.dispose()


if __name__ == "__main__":
    main()
