// ============================================================
// LiveStream Translator — Popup Script (Chrome)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  const apiKeyInput  = document.getElementById('apiKey');
  const toggleKeyBtn = document.getElementById('toggleKey');
  const keyStatus    = document.getElementById('keyStatus');
  const capBtn       = document.getElementById('toggleCapture');
  const badge        = document.getElementById('badge');
  const fontSlider   = document.getElementById('fontSize');
  const fontVal      = document.getElementById('fontSizeVal');
  const opSlider     = document.getElementById('opacity');
  const opVal        = document.getElementById('opacityVal');
  const posSelect    = document.getElementById('position');
  const bilingualChk = document.getElementById('bilingual');
  const bilingualVal = document.getElementById('bilingualVal');

  // ── Load saved settings ──────────────────────────────────
  chrome.storage.local.get([
    'geminiApiKey', 'fontSize', 'captionOpacity', 'captionPosition', 'showBilingual'
  ]).then(s => {
    if (s.geminiApiKey) {
      apiKeyInput.value = s.geminiApiKey;
      setKeyStatus(true);
    }
    if (s.fontSize) {
      fontSlider.value    = s.fontSize;
      fontVal.textContent = `${s.fontSize}px`;
    }
    if (s.captionOpacity !== undefined) {
      opSlider.value    = s.captionOpacity;
      opVal.textContent = `${Math.round(s.captionOpacity * 100)}%`;
    }
    if (s.captionPosition) posSelect.value = s.captionPosition;
    if (s.showBilingual !== undefined) {
      bilingualChk.checked = s.showBilingual;
      bilingualVal.textContent = s.showBilingual ? 'On' : 'Off';
    }
  });

  // Check if already capturing
  chrome.runtime.sendMessage({ action: 'getStatus' }).then(r => {
    if (r?.isCapturing) setActiveState(true);
  }).catch(() => {});

  // ── API key ──────────────────────────────────────────────
  apiKeyInput.addEventListener('input', () => {
    const key = apiKeyInput.value.trim();
    if (key.length > 10) {
      chrome.runtime.sendMessage({ action: 'updateApiKey', apiKey: key });
      setKeyStatus(true);
    } else {
      setKeyStatus(false);
    }
  });

  toggleKeyBtn.addEventListener('click', () => {
    const show           = apiKeyInput.type === 'password';
    apiKeyInput.type     = show ? 'text' : 'password';
    toggleKeyBtn.textContent = show ? '🙈' : '👁';
  });

  // ── Start / Stop ─────────────────────────────────────────
  capBtn.addEventListener('click', async () => {
    const capturing = capBtn.dataset.state === 'active';

    if (capturing) {
      chrome.runtime.sendMessage({ action: 'stopCapture' });
      setActiveState(false);
      return;
    }

    const key = apiKeyInput.value.trim();
    if (!key || key.length < 10) {
      apiKeyInput.style.borderColor = '#e04545';
      keyStatus.textContent  = '⚠️ Enter your Gemini API key first';
      keyStatus.style.color  = '#e04545';
      setTimeout(() => {
        apiKeyInput.style.borderColor = '';
        keyStatus.style.color = '';
        setKeyStatus(!!apiKeyInput.value.trim());
      }, 3000);
      return;
    }

    capBtn.disabled     = true;
    capBtn.textContent  = 'Starting...';

    try {
      const resp = await chrome.runtime.sendMessage({ action: 'startCapture' });
      if (resp?.success) {
        setActiveState(true);
      } else {
        setActiveState(false);
        badge.textContent = `⚠️ ${resp?.error || 'Could not start. Reload the tab and try again.'}`;
        setTimeout(() => { badge.textContent = '● Inactive'; }, 6000);
      }
    } catch (err) {
      setActiveState(false);
      badge.textContent = '⚠️ Extension error — reload the extension';
      setTimeout(() => { badge.textContent = '● Inactive'; }, 5000);
    }

    capBtn.disabled = false;
  });

  // ── Caption settings ─────────────────────────────────────
  fontSlider.addEventListener('input', () => {
    fontVal.textContent = `${fontSlider.value}px`;
    saveSettings();
  });

  opSlider.addEventListener('input', () => {
    opVal.textContent = `${Math.round(opSlider.value * 100)}%`;
    saveSettings();
  });

  posSelect.addEventListener('change', saveSettings);

  bilingualChk.addEventListener('change', () => {
    bilingualVal.textContent = bilingualChk.checked ? 'On' : 'Off';
    saveSettings();
    chrome.runtime.sendMessage({ action: 'updateSettings', showBilingual: bilingualChk.checked });
  });

  function saveSettings() {
    chrome.storage.local.set({
      fontSize:        parseInt(fontSlider.value),
      captionOpacity:  parseFloat(opSlider.value),
      captionPosition: posSelect.value,
      showBilingual:   bilingualChk.checked
    }).then(() => {
      chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'settingsUpdated' }).catch(() => {});
        }
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  function setKeyStatus(saved) {
    keyStatus.textContent = saved ? '✓ Key saved' : '';
    keyStatus.style.color = '';
    keyStatus.classList.toggle('saved', saved);
  }

  // BUG FIX: classList.replace() silently fails if class isn't present.
  // Using remove + add is always safe regardless of current state.
  function setActiveState(active) {
    if (active) {
      capBtn.textContent   = '■  Stop Translation';
      capBtn.dataset.state = 'active';
      capBtn.classList.remove('btn-start');
      capBtn.classList.add('btn-stop');
      badge.textContent = '● Active';
      badge.classList.remove('badge-off');
      badge.classList.add('badge-on');
    } else {
      capBtn.textContent   = '▶  Start Translation';
      capBtn.dataset.state = 'idle';
      capBtn.classList.remove('btn-stop');
      capBtn.classList.add('btn-start');
      badge.textContent = '● Inactive';
      badge.classList.remove('badge-on');
      badge.classList.add('badge-off');
    }
  }

});
