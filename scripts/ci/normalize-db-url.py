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
from urllib.parse import quote

SAFE = "!$&'()*+,;=-._~"
OK = re.compile(r"(?:[A-Za-z0-9\-._~!$&'()*+,;=]|%[0-9A-Fa-f]{2})*")


def normalize(raw: str) -> str:
    text = raw.replace("\ufeff", "").strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {'"', "'"}:
        text = text[1:-1].strip()
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if lines and lines[0].startswith(("postgres://", "postgresql://")):
        return lines[0]
    return text


def encode_password(url: str) -> str:
    scheme, sep, rest = url.partition("://")
    if not sep or "@" not in rest:
        return url
    userinfo, host = rest.rsplit("@", 1)
    user, colon, pw = userinfo.partition(":")
    if not colon or OK.fullmatch(pw):
        return url
    return f"{scheme}://{user}:{quote(pw, safe=SAFE)}@{host}"


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
    normalized = normalize(os.environ.get("SUPABASE_DB_URL", ""))
    url = encode_password(normalized)
    encoded = "tak" if url != normalized else "nie"
    port, scheme, has_user, has_host, has_db = describe(url)
    url_path = os.environ["DB_URL_FILE"]
    port_path = os.environ["DB_PORT_FILE"]
    with open(url_path, "w", encoding="utf-8") as handle:
        handle.write(url)
    os.chmod(url_path, stat.S_IRUSR | stat.S_IWUSR)
    with open(port_path, "w", encoding="utf-8") as handle:
        handle.write(port)
    print(
        f"Adres bazy: dlugosc {len(url)}, schemat {scheme}, "
        f"uzytkownik {'tak' if has_user else 'nie'}, host {'tak' if has_host else 'nie'}, "
        f"baza {'tak' if has_db else 'nie'}, port {port}, "
        f"haslo zakodowane: {encoded}"
    )
    folded = normalized.lower()
    if folded.startswith("jdbc:") or "host=" in folded:
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
