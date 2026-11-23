const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { GameEngine, CAT_CARDS, MOUSE_CARDS } = require('./gameEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 20000,
  pingTimeout: 45000
});

app.use(express.static(path.join(__dirname, '../public')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

const rooms = new Map();

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? makeRoomCode() : code;
}

function getRoomPublicLobby(room) {
  return {
    code: room.code,
    hostToken: room.hostToken,
    cheeseMode: room.cheeseMode || 'classic',
    started: Boolean(room.engine),
    seats: room.seats.map(s => ({
      seatKey: s.seatKey,
      team: s.team,
      index: s.index,
      label: s.label,
      playerName: s.playerName,
      connected: Boolean(s.socketId),
      isAI: s.isAI
    }))
  };
}

function broadcastRoom(room) {
  const lobby = getRoomPublicLobby(room);
  room.players.forEach(p => {
    if (!p.socketId) return;
    const sock = io.sockets.sockets.get(p.socketId);
    if (!sock) return;
    const seat = room.seats.find(s => s.token === p.token);
    const team = seat ? seat.team : 'spectator';
    sock.emit('room:update', {
      lobby,
      me: { token: p.token, name: p.name, team, seatKey: seat?.seatKey || null, seatIndex: seat ? seat.index : null, isHost: p.token === room.hostToken },
      game: room.engine ? room.engine.getFilteredState(team) : null
    });
  });
}

function removePlayerFromRoom(socket) {
  const code = socket.data?.roomCode;
  const token = socket.data?.token;
  if (!code || !token) return;
  const room = rooms.get(code);
  if (!room) return;

  socket.leave(code);
  room.players.delete(token);
  room.seats.forEach(s => {
    if (s.token === token) {
      s.token = null;
      s.playerName = null;
      s.socketId = null;
      s.isAI = true;
    }
  });
  socket.data = {};

  if (room.players.size === 0) {
    rooms.delete(code);
    return;
  }
  if (room.hostToken === token) {
    const nextPlayer = room.players.values().next().value;
    if (nextPlayer) room.hostToken = nextPlayer.token;
  }
  broadcastRoom(room);
}

io.on('connection', socket => {
  socket.emit('meta:cards', { CAT_CARDS, MOUSE_CARDS });

  socket.on('room:create', ({ playerName, token }) => {
    removePlayerFromRoom(socket);
    const code = makeRoomCode();
    const pToken = token || crypto.randomBytes(8).toString('hex');
    const room = {
      code,
      hostToken: pToken,
      cheeseMode: 'classic',
      engine: null,
      players: new Map(),
      seats: [
        { seatKey: 'mouse_0', team: 'mouse', index: 0, label: '생쥐 A', token: pToken, playerName: playerName || '생쥐 A', socketId: socket.id, isAI: false },
        { seatKey: 'mouse_1', team: 'mouse', index: 1, label: '생쥐 B', token: null, playerName: null, socketId: null, isAI: true },
        { seatKey: 'cat_0', team: 'cat', index: 0, label: '고양이 1', token: null, playerName: null, socketId: null, isAI: true },
        { seatKey: 'cat_1', team: 'cat', index: 1, label: '고양이 2', token: null, playerName: null, socketId: null, isAI: true },
        { seatKey: 'cat_2', team: 'cat', index: 2, label: '고양이 3', token: null, playerName: null, socketId: null, isAI: true }
      ],
      chat: []
    };
    room.players.set(pToken, { token: pToken, name: playerName || '플레이어', socketId: socket.id });
    rooms.set(code, room);
    socket.join(code);
    socket.data = { roomCode: code, token: pToken };
    broadcastRoom(room);
  });

  socket.on('room:join', ({ code, playerName, token }) => {
    const clean = String(code || '').trim().toUpperCase();
    const room = rooms.get(clean);
    if (!room) return socket.emit('room:error', '존재하지 않는 방 코드입니다.');
    const pToken = token || crypto.randomBytes(8).toString('hex');

    if (room.players.has(pToken)) {
      const existing = room.players.get(pToken);
      existing.socketId = socket.id;
      if (playerName) existing.name = playerName;
      const seat = room.seats.find(s => s.token === pToken);
      if (seat) { seat.socketId = socket.id; seat.playerName = existing.name; }
    } else {
      const name = playerName || `플레이어${room.players.size + 1}`;
      room.players.set(pToken, { token: pToken, name, socketId: socket.id });
      if (!room.engine) {
        const emptySeat = room.seats.find(s => !s.token);
        if (emptySeat) {
          emptySeat.token = pToken;
          emptySeat.playerName = name;
          emptySeat.socketId = socket.id;
          emptySeat.isAI = false;
        }
      }
    }
    socket.join(clean);
    socket.data = { roomCode: clean, token: pToken };
    broadcastRoom(room);
  });

  socket.on('room:leave', () => {
    removePlayerFromRoom(socket);
    socket.emit('room:left');
  });

  socket.on('room:claimSeat', ({ seatKey }) => {
    const room = rooms.get(socket.data?.roomCode);
    if (!room || room.engine) return;
    const token = socket.data.token;
    const player = room.players.get(token);
    const target = room.seats.find(s => s.seatKey === seatKey);
    if (!target || (target.token && target.token !== token)) return;

    room.seats.forEach(s => {
      if (s.token === token) { s.token = null; s.playerName = null; s.socketId = null; s.isAI = true; }
    });
    target.token = token;
    target.playerName = player.name;
    target.socketId = socket.id;
    target.isAI = false;
    broadcastRoom(room);
  });

  socket.on('room:setMode', ({ cheeseMode }) => {
    const room = rooms.get(socket.data?.roomCode);
    if (!room || room.engine || room.hostToken !== socket.data.token) return;
    room.cheeseMode = cheeseMode === 'three' ? 'three' : 'classic';
    broadcastRoom(room);
  });

  socket.on('room:start', () => {
    const room = rooms.get(socket.data?.roomCode);
    if (!room || room.hostToken !== socket.data.token) return;
    const seatCfg = {
      mice: room.seats.filter(s => s.team === 'mouse').map(s => ({ name: s.playerName || s.label, isAI: !s.token })),
      cats: room.seats.filter(s => s.team === 'cat').map(s => ({ name: s.playerName || s.label, isAI: !s.token }))
    };
    room.engine = new GameEngine(seatCfg, { cheeseMode: room.cheeseMode });
    broadcastRoom(room);
  });

  socket.on('game:action', payload => {
    const room = rooms.get(socket.data?.roomCode);
    if (!room || !room.engine) return;
    const seat = room.seats.find(s => s.token === socket.data.token);
    if (!seat) return socket.emit('room:error', '관전자는 행동할 수 없습니다.');

    let res = { error: '알 수 없는 명령' };
    const { type } = payload;

    if (seat.team === 'mouse') {
      if (type === 'placeCheese') {
        res = room.engine.placeCheese(payload.nodeId);
      } else if (type === 'placeMouseStart') {
        if (room.engine.state.setupMouseIdx !== seat.index) {
          res = { error: '본인 차례의 생쥐 시작 위치만 선택할 수 있습니다!' };
        } else {
          res = room.engine.placeMouseStart(payload.nodeId);
        }
      } else if (type === 'stageMouseMove') {
        if (payload.mouseId !== seat.index) {
          res = { error: '다른 플레이어의 생쥐 말은 움직일 수 없습니다!' };
        } else {
          res = room.engine.stageMouseMove(seat.index, payload.nodeId, payload.cardType || null);
        }
      } else if (type === 'confirmMouseTurn') {
        res = room.engine.confirmMouseTurn();
      }
    } else if (seat.team === 'cat') {
      if (type === 'placeCatStart') {
        if (room.engine.state.setupCatIdx !== seat.index) {
          res = { error: '본인 차례의 고양이만 배치할 수 있습니다!' };
        } else {
          res = room.engine.placeCatStart(payload.edgeId);
        }
      } else if (type === 'catAction') {
        if (payload.catId !== seat.index) {
          res = { error: '다른 플레이어의 고양이 말은 움직일 수 없습니다!' };
        } else {
          res = room.engine.catAction({ ...payload, catId: seat.index });
        }
      } else if (type === 'selectDraftCard') {
        res = room.engine.selectDraftCard(payload.cardIdx, payload.catId);
      }
    }

    if (res.error) socket.emit('room:error', res.error);
    else broadcastRoom(room);
  });

  socket.on('chat:send', ({ channel, text }) => {
    const room = rooms.get(socket.data?.roomCode);
    if (!room || !text || !String(text).trim()) return;
    const token = socket.data.token;
    const player = room.players.get(token);
    const seat = room.seats.find(s => s.token === token);
    const msg = {
      id: Date.now(),
      sender: player?.name || '익명',
      team: seat?.team || 'spectator',
      channel: channel === 'team' ? (seat?.team || 'public') : 'public',
      text: String(text).trim().slice(0, 200)
    };
    room.players.forEach(p => {
      if (!p.socketId) return;
      const pSeat = room.seats.find(s => s.token === p.token);
      if (msg.channel === 'public' || msg.channel === pSeat?.team) {
        io.to(p.socketId).emit('chat:msg', msg);
      }
    });
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data?.roomCode);
    if (!room) return;
    const token = socket.data.token;
    const p = room.players.get(token);
    if (p && p.socketId === socket.id) p.socketId = null;
    const seat = room.seats.find(s => s.token === token);
    if (seat && seat.socketId === socket.id) seat.socketId = null;
    broadcastRoom(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🧀 치즈를 훔쳐라! 멀티 서버 실행 중: http://localhost:${PORT}`);
});
