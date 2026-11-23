const socket = io();
let GRAPH = null;
let ASSETS = null;
const IMGS = {};
let NODES = {};
let EDGES = {};
let RED_EDGES = [];
let NODE_ADJ = {};
let EDGE_ADJ = {};

let roomState = null; // { lobby, me, game }
let localUI = {
  selectedMouseId: 0,
  selectedMouseCard: null,
  selectedCatId: null,
  catMoveEdge: null,
  catMode: 'search', // 'search' | 'capture'
  searchNodes: new Set(),
  draftCardIdx: null
};

const QUAD_START_BLACKS = {
  0: [1, 2, 3, 11, 12, 13],
  1: [8, 9, 10, 18, 19, 20],
  2: [131, 132, 133, 141, 142, 143],
  3: [138, 139, 140, 148, 149, 150]
};

function getStoredToken() {
  try {
    let t = localStorage.getItem('stc_token');
    if (!t) {
      t = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('stc_token', t);
    }
    return t;
  } catch { return 'tok_' + Math.random().toString(36).slice(2); }
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 2600);
}

async function bootAssets() {
  const [gRes, aRes] = await Promise.all([
    fetch('/data/board_graph.json'),
    fetch('/data/assets_bundle.json')
  ]);
  GRAPH = await gRes.json();
  ASSETS = await aRes.json();

  GRAPH.nodes.forEach(n => { NODES[n.id] = n; NODE_ADJ[n.id] = []; });
  const nodeEdges = {};
  GRAPH.nodes.forEach(n => { nodeEdges[n.id] = []; });
  GRAPH.edges.forEach(e => {
    EDGES[e.id] = e;
    if (e.red) RED_EDGES.push(e.id);
    nodeEdges[e.u].push(e.id);
    nodeEdges[e.v].push(e.id);
    NODE_ADJ[e.u].push({ to: e.v, edgeId: e.id });
    NODE_ADJ[e.v].push({ to: e.u, edgeId: e.id });
  });
  GRAPH.edges.forEach(e => {
    const s = new Set();
    nodeEdges[e.u].forEach(id => { if (id !== e.id) s.add(id); });
    nodeEdges[e.v].forEach(id => { if (id !== e.id) s.add(id); });
    EDGE_ADJ[e.id] = Array.from(s);
  });

  Object.entries(ASSETS).forEach(([k, uri]) => {
    const im = new Image();
    im.onload = () => renderBoard();
    im.src = uri;
    IMGS[k] = im;
  });

  // Auto-rejoin if URL has ?room=XXXX
  const params = new URLSearchParams(location.search);
  const qRoom = params.get('room');
  if (qRoom) {
    document.getElementById('inpCode').value = qRoom.toUpperCase();
  }
}

// === SOCKET EVENTS ===
socket.on('connect', () => {
  document.getElementById('roomMeta').textContent = '실시간 서버 연결됨';
  try {
    const savedRoom = localStorage.getItem('stc_room');
    const savedName = localStorage.getItem('stc_name');
    if (savedRoom) {
      socket.emit('room:join', { code: savedRoom, playerName: savedName || '플레이어', token: getStoredToken() });
    }
  } catch {}
});

socket.on('room:error', msg => showToast('⚠️ ' + msg));

socket.on('room:update', data => {
  roomState = data;
  try { localStorage.setItem('stc_room', data.lobby.code); } catch {}
  renderAll();
});

socket.on('chat:msg', msg => {
  const box = document.getElementById('chatBox');
  const div = document.createElement('div');
  const tag = msg.channel === 'public' ? '[전체]' : (msg.channel === 'mouse' ? '[🐭비밀]' : '[🐱팀]');
  const col = msg.channel === 'mouse' ? 'text-sky-300' : msg.channel === 'cat' ? 'text-orange-300' : 'text-stone-300';
  div.className = 'p-1.5 rounded bg-stone-900/70';
  div.innerHTML = `<span class="font-bold ${col}">${tag} ${msg.sender}:</span> <span class="text-stone-100"></span>`;
  div.querySelector('span:last-child').textContent = msg.text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
});

