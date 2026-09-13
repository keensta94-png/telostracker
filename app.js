import {
  LABELS,
  CYCLE,
  getEntry,
  getNext,
  getTicksAfter,
  CHAT_PATTERNS
} from './mechanics.js';

const $ = id => document.getElementById(id);

const state = {
  phase: 1,
  current: null,
  next: 'tendrils',
  remaining: 7,
  autos: 0,
  chat: false,
  playerArea: null,
  lastChat: '',
  lastChatProcessed: '',
  lastAutoAt: 0
};

const alt = window.alt1;


// ------------------------------------------------------------
// General helpers
// ------------------------------------------------------------

function now() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function log(text, kind = 'info') {
  const e = document.createElement('div');

  e.className = 'entry';

  e.innerHTML =
    `<span class="time">${now()}</span>` +
    `<span class="kind">${kind}</span> ` +
    escapeHtml(text);

  $('log').prepend(e);

  while ($('log').children.length > 80) {
    $('log').lastChild.remove();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>\\"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '\\': '&#92;',
    '"': '&quot;'
  }[c]));
}


// ------------------------------------------------------------
// UI
// ------------------------------------------------------------

function renderButtons() {
  const grid = $('mechanicGrid');

  grid.innerHTML = '';

  Object.entries(LABELS).forEach(([id, label]) => {
    const b = document.createElement('button');

    b.className = 'mech';
    b.dataset.mech = id;

    b.innerHTML =
      `<div class="name">${label}</div>` +
      `<div class="ticks">Next gap: ${getTicksAfter(state.phase, id)} autos</div>`;

    b.onclick = () => mechanic(id, 'manual');

    grid.appendChild(b);
  });
}

function render() {
  $('phase').textContent = state.phase;

  $('current').textContent =
    state.current
      ? LABELS[state.current]
      : 'Waiting...';

  $('next').textContent =
    LABELS[state.next] || '—';

  $('nextTicks').textContent =
    state.remaining === 0
      ? 'NOW'
      : `${state.remaining} autos to go`;

  $('autoCount').textContent = state.autos;

  const total = Math.max(
    1,
    state.remaining + state.autos
  );

  $('progressBar').style.width =
    `${Math.max(
      0,
      Math.min(
        100,
        100 - (state.remaining / total) * 100
      )
    )}%`;

  $('counterText').textContent =
    state.current
      ? `After ${LABELS[state.current]} — counting toward ${LABELS[state.next]}`
      : 'Waiting for the next mechanic';

  $('detectorState').textContent =
    state.chat
      ? 'Detector: chat OCR on'
      : (alt
          ? 'Detector: Alt1 ready'
          : 'Detector: manual/browser');

  document.querySelectorAll('.mech').forEach(b => {
    b.classList.toggle(
      'active',
      b.dataset.mech === state.current
    );
  });
}


// ------------------------------------------------------------
// Rotation
// ------------------------------------------------------------

function setPhase(p) {
  const previous = state.current;

  state.phase = p;
  state.current = null;
  state.autos = 0;

  const entry = getEntry(p, previous);

  state.next = entry.mechanic;
  state.remaining = entry.ticks;

  const carry =
    entry.carry
      ? ' via carry-over'
      : '';

  log(
    `Switched to Phase ${p}${carry} → ${LABELS[state.next]} after ${state.remaining} autos`,
    'PHASE'
  );

  render();
}

function mechanic(id, source = 'manual') {
  state.current = id;
  state.autos = 0;

  state.next = getNext(
    state.phase,
    id
  );

  state.remaining = getTicksAfter(
    state.phase,
    id
  );

  log(
    `${LABELS[id]} detected (${source}) → next ${LABELS[state.next]} after ${state.remaining} autos`,
    'MECHANIC'
  );

  render();
}

function auto() {
  if (state.remaining > 0) {
    state.remaining--;
  }

  state.autos++;

  if (state.remaining === 0) {
    log(
      `Next mechanic should now be ${LABELS[state.next]}`,
      'READY'
    );
  }

  render();
}

function undo() {
  if (state.autos > 0) {
    state.autos--;
    state.remaining++;
    render();
  }
}


// ------------------------------------------------------------
// Mechanic recognition
// ------------------------------------------------------------

