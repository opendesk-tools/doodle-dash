# Doodle Dash

A multiplayer drawing-and-guessing party game. One player draws a word, everyone else races to guess it in the chat. Scores are awarded for correct guesses (faster = more points) and for the drawer when others guess correctly.

## How it works

Completely serverless. Uses **WebRTC peer-to-peer** via [PeerJS](https://peerjs.com/) and its free public signaling server — no backend required. One person creates a room (they become the host) and shares the 6-character room code. Everyone else joins with that code.

## Files

| File | Purpose |
|---|---|
| `index.html` | The game itself — open this in a browser to play. |
| `game-core.js` | Pure game logic (scoring, word matching, host state machine). Loaded by both `index.html` and `test.html`. |
| `test.html` | Browser-based automated test runner. Open in any browser to verify the game logic works. |
| `TESTING.md` | Manual end-to-end test scenarios for verifying multiplayer flows in real browsers. |
| `README.md` | This file. |

## Hosting on GitHub Pages

1. Create a new repository (or use an existing one).
2. Drop `index.html` and `game-core.js` into the root (both are required — the game won't work with `index.html` alone).
3. Optionally include `test.html` and `TESTING.md` for ongoing verification.
4. Go to **Settings → Pages**, set the source to the main branch, and save.
5. Share the resulting URL with your users.

## Playing

1. Open the URL.
2. Enter a display name.
3. One person clicks **Create a Room** and shares the 6-character code shown.
4. Everyone else enters that code and clicks **Join**.
5. The host picks number of rounds and draw time, then clicks **Start Game**.
6. Each turn, one player picks from three words and draws. Others type guesses in the chat box.
7. After all rounds, a podium shows the winners.

## Features

- 2–12 players per room
- Host-controlled settings (rounds, draw time)
- 12-color palette, 4 brush sizes, fill, undo, clear
- Close-guess hints (private to the guesser)
- Automatic letter reveals as time runs low
- Time-based scoring + drawer bonuses
- **Late join supported** — players can join after the game has started; they'll see the current canvas, can guess the current word for points, and join the rotation in the next round.
- **Reconnect supported** — if a player drops, they can rejoin with the same name and resume.
- Fully responsive (works on phones)
- 200+ word bank

## Testing

Two layers of testing — see `TESTING.md` for full details.

**Automated (60 seconds):** open `test.html` in a browser. You should see all tests pass with a green bar. The test page covers pure game logic, scoring rules, the host state machine, and specifically the two key scenarios (host-can-start, late-join).

**Manual end-to-end:** open `index.html` in 2–3 browser windows, follow the scenarios in `TESTING.md`, and verify multiplayer flows work over real WebRTC.

## Tech

- Vanilla HTML/CSS/JS, no build step
- PeerJS (WebRTC) for peer-to-peer networking
- Google Fonts (Bagel Fat One, Lilita One, DM Sans)
- Pure logic isolated in `game-core.js` for testability — the test suite directly exercises the same functions the live game uses

## Notes

- Because it's peer-to-peer, if the host disconnects, the room ends. Players don't need to be on the same network — PeerJS handles NAT traversal for most configurations. Some extremely locked-down corporate networks may block WebRTC; in that case, players need to be on a network that allows it.
- All game state is in memory — no data is stored or transmitted beyond the live game session.
