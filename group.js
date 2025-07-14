// group.js

export async function handleGroupCommand(sock, m, text, from, sender) {
  if (!from.endsWith("@g.us")) return;

  try {
    const metadata = await sock.groupMetadata(from);

    const groupAdmins = metadata.participants
      .filter((p) => p.admin !== null)
      .map((p) => p.id);

    const botNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net";
    const botIsAdmin = groupAdmins.includes(botNumber);
    const isAdmin = groupAdmins.includes(sender);

    // cek jika bot bukan admin dan user memanggil perintah admin
    if (
      !botIsAdmin &&
      [".open", ".close", ".link", ".kick", ".add", ".promote", ".demote"].some((cmd) =>
        text.startsWith(cmd)
      )
    ) {
      await sock.sendMessage(from, { text: "⚠️ Bot is not admin!" });
      return;
    }

    // cek jika pengirim bukan admin
    if (
      !isAdmin &&
      sender !== botNumber &&
      [".open", ".close", ".kick", ".add", ".promote", ".demote"].some((cmd) =>
        text.startsWith(cmd)
      )
    ) {
      await sock.sendMessage(from, { text: "⚠️ Only admins can use this command." });
      return;
    }

    // === .open
    if (text === ".open") {
      await sock.groupSettingUpdate(from, "not_announcement");
      await sock.sendMessage(from, { text: "✅ Group opened for everyone." });
    }

    // === .close
    if (text === ".close") {
      await sock.groupSettingUpdate(from, "announcement");
      await sock.sendMessage(from, { text: "✅ Group closed, only admins can chat." });
    }

    // === .link
    if (text === ".link") {
      try {
        const code = await sock.groupInviteCode(from);
        await sock.sendMessage(from, {
          text: `🔗 Group link:\nhttps://chat.whatsapp.com/${code}`,
        });
      } catch (e) {
        console.error("link error:", e);
      }
    }

    // === .kick
    if (text.startsWith(".kick")) {
      let target;

      const mention = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (mention) {
        target = mention;
      } else {
        const quoted = m.message?.extendedTextMessage?.contextInfo;
        if (quoted?.participant) {
          target = quoted.participant;
        }
      }

      if (!target) {
        await sock.sendMessage(from, {
          text: "⚠️ Mention or reply to the user you want to kick.",
        });
        return;
      }

      await sock.groupParticipantsUpdate(from, [target], "remove");
      await sock.sendMessage(from, {
        text: `✅ @${target.split("@")[0]} removed.`,
        mentions: [target],
      });
    }

    // === .add
    if (text.startsWith(".add")) {
      const number = text.split(" ")[1];
      if (!number) {
        await sock.sendMessage(from, { text: "⚠️ Provide the number to add." });
        return;
      }
      const jid = number.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

      try {
        await sock.groupParticipantsUpdate(from, [jid], "add");
        await sock.sendMessage(from, {
          text: `✅ Added @${number}`,
          mentions: [jid],
        });
      } catch (e) {
        console.error("add error:", e);
        await sock.sendMessage(from, {
          text: `⚠️ Failed to add @${number}`,
          mentions: [jid],
        });
      }
    }

    // === .promote
    if (text.startsWith(".promote")) {
      let target;

      const mention = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (mention) {
        target = mention;
      } else {
        const quoted = m.message?.extendedTextMessage?.contextInfo;
        if (quoted?.participant) {
          target = quoted.participant;
        }
      }

      if (!target) {
        await sock.sendMessage(from, {
          text: "⚠️ Mention or reply to the user you want to promote.",
        });
        return;
      }

      // pastikan ada di grup
      const participant = metadata.participants.find((p) => p.id === target);
      if (!participant) {
        await sock.sendMessage(from, { text: "⚠️ User is not in the group." });
        return;
      }

      await sock.groupParticipantsUpdate(from, [target], "promote");
      await sock.sendMessage(from, {
        text: `✅ @${target.split("@")[0]} promoted to admin.`,
        mentions: [target],
      });
    }

    // === .demote
    if (text.startsWith(".demote")) {
      let target;

      const mention = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (mention) {
        target = mention;
      } else {
        const quoted = m.message?.extendedTextMessage?.contextInfo;
        if (quoted?.participant) {
          target = quoted.participant;
        }
      }

      if (!target) {
        await sock.sendMessage(from, {
          text: "⚠️ Mention or reply to the user you want to demote.",
        });
        return;
      }

      const participant = metadata.participants.find((p) => p.id === target);
      if (!participant) {
        await sock.sendMessage(from, { text: "⚠️ User is not in the group." });
        return;
      }

      await sock.groupParticipantsUpdate(from, [target], "demote");
      await sock.sendMessage(from, {
        text: `✅ @${target.split("@")[0]} demoted from admin.`,
        mentions: [target],
      });
    }

  } catch (err) {
    console.error("group.js error:", err);
  }
}
