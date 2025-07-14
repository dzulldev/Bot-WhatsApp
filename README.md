# WhatsApp Bot 🤖📱

A Simple and Powerful WhatsApp Bot using [Baileys](https://github.com/WhiskeySockets/Baileys) ⚡

## ✨ Features

- 💬 `.say` — Make the bot say anything (admin/bot only, deletes original message)
- 👤 `.getpp` — Get someone's profile picture
- 📣 `.hidetag` — Mention all users silently (admin only)
- 🎨 `.brat` — Create a sticker with text
- 🖼️ `.s` / `.stiker` / `.sticker` — Convert image to sticker
- 🔁 `.toimg` — Convert sticker to image
- ⏳ Smart typing/recording presence updates
- 🧠 Admin detection logic
- 🧹 Auto-delete messages based on permissions
- 🛡️ Ephemeral-proof `.say` messages

## ⚙️ How to Run

1. Clone this repo
2. Install dependencies:
   ```bash
   npm install
   ```

   
## Run the bot:

```node index.js```

First time running will show a QR code in terminal. Scan it using your WhatsApp 📲


## 📁 File Structure

- index.js           # Main bot logic
- group.js           # Group command handler (optional)
- auth_info/         # Auth folder (auto created)
- no-profile.png     # Placeholder image


## 🧑‍💻 Requirements

Node.js 18+
FFmpeg (for sticker/image processing)
WhatsApp account
Terminal with QR scan access

---

Made with ChatGPT using Baileys by @WhiskeySockets
