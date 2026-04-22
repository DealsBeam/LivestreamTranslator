[README(1).md](https://github.com/user-attachments/files/26972600/README.1.md)
# 🌐 LiveStream Translator

**Free, open source real-time Japanese → English captions for TwitCasting and any livestream.**

No subscription. No monthly fee. No time limits. You just need a free Google account.

---

## What This Does

When you're watching a Japanese livestream, the streamer's voice gets automatically translated into English captions that appear on screen as they speak — similar to subtitles, but live and in real time.

You can also turn on **bilingual mode** to see the original Japanese text underneath the English translation.

---

## What You Need Before Starting

- Google Chrome browser (this does **not** work on Firefox, Safari, or Edge)
- A free Google account (Gmail counts)
- The livestream-translator folder from this download

---

## Step 1 — Get Your Free Gemini API Key

This is the key that powers the translation. It's completely free.

1. Open Chrome and go to: **https://aistudio.google.com/apikey**
2. Sign in with your Google account if asked
3. Click the blue **"Create API key"** button
4. A long string of letters and numbers will appear — click the **copy icon** next to it
5. Paste it somewhere safe for a moment (like a Notepad/TextEdit window) — you'll need it in Step 3

> The free tier gives you 1,500 translation requests per day. One hour of livestreaming uses about 720 requests, so you'll never run out under normal use.

---

## Step 2 — Install the Extension in Chrome

1. Extract (unzip) the file you downloaded — you will get a folder called **lst-chrome**
2. Open Google Chrome
3. In the address bar at the top, type: **chrome://extensions** and press Enter
4. In the top-right corner of that page, turn on the switch that says **"Developer mode"**
5. Three new buttons will appear — click **"Load unpacked"**
6. A file picker window opens — find and select the **lst-chrome** folder you extracted in step 1
7. The extension will appear in your list with a 🌐 globe icon

**Pin it to your toolbar so it's easy to click:**
1. Click the puzzle piece icon (🧩) in the top-right corner of Chrome
2. Find "LiveStream Translator" in the list
3. Click the pin icon next to it — the 🌐 globe icon will now appear in your toolbar permanently

---

## Step 3 — Add Your API Key

1. Click the 🌐 globe icon in your Chrome toolbar
2. You'll see a box that says "Paste your free API key..."
3. Click inside that box and paste the API key you copied in Step 1
4. The text "✓ Key saved" will appear automatically — you're done, it saves instantly
5. You only need to do this once — it remembers your key forever

---

## Step 4 — Translate Your First Livestream

1. Go to **https://twitcasting.tv** (or any Japanese livestream site) and open a live stream
2. Make sure the stream is actually playing and you can hear audio
3. Click the 🌐 globe icon in your toolbar
4. Click the blue **"▶ Start Translation"** button
5. The popup will close automatically
6. Within a few seconds, a green "Translating..." badge will appear in the top-left corner of the stream page
7. Wait 5–6 seconds — English captions will begin appearing on screen as the streamer speaks

**To stop translation:** Click the 🌐 globe icon again and click **"■ Stop Translation"**

---

## Caption Settings

Click the 🌐 globe icon to access these settings at any time:

| Setting | What It Does |
|---|---|
| **Font size** | Make the caption text bigger or smaller (drag the slider) |
| **Background** | How dark/transparent the caption background is |
| **Position** | Move captions to the top or bottom of the screen |
| **Bilingual** | When ON: shows original Japanese text below the English caption |

Settings save automatically the moment you change them.

---

## Troubleshooting

**"Could not start" error when clicking Start**
→ Reload the livestream tab first, then try again

**Captions appear but the audio on the stream went silent**
→ This is a known Chrome behavior with audio capture. The extension includes a fix for this — if it still happens, reload the tab, start the stream audio again, then click Start Translation

**Captions showing "⚠️ No API key"**
→ Click the 🌐 icon and paste your Gemini key into the box

**The extension disappeared after restarting Chrome**
→ Extensions loaded in Developer mode disappear when Chrome restarts. Go back to chrome://extensions and click "Load unpacked" again. To install it permanently so it survives restarts, the extension would need to be submitted to the Chrome Web Store.

**Captions are delayed or inaccurate**
→ The translation happens in 5-second chunks, so there will always be a 5–6 second delay. Accuracy depends on how clearly the streamer speaks — heavy background music or multiple people talking at once will reduce accuracy.

---

## How It Works (Non-Technical Summary)

Every 5 seconds, the extension quietly grabs a small clip of the stream's audio, sends it to Google's free Gemini AI, and asks it to translate the Japanese speech into English. The translation comes back and appears as a caption on screen. This repeats as long as translation is running.

Your API key is stored only in your browser — it never touches any server other than Google's own translation service.

---

## For Developers / Open Source Contributors

Built with:
- Chrome Extensions Manifest V3
- `chrome.tabCapture` + Offscreen Document API for tab audio capture
- `MediaRecorder` API for 5-second audio chunking
- Google Gemini 2.0 Flash API (free tier) for transcription + translation
- Vanilla JavaScript, no build tools required

Ideas for contributions:
- [ ] More source languages (Korean, Chinese, Spanish, etc.)
- [ ] Alternative translation backends (OpenAI, Claude API)
- [ ] Caption history / scroll-back panel
- [ ] Adjustable chunk size for lower latency
- [ ] Caption color and font customization
- [ ] Word-by-word streaming translation
- [ ] Submit to Chrome Web Store for permanent install

---

## License

MIT — free to use, modify, and share.

---

## Cost Summary

| Item | Cost |
|---|---|
| This extension | Free |
| Gemini API — free tier | Free (1,500 requests/day, no credit card) |
| Gemini API — if you exceed free tier | Less than $0.01 per hour of streaming |

