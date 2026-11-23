const socket = io();
let GRAPH = null;
let ASSETS = null;
let CARD_META = null;
const IMGS = {};
let NODES = {};
let EDGES = {};
let RED_EDGES = [];
let NODE_ADJ = {};
let EDGE_ADJ = {};
let WALL_ADJ = {};

const HOLES = [2, 9, 142, 149];
const OPPOSITE_HOLE = { 2: 149, 149: 2, 9: 142, 142: 9 };
const QUAD_NAMES = ['좌상(1구역)', '우상(2구역)', '좌하(3구역)', '우하(4구역)'];
const QUAD_START_BLACKS = {
  0: [1, 2, 3, 11, 12, 13],
  1: [8, 9, 10, 18, 19, 20],
  2: [131, 132, 133, 141, 142, 143],
  3: [138, 139, 140, 148, 149, 150]
};

let roomState = null; // { lobby, me, game }
let localUI = {
  selectedMouseId: 0,
  selectedMouseCard: null,
  selectedCatId: null,
  catMoveEdge: null,
  catMode: 'search', // 'search' | 'capture'
  draftCardIdx: null
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
  WALL_ADJ = GRAPH.wallAdj || {};

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

  if (CARD_META) renderAugmentGuide();

  const params = new URLSearchParams(location.search);
  const qRoom = params.get('room');
  if (qRoom) document.getElementById('inpCode').value = qRoom.toUpperCase();
}

// === CLIENT-SIDE LEGAL MOVE GUIDELINE CALCULATORS ===
function catHasCard(cat, cardId) {
  return (cat.cards || []).some(c => c.id === cardId || c.copiedId === cardId);
}

function getCatOccupiedEdges(game, excludeCatId = -1) {
  const s = new Set();
  game.cats.forEach(c => { if (c.id !== excludeCatId && c.edgeId !== null) s.add(c.edgeId); });
  if (game.cloneCat?.active && game.cloneCat.edgeId !== null) s.add(game.cloneCat.edgeId);
  return s;
}

function catHasLonelyBonus(game, cat) {
  if (!catHasCard(cat, 'bronze_4') || cat.edgeId === null) return false;
  const myQ = NODES[EDGES[cat.edgeId].u].q;
  return !game.cats.some(o => o.id !== cat.id && o.edgeId !== null && NODES[EDGES[o.edgeId].u].q === myQ);
}

function getCatAdjacentNodes(edgeId, extraRange = false) {
  const e = EDGES[edgeId];
  if (!e) return [];
  const base = new Set([e.u, e.v]);
  if (extraRange) {
    [e.u, e.v].forEach(nid => (NODE_ADJ[nid] || []).forEach(({ to }) => base.add(to)));
  }
  return Array.from(base);
}

function getCatReachableEdges(game, catId) {
  const cat = game.cats[catId];
  if (!cat || cat.edgeId === null) return [];
  if (catHasCard(cat, 'gold_1')) return [cat.edgeId];
  const occ = getCatOccupiedEdges(game, catId);
  if (catHasCard(cat, 'silver_5') && (cat.failedSearches || 0) >= 5) {
    return GRAPH.edges.map(e => e.id).filter(eid => eid === cat.edgeId || !occ.has(eid));
  }
  const maxSteps = (cat.sprintMode && catHasCard(cat, 'silver_1')) ? 3 : 2;
  const dist = { [cat.edgeId]: 0 };
  const q = [cat.edgeId];
  while (q.length) {
    const cur = q.shift();
    if (dist[cur] >= maxSteps) continue;
    for (const nxt of (EDGE_ADJ[cur] || [])) {
      if (dist[nxt] === undefined) {
        dist[nxt] = dist[cur] + 1;
        q.push(nxt);
      }
    }
  }
  return Object.keys(dist).map(Number).filter(eid => eid === cat.edgeId || !occ.has(eid));
}