function findMechanic(text) {
  const s = String(text)
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  for (const item of CHAT_PATTERNS) {
    for (const p of item.patterns) {
      if (s.includes(p)) {
        return item.mechanic;
      }
    }
  }

  return null;
}


// ------------------------------------------------------------
// Alt1 Chat OCR
// ------------------------------------------------------------

let bindId = null;
let chatTimer = null;
let chatScanCount = 0;


function startChatOCR() {
  log('Start Chat OCR clicked', 'DEBUG');

  try {
    if (!alt) {
      log(
        'window.alt1 is not available. Open the app through Alt1.',
        'ERROR'
      );
      return;
    }

    log(
      `Alt1 detected. Version: ${alt.version || 'unknown'}`,
      'DEBUG'
    );

    log(
      `RuneScape linked: ${alt.rsLinked}`,
      'DEBUG'
    );

    log(
      `RuneScape size: ${alt.rsWidth}x${alt.rsHeight}`,
      'DEBUG'
    );

    log(
      `Pixel permission: ${alt.permissionPixel}`,
      'DEBUG'
    );

    if (!alt.rsLinked) {
      log(
        'RuneScape is not linked to Alt1.',
        'ERROR'
      );
      return;
    }

    if (!alt.permissionPixel) {
      log(
        'Pixel permission is disabled for this app.',
        'ERROR'
      );
      return;
    }

    if (chatTimer) {
      clearTimeout(chatTimer);
      chatTimer = null;
    }

    try {
      bindId = alt.bindRegion(
        0,
        0,
        alt.rsWidth,
        alt.rsHeight
      );

      log(
        `Alt1 screen bound successfully. Bind ID: ${bindId}`,
        'OCR'
      );

    } catch (e) {
      log(
        `Failed to bind RuneScape screen: ${e?.stack || e}`,
        'ERROR'
      );

      console.error(e);
      return;
    }

    state.chat = true;

    $('chatBtn').textContent =
      'Chat OCR running';

    log(
      'Chat OCR started. Scanning bottom-left chat area.',
      'OCR'
    );

    render();

    // Start the OCR loop.
    pollChat();

  } catch (e) {
    log(
      `OCR startup error: ${e?.stack || e}`,
      'ERROR'
    );

    console.error(e);
  }
}


function stopChatOCR() {
  state.chat = false;

  if (chatTimer) {
    clearTimeout(chatTimer);
    chatTimer = null;
  }

  bindId = null;

  $('chatBtn').textContent =
    'Start chat OCR';

  log(
    'Chat OCR stopped.',
    'OCR'
  );

  render();
}


function pollChat() {
  if (
    !state.chat ||
    !alt ||
    !bindId
  ) {
    return;
  }

  try {
    chatScanCount++;

    const w =
      alt.rsWidth || 800;

    const h =
      alt.rsHeight || 600;

    /*
     * RuneScape chat is in the bottom-left.
     */

    const minX = 0;

    const maxX =
      Math.floor(w * 0.75);

    const minY =
      Math.floor(h * 0.70);

    const maxY =
      Math.floor(h * 0.98);

    let found = null;

    /*
     * Scan the chat area using Alt1's
     * built-in "chat" OCR font.
     */

    for (
      let y = minY;
      y < maxY && !found;
      y += 6
    ) {
      for (
        let x = minX;
        x < maxX && !found;
        x += 18
      ) {
        try {
          const text =
            alt.bindReadString(
              bindId,
              'chat',
              x,
              y
            );

          if (!text) {
            continue;
          }

          const cleaned =
            text
              .replace(/\s+/g, ' ')
              .trim();

          if (!cleaned) {
            continue;
          }

          /*
           * Only log new OCR text.
           */

          if (cleaned !== state.lastChat) {
            state.lastChat = cleaned;

            log(
              `OCR read: "${cleaned}"`,
              'OCR'
            );
          }

          const mech =
            findMechanic(cleaned);

          if (
            mech &&
            cleaned !== state.lastChatProcessed
          ) {
            state.lastChatProcessed = cleaned;

            found = {
              mech,
              text: cleaned
            };
          }

        } catch (e) {
          /*
           * Ignore individual OCR failures.
           * One bad scan should not stop OCR.
           */
        }
      }
    }

    if (found) {
      log(
        `Telos mechanic recognised: ${found.text}`,
        'CHAT'
      );

      mechanic(
        found.mech,
        'chat OCR'
      );
    }

    /*
     * Debug message every 5 scans so we know
     * the OCR loop is still alive.
     */

    if (chatScanCount % 5 === 0) {
      log(
        `OCR scan active — chat area ${maxX}x${maxY - minY}`,
        'DEBUG'
      );
    }

  } catch (e) {
    log(
      `OCR polling error: ${e?.stack || e}`,
      'ERROR'
    );

    console.error(e);
  }

  const delay =
    Math.max(
      250,
      alt.captureInterval || 400
    );

  chatTimer =
    setTimeout(
      pollChat,
      delay
    );
}


