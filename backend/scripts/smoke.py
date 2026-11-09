"""Live HTTP smoke: run after migrations/seed against localhost:8001."""

import json
import os
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = os.getenv("API_URL", "http://127.0.0.1:8001").rstrip("/")


def call(method, path, data=None, token=None, expected=200):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(
        BASE + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers=headers,
        method=method,
    )
    try:
        response = urlopen(request, timeout=15)
    except HTTPError as exc:
        response = exc
    body = response.read()
    assert response.code == expected, (method, path, response.code, body)
    return json.loads(body) if body else None


def main():
    call("GET", "/health")
    alice = call(
        "POST", "/api/auth/login", {"email": "alice@example.com", "password": "DemoPass123!"}
    )["access_token"]
    bob = call("POST", "/api/auth/login", {"email": "bob@example.com", "password": "DemoPass123!"})[
        "access_token"
    ]
    project = call("POST", "/api/projects", {"title": "HTTP smoke project"}, alice, 201)
    try:
        base = f"/api/projects/{project['id']}"
        task = call("POST", base + "/tasks", {"title": "HTTP smoke task"}, alice, 201)
        call("GET", base, token=bob, expected=404)
        call("GET", base + f"/tasks/{task['id']}", token=bob, expected=404)
        call("PATCH", base, {"title": "HTTP smoke edited"}, alice)
        call("PATCH", base + f"/tasks/{task['id']}", {"status": "DONE"}, alice)
        page = call("GET", base + "/tasks?status=DONE&page=1&page_size=1", token=alice)
        assert page["total"] == 1 and page["items"][0]["status"] == "DONE"
        call("GET", base + "/tasks?page=0", token=alice, expected=422)
        call("GET", base, expected=401)
        call("DELETE", base + f"/tasks/{task['id']}", token=alice, expected=204)
        call("GET", base + f"/tasks/{task['id']}", token=alice, expected=404)
    finally:
        call("DELETE", f"/api/projects/{project['id']}", token=alice, expected=204)
    print(
        "PASS live HTTP: health, login, project/task CRUD, "
        "ownership, status/filter/page, validation"
    )


if __name__ == "__main__":
    main()