// === LOBBY ACTIONS ===
document.getElementById('btnCreateRoom').addEventListener('click', () => {
  const name = document.getElementById('inpName').value.trim() || '방장';
  try { localStorage.setItem('stc_name', name); } catch {}
  socket.emit('room:create', { playerName: name, token: getStoredToken() });
});

document.getElementById('btnJoinRoom').addEventListener('click', () => {
  const name = document.getElementById('inpName').value.trim() || '참가자';
  const code = document.getElementById('inpCode').value.trim().toUpperCase();
  if (code.length !== 4) return showToast('4자리 방 코드를 입력하세요.');
  try { localStorage.setItem('stc_name', name); } catch {}
  socket.emit('room:join', { code, playerName: name, token: getStoredToken() });
});

document.getElementById('btnStartOnline').addEventListener('click', () => socket.emit('room:start'));

document.getElementById('btnCopyRoom').addEventListener('click', () => {
  if (!roomState) return;
  const url = `${location.origin}/?room=${roomState.lobby.code}`;
  navigator.clipboard?.writeText(url).then(() => showToast(`방 링크 복사됨: ${roomState.lobby.code}`)).catch(() => showToast(`방 코드: ${roomState.lobby.code}`));
});

document.getElementById('chatForm').addEventListener('submit', e => {
  e.preventDefault();
  const inp = document.getElementById('chatInput');
  if (!inp.value.trim()) return;
  socket.emit('chat:send', { channel: document.getElementById('chatChannel').value, text: inp.value });
  inp.value = '';
});

// === RENDERING ===
function renderAll() {
  if (!roomState) return;
  const { lobby, me, game } = roomState;
  document.getElementById('roomMeta').textContent = `방 코드: ${lobby.code}`;
  document.getElementById('btnCopyRoom').classList.remove('hidden');

  if (!game) {
    document.getElementById('lobbyView').classList.remove('hidden');
    document.getElementById('gameView').classList.add('hidden');
    document.getElementById('entryForms').classList.add('hidden');
    document.getElementById('waitingRoom').classList.remove('hidden');
    document.getElementById('displayRoomCode').textContent = lobby.code;
    document.getElementById('myTeamBadge').textContent = me.team === 'mouse' ? '🐭 생쥐 팀' : me.team === 'cat' ? '🐱 고양이 팀' : '👀 관전자';

    document.getElementById('seatList').innerHTML = lobby.seats.map(s => `
      <button onclick="claimSeat('${s.seatKey}')" class="p-2.5 rounded-xl border text-left transition ${s.seatKey === me.seatKey ? 'bg-amber-500/20 border-amber-400' : 'bg-stone-900/70 border-stone-700 hover:border-stone-500'}">
        <div class="text-xs font-bold ${s.team === 'mouse' ? 'text-sky-300' : 'text-orange-300'}">${s.label}</div>
        <div class="text-[11px] text-stone-300 mt-0.5">${s.playerName ? `${s.playerName} ${s.connected ? '🟢' : '🔴'}` : '🤖 빈 자리 (AI 자동 배정)'}</div>
      </button>
    `).join('');

    if (me.isHost) {
      document.getElementById('btnStartOnline').classList.remove('hidden');
      document.getElementById('waitHostHint').classList.add('hidden');
    }
    return;
  }

  // Active Game
  document.getElementById('lobbyView').classList.add('hidden');
  document.getElementById('gameView').classList.remove('hidden');
  document.getElementById('roundBadge').classList.remove('hidden');
  document.getElementById('phaseBadge').classList.remove('hidden');
  document.getElementById('roundBadge').textContent = `${game.round} / 3 라운드`;
  document.getElementById('phaseBadge').textContent = game.phase;

  const roleChip = document.getElementById('myRoleChip');
  roleChip.textContent = me.team === 'mouse' ? '🐭 생쥐 팀 시점' : me.team === 'cat' ? '🐱 고양이 팀 시점' : '👀 관전';
  roleChip.className = `px-2.5 py-0.5 rounded-full text-xs font-bold ${me.team === 'mouse' ? 'bg-sky-500/20 text-sky-300' : 'bg-orange-500/20 text-orange-300'}`;

  // 15-Turn Track
  const track = document.getElementById('turnTrack');
  track.innerHTML = '';
  for (let t = 1; t <= 15; t++) {
    const d = document.createElement('div');
    d.className = `turn-pip border ${t === game.turn ? 'bg-amber-500 text-stone-950 border-amber-300' : 'bg-stone-900 text-stone-400 border-stone-700'}`;
    d.textContent = t;
    track.appendChild(d);
  }

  renderControls(game, me);
  document.getElementById('publicLog').innerHTML = game.publicLog.map(item =>
    `<div class="p-1.5 rounded bg-stone-900/70"><span class="text-amber-400 font-bold mr-1">[${item.turn}]</span>${item.msg}</div>`
  ).join('');
  resizeCanvas();
}

