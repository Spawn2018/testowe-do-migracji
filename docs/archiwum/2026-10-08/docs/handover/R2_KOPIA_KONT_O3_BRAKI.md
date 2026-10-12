# R2 — kopia usuniętych kont O3 (2026-10-05)

## F — wgranie (decyzja właściciela ~16:44)

| Fakt | Wynik |
|------|--------|
| Plik lokalny | `/home/box/sand-data/agents/8f0d9d27-789e-4b31-bed8-10c6e4900c24/konta-backup/usuniete_o3_scandimavian_2026-10-05T12-46-06-438Z.json` (2954 B) |
| Bucket | `tower-backup` |
| Klucz obiektu | `konta/usuniete_o3_scandimavian_2026-10-05T12-46-06-438Z.json` |
| PUT | HTTP 200, etag `8f4c23483b07001bd3f84069c5e3af81`, uploaded `2026-10-05T14:44:49.007Z` (UTC) ≈ **16:44 PL** |
| Ścieżka | Cloudflare API + `CLOUDFLARE_API_TOKEN` (bez kluczy S3-style; Account ID z `/accounts`) |

## Lista obiektów `konta/` (potwierdzenie po PUT)

```
konta/usuniete_o3_scandimavian_2026-10-05T12-46-06-438Z.json  size=2954  uploaded=2026-10-05T14:44:49.007Z
```

Konta testowe O3 pozostają usunięte z bazy (audyt `USER_DELETED_OWNER_05_10`); kopia JSON jest w R2.
