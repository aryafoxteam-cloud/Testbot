const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ================== KONFIGURASI ==================
// Semua setting diatur lewat file config.json (satu tempat, gampang diubah)
const CONFIG_PATH = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

const OWNER_NUMBER = process.env.OWNER_NUMBER || config.ownerNumber; // format 628xxxxxxxxxx
const PREFIX = config.prefix || '.';
const MENU_IMAGE = path.join(__dirname, config.menuImage || 'assets/menu.jpg');
const DEFAULT_WELCOME = config.defaultWelcomeText || 'Selamat datang @user di grup ini!';
const DEFAULT_LEAVE = config.defaultLeaveText || 'Selamat tinggal @user, semoga sukses selalu!';
// ===================================================

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FILES = {
  groups: path.join(DATA_DIR, 'groups.json'),
  welcome: path.join(DATA_DIR, 'welcome.json'),
  leave: path.join(DATA_DIR, 'leave.json'),
  status: path.join(DATA_DIR, 'status.json'),
};

function loadJSON(file, def) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(def, null, 2));
    return def;
  }
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch {
    return def;
  }
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let allowedGroups = loadJSON(FILES.groups, []); // ["1234-5678@g.us", ...]
let welcomeMsgs = loadJSON(FILES.welcome, {}); // { groupId: "teks" }
let leaveMsgs = loadJSON(FILES.leave, {}); // { groupId: "teks" }
let groupStatus = loadJSON(FILES.status, {}); // { groupId: "open"|"closed" }

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'session'));
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.macOS('Desktop'),
    logger: P({ level: 'silent' }),
  });

  // ---- Login pakai Pairing Code (bukan scan QR) ----
  if (!sock.authState.creds.registered) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q) => new Promise((resolve) => rl.question(q, resolve));
    const phoneNumber = await question('Masukkan nomor WA bot (format 628xxxxxxxxxx): ');
    rl.close();
    try {
      const code = await sock.requestPairingCode(phoneNumber.trim());
      console.log('==============================');
      console.log('KODE PAIRING KAMU:', code);
      console.log('Masukkan kode ini di HP: WhatsApp > Perangkat Tertaut > Tautkan Perangkat > Tautkan dengan nomor telepon');
      console.log('==============================');
    } catch (e) {
      console.error('Gagal minta kode pairing:', e);
    }
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('Koneksi terputus. Reconnect:', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Bot berhasil terhubung ke WhatsApp!');
    }
  });

  // ---- Welcome & Leave ----
  sock.ev.on('group-participants.update', async (update) => {
    const { id: groupId, participants, action } = update;
    if (!allowedGroups.includes(groupId)) return; // hanya grup yang terdaftar

    for (const participant of participants) {
      const mentionTag = '@' + participant.split('@')[0];
      try {
        if (action === 'add') {
          const template = welcomeMsgs[groupId] || DEFAULT_WELCOME;
          await sock.sendMessage(groupId, {
            text: template.replaceAll('@user', mentionTag),
            mentions: [participant],
          });
        } else if (action === 'remove') {
          const template = leaveMsgs[groupId] || DEFAULT_LEAVE;
          await sock.sendMessage(groupId, {
            text: template.replaceAll('@user', mentionTag),
            mentions: [participant],
          });
        }
      } catch (e) {
        console.error('Gagal kirim welcome/leave:', e);
      }
    }
  });

  // ---- Command handler ----
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = isGroup ? msg.key.participant : from;
    const senderNumber = sender?.split('@')[0];
    const isOwner = senderNumber === OWNER_NUMBER;

    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      '';

    if (!body.startsWith(PREFIX)) return;

    const [cmdRaw, ...args] = body.trim().split(' ');
    const cmd = cmdRaw.toLowerCase();
    const text = args.join(' ');

    const CMD = (name) => PREFIX + name; // helper biar konsisten sama prefix custom

    // Bot hanya aktif di grup yang sudah didaftarkan lewat .addgrup
    if (isGroup && !allowedGroups.includes(from) && cmd !== CMD('addgrup')) return;
    if (!isGroup && cmd !== CMD('menu') && cmd !== CMD('setting')) return; // chat pribadi cuma boleh .menu/.setting biar simpel

    const reply = (content) => sock.sendMessage(from, content);
    const ownerOnly = () => reply({ text: 'Perintah ini khusus owner bot.' });

    try {
      switch (cmd) {
        case CMD('menu'): {
          const caption = '*MENU BOT*\n\n.setting\n.game';
          if (fs.existsSync(MENU_IMAGE)) {
            await reply({ image: fs.readFileSync(MENU_IMAGE), caption });
          } else {
            await reply({ text: caption });
          }
          break;
        }

        case CMD('setting'): {
          if (!isOwner) return ownerOnly();
          await reply({
            text:
              `*SETTING ${config.botName || 'BOT'}*\n\n` +
              `${CMD('addgrup')} - Daftarkan grup ini ke bot\n` +
              `${CMD('dellgrup')} - Hapus grup ini dari daftar\n` +
              `${CMD('tutup')} - Tutup grup (hanya admin bisa chat)\n` +
              `${CMD('buka')} - Buka grup (semua member bisa chat)\n` +
              `${CMD('addwelcome')} <teks> - Set pesan welcome (pakai @user untuk mention)\n` +
              `${CMD('dellwelcome')} - Hapus pesan welcome custom\n` +
              `${CMD('addlave')} <teks> - Set pesan leave (pakai @user untuk mention)\n` +
              `${CMD('delllave')} - Hapus pesan leave custom`,
          });
          break;
        }

        case CMD('game'): {
          await reply({ text: 'Belum ada game yang tersedia. Menyusul update berikutnya 🎮' });
          break;
        }

        case CMD('addgrup'): {
          if (!isOwner) return ownerOnly();
          if (!isGroup) return reply({ text: 'Perintah ini hanya bisa dipakai di dalam grup.' });
          if (allowedGroups.includes(from)) {
            await reply({ text: 'Grup ini sudah terdaftar.' });
          } else {
            allowedGroups.push(from);
            saveJSON(FILES.groups, allowedGroups);
            await reply({ text: 'Grup ini berhasil didaftarkan. Bot sekarang aktif di sini.' });
          }
          break;
        }

        case CMD('dellgrup'): {
          if (!isOwner) return ownerOnly();
          if (!isGroup) return reply({ text: 'Perintah ini hanya bisa dipakai di dalam grup.' });
          allowedGroups = allowedGroups.filter((g) => g !== from);
          saveJSON(FILES.groups, allowedGroups);
          await reply({ text: 'Grup ini dihapus dari daftar. Bot berhenti aktif di sini.' });
          break;
        }

        case CMD('tutup'): {
          if (!isOwner) return ownerOnly();
          if (!isGroup) return;
          await sock.groupSettingUpdate(from, 'announcement');
          groupStatus[from] = 'closed';
          saveJSON(FILES.status, groupStatus);
          await reply({ text: '🔒 Grup ditutup. Hanya admin yang bisa mengirim pesan.' });
          break;
        }

        case CMD('buka'): {
          if (!isOwner) return ownerOnly();
          if (!isGroup) return;
          await sock.groupSettingUpdate(from, 'not_announcement');
          groupStatus[from] = 'open';
          saveJSON(FILES.status, groupStatus);
          await reply({ text: '🔓 Grup dibuka. Semua member bisa mengirim pesan.' });
          break;
        }

        case CMD('addwelcome'): {
          if (!isOwner) return ownerOnly();
          if (!isGroup) return reply({ text: 'Perintah ini hanya bisa dipakai di dalam grup.' });
          if (!text) return reply({ text: 'Contoh: .addwelcome Selamat datang @user!' });
          welcomeMsgs[from] = text;
          saveJSON(FILES.welcome, welcomeMsgs);
          await reply({ text: 'Pesan welcome berhasil disimpan.' });
          break;
        }

        case CMD('dellwelcome'): {
          if (!isOwner) return ownerOnly();
          if (!isGroup) return;
          delete welcomeMsgs[from];
          saveJSON(FILES.welcome, welcomeMsgs);
          await reply({ text: 'Pesan welcome custom dihapus, kembali ke default.' });
          break;
        }

        case CMD('addlave'): {
          if (!isOwner) return ownerOnly();
          if (!isGroup) return reply({ text: 'Perintah ini hanya bisa dipakai di dalam grup.' });
          if (!text) return reply({ text: 'Contoh: .addlave Selamat tinggal @user!' });
          leaveMsgs[from] = text;
          saveJSON(FILES.leave, leaveMsgs);
          await reply({ text: 'Pesan leave berhasil disimpan.' });
          break;
        }

        case CMD('delllave'): {
          if (!isOwner) return ownerOnly();
          if (!isGroup) return;
          delete leaveMsgs[from];
          saveJSON(FILES.leave, leaveMsgs);
          await reply({ text: 'Pesan leave custom dihapus, kembali ke default.' });
          break;
        }
      }
    } catch (err) {
      console.error('Error saat menjalankan command:', err);
      await reply({ text: 'Terjadi error saat menjalankan perintah.' });
    }
  });
}

startBot();
