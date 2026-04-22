// ============================================================
// LiveStream Translator — Background Service Worker (Chrome MV3)
// ============================================================

const state = {
  isCapturing:   false,
  activeTabId:   null,
  apiKey:        '',
  showBilingual: true
};

// Concurrency lock — prevents double-creating the offscreen document
let creatingOffscreen = null;

// Load saved settings on startup
chrome.storage.local.get(['geminiApiKey', 'showBilingual']).then(s => {
  if (s.geminiApiKey)              state.apiKey        = s.geminiApiKey;
  if (s.showBilingual !== undefined) state.showBilingual = s.showBilingual;
});

// ── Message handler ────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {

    case 'startCapture':
      handleStartCapture(sendResponse);
      return true; // keep channel open for async

    case 'stopCapture':
      handleStopCapture();
      sendResponse({ success: true });
      break;

    case 'updateApiKey':
      state.apiKey = msg.apiKey;
      chrome.storage.local.set({ geminiApiKey: msg.apiKey });
      sendToOffscreen({ action: 'updateApiKey', apiKey: msg.apiKey });
      sendResponse({ success: true });
      break;

    case 'updateSettings':
      if (msg.showBilingual !== undefined) state.showBilingual = msg.showBilingual;
      chrome.storage.local.set({ showBilingual: state.showBilingual });
      sendToOffscreen({ action: 'updateSettings', showBilingual: state.showBilingual });
      sendResponse({ success: true });
      break;

    case 'getStatus':
      sendResponse({ isCapturing: state.isCapturing });
      break;

    // ── Messages FROM offscreen ────────────────────────────
    case 'captureReady':
      state.isCapturing = true;
      if (state.activeTabId !== null) {
        chrome.tabs.sendMessage(state.activeTabId, { action: 'captureStarted' }).catch(() => {});
      }
      break;

    case 'showCaption':
      if (state.activeTabId !== null) {
        chrome.tabs.sendMessage(state.activeTabId, {
          action:        'showCaption',
          translation:   msg.translation,
          transcription: msg.transcription
        }).catch(() => {});
      }
      break;

    case 'offscreenError':
      state.isCapturing = false;
      if (state.activeTabId !== null) {
        chrome.tabs.sendMessage(state.activeTabId, {
          action: 'showStatus',
          text: '⚠️ ' + (msg.error || 'Capture error')
        }).catch(() => {});
      }
      closeOffscreen();
      break;

    case 'captureStopped':
      state.isCapturing = false;
      if (state.activeTabId !== null) {
        chrome.tabs.sendMessage(state.activeTabId, { action: 'captureStopped' }).catch(() => {});
      }
      closeOffscreen();
      state.activeTabId = null;
      break;
  }
});

// ── Start capture ──────────────────────────────────────────
async function handleStartCapture(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      sendResponse({ success: false, error: 'No active tab found.' });
      return;
    }

    const tabId = tabs[0].id;
    state.activeTabId = tabId;

    // Get a one-time stream ID for this tab
    const streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, id => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(id);
        }
      });
    });

    // Create offscreen document if needed
    await ensureOffscreen();

    // Send stream ID and settings to offscreen
    await sendToOffscreen({
      action:        'startCapture',
      streamId,
      apiKey:        state.apiKey,
      showBilingual: state.showBilingual
    });

    sendResponse({ success: true });

  } catch (err) {
    console.error('[LST] startCapture error:', err);
    state.isCapturing = false;
    sendResponse({ success: false, error: err.message });
  }
}

// ── Stop capture ───────────────────────────────────────────
function handleStopCapture() {
  state.isCapturing = false;
  sendToOffscreen({ action: 'stopCapture' });

  if (state.activeTabId !== null) {
    chrome.tabs.sendMessage(state.activeTabId, { action: 'captureStopped' }).catch(() => {});
    state.activeTabId = null;
  }

  setTimeout(closeOffscreen, 600);
}

// ── Offscreen helpers ──────────────────────────────────────
// BUG FIX: chrome.offscreen.hasDocument() does not exist.
// Correct method per Google's own samples: chrome.runtime.getContexts()
async function ensureOffscreen() {
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  const contexts = await chrome.runtime.getContexts({
    contextTypes:  ['OFFSCREEN_DOCUMENT'],
    documentUrls:  [chrome.runtime.getURL('offscreen.html')]
  });

  if (contexts.length > 0) return; // already exists

  creatingOffscreen = chrome.offscreen.createDocument({
    url:           'offscreen.html',
    reasons:       [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'Capture tab audio for real-time Japanese translation'
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

async function closeOffscreen() {
  creatingOffscreen = null;
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('offscreen.html')]
    });
    if (contexts.length > 0) {
      await chrome.offscreen.closeDocument();
    }
  } catch (e) {
    // Already closed — fine
  }
}

function sendToOffscreen(msg) {
  return chrome.runtime.sendMessage({ ...msg, target: 'offscreen' }).catch(() => {});
}
