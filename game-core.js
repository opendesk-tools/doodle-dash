/* ==========================================================
   game-core.js
   Pure game logic for Doodle Dash. No DOM, no network.
   Exposed as window.GameCore so it can be tested in isolation
   and used by index.html for shared algorithms.
   ========================================================== */
(function (global) {
  'use strict';

  const WORDS = [
    "cat","dog","elephant","giraffe","penguin","octopus","butterfly","shark","dolphin","tiger",
    "lion","monkey","rabbit","snake","kangaroo","crocodile","flamingo","owl","bee","spider",
    "turtle","horse","cow","sheep","pig","chicken","duck","fish","whale","bear",
    "fox","wolf","hedgehog","squirrel","koala","panda","zebra","rhino","hippo","camel",
    "telephone","umbrella","guitar","piano","bicycle","airplane","rocket","submarine","telescope","microscope",
    "hammer","scissors","pencil","backpack","glasses","hat","sock","shoe","watch","key",
    "lamp","clock","chair","table","bed","couch","fridge","oven","toaster","kettle",
    "bottle","cup","plate","fork","spoon","knife","candle","book","newspaper","laptop",
    "camera","headphones","television","mirror","window","door","ladder","bucket","broom","shovel",
    "pizza","hamburger","hotdog","sandwich","taco","sushi","pasta","noodles","soup","salad",
    "banana","apple","strawberry","pineapple","watermelon","grapes","orange","lemon","carrot","broccoli",
    "cake","cookie","donut","cupcake","muffin","pancake","waffle","icecream","chocolate","popcorn",
    "tree","flower","mushroom","cactus","leaf","cloud","rainbow","lightning","mountain","volcano",
    "beach","island","river","waterfall","desert","forest","sun","moon","star","planet",
    "jumping","sleeping","dancing","swimming","cooking","reading","running","crying","laughing","fishing",
    "car","truck","bus","boat","motorcycle","scooter","train","helicopter","tractor","ambulance",
    "castle","pirate","wizard","ghost","robot","dragon","mermaid","alien","dinosaur","knight",
    "snowman","scarecrow","lighthouse","windmill","bridge","tent","igloo","treasure","anchor","compass",
    "violin","drum","trumpet","saxophone","microphone","volleyball","basketball","soccer","tennis",
    "balloon","gift","crown","ring","medal","trophy","pretzel","fireworks","snowflake",
    "tornado","earthquake","bonfire","spaceship","satellite","skateboard","kite"
  ];
  const WORD_SET = Array.from(new Set(WORDS));

  // ----------------- Pure utility functions -----------------
  const PALETTE = ['#ff4d8d','#3a86ff','#8ce99a','#ffd23f','#9d4edd','#ff9e3d','#06b6d4','#e63946','#6b4423','#111111'];
  function randomColor(rng) { rng = rng || Math.random; return PALETTE[Math.floor(rng() * PALETTE.length)]; }

  function randomCode(rng) {
    rng = rng || Math.random;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(rng() * chars.length)];
    return s;
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
  }

  function shuffle(a, rng) {
    rng = rng || Math.random;
    const arr = [...a];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function maskWord(w) {
    return String(w).split('').map(ch => /[a-zA-Z]/.test(ch) ? '_' : ch).join('');
  }

  function normalizeGuess(s) {
    return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  function levenshtein(a, b) {
    a = String(a); b = String(b);
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  function isCorrectGuess(guess, target) {
    return normalizeGuess(guess) === normalizeGuess(target) && normalizeGuess(target) !== '';
  }

  function isCloseGuess(guess, target) {
    const g = normalizeGuess(guess);
    const t = normalizeGuess(target);
    if (g.length < 3 || !t) return false;
    if (Math.abs(g.length - t.length) > 1) return false;
    const d = levenshtein(g, t);
    return d > 0 && d <= 1;
  }

  function computeGuesserPoints(order, timeLeft, maxTime) {
    const ratio = maxTime > 0 ? Math.max(0, Math.min(1, timeLeft / maxTime)) : 0;
    const base = 50 + Math.round(ratio * 100);
    const orderBonus = Math.max(0, 50 - Math.max(0, order - 1) * 15);
    return base + orderBonus;
  }

  function computeDrawerBonus() { return 30; }

  function contrastText(hex) {
    const h = String(hex).replace('#', '');
    if (h.length !== 6) return '#000';
    const r = parseInt(h.substr(0, 2), 16);
    const g = parseInt(h.substr(2, 2), 16);
    const b = parseInt(h.substr(4, 2), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#000' : '#fff';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ----------------- Host state machine -----------------
  // All functions take state as first arg. Mutate in place. No external deps.
  const HostLogic = {
    MAX_PLAYERS: 12,
    DRAW_TIME_DEFAULT: 80,
    ROUNDS_DEFAULT: 3,

    createInitialState(hostId, hostName, hostColor) {
      return {
        phase: 'lobby',
        players: [{ id: hostId, name: String(hostName || 'Host').slice(0, 16), color: hostColor || randomColor(), score: 0, connected: true }],
        hostId,
        drawerId: null,
        currentWord: null,
        maskedWord: '',
        wordLength: 0,
        timeLeft: 0,
        maxTime: HostLogic.DRAW_TIME_DEFAULT,
        maxRounds: HostLogic.ROUNDS_DEFAULT,
        round: 1,
        drawOrder: [],
        drawerIndex: 0,
        guessedIds: [],
        chat: [],
        wordChoices: null,
        canvasEvents: [],
        hintsGiven: 0,
      };
    },

    addPlayer(state, id, name, color) {
      // Reconnect path: player with same id already exists
      const existing = state.players.find(p => p.id === id);
      if (existing) {
        const wasConnected = existing.connected;
        existing.connected = true;
        if (name) existing.name = String(name).slice(0, 16);
        if (color) existing.color = color;
        return { accepted: true, reconnect: !wasConnected, player: existing };
      }
      const active = state.players.filter(p => p.connected).length;
      if (active >= HostLogic.MAX_PLAYERS) {
        return { accepted: false, reason: 'Room full (max ' + HostLogic.MAX_PLAYERS + ').' };
      }
      const p = {
        id,
        name: String(name || 'Player').slice(0, 16),
        color: color || randomColor(),
        score: 0,
        connected: true,
      };
      state.players.push(p);
      return { accepted: true, reconnect: false, player: p, midGame: state.phase !== 'lobby' };
    },

    disconnectPlayer(state, id) {
      const p = state.players.find(pl => pl.id === id);
      if (!p) return { found: false };
      if (state.phase === 'lobby') {
        state.players = state.players.filter(pl => pl.id !== id);
        return { found: true, removed: true };
      }
      p.connected = false;
      const wasDrawer = state.drawerId === id && (state.phase === 'drawing' || state.phase === 'choosing');
      return { found: true, removed: false, wasDrawer };
    },

    canStartGame(state) {
      return state.phase === 'lobby' && state.players.filter(p => p.connected).length >= 2;
    },

    startGame(state, maxRounds, maxTime, rng) {
      if (!HostLogic.canStartGame(state)) return { started: false, reason: 'Cannot start' };
      state.maxRounds = Number(maxRounds) || HostLogic.ROUNDS_DEFAULT;
      state.maxTime = Number(maxTime) || HostLogic.DRAW_TIME_DEFAULT;
      state.round = 1;
      for (const p of state.players) p.score = 0;
      HostLogic._startRound(state, rng);
      HostLogic._beginTurn(state, rng);
      return { started: true };
    },

    _startRound(state, rng) {
      state.drawOrder = shuffle(state.players.filter(p => p.connected).map(p => p.id), rng);
      state.drawerIndex = 0;
    },

    _beginTurn(state, rng) {
      state.guessedIds = [];
      state.currentWord = null;
      state.maskedWord = '';
      state.wordLength = 0;
      state.timeLeft = state.maxTime;
      state.canvasEvents = [];
      state.hintsGiven = 0;
      state.wordChoices = null;

      while (state.drawerIndex < state.drawOrder.length) {
        const id = state.drawOrder[state.drawerIndex];
        const pl = state.players.find(p => p.id === id);
        if (pl && pl.connected) break;
        state.drawerIndex++;
      }
      if (state.drawerIndex >= state.drawOrder.length) {
        if (state.round >= state.maxRounds) {
          state.phase = 'gameEnd';
          state.drawerId = null;
          return { roundOver: true, gameOver: true };
        }
        state.round++;
        HostLogic._startRound(state, rng);
        return HostLogic._beginTurn(state, rng);
      }
      state.drawerId = state.drawOrder[state.drawerIndex];
      state.phase = 'choosing';
      const pool = shuffle(WORD_SET, rng);
      state.wordChoices = pool.slice(0, 3);
      return { roundOver: false };
    },

    chooseWord(state, word) {
      if (state.phase !== 'choosing') return { accepted: false, reason: 'not-choosing' };
      if (!state.wordChoices || !state.wordChoices.includes(word)) return { accepted: false, reason: 'not-in-choices' };
      state.phase = 'drawing';
      state.currentWord = word;
      state.maskedWord = maskWord(word);
      state.wordLength = word.length;
      state.hintsGiven = 0;
      state.timeLeft = state.maxTime;
      return { accepted: true };
    },

    processGuess(state, playerId, text) {
      const player = state.players.find(p => p.id === playerId);
      if (!player) return { handled: false, reason: 'unknown-player' };
      const chatText = String(text || '').slice(0, 60).trim();
      if (!chatText) return { handled: false, reason: 'empty' };

      if (state.phase === 'drawing') {
        if (playerId === state.drawerId) return { handled: false, reason: 'is-drawer' };
        if (state.guessedIds.includes(playerId)) return { handled: false, reason: 'already-guessed' };

        if (isCorrectGuess(chatText, state.currentWord)) {
          const order = state.guessedIds.length + 1;
          const pts = computeGuesserPoints(order, state.timeLeft, state.maxTime);
          player.score += pts;
          const drawer = state.players.find(p => p.id === state.drawerId);
          if (drawer) drawer.score += computeDrawerBonus();
          state.guessedIds.push(playerId);
          const guessersLeft = state.players.filter(p => p.id !== state.drawerId && p.connected && !state.guessedIds.includes(p.id));
          return {
            handled: true, kind: 'correct',
            playerId, playerName: player.name,
            pointsAwarded: pts, drawerBonus: computeDrawerBonus(),
            order, allGuessed: guessersLeft.length === 0,
          };
        }

        if (isCloseGuess(chatText, state.currentWord)) {
          return { handled: true, kind: 'close', playerId, playerName: player.name, text: chatText };
        }
      }
      return { handled: true, kind: 'chat', playerId, playerName: player.name, text: chatText };
    },

    tick(state) {
      if (state.phase !== 'drawing') return { timeUp: false, revealed: false };
      state.timeLeft--;
      const elapsed = state.maxTime - state.timeLeft;
      let revealed = false;
      const want1 = Math.floor(state.maxTime * 0.35);
      const want2 = Math.floor(state.maxTime * 0.70);
      if (state.hintsGiven < 1 && elapsed >= want1) { HostLogic._revealLetter(state); revealed = true; }
      if (state.hintsGiven < 2 && elapsed >= want2) { HostLogic._revealLetter(state); revealed = true; }
      return { timeUp: state.timeLeft <= 0, revealed };
    },

    _revealLetter(state) {
      state.hintsGiven++;
      const word = state.currentWord || '';
      const cur = state.maskedWord.split('');
      const hidden = [];
      for (let i = 0; i < word.length; i++) if (cur[i] === '_') hidden.push(i);
      if (hidden.length <= 1) return; // never reveal the last letter
      const pick = hidden[Math.floor(Math.random() * hidden.length)];
      cur[pick] = word[pick];
      state.maskedWord = cur.join('');
    },

    endTurn(state) {
      if (state.phase !== 'drawing' && state.phase !== 'choosing') return { ended: false };
      state.phase = 'roundEnd';
      return { ended: true };
    },

    advanceToNextTurn(state, rng) {
      state.drawerIndex++;
      return HostLogic._beginTurn(state, rng);
    },

    recordCanvasEvent(state, event) {
      if (state.phase !== 'drawing') return;
      if (!state.canvasEvents) state.canvasEvents = [];
      if (event.type === 'clear') {
        state.canvasEvents = [{ type: 'clear' }];
      } else if (event.type === 'fill') {
        state.canvasEvents.push({ type: 'fill', color: event.color });
      } else if (event.type === 'stroke') {
        state.canvasEvents.push({
          type: 'stroke',
          x1: event.x1, y1: event.y1, x2: event.x2, y2: event.y2,
          color: event.color, size: event.size,
        });
      }
    },

    getPublicState(state) {
      return {
        phase: state.phase,
        players: state.players.map(p => ({ id: p.id, name: p.name, color: p.color, score: p.score, connected: p.connected })),
        hostId: state.hostId,
        drawerId: state.drawerId,
        maskedWord: state.maskedWord,
        wordLength: state.wordLength,
        timeLeft: state.timeLeft,
        maxTime: state.maxTime,
        maxRounds: state.maxRounds,
        round: state.round,
        guessedIds: [...state.guessedIds],
      };
    },

    resetForNewGame(state) {
      state.phase = 'lobby';
      for (const p of state.players) p.score = 0;
      state.drawerId = null;
      state.currentWord = null;
      state.maskedWord = '';
      state.wordLength = 0;
      state.timeLeft = 0;
      state.round = 1;
      state.drawOrder = [];
      state.drawerIndex = 0;
      state.guessedIds = [];
      state.canvasEvents = [];
      state.wordChoices = null;
      state.hintsGiven = 0;
    },
  };

  global.GameCore = {
    WORDS, WORD_SET, PALETTE,
    randomColor, randomCode, initials, shuffle,
    maskWord, normalizeGuess, levenshtein,
    isCorrectGuess, isCloseGuess,
    computeGuesserPoints, computeDrawerBonus,
    contrastText, escapeHtml,
    HostLogic,
  };
})(typeof window !== 'undefined' ? window : globalThis);
