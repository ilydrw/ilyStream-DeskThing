# ilyStream DeskThing

Spotify Car Thing client for [ilyStream](../ilyStream) — turns the device into a tactile soundboard
and stream-deck remote.

## How it works

```
Car Thing  ──(DeskThing message bus)──>  Server (Node, on PC)  ──(HTTP)──>  ilyStream
```

The Car Thing browser never makes HTTP calls itself. The DeskThing server module runs on the user's
PC, holds the long-lived API token, and proxies all calls to ilyStream's `/api/v1/*` endpoints.

## Pairing flow

1. User opens **ilyStream → Connections → DeskThing**, clicks **Pair new device** to get a 6-digit
   code (60s TTL).
2. User opens this app on the Car Thing, enters the LAN host (e.g. `192.168.1.100:8899`) and the
   6-digit code.
3. Server POSTs `/api/v1/pair/complete` to ilyStream, receives a long-lived token, persists it via
   `DeskThing.saveData`, and starts streaming the catalog to the client.

## Layout

- `src/` — React 18 client (Vite, Chrome 69 target). Renders Setup / Grid screens.
- `server/` — Node module bundled with esbuild. Holds host + token, proxies to ilyStream.
- `shared/` — typed message protocol used by both sides.
- `public/` — icon + manifest copy.
- `manifest.json` — DeskThing app manifest (id `ilystream`).

## Scripts

- `npm run dev` — Vite dev server (client only, on `localhost:3000`). For real testing you need to
  install the built zip into DeskThing.
- `npm run build` — full build (client + server) and zip into `ilystream.zip` ready to install in
  DeskThing.
- `npm run typecheck` — both client and server tsc passes.
- Tagged releases are built by `.github/workflows/release.yml` and attach `ilystream.zip` to the
  GitHub Release.

## Status

Step 1 (LAN endpoints + pair UI) lives in ilyStream itself. This repo is step 2 — the device
client. The companion supports pairing, unpairing, catalog refresh, soundboard/deck actions, live
state, stream stats, chat, and recent sounds.

## 0.0.5 maintenance

- Hardened the live event bridge with bounded SSE buffering, CRLF frame handling, and cleaner reader/abort teardown.
- Kept the companion aligned with the ilyStream studio health pass so device control remains reliable during longer local-first streams.
