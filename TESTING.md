# Doodle Dash — Test Plan

Two layers of testing:

| Layer | Where | What it covers |
|---|---|---|
| **Automated** | Open `test.html` in any browser | Pure functions, scoring, host state machine |
| **Manual E2E** | Open `index.html` in 2+ browser windows | Real WebRTC, canvas drawing, UI |

The two requirements from the spec are covered by both layers.

---

## 1. Automated tests (run these first)

Open `test.html` in a browser. You should see a green pass bar with **~70 passing tests**, including two highlighted scenario groups:

- **🎯 Scenario: Host can start the game**
- **🎯 Scenario: User can join after the game has started**

If anything fails, the failing assertion is shown in red with the actual vs expected values.

To re-run, just click the **Re-run** button (or refresh the page).

---

## 2. Manual end-to-end tests

WebRTC peer connections, canvas drawing, and UI behaviour can't be verified in pure JS — these need real browsers. Run these scenarios with 2+ Chrome windows side-by-side (or two devices on the same network).

### Scenario A — Host can start the game

**Steps:**
1. Open `index.html` in **Window 1**. Enter name "Alice" → click **Create Room**.
2. Verify a 6-character room code appears (e.g., `K7M3Q2`).
3. Open `index.html` in **Window 2**. Enter name "Bob" and the room code → click **Join**.
4. In Window 1, verify Bob appears in the player list.
5. Verify the **Start Game** button becomes enabled (it requires ≥ 2 players).
6. Click **Start Game** in Window 1.

**Expected:**
- Both windows transition to the game screen.
- One player is shown the word-choice screen with 3 word options; the other sees "Waiting for [name] to choose a word…"
- Player list shows both players with score 0.
- Round counter shows "Round 1 of 3".

**Failure modes to watch for:**
- ❌ Start button stays disabled with 2 players → `canStartGame` regression
- ❌ Both windows still on lobby after click → host broadcast didn't fire
- ❌ Words shown to both players → `wordReveal` going to wrong peer

---

### Scenario B — User can join AFTER the game has started

**Steps:**
1. Complete Scenario A through step 6 (game is running, drawer has chosen a word, drawing is happening).
2. Have the drawer make a few strokes on the canvas.
3. Open `index.html` in a **third window** (Window 3). Enter name "Charlie" and the same room code → click **Join**.

**Expected (the important assertions):**
- ✅ Charlie's window transitions directly to the game screen (skipping the lobby).
- ✅ Charlie sees the strokes that were already drawn (canvas replay).
- ✅ Chat message appears in all 3 windows: *"Charlie joined mid-game — will draw next round"*.
- ✅ Charlie's score starts at 0 in everyone's player list.
- ✅ Drawer's timer / word / canvas are not interrupted.
- ✅ Charlie can type a guess. If they guess correctly, they earn points just like anyone else.
- ✅ When the current round ends and a new round starts, Charlie is included in the next draw order (will eventually be the drawer).

**Failure modes to watch for:**
- ❌ "Game already in progress" rejection → late-join code regressed
- ❌ Charlie sees blank canvas while drawing is in progress → canvas replay broken
- ❌ Charlie's score field is missing or wrong → state sync issue
- ❌ Drawer's stroke is interrupted or canvas resizes → unrelated layout regression

---

### Scenario C — Drawing syncs across late joiner

**Steps:**
1. With Charlie joined mid-game (Scenario B), have the drawer continue drawing.
2. Have the drawer click **Clear** and start over.

**Expected:**
- Charlie sees new strokes appear in real time.
- When Clear is pressed, Charlie's canvas clears and any new strokes appear correctly.

---

### Scenario D — Reconnection (bonus)

**Steps:**
1. With 3 players in the game (Scenario B state), close Charlie's tab.
2. Other players see "Charlie disconnected" in chat.
3. Re-open `index.html`, name "Charlie", join with the same room code.

**Expected:**
- Charlie rejoins.
- If Charlie's previous score was non-zero, that score is preserved (not reset to 0).
- Game continues normally.

---

### Scenario E — Round + game lifecycle

**Steps:**
1. Start a 2-round, 30-second game with 2 players.
2. Let each player draw their full turn (or use Clear to skip ahead).
3. After all turns complete, verify the game-end screen appears with a podium.
4. Click **Play Again** → verify return to lobby with scores reset.

---

## Quick smoke test (60 seconds)

If you only have a minute:

1. Open `test.html` → look for green bar, all passing.
2. Open `index.html` in two windows → create + join a room → start game → verify both windows switch to the game screen.
3. Open a third window → join the same room mid-game → verify the third window goes straight to the game (not rejected).

If all three pass, the core functionality works.

---

## Hosting reminder

For real multi-machine testing, host the files on GitHub Pages (or any static host):

```
git add index.html game-core.js test.html README.md TESTING.md
git commit -m "Doodle Dash"
git push
```

Then enable Pages in the repo settings. Players will need internet access to reach the PeerJS public signaling server (`peerjs.com:443` over HTTPS); the actual game traffic is direct WebRTC peer-to-peer.
