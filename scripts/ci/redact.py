"""Podmienia adres i hasło bazy w tekście ze stdin. Sekretu nie wypisuje.

Czyta DB_URL_FILE i DB_PASSWORD_FILE. Pusty plik albo brak pliku = bez podmiany.
Kolejność: najpierw cały adres, potem hasło (hasło bywa fragmentem adresu).
"""

from __future__ import annotations

import os
import sys


def read_secret(path: str) -> str:
    if not path or not os.path.isfile(path):
        return ""
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def redact(text: str, url: str, password: str) -> str:
    if url:
        text = text.replace(url, "[adres]")
    if password:
        text = text.replace(password, "[haslo]")
    return text


def main() -> None:
    url = read_secret(os.environ.get("DB_URL_FILE", ""))
    password = read_secret(os.environ.get("DB_PASSWORD_FILE", ""))
    sys.stdout.write(redact(sys.stdin.read(), url, password))


if __name__ == "__main__":
    main()
