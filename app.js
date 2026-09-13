import {
  LABELS,
  getEntry,
  getNext,
  getTicksAfter
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

  /*
   * Ignore the tiny garbage strings we're currently getting
   * from OCR.
   */
  if (s.length < 12) {
    return null;
  }

  /*
   * Only use distinctive Telos phrases.
   *
   * Do NOT use things like just "hold still" or "give me strength"
   * because OCR can easily produce those accidentally.
   */
  const patterns = [
    {
      mechanic: 'tendrils',
      patterns: [
        'anima will return to the source',
        'return to the source'
      ]
    },

    {
      mechanic: 'uppercut',
      patterns: [
        'gielinor, give me strength',
        'gielinor give me strength'
      ]
    },

    {
      mechanic: 'holdstill',
      patterns: [
        'hold still, invader',
        'hold still invader'
      ]
    },

    {
      mechanic: 'onslaught',
      patterns: [
        'anima is mine',
        'anima belongs to me'
      ]
    },

    {
      mechanic: 'virus',
      patterns: [
        'virus',
        'corrupted anima'
      ]
    },

    {
      mechanic: 'nospec',
      patterns: [
        'no special attack',
        'no spec'
      ]
    }
  ];

  for (const item of patterns) {
    for (const pattern of item.patterns) {
      if (s.includes(pattern)) {
        return item.mechanic;
      }
    }
  }

  return null;
}

// ------------------------------------------------------------
// Alt1 Chat OCR
// ------------------------------------------------------------

// ------------------------------------------------------------
// Alt1 Chat OCR
// ------------------------------------------------------------

let bindId = null;
let chatTimer = null;

let lastRecognisedMechanic = null;
let lastRecognisedAt = 0;


function startChatOCR() {
  log('Start Chat OCR clicked', 'DEBUG');

  try {

    if (!window.alt1) {
      log(
        'Alt1 API is not available.',
        'ERROR'
      );
      return;
    }


    if (!alt.rsLinked) {
      log(
        'RuneScape is not linked to Alt1.',
        'ERROR'
      );
      return;
    }


    log(
      `RuneScape size: ${alt.rsWidth}x${alt.rsHeight}`,
      'DEBUG'
    );


    log(
      `Pixel permission: ${alt.permissionPixel}`,
      'DEBUG'
    );


    if (!alt.permissionPixel) {
      log(
        'Pixel permission is not enabled.',
        'ERROR'
      );
      return;
    }


    // Stop any existing OCR timer.
    if (chatTimer) {
      clearTimeout(chatTimer);
      chatTimer = null;
    }


    // Reset recognition state.
    bindId = null;

    lastRecognisedMechanic = null;
    lastRecognisedAt = 0;

    state.lastChat = '';
    state.lastChatProcessed = '';


    // --------------------------------------------------------
    // Bind the RuneScape screen
    // --------------------------------------------------------

    try {

      bindId = alt.bindRegion(
        0,
        0,
        alt.rsWidth,
        alt.rsHeight
      );

      log(
        `RuneScape screen bound successfully: ${bindId}`,
        'DEBUG'
      );

    } catch (e) {

      log(
        `bindRegion failed: ${e?.message || e}`,
        'ERROR'
      );

      console.error(
        'bindRegion error:',
        e
      );

      bindId = null;

      return;
    }


    if (
      bindId === null ||
      bindId === undefined
    ) {
      log(
        'Invalid Alt1 bind ID returned.',
        'ERROR'
      );

      return;
    }


    // --------------------------------------------------------
    // Start OCR
    // --------------------------------------------------------

    state.chat = true;

    $('chatBtn').textContent =
      'Stop chat OCR';

    render();


    log(
      'Chat OCR started — monitoring RuneScape chat.',
      'OCR'
    );


    // Start polling immediately.
    pollChat();


  } catch (e) {

    log(
      `OCR startup error: ${e?.message || e}`,
      'ERROR'
    );

    console.error(
      'OCR startup error:',
      e
    );


    state.chat = false;
    bindId = null;


    if (chatTimer) {
      clearTimeout(chatTimer);
      chatTimer = null;
    }


    $('chatBtn').textContent =
      'Start chat OCR';

    render();
  }
}


function stopChatOCR() {

  state.chat = false;


  if (chatTimer) {
    clearTimeout(chatTimer);
    chatTimer = null;
  }


  bindId = null;


  lastRecognisedMechanic = null;
  lastRecognisedAt = 0;


  $('chatBtn').textContent =
    'Start chat OCR';


  log(
    'Chat OCR stopped.',
    'OCR'
  );


  render();
}


function pollChat() {

  if (!state.chat) {
    return;
  }


  if (
    !alt ||
    bindId === null
  ) {

    stopChatOCR();

    return;
  }


  try {

    const w =
      alt.rsWidth || 1653;

    const h =
      alt.rsHeight || 917;


    // --------------------------------------------------------
    // RuneScape chat region
    //
    // Based on your screenshot:
    //
    // X: approximately 0 - 545
    // Y: approximately 700 - 895
    //
    // These are proportional so they can adapt to resizing.
    // --------------------------------------------------------

    const chatX = 0;

    const chatY =
      Math.floor(h * 0.76);

    const chatH =
      Math.floor(h * 0.21);


    let recognised = null;


    // --------------------------------------------------------
    // Scan possible chat-line positions.
    // --------------------------------------------------------

    for (
      let y = chatY;
      y < chatY + chatH;
      y += 3
    ) {

      try {

        const text =
          alt.bindReadString(
            bindId,
            'chat',
            chatX + 5,
            y
          );


        if (!text) {
          continue;
        }


        const cleaned =
          String(text)
            .replace(/\s+/g, ' ')
            .trim();


        // Ignore tiny OCR garbage.
        if (cleaned.length < 12) {
          continue;
        }


        // Check for an actual Telos mechanic.
        const mechanicId =
          findMechanic(cleaned);


        if (!mechanicId) {
          continue;
        }


        recognised = {
          text: cleaned,
          mechanic: mechanicId
        };


        break;

      } catch (e) {

        // Ignore failed OCR coordinates.
        console.debug(
          'OCR coordinate failed:',
          e
        );
      }
    }


    // --------------------------------------------------------
    // Nothing recognised.
    // --------------------------------------------------------

    if (!recognised) {

      scheduleChatPoll();

      return;
    }


    const timestamp =
      Date.now();


    // --------------------------------------------------------
    // Prevent the same chat message from firing repeatedly.
    // --------------------------------------------------------

    const duplicate =
      recognised.mechanic ===
        lastRecognisedMechanic &&
      timestamp - lastRecognisedAt < 5000;


    if (duplicate) {

      scheduleChatPoll();

      return;
    }


    // --------------------------------------------------------
    // New mechanic recognised.
    // --------------------------------------------------------

    lastRecognisedMechanic =
      recognised.mechanic;

    lastRecognisedAt =
      timestamp;


    log(
      `Telos mechanic recognised: "${recognised.text}"`,
      'CHAT'
    );


    mechanic(
      recognised.mechanic,
      'chat OCR'
    );


    scheduleChatPoll();


  } catch (e) {

    log(
      `OCR polling error: ${e?.message || e}`,
      'ERROR'
    );


    console.error(
      'OCR polling error:',
      e
    );


    stopChatOCR();
  }
}


function scheduleChatPoll() {

  if (!state.chat) {
    return;
  }


  const interval =
    Math.max(
      500,
      alt.captureInterval || 500
    );


  chatTimer =
    setTimeout(
      pollChat,
      interval
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
