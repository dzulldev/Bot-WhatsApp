import {
  DisconnectReason,
  downloadMediaMessage,
  makeWASocket,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import Jimp from "jimp";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { handleGroupCommand } from "./group.js";

const lastImage = {};
let currentPresence = "composing";
let presenceTimer;

function now() {
  return new Date().toLocaleString("en-US", {
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
}

async function isAdmin(sock, jid, user) {
  try {
    const groupMetadata = await sock.groupMetadata(jid);
    const participant = groupMetadata.participants.find(p => p.id === user);
    return participant?.admin !== null && participant?.admin !== undefined;
  } catch {
    return false;
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
  });

  sock.ev.on("connection.update", ({ connection, qr, lastDisconnect }) => {
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === "open") console.log(`[${now()}] ✅ Connected`);
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode || "";
      console.log(`[${now()}] ❌ Disconnected: ${DisconnectReason[code] || code}`);
      startBot();
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;

    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const isGroup = from.endsWith("@g.us");
    if (isGroup) await sock.readMessages([m.key]);

    const text =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      "";

    const isImage = !!m.message.imageMessage;
    const isSticker = !!m.message.stickerMessage;
    const type = isImage ? "image" : isSticker ? "sticker" : "text";

    console.log(`[${now()}] [${type}] ${from} => ${text || "[no caption]"}`);

    clearTimeout(presenceTimer);
    sock.sendPresenceUpdate(currentPresence, from);
    presenceTimer = setTimeout(() => {
      sock.sendPresenceUpdate("paused", from);
    }, 60000);
    currentPresence = currentPresence === "composing" ? "recording" : "composing";

    if (isImage && !text) lastImage[from] = m;

    if (text.startsWith(".")) {
      await sock.sendMessage(from, {
        react: { text: "⏳", key: m.key },
      });
    }

    try {
      await handleGroupCommand(sock, m, text, from, sender);

      // .brat
      if (text.startsWith(".brat")) {
        await handleBrat(sock, from, text);
      }

      // .getpp
      if (text.startsWith(".getpp")) {
        const quoted = m.message?.extendedTextMessage?.contextInfo;
        const target = quoted?.participant || sender;
        try {
          const ppUrl = await sock.profilePictureUrl(target, "image");
          await sock.sendMessage(from, {
            image: { url: ppUrl },
            jpegThumbnail: true,
            caption: "✅ Successfully fetched profile picture.",
          });
        } catch {
          await sock.sendMessage(from, {
            image: { url: "./no-profile.png" },
            caption: "⚠️ No profile picture found.",
          });
        }
      }

      // .hidetag
      if (text.startsWith(".hidetag") && isGroup) {
        const pesan = text.split(" ").slice(1).join(" ") || " ";
        const metadata = await sock.groupMetadata(from);
        const mentions = metadata.participants.map((p) => p.id);
        await sock.sendMessage(from, { text: pesan, mentions });
      }

      // .say (FIXED)
      if (text.startsWith(".say")) {
        const sayMsg = text.slice(4).trim();
        const isFromBot = sender === sock.user?.id || m.key.fromMe;
        const isSenderAdmin = isGroup && await isAdmin(sock, from, sender);

        if (!isFromBot && !isSenderAdmin) {
          await sock.sendMessage(from, { text: "❌ You are not allowed to use this command." });
          return;
        }

        if (sayMsg.length > 0) {
          await sock.sendMessage(from, { text: sayMsg }, { ephemeralExpiration: 0 });

          if (isFromBot) {
            await sock.sendMessage(from, { delete: m.key });
          } else if (isSenderAdmin && isGroup) {
            const botIsAdmin = await isAdmin(sock, from, sock.user.id);
            if (botIsAdmin) {
              await sock.sendMessage(from, {
                delete: {
                  remoteJid: from,
                  fromMe: false,
                  id: m.key.id,
                  participant: sender,
                }
              });
            }
          }
        }

        return;
      }

      // .s / .stiker / .sticker
      if (
        [".s", ".stiker", ".sticker"].some((cmd) =>
          text.toLowerCase().startsWith(cmd)
        )
      ) {
        await handleSticker(sock, from, m, isImage);
      }

      // .toimg
      if (text === ".toimg") {
        await handleToImg(sock, from, m, isSticker);
      }

    } catch (err) {
      console.error("messages.upsert error:", err);
    }

    if (text.startsWith(".")) {
      await sock.sendMessage(from, {
        react: { text: "", key: m.key },
      });
    }
  });
}

async function handleBrat(sock, from, text) {
  const stickerText = text.replace(".brat", "").trim() || " ";
  const pngFile = `brat_${Date.now()}.png`;
  const webpFile = `brat_${Date.now()}.webp`;

  const img = await new Jimp(512, 512, 0xffffffff);
  const font = await Jimp.loadFont(Jimp.FONT_SANS_128_BLACK);
  img.print(font, 20, 0, { text: stickerText }, 512, 300);
  await img.writeAsync(pngFile);

  ffmpeg(pngFile)
    .on("end", async () => {
      await sock.sendMessage(from, { sticker: { url: webpFile } });
      fs.unlinkSync(pngFile);
      fs.unlinkSync(webpFile);
    })
    .on("error", console.error)
    .addOutputOptions([
      "-vcodec", "libwebp",
      "-vf", "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=15",
      "-lossless", "1",
      "-compression_level", "3",
      "-qscale", "50",
      "-preset", "picture",
      "-loop", "0",
      "-an",
      "-vsync", "0",
    ])
    .save(webpFile);
}

async function handleSticker(sock, from, m, isImage) {
  const target = isImage ? m : lastImage[from];
  if (!target?.message?.imageMessage) return;

  const buffer = await downloadMediaMessage(target, "buffer", {});
  const tmpFile = `tmp_${Date.now()}.png`;
  const webpFile = `sticker_${Date.now()}.webp`;

  await Jimp.read(buffer)
    .then((img) => img.resize(512, Jimp.AUTO).quality(90).writeAsync(tmpFile))
    .then(() => {
      ffmpeg(tmpFile)
        .on("end", async () => {
          await sock.sendMessage(from, { sticker: { url: webpFile } });
          fs.unlinkSync(tmpFile);
          fs.unlinkSync(webpFile);
        })
        .on("error", console.error)
        .addOutputOptions([
          "-vcodec", "libwebp",
          "-vf", "fps=15",
          "-lossless", "1",
          "-compression_level", "6",
          "-qscale", "50",
          "-preset", "picture",
          "-loop", "0",
          "-an",
          "-vsync", "0",
        ])
        .save(webpFile);
    });
}

async function handleToImg(sock, from, m, isSticker) {
  let target = isSticker ? m : null;
  const quoted = m.message?.extendedTextMessage?.contextInfo;

  if (!target && quoted?.quotedMessage?.stickerMessage) {
    target = {
      key: { remoteJid: from, id: quoted.stanzaId },
      message: quoted.quotedMessage,
    };
  }

  if (!target?.message?.stickerMessage) return;

  const buffer = await downloadMediaMessage(target, "buffer", {});
  const webpFile = `sticker_${Date.now()}.webp`;
  const pngFile = `image_${Date.now()}.png`;

  fs.writeFileSync(webpFile, buffer);

  ffmpeg(webpFile)
    .inputFormat("webp")
    .on("end", async () => {
      await sock.sendMessage(from, { image: { url: pngFile } });
      fs.unlinkSync(webpFile);
      fs.unlinkSync(pngFile);
    })
    .on("error", console.error)
    .save(pngFile);
}

startBot();
