# Prom Gdańsk–Nynäshamn — rozkład + AIS

## Który statek kiedy
Źródło: HTML Polferries (`code=gn` / `ng`) — **brak publicznego API**.
W tabelach oznaczenia: **WAW** = M/F Wawel, **NS** = Nova Star (naprzemiennie).
Typowy slot: wyjazd ~18:00, przyjazd ~12:00* następnego dnia.

## Lokalizacja (darmowe API)
**AISStream** — https://aisstream.io — darmowy klucz, WebSocket.
- Endpoint: `wss://stream.aisstream.io/v0/stream`
- **Tylko server-side** (browser zabroniony)
- MMSI: Wawel `311852000`, Nova Star `311000787`
- Env: `AISSTREAM_API_KEY`

Proxy lokalne: klient → nasz WS → AISStream (klucz nigdy w froncie).
