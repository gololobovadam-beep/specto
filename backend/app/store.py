from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import ydb

from .config import Settings
from .models import (
    AppSession,
    CategoryEntity,
    PageEntity,
    TopicEntity,
    UserSettings,
    WorkspaceSnapshot,
)


def _row_value(row, column_name: str):
    if hasattr(row, column_name):
        return getattr(row, column_name)

    try:
        return row[column_name]
    except Exception:
        return row.get(column_name)


def _now_revision() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


@dataclass(frozen=True)
class TableNames:
    pages: str
    topics: str
    categories: str
    documents: str
    revisions: str


class YdbWorkspaceStore:
    def __init__(self, settings: Settings):
        self._tables = self._build_table_names(settings.ydb_table_prefix)
        self._driver = ydb.Driver(
            endpoint=settings.ydb_endpoint,
            database=settings.ydb_database,
            credentials=ydb.credentials_from_env_variables(),
        )
        self._driver.wait(timeout=settings.ydb_driver_timeout_seconds, fail_fast=True)
        self._pool = ydb.QuerySessionPool(self._driver)

        if settings.ydb_auto_create_schema:
            self.ensure_schema()

    def close(self):
        self._pool.stop()
        self._driver.stop()

    def ensure_schema(self):
        statements = [
            f"""
            CREATE TABLE IF NOT EXISTS `{self._tables.pages}` (
              user_id Utf8,
              page_id Utf8,
              payload_json Utf8,
              PRIMARY KEY (user_id, page_id)
            );
            """,
            f"""
            CREATE TABLE IF NOT EXISTS `{self._tables.topics}` (
              user_id Utf8,
              topic_id Utf8,
              payload_json Utf8,
              PRIMARY KEY (user_id, topic_id)
            );
            """,
            f"""
            CREATE TABLE IF NOT EXISTS `{self._tables.categories}` (
              user_id Utf8,
              category_id Utf8,
              payload_json Utf8,
              PRIMARY KEY (user_id, category_id)
            );
            """,
            f"""
            CREATE TABLE IF NOT EXISTS `{self._tables.documents}` (
              user_id Utf8,
              document_id Utf8,
              payload_json Utf8,
              PRIMARY KEY (user_id, document_id)
            );
            """,
            f"""
            CREATE TABLE IF NOT EXISTS `{self._tables.revisions}` (
              user_id Utf8,
              revision Utf8,
              PRIMARY KEY (user_id)
            );
            """,
        ]

        for statement in statements:
            self._execute(statement)

    def load_workspace(self, user_id: str) -> tuple[WorkspaceSnapshot, str | None]:
        pages = [
            PageEntity.model_validate_json(payload_json)
            for payload_json in self._select_payloads(self._tables.pages, "page_id", user_id)
        ]
        topics = [
            TopicEntity.model_validate_json(payload_json)
            for payload_json in self._select_payloads(self._tables.topics, "topic_id", user_id)
        ]
        categories = [
            CategoryEntity.model_validate_json(payload_json)
            for payload_json in self._select_payloads(self._tables.categories, "category_id", user_id)
        ]

        documents = self._select_documents(user_id)
        revision = self.get_revision(user_id)

        return (
            WorkspaceSnapshot(
                pages=pages,
                topics=topics,
                categories=categories,
                session=(
                    AppSession.model_validate_json(documents["session"])
                    if "session" in documents
                    else AppSession()
                ),
                settings=(
                    UserSettings.model_validate_json(documents["settings"])
                    if "settings" in documents
                    else UserSettings()
                ),
            ),
            revision,
        )

    def get_revision(self, user_id: str) -> str | None:
        result_sets = self._execute(
            f"""
            DECLARE $user_id AS Utf8;
            SELECT revision FROM `{self._tables.revisions}` WHERE user_id = $user_id;
            """,
            {"$user_id": user_id},
        )
        rows = result_sets[0].rows
        return str(_row_value(rows[0], "revision")) if rows else None

    def save_page(self, user_id: str, page: PageEntity) -> str:
        return self._save_entity(self._tables.pages, "page_id", user_id, page.id, page.model_dump_json())

    def save_pages(self, user_id: str, pages: list[PageEntity]) -> str:
        return self._save_entities(
            self._tables.pages,
            "page_id",
            user_id,
            [(page.id, page.model_dump_json()) for page in pages],
        )

    def save_topic(self, user_id: str, topic: TopicEntity) -> str:
        return self._save_entity(
            self._tables.topics, "topic_id", user_id, topic.id, topic.model_dump_json()
        )

    def save_topics(self, user_id: str, topics: list[TopicEntity]) -> str:
        return self._save_entities(
            self._tables.topics,
            "topic_id",
            user_id,
            [(topic.id, topic.model_dump_json()) for topic in topics],
        )

    def save_category(self, user_id: str, category: CategoryEntity) -> str:
        return self._save_entity(
            self._tables.categories,
            "category_id",
            user_id,
            category.id,
            category.model_dump_json(),
        )

    def save_categories(self, user_id: str, categories: list[CategoryEntity]) -> str:
        return self._save_entities(
            self._tables.categories,
            "category_id",
            user_id,
            [(category.id, category.model_dump_json()) for category in categories],
        )

    def delete_category(self, user_id: str, category_id: str) -> str:
        revision = _now_revision()
        self._execute(
            f"""
            DECLARE $user_id AS Utf8;
            DECLARE $category_id AS Utf8;
            DECLARE $revision AS Utf8;

            DELETE FROM `{self._tables.categories}` WHERE user_id = $user_id AND category_id = $category_id;
            UPSERT INTO `{self._tables.revisions}` (user_id, revision) VALUES ($user_id, $revision);
            """,
            {
                "$user_id": user_id,
                "$category_id": category_id,
                "$revision": revision,
            },
        )
        return revision

    def save_session(self, user_id: str, session: AppSession) -> str:
        return self._save_document(user_id, "session", session.model_dump_json())

    def save_settings(self, user_id: str, settings: UserSettings) -> str:
        return self._save_document(user_id, "settings", settings.model_dump_json())

    def _save_entity(
        self,
        table_name: str,
        id_column: str,
        user_id: str,
        entity_id: str,
        payload_json: str,
    ) -> str:
        revision = _now_revision()
        self._execute(
            f"""
            DECLARE $user_id AS Utf8;
            DECLARE $entity_id AS Utf8;
            DECLARE $payload_json AS Utf8;
            DECLARE $revision AS Utf8;

            UPSERT INTO `{table_name}` (user_id, {id_column}, payload_json)
            VALUES ($user_id, $entity_id, $payload_json);

            UPSERT INTO `{self._tables.revisions}` (user_id, revision)
            VALUES ($user_id, $revision);
            """,
            {
                "$user_id": user_id,
                "$entity_id": entity_id,
                "$payload_json": payload_json,
                "$revision": revision,
            },
        )
        return revision

    def _save_entities(
        self,
        table_name: str,
        id_column: str,
        user_id: str,
        items: list[tuple[str, str]],
    ) -> str:
        revision = _now_revision()

        if not items:
            self._touch_revision(user_id, revision)
            return revision

        declarations = [
            "DECLARE $user_id AS Utf8;",
            "DECLARE $revision AS Utf8;",
        ]
        statements: list[str] = []
        parameters: dict[str, str] = {
            "$user_id": user_id,
            "$revision": revision,
        }

        for index, (entity_id, payload_json) in enumerate(items):
            entity_param = f"$entity_id_{index}"
            payload_param = f"$payload_json_{index}"
            declarations.append(f"DECLARE {entity_param} AS Utf8;")
            declarations.append(f"DECLARE {payload_param} AS Utf8;")
            statements.append(
                f"UPSERT INTO `{table_name}` (user_id, {id_column}, payload_json) "
                f"VALUES ($user_id, {entity_param}, {payload_param});"
            )
            parameters[entity_param] = entity_id
            parameters[payload_param] = payload_json

        statements.append(
            f"UPSERT INTO `{self._tables.revisions}` (user_id, revision) "
            f"VALUES ($user_id, $revision);"
        )

        self._execute("\n".join([*declarations, *statements]), parameters)
        return revision

    def _save_document(self, user_id: str, document_id: str, payload_json: str) -> str:
        revision = _now_revision()
        self._execute(
            f"""
            DECLARE $user_id AS Utf8;
            DECLARE $document_id AS Utf8;
            DECLARE $payload_json AS Utf8;
            DECLARE $revision AS Utf8;

            UPSERT INTO `{self._tables.documents}` (user_id, document_id, payload_json)
            VALUES ($user_id, $document_id, $payload_json);

            UPSERT INTO `{self._tables.revisions}` (user_id, revision)
            VALUES ($user_id, $revision);
            """,
            {
                "$user_id": user_id,
                "$document_id": document_id,
                "$payload_json": payload_json,
                "$revision": revision,
            },
        )
        return revision

    def _touch_revision(self, user_id: str, revision: str):
        self._execute(
            f"""
            DECLARE $user_id AS Utf8;
            DECLARE $revision AS Utf8;

            UPSERT INTO `{self._tables.revisions}` (user_id, revision)
            VALUES ($user_id, $revision);
            """,
            {
                "$user_id": user_id,
                "$revision": revision,
            },
        )

    def _select_payloads(self, table_name: str, id_column: str, user_id: str) -> list[str]:
        result_sets = self._execute(
            f"""
            DECLARE $user_id AS Utf8;
            SELECT payload_json FROM `{table_name}` WHERE user_id = $user_id ORDER BY {id_column};
            """,
            {"$user_id": user_id},
        )
        return [str(_row_value(row, "payload_json")) for row in result_sets[0].rows]

    def _select_documents(self, user_id: str) -> dict[str, str]:
        result_sets = self._execute(
            f"""
            DECLARE $user_id AS Utf8;
            SELECT document_id, payload_json FROM `{self._tables.documents}` WHERE user_id = $user_id ORDER BY document_id;
            """,
            {"$user_id": user_id},
        )
        return {
            str(_row_value(row, "document_id")): str(_row_value(row, "payload_json"))
            for row in result_sets[0].rows
        }

    def _execute(self, query: str, parameters: dict | None = None):
        return self._pool.execute_with_retries(query, parameters or {})

    def _build_table_names(self, prefix: str) -> TableNames:
        normalized_prefix = "_".join(
            part for part in "".join(ch if ch.isalnum() else "_" for ch in prefix).split("_") if part
        )
        base = normalized_prefix or "specto"

        return TableNames(
            pages=f"{base}_workspace_pages",
            topics=f"{base}_workspace_topics",
            categories=f"{base}_workspace_categories",
            documents=f"{base}_workspace_documents",
            revisions=f"{base}_workspace_revisions",
        )