function getMouseLegalMoves(game, mouseId, cardType = null) {
  const m = game.mice[mouseId];
  if (!m || m.delivered || m.pos == null) return [];
  const other = game.mice[1 - mouseId];
  const otherPos = other.delivered ? null : (other.pendingPos ?? other.pos);
  const catEdges = getCatOccupiedEdges(game);
  const blocked = (game.blockedNode && game.blockedNodeRound === game.round) ? game.blockedNode : null;
  const usedHoles = new Set(game.usedHolesThisRound || []);
  const out = new Set();

  if (!cardType) {
    (NODE_ADJ[m.pos] || []).forEach(({ to, edgeId }) => {
      if (catEdges.has(edgeId) || to === otherPos || to === blocked) return;
      if (HOLES.includes(to) && usedHoles.has(to) && m.hasCheese) return;
      out.add(to);
    });
  } else if (cardType === 'sprint' && m.cards?.sprint) {
    (NODE_ADJ[m.pos] || []).forEach(({ to: mid }) => {
      if (mid === blocked) return;
      (NODE_ADJ[mid] || []).forEach(({ to }) => {
        if (to === m.pos || to === otherPos || to === blocked) return;
        if (HOLES.includes(to) && usedHoles.has(to) && m.hasCheese) return;
        out.add(to);
      });
    });
  } else if (cardType === 'wall' && m.cards?.wall) {
    (WALL_ADJ[String(m.pos)] || []).forEach(to => {
      if (to === otherPos || to === blocked) return;
      if (HOLES.includes(to) && usedHoles.has(to) && m.hasCheese) return;
      out.add(to);
    });
  } else if (cardType === 'hole' && m.cards?.hole && HOLES.includes(m.pos)) {
    const opp = OPPOSITE_HOLE[m.pos];
    if (opp && opp !== otherPos && opp !== blocked && !(usedHoles.has(opp) && m.hasCheese)) {
      out.add(opp);
    }
  }
  return Array.from(out);
}

// === SOCKET EVENTS ===
socket.on('meta:cards', meta => {
  CARD_META = meta;
  if (ASSETS) renderAugmentGuide();
});

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

