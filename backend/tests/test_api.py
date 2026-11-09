"""Integration contract: real HTTP handlers and disposable relational database."""

import importlib
import os
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient

SECRET = "test-only-secret-with-at-least-32-characters"


@pytest.fixture
def client(tmp_path, monkeypatch):
    # A TEST_DATABASE_URL may point at an EMPTY disposable PostgreSQL database.
    monkeypatch.setenv(
        "DATABASE_URL", os.getenv("TEST_DATABASE_URL", f"sqlite:///{tmp_path}/test.db")
    )
    monkeypatch.setenv("JWT_SECRET", SECRET)
    from app import main

    importlib.reload(main)
    if hasattr(main, "engine"):
        from sqlmodel import SQLModel

        SQLModel.metadata.drop_all(main.engine)
        SQLModel.metadata.create_all(main.engine)
    with TestClient(main.app) as test_client:
        yield test_client
    if hasattr(main, "engine"):
        main.engine.dispose()


def signup(client, email="alice@example.com"):
    response = client.post("/api/auth/signup", json={"email": email, "password": "DemoPass123!"})
    assert response.status_code == 201, response.text
    token = client.post("/api/auth/login", json={"email": email, "password": "DemoPass123!"})
    assert token.status_code == 200, token.text
    return {"Authorization": f"Bearer {token.json()['access_token']}"}


def project(client, headers, title="Release planning"):
    response = client.post(
        "/api/projects", headers=headers, json={"title": title, "description": "Plan a release"}
    )
    assert response.status_code == 201, response.text
    return response.json()


