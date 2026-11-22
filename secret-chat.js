const crypto = require('crypto');
const { Server } = require('socket.io');

const MAX_ANON_POOL = 10000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB limit per file for server stability
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.webp',
  '.mp4', '.zip', '.txt',
  '.js', '.ts', '.py', '.sh', '.html', '.css', '.json', '.c', '.cpp', '.h'
]);

function formatAnonName(num) {
  return `ANONYMOUS-${String(num).padStart(4, '0')}`;
}

function generateSixDigitCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function generateToken() {
  return crypto.randomBytes(18).toString('hex');
}

function attachSecretChat(httpServer) {
  const io = new Server(httpServer, {
    maxHttpBufferSize: MAX_FILE_BYTES + 256 * 1024,
    cors: { origin: false }
  });

  // In-memory ephemeral rooms (never persisted to disk or long-term storage)
  const rooms = new Map();
  let anonCounter = 0;

  function nextAnonName(room) {
    const used = new Set([...room.members.values()].map((m) => m.anonName));
    for (let i = 0; i < MAX_ANON_POOL; i++) {
      anonCounter = (anonCounter % MAX_ANON_POOL) + 1;
      const candidate = formatAnonName(anonCounter);
      if (!used.has(candidate)) return candidate;
    }
    return `ANONYMOUS-${crypto.randomInt(1, MAX_ANON_POOL + 1).toString().padStart(4, '0')}`;
  }

  function clearTimers(room) {
    if (room.inactivityTimer) {
      clearTimeout(room.inactivityTimer);
      room.inactivityTimer = null;
    }
    if (room.intervalTimer) {
      clearInterval(room.intervalTimer);
      room.intervalTimer = null;
    }
  }

  function destroyRoom(roomId, reason = 'deleted') {
    const room = rooms.get(roomId);
    if (!room) return;
    clearTimers(room);
    room.messages = [];
    room.files = [];
    room.keyMaterial = null;
    io.to(roomId).emit('secret:destroyed', { roomId, reason });
    for (const [, socket] of io.sockets.sockets) {
      if (socket.data.roomId === roomId) {
        socket.leave(roomId);
        socket.data.roomId = null;
        socket.data.anonName = null;
      }
    }
    rooms.delete(roomId);
  }

  function wipeContentOnly(roomId, reason = 'periodic-clear') {
    const room = rooms.get(roomId);
    if (!room) return;
    room.messages = [];
    room.files = [];
    room.lastActivity = Date.now();
    io.to(roomId).emit('secret:wiped', { roomId, reason, clearedAt: Date.now() });
  }

  function scheduleTimers(room) {
    clearTimers(room);
    // Mode 1: Delete entire room after 5 minutes of inactivity
    if (room.purgeMode === 'inactivity-5m') {
      room.inactivityTimer = setTimeout(() => {
        destroyRoom(room.id, 'inactivity-5m');
      }, FIVE_MINUTES_MS);
    }
    // Mode 2: Clear chat messages and files every 5 minutes regardless of activity
    if (room.purgeMode === 'every-5m') {
      room.intervalTimer = setInterval(() => {
        wipeContentOnly(room.id, 'every-5m');
      }, FIVE_MINUTES_MS);
    }
  }

  function touchActivity(room) {
    room.lastActivity = Date.now();
    if (room.purgeMode === 'inactivity-5m') {
      if (room.inactivityTimer) clearTimeout(room.inactivityTimer);
      room.inactivityTimer = setTimeout(() => {
        destroyRoom(room.id, 'inactivity-5m');
      }, FIVE_MINUTES_MS);
    }
  }

  io.on('connection', (socket) => {
    socket.on('secret:create-room', (payload = {}, cb) => {
      const mode = payload.mode === 'every-5m' ? 'every-5m' : 'inactivity-5m';
      const isGroup = Boolean(payload.isGroup);
      const maxMembers = isGroup ? Math.min(Math.max(Number(payload.maxMembers) || 12, 2), 100) : 2;

      const roomId = crypto.randomBytes(10).toString('hex');
      const inviteToken = generateToken();
      const verifyCode = generateSixDigitCode();
      const creatorAnon = formatAnonName((anonCounter % MAX_ANON_POOL) + 1);
      anonCounter = (anonCounter % MAX_ANON_POOL) + 1;

      const room = {
        id: roomId,
        inviteToken,
        tokenUsed: isGroup ? false : false,
        tokenExpiresAt: Date.now() + 10 * 60 * 1000, // 10 min invite window
        verifyCode,
        failedAttempts: 0,
        isGroup,
        maxMembers,
        purgeMode: mode,
        creatorSocketId: socket.id,
        locked: false,
        keyMaterial: crypto.randomBytes(32).toString('hex'),
        members: new Map(),
        messages: [],
        files: [],
        createdAt: Date.now(),
        lastActivity: Date.now(),
        inactivityTimer: null,
        intervalTimer: null
      };

      room.members.set(socket.id, {
        anonName: creatorAnon,
        role: 'admin'
      });

      rooms.set(roomId, room);
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.anonName = creatorAnon;
      scheduleTimers(room);

      if (typeof cb === 'function') {
        cb({
          ok: true,
          roomId,
          inviteToken,
          verifyCode,
          anonName: creatorAnon,
          isGroup,
          maxMembers,
          purgeMode: mode,
          expiresAt: room.tokenExpiresAt,
          members: [...room.members.entries()].map(([id, m]) => ({
            id,
            anonName: m.anonName,
            role: m.role
          }))
        });
      }
    });

    socket.on('secret:verify-and-join', (payload = {}, cb) => {
      const token = String(payload.token || '').trim();
      const code = String(payload.code || '').trim();

      let targetRoom = null;
      for (const room of rooms.values()) {
        if (room.inviteToken === token) {
          targetRoom = room;
          break;
        }
      }

      if (!targetRoom) {
        return typeof cb === 'function' && cb({ ok: false, error: 'Невалиден или изтекъл QR токен.' });
      }
      if (Date.now() > targetRoom.tokenExpiresAt) {
        return typeof cb === 'function' && cb({ ok: false, error: 'QR поканата е изтекла.' });
      }
      if (!targetRoom.isGroup && targetRoom.tokenUsed) {
        return typeof cb === 'function' && cb({ ok: false, error: 'QR кодът вече е използван.' });
      }
      if (targetRoom.failedAttempts >= 5) {
        return typeof cb === 'function' && cb({ ok: false, error: 'Твърде много грешни опити за код.' });
      }
      if (code !== targetRoom.verifyCode) {
        targetRoom.failedAttempts += 1;
        return typeof cb === 'function' && cb({
          ok: false,
          error: `Грешен 6-цифрен код (опит ${targetRoom.failedAttempts}/5).`
        });
      }
      if (targetRoom.members.size >= targetRoom.maxMembers) {
        return typeof cb === 'function' && cb({ ok: false, error: 'Стаята е достигнала лимита си.' });
      }

      if (!targetRoom.isGroup) {
        targetRoom.tokenUsed = true;
      }

      const anonName = nextAnonName(targetRoom);
      targetRoom.members.set(socket.id, { anonName, role: 'member' });
      socket.join(targetRoom.id);
      socket.data.roomId = targetRoom.id;
      socket.data.anonName = anonName;
      touchActivity(targetRoom);

      const membersList = [...targetRoom.members.entries()].map(([id, m]) => ({
        id,
        anonName: m.anonName,
        role: m.role
      }));

      io.to(targetRoom.id).emit('secret:members-updated', { members: membersList });

      if (typeof cb === 'function') {
        cb({
          ok: true,
          roomId: targetRoom.id,
          anonName,
          isGroup: targetRoom.isGroup,
          purgeMode: targetRoom.purgeMode,
          messages: targetRoom.messages,
          files: targetRoom.files.map((f) => ({
            id: f.id,
            name: f.name,
            size: f.size,
            mime: f.mime,
            sender: f.sender,
            encData: f.encData,
            iv: f.iv,
            createdAt: f.createdAt
          })),
          members: membersList
        });
      }
    });

    socket.on('secret:message', (payload = {}, cb) => {
      const roomId = socket.data.roomId;
      const room = roomId ? rooms.get(roomId) : null;
      const member = room ? room.members.get(socket.id) : null;
      if (!room || !member) {
        return typeof cb === 'function' && cb({ ok: false, error: 'Не сте в активна стая.' });
      }

      const cipherText = String(payload.cipherText || '');
      const iv = String(payload.iv || '');
      if (!cipherText || cipherText.length > 20000) {
        return typeof cb === 'function' && cb({ ok: false, error: 'Невалидно съобщение.' });
      }

      const msg = {
        id: crypto.randomBytes(6).toString('hex'),
        sender: member.anonName,
        cipherText,
        iv,
        createdAt: Date.now()
      };

      room.messages.push(msg);
      if (room.messages.length > 300) {
        room.messages.shift();
      }
      touchActivity(room);

      io.to(room.id).emit('secret:message', msg);
      if (typeof cb === 'function') cb({ ok: true, id: msg.id });
    });

    socket.on('secret:file', (payload = {}, cb) => {
      const roomId = socket.data.roomId;
      const room = roomId ? rooms.get(roomId) : null;
      const member = room ? room.members.get(socket.id) : null;
      if (!room || !member) {
        return typeof cb === 'function' && cb({ ok: false, error: 'Не сте в активна стая.' });
      }

      const fileName = pathSafeName(String(payload.name || 'file.bin'));
      const ext = fileName.includes('.') ? '.' + fileName.split('.').pop().toLowerCase() : '';
      const size = Number(payload.size || 0);
      const encData = String(payload.encData || '');
      const iv = String(payload.iv || '');
      const mime = String(payload.mime || 'application/octet-stream').slice(0, 100);

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return typeof cb === 'function' && cb({ ok: false, error: `Неразрешен формат (${ext || 'без разширение'}).` });
      }
      if (!encData || size <= 0 || size > MAX_FILE_BYTES || Buffer.byteLength(encData, 'utf8') > MAX_FILE_BYTES * 2) {
        return typeof cb === 'function' && cb({ ok: false, error: 'Файлът е твърде голям или невалиден (лимит 10 MB).' });
      }

      const fileItem = {
        id: crypto.randomBytes(6).toString('hex'),
        name: fileName,
        size,
        mime,
        sender: member.anonName,
        encData,
        iv,
        createdAt: Date.now()
      };

      room.files.push(fileItem);
      if (room.files.length > 50) {
        room.files.shift();
      }
      touchActivity(room);

      io.to(room.id).emit('secret:file', fileItem);
      if (typeof cb === 'function') cb({ ok: true, id: fileItem.id });
    });

    socket.on('secret:kick', (payload = {}, cb) => {
      const roomId = socket.data.roomId;
      const room = roomId ? rooms.get(roomId) : null;
      const requester = room ? room.members.get(socket.id) : null;
      if (!room || !requester || requester.role !== 'admin') {
        return typeof cb === 'function' && cb({ ok: false, error: 'Само администраторът може да изключва участници.' });
      }

      const targetSocketId = String(payload.targetSocketId || '');
      if (!targetSocketId || targetSocketId === socket.id || !room.members.has(targetSocketId)) {
        return typeof cb === 'function' && cb({ ok: false, error: 'Невалиден участник.' });
      }

      room.members.delete(targetSocketId);
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(room.id);
        targetSocket.data.roomId = null;
        targetSocket.data.anonName = null;
        targetSocket.emit('secret:kicked', { roomId: room.id });
      }

      const membersList = [...room.members.entries()].map(([id, m]) => ({
        id,
        anonName: m.anonName,
        role: m.role
      }));
      io.to(room.id).emit('secret:members-updated', { members: membersList });
      if (typeof cb === 'function') cb({ ok: true });
    });

    socket.on('secret:destroy-room', (_, cb) => {
      const roomId = socket.data.roomId;
      if (!roomId || !rooms.has(roomId)) {
        return typeof cb === 'function' && cb({ ok: false, error: 'Няма активна стая.' });
      }
      destroyRoom(roomId, 'manual-destroy');
      if (typeof cb === 'function') cb({ ok: true });
    });

    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      const room = roomId ? rooms.get(roomId) : null;
      if (!room) return;

      room.members.delete(socket.id);
      if (room.members.size === 0) {
        destroyRoom(room.id, 'empty-room');
        return;
      }

      const membersList = [...room.members.entries()].map(([id, m]) => ({
        id,
        anonName: m.anonName,
        role: m.role
      }));
      io.to(room.id).emit('secret:members-updated', { members: membersList });
    });
  });

  return io;
}

function pathSafeName(raw) {
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file.bin';
}

module.exports = { attachSecretChat };
