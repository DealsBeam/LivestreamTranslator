// ============================================================
// LiveStream Translator — Offscreen Document
// ============================================================

const capture = {
  stream:       null,
  recorder:     null,
  chunks:       [],
  running:      false,
  apiKey:       '',
  showBilingual: true,
  chunkTimer:   null,
  audioCtx:     null  // keeps tab audio playing through speakers
};

// ── Message listener ───────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target && msg.target !== 'offscreen') return;

  switch (msg.action) {
    case 'startCapture':
      capture.apiKey        = msg.apiKey        || '';
      capture.showBilingual = msg.showBilingual !== false;
      startCapture(msg.streamId);
      break;
    case 'stopCapture':
      stopCapture();
      break;
    case 'updateApiKey':
      capture.apiKey = msg.apiKey || '';
      break;
    case 'updateSettings':
      if (msg.showBilingual !== undefined) capture.showBilingual = msg.showBilingual;
      break;
  }
});

// ── Get tab audio stream ───────────────────────────────────
async function startCapture(streamId) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource:   'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    capture.stream  = stream;
    capture.running = true;

    // ── BUG FIX: tabCapture mutes the tab's audio output. ──
    // Without this, the user goes deaf on TwitCasting the moment
    // translation starts. We pipe the captured stream back through
    // an AudioContext so the user can still hear the stream normally.
    capture.audioCtx = new AudioContext();
    const source = capture.audioCtx.createMediaStreamSource(stream);
    source.connect(capture.audioCtx.destination);

    chrome.runtime.sendMessage({ action: 'captureReady' });
    scheduleChunk();

  } catch (err) {
    console.error('[LST-offscreen] getUserMedia error:', err);
    chrome.runtime.sendMessage({
      action: 'offscreenError',
      error:  'Could not access tab audio: ' + err.message
    });
  }
}

// ── 5-second recording loop ────────────────────────────────
function scheduleChunk() {
  if (!capture.running || !capture.stream?.active) {
    stopCapture();
    return;
  }

  capture.chunks = [];
  const mime = getBestMime();
  let recorder;

  try {
    recorder = new MediaRecorder(capture.stream, mime ? { mimeType: mime } : {});
  } catch (e) {
    console.error('[LST-offscreen] MediaRecorder init failed:', e);
    stopCapture();
    return;
  }

  capture.recorder = recorder;

  recorder.ondataavailable = e => {
    if (e.data?.size > 0) capture.chunks.push(e.data);
  };

  recorder.onstop = async () => {
    if (capture.chunks.length > 0 && capture.running) {
      const blob = new Blob(capture.chunks, { type: recorder.mimeType || 'audio/webm' });
      await sendToGemini(blob);
    }
    if (capture.running) scheduleChunk();
  };

  recorder.start();
  capture.chunkTimer = setTimeout(() => {
    if (recorder.state === 'recording') recorder.stop();
  }, 5000);
}

function getBestMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

// ── Gemini API call ────────────────────────────────────────
async function sendToGemini(blob) {
  if (!capture.apiKey) {
    chrome.runtime.sendMessage({
      action: 'showCaption',
      translation:   '⚠️ No API key set. Open the extension and paste your Gemini key.',
      transcription: ''
    });
    return;
  }

  try {
    const base64 = await blobToBase64(blob);
    const mime   = blob.type || 'audio/webm';

    const prompt = capture.showBilingual
      ? `This audio is from a Japanese livestream. Listen and respond ONLY with this exact JSON, no markdown, no extra text:
{"transcription":"original Japanese text","translation":"English translation"}
If there is only silence or music and no clear speech, respond with exactly: {"transcription":"","translation":""}
Keep the English natural and conversational. Preserve slang, tone, and emotion.`
      : `This audio is from a Japanese livestream. Translate what is said into natural conversational English. Preserve slang, tone and emotion. Output ONLY the English translation. If there is only silence or music, output nothing.`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${capture.apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: mime, data: base64 } },
            { text: prompt }
          ]}],
          generationConfig: { temperature: 0.1, maxOutputTokens: 400 }
        })
      }
    );

    if (resp.status === 429) { console.warn('[LST] Rate limit — skipping'); return; }
    if (!resp.ok)            { console.error('[LST] Gemini error', resp.status); return; }

    const data = await resp.json();
    const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!raw) return;

    if (capture.showBilingual) {
      try {
        const clean  = raw.replace(/```json\n?|```/g, '').trim();
        const parsed = JSON.parse(clean);
        const trans  = (parsed.translation   || '').trim();
        const transcr = (parsed.transcription || '').trim();
        if (trans) {
          chrome.runtime.sendMessage({ action: 'showCaption', translation: trans, transcription: transcr });
        }
      } catch {
        if (raw.length > 1) {
          chrome.runtime.sendMessage({ action: 'showCaption', translation: raw, transcription: '' });
        }
      }
    } else {
      if (raw.length > 1) {
        chrome.runtime.sendMessage({ action: 'showCaption', translation: raw, transcription: '' });
      }
    }

  } catch (err) {
    console.error('[LST-offscreen] sendToGemini error:', err);
  }
}

// ── Stop and clean up ─────────────────────────────────────
function stopCapture() {
  capture.running = false;
  clearTimeout(capture.chunkTimer);

  if (capture.recorder?.state !== 'inactive') {
    try { capture.recorder.stop(); } catch (_) {}
  }
  if (capture.stream) {
    capture.stream.getTracks().forEach(t => t.stop());
    capture.stream = null;
  }
  if (capture.audioCtx) {
    capture.audioCtx.close().catch(() => {});
    capture.audioCtx = null;
  }

  chrome.runtime.sendMessage({ action: 'captureStopped' });
}

// ── Utility ───────────────────────────────────────────────
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror  = reject;
    reader.readAsDataURL(blob);
  });
}