socket.on('room:left', () => {
  roomState = null;
  localUI = { selectedMouseId: 0, selectedMouseCard: null, selectedCatId: null, catMoveEdge: null, catMode: 'search', draftCardIdx: null };
  try { localStorage.removeItem('stc_room'); } catch {}
  document.getElementById('roomMeta').textContent = '실시간 서버 연결됨';
  document.getElementById('roundBadge').classList.add('hidden');
  document.getElementById('phaseBadge').classList.add('hidden');
  document.getElementById('turnTrack').innerHTML = '';
  document.getElementById('btnCopyRoom').classList.add('hidden');
  document.getElementById('btnLeaveRoom').classList.add('hidden');
  document.getElementById('gameView').classList.add('hidden');
  document.getElementById('lobbyView').classList.remove('hidden');
  document.getElementById('entryForms').classList.remove('hidden');
  document.getElementById('waitingRoom').classList.add('hidden');
  document.getElementById('chatBox').innerHTML = '';
  showToast('방에서 나왔습니다.');
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

// === LOBBY & HEADER ACTIONS ===
function leaveCurrentRoom() {
  try { localStorage.removeItem('stc_room'); } catch {}
  socket.emit('room:leave');
}

document.getElementById('btnLeaveRoom').addEventListener('click', leaveCurrentRoom);
document.getElementById('btnLeaveLobby').addEventListener('click', leaveCurrentRoom);

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

// === GUIDE & CARD ZOOM MODALS ===
window.zoomCard = (imgKey, tierLabel, name, desc) => {
  document.getElementById('zoomImg').src = ASSETS?.[imgKey] || '';
  document.getElementById('zoomTier').textContent = tierLabel || '';
  document.getElementById('zoomTitle').textContent = name || '';
  document.getElementById('zoomDesc').textContent = desc || '';
  document.getElementById('cardZoomModal').classList.remove('hidden');
};
document.getElementById('btnCloseZoom').addEventListener('click', () => document.getElementById('cardZoomModal').classList.add('hidden'));

document.getElementById('btnGuide').addEventListener('click', () => {
  renderAugmentGuide();
  document.getElementById('guideModal').classList.remove('hidden');
});
document.getElementById('btnCloseGuide').addEventListener('click', () => document.getElementById('guideModal').classList.add('hidden'));
document.getElementById('tabAugmentsBtn').addEventListener('click', () => {
  document.getElementById('augmentsTabContent').classList.remove('hidden');
  document.getElementById('rulesTabContent').classList.add('hidden');
  document.getElementById('tabAugmentsBtn').className = 'px-3 py-1.5 text-xs font-bold border-b-2 border-amber-400 text-amber-300';
  document.getElementById('tabRulesBtn').className = 'px-3 py-1.5 text-xs font-bold border-b-2 border-transparent text-stone-400 hover:text-stone-200';
});
document.getElementById('tabRulesBtn').addEventListener('click', () => {
  document.getElementById('augmentsTabContent').classList.add('hidden');
  document.getElementById('rulesTabContent').classList.remove('hidden');
  document.getElementById('tabRulesBtn').className = 'px-3 py-1.5 text-xs font-bold border-b-2 border-amber-400 text-amber-300';
  document.getElementById('tabAugmentsBtn').className = 'px-3 py-1.5 text-xs font-bold border-b-2 border-transparent text-stone-400 hover:text-stone-200';
});

function escAttr(str) {
  return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function renderAugmentGuide() {
  if (!CARD_META || !ASSETS) return;
  const sections = [
    { title: '🥉 1단계 · 브론즈 증강 (고양이 초기 장착)', color: 'text-orange-300', cards: CARD_META.CAT_CARDS.bronze.map(c => ({ ...c, imgKey: c.id, tierLabel: '1단계 · 브론즈' })) },
    { title: '🥈 2단계 · 실버 증강 (1라운드 종료 드래프트)', color: 'text-slate-200', cards: CARD_META.CAT_CARDS.silver.map(c => ({ ...c, imgKey: c.id, tierLabel: '2단계 · 실버' })) },
    { title: '🥇 3단계 · 골드 증강 (2라운드 종료 드래프트)', color: 'text-amber-300', cards: CARD_META.CAT_CARDS.gold.map(c => ({ ...c, imgKey: c.id, tierLabel: '3단계 · 골드' })) },
    { title: '🐭 생쥐 전용 특수 이동 카드 (게임 중 각 1회)', color: 'text-sky-300', cards: CARD_META.MOUSE_CARDS.map(c => ({ ...c, tierLabel: '생쥐 능력 카드' })) }
  ];
  document.getElementById('augmentsTabContent').innerHTML = sections.map(sec => `
    <div class="space-y-2">
      <h3 class="text-sm font-extrabold ${sec.color}">${sec.title}</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
        ${sec.cards.map(c => `
          <button onclick="zoomCard('${c.imgKey}','${escAttr(c.tierLabel)}','${escAttr(c.name)}','${escAttr(c.desc)}')" class="p-2 rounded-xl bg-stone-900/80 border border-stone-700 hover:border-amber-400 transition text-left flex flex-col">
            <img src="${ASSETS[c.imgKey] || ''}" class="w-full rounded-lg mb-1.5" />
            <div class="text-xs font-bold text-white leading-tight">${c.name}</div>
            <div class="text-[10px] text-stone-400 mt-1 line-clamp-3 leading-snug">${c.desc}</div>
          </button>`).join('')}
      </div>
    </div>
  `).join('');
}

// === RENDERING ===
function renderAll() {
  if (!roomState) return;
  const { lobby, me, game } = roomState;
  document.getElementById('roomMeta').textContent = `방 코드: ${lobby.code}`;
  document.getElementById('btnCopyRoom').classList.remove('hidden');
  document.getElementById('btnLeaveRoom').classList.remove('hidden');

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
    } else {
      document.getElementById('btnStartOnline').classList.add('hidden');
      document.getElementById('waitHostHint').classList.remove('hidden');
    }
    return;
  }

  // Active Game
  document.getElementById('lobbyView').classList.add('hidden');
  document.getElementById('gameView').classList.remove('hidden');
  document.getElementById('roundBadge').classList.remove('hidden');
  document.getElementById('phaseBadge').classList.remove('hidden');
  document.getElementById('roundBadge').textContent = `${game.round} / 3 라운드`;

  const pLabels = {
    SETUP_CHEESE: '치즈 배치', SETUP_MICE: '생쥐 시작 위치', SETUP_CATS: '고양이 초기 배치',
    MOUSE_TURN: '생쥐 팀 턴', CAT_TURN: '고양이 팀 턴', DRAFT: '증강 드래프트', GAME_OVER: '게임 종료'
  };
  document.getElementById('phaseBadge').textContent = pLabels[game.phase] || game.phase;

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
    const marks = game.specialTrackMarks?.[t];
    if (marks?.length) {
      const dot = document.createElement('span');
      dot.className = 'absolute -top-1.5 -right-1 px-1 rounded bg-sky-500 text-[9px] text-white font-bold';
      dot.textContent = marks.join('');
      d.appendChild(dot);
    }
    track.appendChild(d);
  }

  renderControls(game, me);
  document.getElementById('publicLog').innerHTML = game.publicLog.map(item =>
    `<div class="p-1.5 rounded bg-stone-900/70"><span class="text-amber-400 font-bold mr-1">[${item.turn}]</span>${item.msg}</div>`
  ).join('');
  resizeCanvas();
}

window.claimSeat = seatKey => socket.emit('room:claimSeat', { seatKey });

