"""Normalizuje SUPABASE_DB_URL przed `supabase db push`. Adresu nie wypisuje.

Cudzysłów wokół całości, BOM i puste linie zrzucają CLI 2.121.0 na parser
słownikowy. Hasło z „=” albo ze znakiem specjalnym (@ # / ? spacja) jest
wtedy źle odczytane i host wpada na gniazdo lokalne (user=runner).
Hasło kodujemy procentowo; już zakodowane zostawiamy.
"""

from __future__ import annotations

import os
import re
import stat
import sys
from urllib.parse import parse_qs, quote, unquote, urlparse

SAFE = "!$&'()*+,;=-._~"
OK = re.compile(r"(?:[A-Za-z0-9\-._~!$&'()*+,;=]|%[0-9A-Fa-f]{2})*")
ASSIGN = re.compile(r"^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", re.DOTALL)
NAME_OK = re.compile(r"[A-Z_]+")


def strip_quotes(text: str) -> str:
    text = text.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {'"', "'"}:
        return text[1:-1].strip()
    return text


def classify(text: str) -> str:
    folded = text.lower()
    if folded.startswith("jdbc:"):
        return "jdbc"
    if folded.startswith(("postgres://", "postgresql://")):
        return "uri"
    if "host=" in folded:
        return "klucz=wartosc"
    if "://" in text:
        return "uri"
    return "inny"


def jdbc_to_uri(text: str) -> str | None:
    """jdbc:postgresql://host:port/baza?user=&password= → postgresql://…"""
    if not text.lower().startswith("jdbc:postgresql://"):
        return None
    parsed = urlparse(text[len("jdbc:") :])
    query = parse_qs(parsed.query, keep_blank_values=False)
    users = query.get("user") or []
    passwords = query.get("password") or []
    database = parsed.path.lstrip("/").split("/", 1)[0]
    if not users or not passwords or not parsed.hostname or not database:
        return None
    user = quote(users[0], safe="")
    port = parsed.port or 5432
    return f"postgresql://{user}:{passwords[0]}@{parsed.hostname}:{port}/{database}"


def prepare(raw: str) -> tuple[str, str | None, str]:
    """BOM, prefiks NAZWA=, cudzysłów, JDBC. Zwraca (tekst, nazwa albo None, format)."""
    text = raw.replace("\ufeff", "").strip()
    name: str | None = None
    matched = ASSIGN.match(text)
    if matched:
        candidate = strip_quotes(matched.group(2).strip())
        folded = candidate.lower()
        if folded.startswith(("postgres://", "postgresql://", "jdbc:")) or "://" in candidate:
            name = matched.group(1)
            text = matched.group(2)
    text = strip_quotes(text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    body = lines[0] if lines else text
    fmt = classify(body)
    converted = jdbc_to_uri(body)
    if converted:
        body = converted
    return body, name, fmt


def encode_password(url: str) -> str:
    scheme, sep, rest = url.partition("://")
    if not sep or "@" not in rest:
        return url
    userinfo, host = rest.rsplit("@", 1)
    user, colon, pw = userinfo.partition(":")
    if not colon or OK.fullmatch(pw):
        return url
    return f"{scheme}://{user}:{quote(pw, safe=SAFE)}@{host}"


def password_of(url: str) -> str:
    """Hasło zdekodowane (unquote). Puste, gdy adres nie ma użytkownika."""
    scheme, sep, rest = url.partition("://")
    if not sep or scheme not in {"postgres", "postgresql"} or "@" not in rest:
        return ""
    userinfo, _host = rest.rsplit("@", 1)
    _user, colon, pw = userinfo.partition(":")
    if not colon:
        return ""
    return unquote(pw)


def connection_mode(url: str) -> str:
    """pooler — host puli (IPv4, --db-url). link — reszta, CLI bierze pulę z API."""
    _port, scheme, _user, has_host, _db = describe(url)
    if scheme != "postgres" or not has_host:
        return "link"
    rest = url.rsplit("@", 1)[-1]
    hostport = rest.split("/", 1)[0].split("?", 1)[0]
    tail = hostport.rsplit(":", 1)
    host = tail[0] if len(tail) == 2 and tail[1].isdigit() else hostport
    if "pooler.supabase.com" in host:
        return "pooler"
    return "link"


def describe(url: str) -> tuple[str, str, bool, bool, bool]:
    scheme = "postgres" if url.startswith(("postgres://", "postgresql://")) else "inny"
    has_at = "@" in url
    rest = url.rsplit("@", 1)[-1] if has_at else url
    port_match = re.search(r":(\d+)", rest)
    port = port_match.group(1) if port_match else "brak"
    user = host = database = ""
    if scheme == "postgres" and has_at:
        user = url.split("://", 1)[1].rsplit("@", 1)[0].split(":", 1)[0]
        hostport = rest.split("/", 1)[0].split("?", 1)[0]
        tail = hostport.rsplit(":", 1)
        host = tail[0] if len(tail) == 2 and tail[1].isdigit() else hostport
        if "/" in rest:
            database = rest.split("/", 1)[1].split("?", 1)[0]
    return port, scheme, bool(user), bool(host), bool(database)


def main() -> int:
    normalized, name, fmt = prepare(os.environ.get("SUPABASE_DB_URL", ""))
    url = encode_password(normalized)
    encoded = "tak" if url != normalized else "nie"
    port, scheme, has_user, has_host, has_db = describe(url)
    url_path = os.environ["DB_URL_FILE"]
    port_path = os.environ["DB_PORT_FILE"]
    password_path = os.environ["DB_PASSWORD_FILE"]
    mode_path = os.environ["DB_MODE_FILE"]
    password = password_of(url)
    mode = connection_mode(url)
    with open(url_path, "w", encoding="utf-8") as handle:
        handle.write(url)
    os.chmod(url_path, stat.S_IRUSR | stat.S_IWUSR)
    with open(port_path, "w", encoding="utf-8") as handle:
        handle.write(port)
    with open(password_path, "w", encoding="utf-8") as handle:
        handle.write(password)
    os.chmod(password_path, stat.S_IRUSR | stat.S_IWUSR)
    with open(mode_path, "w", encoding="utf-8") as handle:
        handle.write(mode)
    print(
        f"Adres bazy: dlugosc {len(url)}, schemat {scheme}, "
        f"uzytkownik {'tak' if has_user else 'nie'}, host {'tak' if has_host else 'nie'}, "
        f"baza {'tak' if has_db else 'nie'}, port {port}, "
        f"haslo zakodowane: {encoded}, polaczenie: {mode}"
    )
    if name and NAME_OK.fullmatch(name):
        print(f"prefiks NAZWA= zdjety: tak ({name})")
    elif name:
        print("prefiks NAZWA= zdjety: tak")
    else:
        print("prefiks NAZWA= zdjety: nie")
    print(f"format: {fmt}")
    if fmt in {"jdbc", "klucz=wartosc"} and scheme != "postgres":
        print(
            "to format JDBC/klucz=wartość — wklej URI z Supabase → Connect → Session pooler"
        )
    if scheme != "postgres" or not has_user or not has_host or not has_db:
        print("SUPABASE_DB_URL nie jest pełnym adresem postgresql://uzytkownik@host:port/baza.")
        print(
            "Właściciel wkleja adres sesyjny (port 5432) w Settings → Secrets → Actions. "
            "Adresu nie wypisuję."
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