// ------------------------------------------------------------
// Experimental hit-splat detector
// ------------------------------------------------------------

function setPlayerArea() {
  if (
    !alt ||
    !alt.rsLinked
  ) {
    log(
      'Alt1 is not available.',
      'WARN'
    );

    return;
  }

  const packed =
    alt.mousePosition;

  const x =
    (packed >> 16) & 0xffff;

  const y =
    packed & 0xffff;

  state.playerArea = {
    x: Math.max(0, x - 90),
    y: Math.max(0, y - 90),
    w: 180,
    h: 180
  };

  log(
    `Hit-splat area calibrated around ${x}, ${y}.`,
    'CALIBRATE'
  );

  $('detectHelp').textContent =
    'Hit area set. This detector is experimental; use +1 auto if it misses a hit.';

  startHitDetector();
}


let hitTimer = null;
let lastRed = 0;


function startHitDetector() {
  if (hitTimer) {
    clearInterval(hitTimer);
  }

  if (
    !state.playerArea ||
    !alt ||
    !alt.rsLinked ||
    !alt.permissionPixel
  ) {
    return;
  }

  let previous = 0;

  hitTimer =
    setInterval(() => {
      try {
        const a =
          state.playerArea;

        const id =
          alt.bindScreenRegion(
            a.x,
            a.y,
            a.w,
            a.h
          );

        let score = 0;

        for (
          let y = 15;
          y < a.h;
          y += 8
        ) {
          for (
            let x = 15;
            x < a.w;
            x += 8
          ) {
            const p =
              alt.bindGetPixel(
                id,
                x,
                y
              );

            const r =
              p & 255;

            const g =
              (p >> 8) & 255;

            const b =
              (p >> 16) & 255;

            if (
              r > 150 &&
              r > g * 1.35 &&
              r > b * 1.25
            ) {
              score++;
            }
          }
        }

        if (
          score > 12 &&
          previous <= 12 &&
          Date.now() - lastRed > 500
        ) {
          lastRed =
            Date.now();

          auto();

          log(
            'Possible hit-splat detected',
            'HIT'
          );
        }

        previous =
          score;

      } catch (e) {
        // Keep detector alive if a frame fails.
      }

    }, 250);
}


// ------------------------------------------------------------
// Buttons
// ------------------------------------------------------------

$('resetBtn').onclick = () => {
  stopChatOCR();

  state.phase = 1;
  state.current = null;
  state.next = 'tendrils';
  state.remaining = 7;
  state.autos = 0;
  state.lastChat = '';
  state.lastChatProcessed = '';

  log(
    'Tracker reset',
    'RESET'
  );

  render();
};


$('autoBtn').onclick =
  auto;


$('undoAuto').onclick =
  undo;


$('chatBtn').onclick = () => {
  if (state.chat) {
    stopChatOCR();
  } else {
    startChatOCR();
  }
};


$('playerBtn').onclick =
  setPlayerArea;


$('clearLog').onclick =
  () => $('log').replaceChildren();


document
  .querySelectorAll('[data-phase]')
  .forEach(b => {
    b.onclick =
      () => setPhase(
        Number(b.dataset.phase)
      );
  });


// ------------------------------------------------------------
// Startup
// ------------------------------------------------------------

renderButtons();

if (alt) {
  $('status').textContent =
    alt.rsLinked
      ? 'Alt1 detected — ready to monitor RuneScape'
      : 'Alt1 API present — RuneScape client not linked';
} else {
  $('status').textContent =
    'Browser test mode — Alt1 not detected';
}

log(
  'Tracker loaded. Start with the phase buttons or confirm a mechanic manually.',
  'READY'
);
