// ============================================================
// LiveStream Translator — Content Script
// Displays translated captions as an overlay on the page.
// Supports bilingual mode (Japanese original + English translation).
// ============================================================

(function () {
  'use strict';

  let fadeTimer = null;
  let toastTimer = null;

  // ── Inject styles ─────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('lst-styles')) return;
    const s = document.createElement('style');
    s.id = 'lst-styles';
    s.textContent = `
      #lst-caption-wrap {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        max-width: 82%;
        min-width: 220px;
        z-index: 2147483647;
        text-align: center;
        pointer-events: none;
        transition: opacity 0.5s ease;
        font-family: Arial, Helvetica, sans-serif;
      }
      #lst-caption-wrap.pos-top {
        bottom: auto;
        top: 80px;
      }
      #lst-caption-wrap.fading {
        opacity: 0;
      }
      #lst-translation {
        display: inline-block;
        background: rgba(0,0,0,0.84);
        color: #ffffff;
        font-size: 18px;
        font-weight: 600;
        line-height: 1.5;
        padding: 9px 22px 9px 18px;
        border-radius: 6px 6px 0 0;
        border-left: 4px solid #4f8ef7;
        text-shadow: 1px 1px 3px rgba(0,0,0,0.9);
        word-break: break-word;
        max-width: 100%;
        animation: lst-up 0.28s ease;
      }
      #lst-transcription {
        display: inline-block;
        background: rgba(0,0,0,0.65);
        color: #cccccc;
        font-size: 13px;
        font-weight: 400;
        line-height: 1.4;
        padding: 4px 22px 5px 18px;
        border-radius: 0 0 6px 6px;
        border-left: 4px solid #4f8ef7;
        border-top: 1px solid rgba(255,255,255,0.08);
        word-break: break-word;
        max-width: 100%;
      }
      #lst-transcription:empty { display: none; }

      #lst-indicator {
        position: fixed;
        top: 14px;
        left: 14px;
        z-index: 2147483647;
        background: rgba(10,10,25,0.88);
        color: #aaaaaa;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        padding: 5px 12px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 7px;
        pointer-events: none;
      }
      #lst-indicator .lst-dot {
        width: 8px; height: 8px;
        background: #4caf50;
        border-radius: 50%;
        animation: lst-pulse 1.6s infinite;
      }

      #lst-toast {
        position: fixed;
        top: 14px;
        right: 14px;
        z-index: 2147483647;
        background: rgba(10,10,25,0.9);
        color: #aaaaaa;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        padding: 7px 14px;
        border-radius: 4px;
        border-left: 3px solid #4f8ef7;
        pointer-events: none;
        animation: lst-up 0.2s ease;
      }

      @keyframes lst-up    { from { opacity:0; transform:translateY(5px) } to { opacity:1; transform:none } }
      @keyframes lst-pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
    `;
    document.head.appendChild(s);
  }

  // ── Caption display ───────────────────────────────────────
  function showCaption(translation, transcription) {
    injectStyles();

    let wrap = document.getElementById('lst-caption-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'lst-caption-wrap';

      const tl = document.createElement('div');
      tl.id = 'lst-translation';

      const tr = document.createElement('div');
      tr.id = 'lst-transcription';

      wrap.appendChild(tl);
      wrap.appendChild(tr);
      document.body.appendChild(wrap);
    }

    document.getElementById('lst-translation').textContent   = translation;
    document.getElementById('lst-transcription').textContent = transcription || '';

    // Apply settings
    chrome.storage.local.get(['fontSize', 'captionOpacity', 'captionPosition', 'showBilingual']).then(s => {
      const tl = document.getElementById('lst-translation');
      const tr = document.getElementById('lst-transcription');
      if (!tl) return;

      tl.style.fontSize = `${s.fontSize || 18}px`;
      const op = s.captionOpacity !== undefined ? s.captionOpacity : 0.84;
      tl.style.background = `rgba(0,0,0,${op})`;
      tr.style.display = (s.showBilingual !== false && transcription) ? 'inline-block' : 'none';
      wrap.classList.toggle('pos-top', (s.captionPosition || 'bottom') === 'top');
    });

    wrap.classList.remove('fading');
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => {
      const w = document.getElementById('lst-caption-wrap');
      if (w) w.classList.add('fading');
    }, 7000);
  }

  // ── Active indicator ─────────────────────────────────────
  function showIndicator() {
    if (document.getElementById('lst-indicator')) return;
    injectStyles();
    const el = document.createElement('div');
    el.id = 'lst-indicator';
    el.innerHTML = '<div class="lst-dot"></div><span>Translating...</span>';
    document.body.appendChild(el);
  }

  function removeIndicator() {
    document.getElementById('lst-indicator')?.remove();
  }

  // ── Toast ─────────────────────────────────────────────────
  function showToast(text, duration = 5000) {
    injectStyles();
    let el = document.getElementById('lst-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lst-toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), duration);
  }

  // ── Remove all UI ─────────────────────────────────────────
  function removeAll() {
    clearTimeout(fadeTimer);
    clearTimeout(toastTimer);
    document.getElementById('lst-caption-wrap')?.remove();
    document.getElementById('lst-indicator')?.remove();
    document.getElementById('lst-toast')?.remove();
  }

  // ── Re-apply settings ────────────────────────────────────
  function applySettings() {
    const wrap = document.getElementById('lst-caption-wrap');
    const tl   = document.getElementById('lst-translation');
    const tr   = document.getElementById('lst-transcription');
    if (!wrap || !tl) return;

    chrome.storage.local.get(['fontSize', 'captionOpacity', 'captionPosition', 'showBilingual']).then(s => {
      tl.style.fontSize = `${s.fontSize || 18}px`;
      const op = s.captionOpacity !== undefined ? s.captionOpacity : 0.84;
      tl.style.background = `rgba(0,0,0,${op})`;
      if (tr) tr.style.display = (s.showBilingual !== false && tr.textContent) ? 'inline-block' : 'none';
      wrap.classList.toggle('pos-top', (s.captionPosition || 'bottom') === 'top');
    });
  }

  // ── Message listener ──────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.action) {
      case 'captureStarted':
        showIndicator();
        showToast('🎧 LiveStream Translator is active', 4000);
        break;

      case 'showCaption':
        showCaption(msg.translation, msg.transcription || '');
        break;

      case 'showStatus':
        showToast(msg.text);
        break;

      case 'captureStopped':
        removeAll();
        break;

      case 'settingsUpdated':
        applySettings();
        break;
    }
  });

})();
