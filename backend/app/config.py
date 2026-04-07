from __future__ import annotations

import os
from dataclasses import dataclass


def _parse_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_int(value: str | None, default: int) -> int:
    if value is None:
        return default

    try:
        return int(value)
    except ValueError:
        return default


def _parse_csv(value: str | None, default: list[str]) -> list[str]:
    if value is None:
        return default

    items = [item.strip() for item in value.split(",")]
    return [item for item in items if item]


def _required(name: str) -> str:
    value = os.getenv(name)
    if value and value.strip():
        return value.strip()

    raise RuntimeError(f"Environment variable {name} is required")


@dataclass(frozen=True)
class Settings:
    app_host: str
    app_port: int
    cors_origins: list[str]
    ydb_endpoint: str
    ydb_database: str
    ydb_auto_create_schema: bool
    ydb_driver_timeout_seconds: int
    ydb_table_prefix: str
    firebase_project_id: str
    firebase_service_account_json: str | None
    firebase_service_account_file: str | None


def load_settings() -> Settings:
    return Settings(
        app_host=os.getenv("APP_HOST", "0.0.0.0"),
        app_port=_parse_int(os.getenv("APP_PORT"), 8080),
        cors_origins=_parse_csv(
            os.getenv("APP_CORS_ORIGINS"),
            ["http://localhost:5173", "http://127.0.0.1:5173"],
        ),
        ydb_endpoint=_required("YDB_ENDPOINT"),
        ydb_database=_required("YDB_DATABASE"),
        ydb_auto_create_schema=_parse_bool(os.getenv("YDB_AUTO_CREATE_SCHEMA"), True),
        ydb_driver_timeout_seconds=_parse_int(os.getenv("YDB_DRIVER_TIMEOUT_SECONDS"), 10),
        ydb_table_prefix=os.getenv("YDB_TABLE_PREFIX", "specto").strip() or "specto",
        firebase_project_id=_required("FIREBASE_PROJECT_ID"),
        firebase_service_account_json=os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"),
        firebase_service_account_file=os.getenv("FIREBASE_SERVICE_ACCOUNT_FILE"),
    )