function renderCatCardBadges(cat) {
  return (cat.cards || []).map(card => {
    const tierCol = card.tier === 'gold'
      ? 'border-amber-400/70 text-amber-300 bg-amber-500/15'
      : card.tier === 'silver'
      ? 'border-slate-400/70 text-slate-200 bg-slate-500/15'
      : 'border-orange-700/80 text-orange-200 bg-orange-950/50';
    const tierLabel = card.tier === 'gold' ? '3단계 · 골드' : card.tier === 'silver' ? '2단계 · 실버' : '1단계 · 브론즈';
    return `<button type="button" onclick="event.stopPropagation(); zoomCard('${card.id}','${tierLabel}','${escAttr(card.name)}','${escAttr(card.desc)}')" title="${escAttr(card.desc)}" class="px-2 py-0.5 rounded-md border ${tierCol} text-[11px] font-bold hover:brightness-125 transition">${card.name} ⓘ</button>`;
  }).join('');
}

function renderControls(game, me) {
  const inst = document.getElementById('instructionText');
  const el = document.getElementById('controlPanel');

  if (game.phase === 'GAME_OVER') {
    inst.textContent = `🏆 ${game.winReason}`;
    el.innerHTML = `
      <div class="text-center py-4 space-y-3">
        <div class="text-2xl font-extrabold text-amber-300">${game.winner === 'mouse' ? '🐭 생쥐 팀 승리!' : '🐱 고양이 팀 승리!'}</div>
        <div class="text-xs text-stone-300">${game.winReason}</div>
        <button onclick="leaveCurrentRoom()" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs">로비로 나가기</button>
      </div>`;
    return;
  }

  if (game.phase === 'SETUP_CHEESE') {
    const need = (game.round === 1 ? 3 : 2) - game.cheeses.length;
    inst.textContent = me.team === 'mouse' ? `노란색 하이라이트 하얀 칸을 클릭해 치즈를 ${need}개 더 배치하세요 (구역당 1개).` : '생쥐 팀이 치즈를 비밀리에 배치하는 중입니다...';
    el.innerHTML = `<div class="text-xs text-stone-300">배치된 치즈: ${me.team === 'mouse' ? (game.cheeses.map(c => '#' + c.nodeId).join(', ') || '없음') : '비공개'}</div>`;
  } else if (game.phase === 'SETUP_MICE') {
    inst.textContent = me.team === 'mouse' ? `생쥐 ${game.setupMouseIdx === 0 ? 'A' : 'B'}의 시작 위치(파란색 하이라이트 검은 칸)를 클릭하세요.` : '생쥐 팀이 시작 위치를 고르는 중입니다...';
    el.innerHTML = `<div class="text-xs text-stone-300">생쥐 팀 시작 위치 선택 중...</div>`;
  } else if (game.phase === 'SETUP_CATS') {
    inst.textContent = me.team === 'cat' ? `고양이 ${game.setupCatIdx + 1}을 중앙의 빨간색 하이라이트 교차로에 배치하세요.` : '고양이 팀이 붉은 교차로에 말을 배치하는 중입니다...';
    el.innerHTML = `
      <div class="space-y-2">
        <div class="text-xs font-bold text-orange-300">고양이 초기 브론즈 증강 (클릭하면 카드 설명 확인)</div>
        ${game.cats.map(c => `
          <div class="p-2 rounded-xl bg-stone-900/70 border border-stone-700 flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-white">${c.name}</span>
            <div class="flex flex-wrap gap-1">${renderCatCardBadges(c)}</div>
          </div>`).join('')}
      </div>`;
  } else if (game.phase === 'MOUSE_TURN') {
    inst.textContent = me.team === 'mouse' ? '파란색 하이라이트 칸을 클릭해 이동하거나 특수 카드를 사용한 뒤 [턴 확정]을 누르세요.' : '생쥐 팀이 비밀리에 이동 경로를 기록 중입니다...';
    if (me.team !== 'mouse') {
      el.innerHTML = `<div class="text-xs text-stone-400 py-4 text-center">생쥐 팀의 이동을 기다리는 중...</div>`;
      return;
    }
    const allMoved = game.mice.every(m => m.delivered || m.movedThisTurn);
    const activeM = game.mice[localUI.selectedMouseId];
    const mCards = CARD_META?.MOUSE_CARDS || [
      { id: 'sprint', imgKey: 'mouse_card_sprint', name: '질주', desc: '2칸 연속 이동 (고양이 무시)' },
      { id: 'wall', imgKey: 'mouse_card_wall', name: '담 넘기', desc: '같은 건물 블록 건너편 이동' },
      { id: 'hole', imgKey: 'mouse_card_hole', name: '쥐구멍 이동', desc: '맞은편 쥐구멍으로 이동' }
    ];
    el.innerHTML = `
      <div class="grid grid-cols-2 gap-2">
        ${game.mice.map(m => `
          <button onclick="pickMouse(${m.id})" class="p-2 rounded-xl border text-left ${localUI.selectedMouseId === m.id ? 'bg-sky-500/20 border-sky-400' : 'bg-stone-900 border-stone-700'}">
            <div class="text-xs font-bold text-white">${m.name}</div>
            <div class="text-[11px] text-amber-300">${m.delivered ? '🕳️ 배달 완료' : m.movedThisTurn ? `✓ #${m.pendingPos} 예정` : `현재 #${m.pos}`}</div>
          </button>`).join('')}
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        ${mCards.map(mc => {
          const avail = activeM?.cards?.[mc.id];
          const isSel = localUI.selectedMouseCard === mc.id;
          return `
            <div class="flex flex-col gap-1">
              <button ${avail ? '' : 'disabled'} onclick="toggleMCard('${mc.id}')" class="p-1.5 rounded-xl border text-center ${isSel ? 'bg-amber-500/25 border-amber-400' : 'bg-stone-900 border-stone-700'} ${avail ? '' : 'opacity-35'}">
                ${ASSETS?.[mc.imgKey] ? `<img src="${ASSETS[mc.imgKey]}" class="w-full rounded-md mb-1" />` : ''}
                <div class="text-[11px] font-bold text-white">${mc.name}</div>
              </button>
              <button onclick="zoomCard('${mc.imgKey}','생쥐 능력 카드','${escAttr(mc.name)}','${escAttr(mc.desc)}')" class="text-[10px] text-stone-400 hover:text-amber-300">설명 보기</button>
            </div>`;
        }).join('')}
      </div>
      <button ${allMoved ? '' : 'disabled'} onclick="confirmMouse()" class="w-full py-2.5 rounded-xl font-extrabold text-xs ${allMoved ? 'bg-sky-500 hover:bg-sky-400 text-stone-950' : 'bg-stone-800 text-stone-500'}">생쥐 턴 확정</button>
    `;
  } else if (game.phase === 'CAT_TURN') {
    inst.textContent = me.team === 'cat'
      ? (localUI.selectedCatId === null
        ? '행동할 고양이를 선택하면 이동 가능한 교차로가 주황색으로 표시됩니다.'
        : '주황색 교차로를 클릭해 이동한 뒤, 아래 [단서 수색] 또는 [포획 시도]를 실행하세요.')
      : '고양이 팀이 추격 중입니다...';
    if (me.team !== 'cat') {
      el.innerHTML = `
        <div class="space-y-2">
          <div class="text-xs text-stone-400 text-center py-2">고양이 팀의 추격을 지켜보는 중...</div>
          <div class="text-[11px] font-bold text-orange-300">고양이 장착 증강 (클릭해 효과 확인)</div>
          ${game.cats.map(c => `<div class="p-2 rounded-lg bg-stone-900/70 flex items-center justify-between gap-2"><span class="text-xs font-bold">${c.name}</span><div class="flex flex-wrap gap-1">${renderCatCardBadges(c)}</div></div>`).join('')}
        </div>`;
      return;
    }
    el.innerHTML = `
      <div class="space-y-2">
        ${game.cats.map(c => `
          <div onclick="${c.actedThisTurn ? '' : `pickCat(${c.id})`}" class="p-2.5 rounded-xl border transition ${c.actedThisTurn ? 'bg-stone-900/40 border-stone-800 opacity-45' : localUI.selectedCatId === c.id ? 'bg-orange-500/20 border-orange-400 cursor-pointer' : 'bg-stone-900 border-stone-700 hover:border-orange-400/60 cursor-pointer'}">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-white">${c.name}</span>
              <span class="text-[11px] text-amber-300">${c.actedThisTurn ? '✓ 완료' : localUI.selectedCatId === c.id ? '● 이동·행동 중' : '선택'}</span>
            </div>
            <div class="mt-1.5 flex flex-wrap gap-1">${renderCatCardBadges(c)}</div>
          </div>`).join('')}
      </div>
      ${localUI.selectedCatId !== null && localUI.catMoveEdge !== null ? `
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button onclick="execCatSearch()" class="py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-xs">🔍 인접 전체 수색</button>
          <button onclick="setCatCaptureMode()" class="py-2 rounded-lg ${localUI.catMode === 'capture' ? 'bg-red-500 text-white' : 'bg-stone-800 hover:bg-stone-700 text-red-300 border border-red-500/40'} font-extrabold text-xs">🎯 포획 대상 클릭</button>
        </div>` : `<div class="text-[11px] text-stone-400">행동할 고양이를 선택하면 이동 범위 가이드라인이 보드에 표시됩니다.</div>`}
    `;
  } else if (game.phase === 'DRAFT') {
    inst.textContent = me.team === 'cat' ? '라운드 종료! 증강 카드 3장 중 1장을 골라 고양이에 장착하세요.' : '고양이 팀이 증강 카드를 선택하는 중입니다...';
    if (me.team !== 'cat') { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="space-y-2">
        <div class="grid grid-cols-3 gap-2">
          ${game.draftOptions.map((c, idx) => `
            <button onclick="pickDraft(${idx})" class="p-2 rounded-xl border text-center transition ${localUI.draftCardIdx === idx ? 'bg-amber-500/20 border-amber-400' : 'bg-stone-900 border-stone-700 hover:border-amber-400/60'}">
              ${ASSETS?.[c.id] ? `<img src="${ASSETS[c.id]}" class="w-full rounded-lg mb-1" />` : ''}
              <div class="text-[11px] font-bold text-amber-300 leading-tight">${c.name}</div>
              <div class="text-[10px] text-stone-300 mt-1 leading-snug">${c.desc}</div>
            </button>`).join('')}
        </div>
        ${localUI.draftCardIdx !== null ? `<div class="flex gap-1.5 pt-1">${game.cats.map(c => `<button onclick="equipDraft(${c.id})" class="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-stone-950 font-extrabold text-xs">${c.name} 장착</button>`).join('')}</div>` : ''}
      </div>`;
  }
}

window.pickMouse = id => { localUI.selectedMouseId = id; localUI.selectedMouseCard = null; renderAll(); };
window.toggleMCard = cid => { localUI.selectedMouseCard = localUI.selectedMouseCard === cid ? null : cid; renderAll(); };
window.confirmMouse = () => socket.emit('game:action', { type: 'confirmMouseTurn' });
window.pickCat = id => { localUI.selectedCatId = id; localUI.catMoveEdge = roomState.game.cats[id].edgeId; localUI.catMode = 'search'; renderAll(); };
window.setCatCaptureMode = () => { localUI.catMode = 'capture'; showToast('빨간색으로 표시된 인접 원형 칸 중 1곳을 클릭하세요!'); renderAll(); };
window.execCatSearch = () => {
  const cat = roomState.game.cats[localUI.selectedCatId];
  const targets = getCatAdjacentNodes(localUI.catMoveEdge, catHasLonelyBonus(roomState.game, cat));
  socket.emit('game:action', { type: 'catAction', catId: localUI.selectedCatId, edgeId: localUI.catMoveEdge, actionType: 'search', targetNodes: targets });
  localUI.selectedCatId = null; localUI.catMoveEdge = null; localUI.catMode = 'search';
};
window.pickDraft = idx => { localUI.draftCardIdx = idx; renderAll(); };
window.equipDraft = catId => {
  socket.emit('game:action', { type: 'selectDraftCard', cardIdx: localUI.draftCardIdx, catId });
  localUI.draftCardIdx = null;
};

// === CANVAS RENDERING WITH FULL PER-UNIT MOVE GUIDELINES ===
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

function drawRing(bx, by, rad, stroke, fill = null, lineWidth = 4) {
  const sc = canvas.width / GRAPH.width;
  ctx.beginPath();
  ctx.arc(bx * sc, by * sc, rad * sc, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth * sc;
  ctx.stroke();
}

function renderBoard() {
  if (!GRAPH || !canvas.width) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (IMGS.board?.complete) ctx.drawImage(IMGS.board, 0, 0, canvas.width, canvas.height);
  if (!roomState?.game) return;

  const { game, me } = roomState;
  const sc = canvas.width / GRAPH.width;

  // 1. Clues & Stolen Cheese Tokens
  game.cluesPast.forEach(nid => { ctx.save(); ctx.globalAlpha = 0.45; drawSprite('token_clue', NODES[nid].x, NODES[nid].y, 44); ctx.restore(); });
  game.cluesCurrent.forEach(nid => drawSprite('token_clue', NODES[nid].x, NODES[nid].y, 48));
  game.stolenTokens.forEach(t => drawSprite('token_cheese', NODES[t.nodeId].x, NODES[t.nodeId].y, 50));

  // 2. Per-Unit Move Guidelines & Phase Highlights!
  if (game.phase === 'SETUP_CHEESE' && me.team === 'mouse') {
    const usedQ = new Set(game.cheeses.map(c => c.quad));
    GRAPH.nodes.forEach(n => {
      if (n.type === 'white' && !usedQ.has(n.q) && (!game.relocateAllowedQuads || game.relocateAllowedQuads.includes(n.q))) {
        drawRing(n.x, n.y, 20, 'rgba(245,158,11,0.85)', 'rgba(245,158,11,0.18)', 3);
      }
    });
  } else if (game.phase === 'SETUP_MICE' && me.team === 'mouse') {
    const m = game.mice[game.setupMouseIdx];
    const allowedQ = m?.allowedStartQuad;
    if (allowedQ !== null && allowedQ !== undefined) {
      QUAD_START_BLACKS[allowedQ].forEach(nid => {
        if (nid === game.mice[1 - m.id].pos) return;
        drawRing(NODES[nid].x, NODES[nid].y, 23, '#38bdf8', 'rgba(56,189,248,0.28)', 4);
      });
    }
  } else if (game.phase === 'SETUP_CATS' && me.team === 'cat') {
    RED_EDGES.forEach(eid => {
      if (!game.cats.some(c => c.edgeId === eid)) drawRing(EDGES[eid].x, EDGES[eid].y, 18, '#ef4444', 'rgba(239,68,68,0.38)', 4);
    });
  } else if (game.phase === 'MOUSE_TURN' && me.team === 'mouse') {
    const legal = getMouseLegalMoves(game, localUI.selectedMouseId, localUI.selectedMouseCard);
    const col = localUI.selectedMouseCard ? '#facc15' : '#38bdf8';
    const fill = localUI.selectedMouseCard ? 'rgba(250,204,21,0.28)' : 'rgba(56,189,248,0.28)';
    legal.forEach(nid => drawRing(NODES[nid].x, NODES[nid].y, 23, col, fill, 4));
  } else if (game.phase === 'CAT_TURN' && me.team === 'cat' && localUI.selectedCatId !== null) {
    // Draw all reachable intersections (0~2 steps) for selected cat!
    const reachable = getCatReachableEdges(game, localUI.selectedCatId);
    reachable.forEach(eid => {
      const isChosen = (eid === localUI.catMoveEdge);
      drawRing(EDGES[eid].x, EDGES[eid].y, isChosen ? 21 : 14, isChosen ? '#facc15' : '#fb923c', isChosen ? 'rgba(250,204,21,0.38)' : 'rgba(251,146,60,0.32)', isChosen ? 4 : 3);
    });
    // Draw adjacent search/capture target nodes from the chosen intersection!
    if (localUI.catMoveEdge !== null) {
      const cat = game.cats[localUI.selectedCatId];
      const adjNodes = getCatAdjacentNodes(localUI.catMoveEdge, catHasLonelyBonus(game, cat));
      const isCap = (localUI.catMode === 'capture');
      adjNodes.forEach(nid => {
        drawRing(NODES[nid].x, NODES[nid].y, 24, isCap ? '#ef4444' : '#4ade80', isCap ? 'rgba(239,68,68,0.32)' : 'rgba(74,222,128,0.26)', 4);
      });
    }
  }

  // 3. Secret Cheeses & Mice (only present in Mouse View or Game Over)
  game.cheeses.forEach(c => {
    if (c.stolenBy !== null) return;
    const n = NODES[c.nodeId];
    drawRing(n.x, n.y, 24, '#f59e0b', 'rgba(245,158,11,0.35)', 4);
    ctx.font = `bold ${Math.round(22 * sc)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🧀', n.x * sc, n.y * sc);
  });
  game.mice.forEach(m => {
    const p = m.pendingPos ?? m.pos;
    if (!p) return;
    const n = NODES[p];
    const isSel = (game.phase === 'MOUSE_TURN' && me.team === 'mouse' && localUI.selectedMouseId === m.id);
    drawRing(n.x, n.y, isSel ? 26 : 23, isSel ? '#facc15' : (m.id === 0 ? '#38bdf8' : '#a855f7'), 'rgba(15,23,42,0.55)', 4);
    drawSprite(m.img, n.x, n.y, 38);
  });

  // 4. Cats
  game.cats.forEach(c => {
    if (c.edgeId === null) return;
    const drawEdge = (game.phase === 'CAT_TURN' && me.team === 'cat' && localUI.selectedCatId === c.id && localUI.catMoveEdge !== null)
      ? localUI.catMoveEdge : c.edgeId;
    const e = EDGES[drawEdge];
    if (game.phase === 'CAT_TURN' && !c.actedThisTurn) {
      drawRing(e.x, e.y, 22, localUI.selectedCatId === c.id ? '#facc15' : '#fb923c', null, 3);
    }
    drawSprite(c.img, e.x, e.y, 38);
  });
}

function findHit(bx, by) {
  const g = roomState?.game;
  const preferEdge = (g && (g.phase === 'SETUP_CATS' || (g.phase === 'CAT_TURN' && localUI.catMode !== 'capture')));
  let hitNode = null, nd = 28;
  GRAPH.nodes.forEach(n => { const d = Math.hypot(n.x - bx, n.y - by); if (d < nd) { nd = d; hitNode = n.id; } });
  let hitEdge = null, ed = 24;
  GRAPH.edges.forEach(e => { const d = Math.hypot(e.x - bx, e.y - by); if (d < ed) { ed = d; hitEdge = e.id; } });
  if (preferEdge && hitEdge !== null) return { kind: 'edge', id: hitEdge };
  if (hitNode !== null) return { kind: 'node', id: hitNode };
  if (hitEdge !== null) return { kind: 'edge', id: hitEdge };
  return null;
}

canvas.addEventListener('mousemove', ev => {
  if (!GRAPH || !roomState?.game) return;
  const rect = canvas.getBoundingClientRect();
  const bx = ((ev.clientX - rect.left) / rect.width) * GRAPH.width;
  const by = ((ev.clientY - rect.top) / rect.height) * GRAPH.height;
  const hit = findHit(bx, by);
  const tip = document.getElementById('boardTooltip');
  if (!hit) { tip.classList.add('hidden'); return; }
  tip.style.left = `${Math.min(rect.width - 160, Math.max(8, ev.clientX - rect.left + 12))}px`;
  tip.style.top = `${Math.max(8, ev.clientY - rect.top - 32)}px`;
  if (hit.kind === 'node') {
    const n = NODES[hit.id];
    const tLabel = n.type === 'hole' ? '쥐구멍' : (n.type === 'black' ? '검은 칸' : '하얀 칸');
    tip.textContent = `#${n.id} (${tLabel} · ${QUAD_NAMES[n.q]})`;
  } else {
    const e = EDGES[hit.id];
    tip.textContent = `교차로 #${e.u}-#${e.v}${e.red ? ' [붉은 시작점]' : ''}`;
  }
  tip.classList.remove('hidden');
});
canvas.addEventListener('mouseleave', () => document.getElementById('boardTooltip').classList.add('hidden'));

canvas.addEventListener('click', ev => {
  if (!roomState?.game || !GRAPH) return;
  const { game, me } = roomState;
  const rect = canvas.getBoundingClientRect();
  const bx = ((ev.clientX - rect.left) / rect.width) * GRAPH.width;
  const by = ((ev.clientY - rect.top) / rect.height) * GRAPH.height;
  const hit = findHit(bx, by);
  if (!hit) return;

  if (game.phase === 'SETUP_CHEESE' && me.team === 'mouse' && hit.kind === 'node') {
    socket.emit('game:action', { type: 'placeCheese', nodeId: hit.id });
  } else if (game.phase === 'SETUP_MICE' && me.team === 'mouse' && hit.kind === 'node') {
    socket.emit('game:action', { type: 'placeMouseStart', nodeId: hit.id });
  } else if (game.phase === 'SETUP_CATS' && me.team === 'cat' && hit.kind === 'edge') {
    socket.emit('game:action', { type: 'placeCatStart', edgeId: hit.id });
  } else if (game.phase === 'MOUSE_TURN' && me.team === 'mouse' && hit.kind === 'node') {
    socket.emit('game:action', { type: 'stageMouseMove', mouseId: localUI.selectedMouseId, nodeId: hit.id, cardType: localUI.selectedMouseCard });
    localUI.selectedMouseCard = null;
  } else if (game.phase === 'CAT_TURN' && me.team === 'cat') {
    if (localUI.catMode === 'capture' && localUI.selectedCatId !== null && localUI.catMoveEdge !== null && hit.kind === 'node') {
      socket.emit('game:action', { type: 'catAction', catId: localUI.selectedCatId, edgeId: localUI.catMoveEdge, actionType: 'capture', targetNodes: [hit.id] });
      localUI.selectedCatId = null; localUI.catMoveEdge = null; localUI.catMode = 'search';
    } else if (hit.kind === 'edge') {
      if (localUI.selectedCatId === null) {
        const c = game.cats.find(x => x.edgeId === hit.id && !x.actedThisTurn);
        if (c) { pickCat(c.id); return; }
      }
      if (localUI.selectedCatId !== null) {
        const reachable = getCatReachableEdges(game, localUI.selectedCatId);
        if (!reachable.includes(hit.id)) {
          showToast('주황색으로 표시된 이동 범위(0~2칸) 내의 교차로를 선택하세요.');
          return;
        }
        localUI.catMoveEdge = hit.id;
        renderAll();
      }
    }
  }
});

window.addEventListener('resize', resizeCanvas);
bootAssets();