window.claimSeat = seatKey => socket.emit('room:claimSeat', { seatKey });

function renderControls(game, me) {
  const inst = document.getElementById('instructionText');
  const el = document.getElementById('controlPanel');

  if (game.phase === 'GAME_OVER') {
    inst.textContent = `🏆 ${game.winReason}`;
    el.innerHTML = `<div class="text-center py-4 space-y-2"><div class="text-2xl font-extrabold text-amber-300">${game.winner === 'mouse' ? '생쥐 팀 승리!' : '고양이 팀 승리!'}</div><div class="text-xs text-stone-300">${game.winReason}</div></div>`;
    return;
  }

  if (game.phase === 'SETUP_CHEESE') {
    inst.textContent = me.team === 'mouse' ? '하얀 원형 칸을 클릭해 치즈를 비밀리에 배치하세요.' : '생쥐 팀이 치즈를 비밀리에 배치하는 중입니다...';
    el.innerHTML = `<div class="text-xs text-stone-300">배치된 치즈: ${me.team === 'mouse' ? game.cheeses.map(c => '#' + c.nodeId).join(', ') || '없음' : '비공개'}</div>`;
  } else if (game.phase === 'SETUP_MICE') {
    inst.textContent = me.team === 'mouse' ? `생쥐 ${game.setupMouseIdx === 0 ? 'A' : 'B'}의 시작 위치(하이라이트 검은 칸)를 클릭하세요.` : '생쥐 팀이 시작 위치를 고르는 중입니다...';
    el.innerHTML = `<div class="text-xs text-stone-300">생쥐 팀 세팅 진행 중...</div>`;
  } else if (game.phase === 'SETUP_CATS') {
    inst.textContent = me.team === 'cat' ? `고양이 ${game.setupCatIdx + 1}을 중앙의 붉은 교차로에 배치하세요.` : '고양이 팀이 붉은 교차로에 말을 배치하는 중입니다...';
    el.innerHTML = `<div class="text-xs text-orange-300">${game.cats.map(c => `${c.name}: [${c.cards[0].name}]`).join('<br/>')}</div>`;
  } else if (game.phase === 'MOUSE_TURN') {
    inst.textContent = me.team === 'mouse' ? '생쥐 A, B의 다음 이동 칸을 클릭하고 [턴 확정]을 누르세요.' : '생쥐 팀이 비밀리에 이동 경로를 기록 중입니다...';
    if (me.team !== 'mouse') {
      el.innerHTML = `<div class="text-xs text-stone-400 py-4 text-center">생쥐 팀의 이동을 기다리는 중...</div>`;
      return;
    }
    const allMoved = game.mice.every(m => m.delivered || m.movedThisTurn);
    el.innerHTML = `
      <div class="grid grid-cols-2 gap-2">
        ${game.mice.map(m => `
          <button onclick="pickMouse(${m.id})" class="p-2 rounded-xl border text-left ${localUI.selectedMouseId === m.id ? 'bg-sky-500/20 border-sky-400' : 'bg-stone-900 border-stone-700'}">
            <div class="text-xs font-bold text-white">${m.name}</div>
            <div class="text-[11px] text-amber-300">${m.delivered ? '🕳️ 배달 완료' : m.movedThisTurn ? `✓ #${m.pendingPos}` : `현재 #${m.pos}`}</div>
          </button>`).join('')}
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        ${['sprint', 'wall', 'hole'].map(cid => {
          const m = game.mice[localUI.selectedMouseId];
          const label = cid === 'sprint' ? '질주' : cid === 'wall' ? '담넘기' : '쥐구멍';
          const avail = m?.cards?.[cid];
          return `<button ${avail ? '' : 'disabled'} onclick="toggleMCard('${cid}')" class="py-1.5 rounded-lg text-xs font-bold border ${localUI.selectedMouseCard === cid ? 'bg-amber-500 text-stone-950 border-amber-300' : 'bg-stone-900 text-stone-200 border-stone-700'} ${avail ? '' : 'opacity-35'}">${label}</button>`;
        }).join('')}
      </div>
      <button ${allMoved ? '' : 'disabled'} onclick="confirmMouse()" class="w-full py-2.5 rounded-xl font-extrabold text-xs ${allMoved ? 'bg-sky-500 text-stone-950' : 'bg-stone-800 text-stone-500'}">생쥐 턴 확정</button>
    `;
  } else if (game.phase === 'CAT_TURN') {
    inst.textContent = me.team === 'cat' ? '고양이를 고르고 교차로 이동 후 수색 또는 포획을 실행하세요.' : '고양이 팀이 추격 중입니다...';
    if (me.team !== 'cat') {
      el.innerHTML = `<div class="text-xs text-stone-400 py-4 text-center">고양이 팀의 추격을 지켜보는 중...</div>`;
      return;
    }
    el.innerHTML = `
      <div class="space-y-1.5">
        ${game.cats.map(c => `
          <button ${c.actedThisTurn ? 'disabled' : ''} onclick="pickCat(${c.id})" class="w-full p-2 rounded-xl border text-left flex items-center justify-between ${localUI.selectedCatId === c.id ? 'bg-orange-500/20 border-orange-400' : 'bg-stone-900 border-stone-700'} ${c.actedThisTurn ? 'opacity-45' : ''}">
            <span class="text-xs font-bold text-white">${c.name} (${c.cards.map(x => x.name).join(', ')})</span>
            <span class="text-[11px] text-amber-300">${c.actedThisTurn ? '✓ 완료' : '선택'}</span>
          </button>`).join('')}
      </div>
      ${localUI.selectedCatId !== null && localUI.catMoveEdge !== null ? `
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button onclick="execCatSearch()" class="py-2 rounded-lg bg-emerald-500 text-stone-950 font-extrabold text-xs">🔍 인접 전체 수색</button>
          <button onclick="setCatCaptureMode()" class="py-2 rounded-lg ${localUI.catMode === 'capture' ? 'bg-red-500 text-white' : 'bg-stone-800 text-red-300'} font-extrabold text-xs">🎯 포획 대상 클릭</button>
        </div>` : `<div class="text-[11px] text-stone-400">행동할 고양이를 고른 뒤 보드에서 이동할 교차로를 클릭하세요.</div>`}
    `;
  } else if (game.phase === 'DRAFT') {
    inst.textContent = me.team === 'cat' ? '라운드 종료! 증강 카드 3장 중 1장을 골라 고양이에 장착하세요.' : '고양이 팀이 증강 카드를 선택하는 중입니다...';
    if (me.team !== 'cat') { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="space-y-2">
        ${game.draftOptions.map((c, idx) => `
          <button onclick="pickDraft(${idx})" class="w-full p-2 rounded-xl border text-left ${localUI.draftCardIdx === idx ? 'bg-amber-500/20 border-amber-400' : 'bg-stone-900 border-stone-700'}">
            <div class="text-xs font-bold text-amber-300">${c.name}</div>
            <div class="text-[11px] text-stone-300">${c.desc}</div>
          </button>`).join('')}
        ${localUI.draftCardIdx !== null ? `<div class="flex gap-1.5">${game.cats.map(c => `<button onclick="equipDraft(${c.id})" class="flex-1 py-1.5 rounded-lg bg-orange-500 text-stone-950 font-bold text-xs">${c.name} 장착</button>`).join('')}</div>` : ''}
      </div>`;
  }
}

window.pickMouse = id => { localUI.selectedMouseId = id; localUI.selectedMouseCard = null; renderAll(); };
window.toggleMCard = cid => { localUI.selectedMouseCard = localUI.selectedMouseCard === cid ? null : cid; renderAll(); };
window.confirmMouse = () => socket.emit('game:action', { type: 'confirmMouseTurn' });
window.pickCat = id => { localUI.selectedCatId = id; localUI.catMoveEdge = roomState.game.cats[id].edgeId; localUI.catMode = 'search'; renderAll(); };
window.setCatCaptureMode = () => { localUI.catMode = 'capture'; showToast('포획할 인접 원형 칸을 보드에서 클릭하세요!'); renderAll(); };
window.execCatSearch = () => {
  const e = EDGES[localUI.catMoveEdge];
  socket.emit('game:action', { type: 'catAction', catId: localUI.selectedCatId, edgeId: localUI.catMoveEdge, actionType: 'search', targetNodes: [e.u, e.v] });
  localUI.selectedCatId = null; localUI.catMoveEdge = null;
};
window.pickDraft = idx => { localUI.draftCardIdx = idx; renderAll(); };
window.equipDraft = catId => {
  socket.emit('game:action', { type: 'selectDraftCard', cardIdx: localUI.draftCardIdx, catId });
  localUI.draftCardIdx = null;
};

// === CANVAS ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const wrap = document.getElementById('boardWrap');
  if (!wrap) return;
  const r = wrap.getBoundingClientRect();
  if (!r.width) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  renderBoard();
}

function drawSprite(key, bx, by, size) {
  const im = IMGS[key];
  if (!im || !im.complete || !GRAPH) return;
  const sc = canvas.width / GRAPH.width;
  const s = size * sc;
  ctx.drawImage(im, bx * sc - s / 2, by * sc - s / 2, s, s);
}

function drawRing(bx, by, rad, stroke, fill = null) {
  const sc = canvas.width / GRAPH.width;
  ctx.beginPath();
  ctx.arc(bx * sc, by * sc, rad * sc, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 4 * sc;
  ctx.stroke();
}

function renderBoard() {
  if (!GRAPH || !canvas.width) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (IMGS.board?.complete) ctx.drawImage(IMGS.board, 0, 0, canvas.width, canvas.height);
  if (!roomState?.game) return;

  const { game, me } = roomState;
  game.cluesPast.forEach(nid => { ctx.save(); ctx.globalAlpha = 0.45; drawSprite('token_clue', NODES[nid].x, NODES[nid].y, 44); ctx.restore(); });
  game.cluesCurrent.forEach(nid => drawSprite('token_clue', NODES[nid].x, NODES[nid].y, 48));
  game.stolenTokens.forEach(t => drawSprite('token_cheese', NODES[t.nodeId].x, NODES[t.nodeId].y, 50));

  // Secret data (server only sends these to Mouse Team or at Game Over!)
  game.cheeses.forEach(c => {
    if (c.stolenBy !== null) return;
    drawRing(NODES[c.nodeId].x, NODES[c.nodeId].y, 24, '#f59e0b', 'rgba(245,158,11,0.35)');
  });
  game.mice.forEach(m => {
    const p = m.pendingPos ?? m.pos;
    if (!p) return;
    drawRing(NODES[p].x, NODES[p].y, 24, m.id === 0 ? '#38bdf8' : '#a855f7', 'rgba(15,23,42,0.55)');
    drawSprite(m.img, NODES[p].x, NODES[p].y, 38);
  });

  // Highlights for Cat start or move
  if (game.phase === 'SETUP_CATS' && me.team === 'cat') {
    RED_EDGES.forEach(eid => {
      if (!game.cats.some(c => c.edgeId === eid)) drawRing(EDGES[eid].x, EDGES[eid].y, 18, '#ef4444', 'rgba(239,68,68,0.35)');
    });
  }
  if (game.phase === 'CAT_TURN' && me.team === 'cat' && localUI.selectedCatId !== null && localUI.catMoveEdge !== null) {
    drawRing(EDGES[localUI.catMoveEdge].x, EDGES[localUI.catMoveEdge].y, 22, '#facc15', 'rgba(250,204,21,0.28)');
  }

  game.cats.forEach(c => {
    if (c.edgeId === null) return;
    drawSprite(c.img, EDGES[c.edgeId].x, EDGES[c.edgeId].y, 38);
  });
}

canvas.addEventListener('click', ev => {
  if (!roomState?.game || !GRAPH) return;
  const { game, me } = roomState;
  const rect = canvas.getBoundingClientRect();
  const bx = ((ev.clientX - rect.left) / rect.width) * GRAPH.width;
  const by = ((ev.clientY - rect.top) / rect.height) * GRAPH.height;

  let hitNode = null, nd = 28;
  GRAPH.nodes.forEach(n => { const d = Math.hypot(n.x - bx, n.y - by); if (d < nd) { nd = d; hitNode = n.id; } });
  let hitEdge = null, ed = 24;
  GRAPH.edges.forEach(e => { const d = Math.hypot(e.x - bx, e.y - by); if (d < ed) { ed = d; hitEdge = e.id; } });

  if (game.phase === 'SETUP_CHEESE' && me.team === 'mouse' && hitNode) {
    socket.emit('game:action', { type: 'placeCheese', nodeId: hitNode });
  } else if (game.phase === 'SETUP_MICE' && me.team === 'mouse' && hitNode) {
    socket.emit('game:action', { type: 'placeMouseStart', nodeId: hitNode });
  } else if (game.phase === 'SETUP_CATS' && me.team === 'cat' && hitEdge !== null) {
    socket.emit('game:action', { type: 'placeCatStart', edgeId: hitEdge });
  } else if (game.phase === 'MOUSE_TURN' && me.team === 'mouse' && hitNode) {
    socket.emit('game:action', { type: 'stageMouseMove', mouseId: localUI.selectedMouseId, nodeId: hitNode, cardType: localUI.selectedMouseCard });
    localUI.selectedMouseCard = null;
  } else if (game.phase === 'CAT_TURN' && me.team === 'cat') {
    if (localUI.catMode === 'capture' && localUI.selectedCatId !== null && localUI.catMoveEdge !== null && hitNode) {
      socket.emit('game:action', { type: 'catAction', catId: localUI.selectedCatId, edgeId: localUI.catMoveEdge, actionType: 'capture', targetNodes: [hitNode] });
      localUI.selectedCatId = null; localUI.catMoveEdge = null; localUI.catMode = 'search';
    } else if (localUI.selectedCatId !== null && hitEdge !== null) {
      localUI.catMoveEdge = hitEdge;
      renderAll();
    }
  }
});

window.addEventListener('resize', resizeCanvas);
bootAssets();
