import json
import os
import sys
import time
import urllib.parse
import urllib.request
from urllib.error import HTTPError


def http_json(method: str, url: str, body: dict | None = None, headers: dict | None = None) -> tuple[int, dict]:
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")

    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)

    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except HTTPError as e:
        raw = e.read().decode("utf-8") if e.fp else ""
        try:
            return e.code, json.loads(raw) if raw else {"detail": raw}
        except json.JSONDecodeError:
            return e.code, {"detail": raw}


def http_form(method: str, url: str, form_fields: dict[str, str]) -> tuple[int, dict]:
    data = urllib.parse.urlencode(form_fields).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except HTTPError as e:
        raw = e.read().decode("utf-8") if e.fp else ""
        try:
            return e.code, json.loads(raw) if raw else {"detail": raw}
        except json.JSONDecodeError:
            return e.code, {"detail": raw}


def main() -> int:
    base = os.getenv("API_BASE", "http://127.0.0.1:8000").rstrip("/")
    register_url = f"{base}/api/auth/register"
    login_url = f"{base}/api/auth/login"
    user_url_tpl = f"{base}/api/usuarios/{{email}}"

    stamp = str(int(time.time()))
    email = f"testuser_{stamp}@mail.com"
    password = "password123"

    print(f"[1/3] Register -> {email}")
    status, reg = http_json(
        "POST",
        register_url,
        body={"name": "Tester", "email": email, "password": password},
    )
    if status not in (200, 201):
        if status == 409:
            print(f"  - Cuenta ya existía (409). Continuando con login.")
        else:
            print(f"  - Error en register ({status}): {reg}")
            return 1
    else:
        print(f"  - Register OK: {reg.get('user', {}).get('id')}")

    print("[2/3] Login")
    status, login = http_form(
        "POST",
        login_url,
        form_fields={"username": email, "password": password},
    )
    if status not in (200, 201):
        print(f"  - Error en login ({status}): {login}")
        return 1
    token = login.get("access_token")
    if not token:
        print(f"  - Login no devolvió access_token: {login}")
        return 1
    print(f"  - Login OK. Token (prefix): {token[:10]}")

    print("[3/3] Get user (sin auth)")
    user_url = user_url_tpl.format(email=urllib.parse.quote(email))
    req = urllib.request.Request(user_url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            user = json.loads(raw) if raw else {}
    except HTTPError as e:
        raw = e.read().decode("utf-8") if e.fp else ""
        print(f"  - Error en get user ({e.code}): {raw}")
        return 1

    user_id = user.get("user", {}).get("id")
    print(f"  - User OK. id={user_id}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