def task(client, headers, project_id, title="Write release notes", status="TODO"):
    response = client.post(
        f"/api/projects/{project_id}/tasks",
        headers=headers,
        json={"title": title, "description": "Explain the changes", "status": status},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_auth_signup_login_and_private_profile(client):
    headers = signup(client)
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "alice@example.com"
    assert "password_hash" not in me.json()
    assert (
        client.post(
            "/api/auth/signup", json={"email": "ALICE@example.com", "password": "DemoPass123!"}
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/auth/login", json={"email": "alice@example.com", "password": "WrongPass123!"}
        ).status_code
        == 401
    )


@pytest.mark.parametrize("authorization", [None, "Bearer garbage", "Basic abc"])
def test_unauthenticated_requests_are_rejected(client, authorization):
    headers = {"Authorization": authorization} if authorization else {}
    assert client.get("/api/projects", headers=headers).status_code == 401
    assert (
        client.post("/api/projects", headers=headers, json={"title": "Private"}).status_code == 401
    )


@pytest.mark.parametrize(
    "claims",
    [
        {"sub": "1", "exp": datetime.now(UTC) - timedelta(minutes=1)},
        {"sub": "999999", "exp": datetime.now(UTC) + timedelta(minutes=1)},
        {"sub": "not-an-id", "exp": datetime.now(UTC) + timedelta(minutes=1)},
        {"sub": "1"},
    ],
)
def test_expired_unknown_and_invalid_subject_tokens(client, claims):
    token = jwt.encode(claims, SECRET, algorithm="HS256")
    assert (
        client.get("/api/projects", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    )


def test_project_crud_and_cascade(client):
    headers = signup(client)
    p = project(client, headers)
    t = task(client, headers, p["id"])
    assert client.get(f"/api/projects/{p['id']}", headers=headers).json()["title"] == p["title"]
    updated = client.patch(f"/api/projects/{p['id']}", headers=headers, json={"title": "New title"})
    assert updated.status_code == 200 and updated.json()["title"] == "New title"
    assert client.delete(f"/api/projects/{p['id']}", headers=headers).status_code == 204
    assert client.get(f"/api/projects/{p['id']}", headers=headers).status_code == 404
    assert (
        client.get(f"/api/projects/{p['id']}/tasks/{t['id']}", headers=headers).status_code == 404
    )


def test_task_crud_status_filter_and_pages(client):
    headers = signup(client)
    p = project(client, headers)
    t = task(client, headers, p["id"])
    task(client, headers, p["id"], "Second", "DONE")
    url = f"/api/projects/{p['id']}/tasks"
    result = client.get(url, headers=headers, params={"status": "TODO", "page": 1, "page_size": 1})
    assert result.status_code == 200
    assert result.json()["total"] == 1 and result.json()["items"][0]["id"] == t["id"]
    result = client.patch(
        f"{url}/{t['id']}", headers=headers, json={"status": "IN_PROGRESS", "title": "Updated task"}
    )
    assert result.status_code == 200 and result.json()["status"] == "IN_PROGRESS"
    assert client.get(f"{url}/{t['id']}", headers=headers).json()["title"] == "Updated task"
    second = client.get(url, headers=headers, params={"page": 2, "page_size": 1}).json()
    assert (
        second["total"] == 2 and len(second["items"]) == 1 and second["items"][0]["id"] != t["id"]
    )
    assert (
        client.get(url, headers=headers, params={"page": 3, "page_size": 1}).json()["items"] == []
    )
    assert client.delete(f"{url}/{t['id']}", headers=headers).status_code == 204
    assert client.get(f"{url}/{t['id']}", headers=headers).status_code == 404


def test_cross_user_and_nested_resource_paths_are_hidden(client):
    alice = signup(client)
    bob = signup(client, "bob@example.com")
    a = project(client, alice)
    b = project(client, bob, "Bob private")
    t = task(client, alice, a["id"])
    assert client.get("/api/projects", headers=bob).json()["total"] == 1
    for method in ("get", "patch", "delete"):
        kwargs = {"json": {"title": "Intrusion"}} if method == "patch" else {}
        assert (
            getattr(client, method)(f"/api/projects/{a['id']}", headers=bob, **kwargs).status_code
            == 404
        )
        for path in (
            f"/api/projects/{a['id']}/tasks/{t['id']}",
            f"/api/projects/{b['id']}/tasks/{t['id']}",
        ):
            assert getattr(client, method)(path, headers=bob, **kwargs).status_code == 404
    assert client.get(f"/api/projects/{a['id']}/tasks", headers=bob).status_code == 404
    assert (
        client.post(
            f"/api/projects/{a['id']}/tasks", headers=bob, json={"title": "Intrusion"}
        ).status_code
        == 404
    )
    own_second = project(client, alice, "Other project")
    assert (
        client.patch(
            f"/api/projects/{own_second['id']}/tasks/{t['id']}",
            headers=alice,
            json={"status": "DONE"},
        ).status_code
        == 404
    )


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "bad-email", "password": "DemoPass123!"},
        {"email": "a@example.com", "password": "short"},
        {"email": "a@example.com", "password": "          "},
        {"email": "a@example.com", "password": "DemoPass123!", "admin": True},
    ],
)
def test_invalid_signup(client, payload):
    assert client.post("/api/auth/signup", json=payload).status_code == 422


def test_input_validation_and_missing_resources(client):
    headers = signup(client)
    p = project(client, headers)
    for payload in ({"title": "  "}, {"title": "x" * 121}, {"title": "ok", "owner_id": 99}):
        assert client.post("/api/projects", headers=headers, json=payload).status_code == 422
    for payload in ({"title": None}, {}, {"description": None}):
        assert (
            client.patch(f"/api/projects/{p['id']}", headers=headers, json=payload).status_code
            == 422
        )
    for query in ({"page": 0}, {"page_size": 101}, {"page_size": 0}, {"page": "abc"}):
        assert client.get("/api/projects", headers=headers, params=query).status_code == 422
    url = f"/api/projects/{p['id']}/tasks"
    assert (
        client.post(url, headers=headers, json={"title": "x", "status": "UNKNOWN"}).status_code
        == 422
    )
    assert client.get(url, headers=headers, params={"status": "UNKNOWN"}).status_code == 422
    assert client.get("/api/projects/999999", headers=headers).status_code == 404
    assert client.get(f"{url}/999999", headers=headers).status_code == 404


def test_project_pagination_is_owner_scoped_and_stable(client):
    headers = signup(client)
    first = project(client, headers, "First")
    second = project(client, headers, "Second")
    result = client.get("/api/projects?page=2&page_size=1", headers=headers).json()
    assert result["total"] == 2 and result["page"] == 2 and result["page_size"] == 1
    assert result["items"][0]["id"] == second["id"] != first["id"]
