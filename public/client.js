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
const QUAD_NAMES = ['A 구역', 'B 구역', 'C 구역', 'D 구역'];
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
  catMode: 'move', // 'move' | 'search' | 'capture' | 'ability'
  activeAbility: null, // { catId, cardId }
  controllingClone: false,
  draftCardIdx: null,
  sideDrawerOpen: false,
  catChecksEnabled: true,
  replayActive: false,
  replayIdx: 0,
  replayPlaying: false
};
let replayTimer = null;

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

let lastSeenPopupId = null;
let noticeFadeTimer = null;
function showActionNotice(text, tone = 'info') {
  const el = document.getElementById('actionNotice');
  if (!el || !text) return;
  const cls = tone === 'found'
    ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
    : tone === 'fail'
    ? 'bg-red-950/95 border-red-400 text-red-200'
    : 'bg-stone-900/95 border-amber-400/80 text-amber-200';
  el.className = `pointer-events-none fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl border text-sm sm:text-base font-extrabold shadow-2xl transition-opacity duration-500 ${cls}`;
  el.textContent = text;
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  clearTimeout(noticeFadeTimer);
  noticeFadeTimer = setTimeout(() => { el.style.opacity = '0'; }, 2000);
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
  const res = new Set(Object.keys(dist).map(Number).filter(eid => eid === cat.edgeId || !occ.has(eid)));
  if (catHasCard(cat, 'gold_2')) {
    game.cats.forEach(o => {
      if (o.id !== catId && o.edgeId !== null) (EDGE_ADJ[o.edgeId] || []).forEach(eid => { if (!occ.has(eid)) res.add(eid); });
    });
  }
  return Array.from(res);
}

function getCloneReachableEdges(game) {
  if (!game.cloneCat?.active || game.cloneCat.edgeId === null) return [];
  const occ = getCatOccupiedEdges(game, -1);
  occ.delete(game.cloneCat.edgeId);
  const dist = { [game.cloneCat.edgeId]: 0 };
  const q = [game.cloneCat.edgeId];
  while (q.length) {
    const cur = q.shift();
    if (dist[cur] >= 2) continue;
    for (const nxt of (EDGE_ADJ[cur] || [])) {
      if (dist[nxt] === undefined) { dist[nxt] = dist[cur] + 1; q.push(nxt); }
    }
  }
  return Object.keys(dist).map(Number).filter(eid => eid === game.cloneCat.edgeId || !occ.has(eid));
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
    const cheeseNodes = new Set((game.cheeses || []).filter(c => c.stolenBy === null).map(c => c.nodeId));
    (NODE_ADJ[m.pos] || []).forEach(({ to: mid }) => {
      if (mid === blocked) return;
      (NODE_ADJ[mid] || []).forEach(({ to }) => {
        if (to === m.pos || to === otherPos || to === blocked || cheeseNodes.has(to)) return;
        if (HOLES.includes(to) && usedHoles.has(to) && m.hasCheese) return;
        out.add(to);
      });
    });
  } else if (cardType === 'wall' && m.cards?.wall) {
    const cheeseNodes = new Set((game.cheeses || []).filter(c => c.stolenBy === null).map(c => c.nodeId));
    (WALL_ADJ[String(m.pos)] || []).forEach(to => {
      if (to === otherPos || to === blocked || cheeseNodes.has(to)) return;
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
  const myIndices = data.me?.seatIndices || [];
  if (data.me?.team === 'mouse' && myIndices.length) {
    const curM = data.game?.mice?.[localUI.selectedMouseId];
    if (!myIndices.includes(localUI.selectedMouseId) || curM?.delivered || curM?.movedThisTurn) {
      const nextUnmoved = myIndices.find(idx => {
        const m = data.game?.mice?.[idx];
        return m && !m.delivered && !m.movedThisTurn;
      });
      localUI.selectedMouseId = nextUnmoved !== undefined ? nextUnmoved : myIndices[0];
    }
  }
  if (data.me?.team === 'cat' && myIndices.length && data.game?.phase === 'CAT_TURN') {
    // Prefer any cat currently mid-search, else keep current if still unacted, else pick first unacted owned cat
    const midSearch = myIndices.find(idx => data.game.cats[idx]?.searchingThisTurn);
    if (midSearch !== undefined) {
      localUI.selectedCatId = midSearch;
      localUI.catMoveEdge = data.game.cats[midSearch].edgeId;
      localUI.catMode = 'search';
    } else {
      const curCat = localUI.selectedCatId !== null ? data.game.cats[localUI.selectedCatId] : null;
      if (curCat && curCat.sprintMode && localUI.catMode !== 'move') {
        localUI.catMode = 'move';
      }
      if (!curCat || !myIndices.includes(localUI.selectedCatId) || curCat.actedThisTurn) {
        const nextCatIdx = myIndices.find(idx => !data.game.cats[idx]?.actedThisTurn);
        if (nextCatIdx !== undefined) {
          localUI.selectedCatId = nextCatIdx;
          localUI.catMoveEdge = data.game.cats[nextCatIdx].edgeId;
          localUI.catMode = 'move';
          localUI.controllingClone = false;
        } else {
          localUI.selectedCatId = null;
          localUI.catMoveEdge = null;
          localUI.catMode = 'move';
          localUI.controllingClone = false;
        }
      }
    }
  }
  try { localStorage.setItem('stc_room', data.lobby.code); } catch {}
  renderAll();
});

socket.on('room:left', () => {
  roomState = null;
  localUI = { selectedMouseId: 0, selectedMouseCard: null, selectedCatId: null, catMoveEdge: null, catMode: 'move', activeAbility: null, controllingClone: false, draftCardIdx: null };
  try { localStorage.removeItem('stc_room'); } catch {}
  document.getElementById('roomMeta').textContent = '실시간 서버 연결됨';
  document.getElementById('roundBadge').classList.add('hidden');
  document.getElementById('phaseBadge').classList.add('hidden');
  document.getElementById('turnTrack').innerHTML = '';
  document.getElementById('btnCopyRoom').classList.add('hidden');
  document.getElementById('btnLeaveRoom').classList.add('hidden');
  document.getElementById('btnSideTab').classList.add('hidden');
  toggleSideDrawer(false);
  document.getElementById('gameView').classList.add('hidden');
  document.getElementById('btnSideTab').classList.add('hidden');
  toggleSideDrawer(false);
  document.getElementById('lobbyView').classList.remove('hidden');
  document.getElementById('entryForms').classList.remove('hidden');
  document.getElementById('waitingRoom').classList.add('hidden');
  document.getElementById('chatBox').innerHTML = '';
  document.getElementById('topBanner').classList.add('hidden');
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
function renderCatChecksPanel(game) {
  const list = document.getElementById('catChecksList');
  const cnt = document.getElementById('catChecksCount');
  const toggleBtn = document.getElementById('btnToggleCatChecks');
  if (!list || !cnt) return;
  const enabled = localUI.catChecksEnabled !== false;
  if (toggleBtn) {
    toggleBtn.textContent = enabled ? 'ON' : 'OFF';
    toggleBtn.className = enabled
      ? 'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/70 text-emerald-200 transition'
      : 'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-400 transition';
  }
  const items = game.catCheckedNodes || [];
  const map = new Map();
  items.forEach(it => map.set(`${it.round || 1}-${it.nodeId}`, it));
  const arr = Array.from(map.values());
  if (!enabled) {
    cnt.textContent = '사용 안 함 (OFF)';
    list.classList.add('hidden');
    return;
  }
  list.classList.remove('hidden');
  cnt.textContent = `전체 ${arr.length}건${game.showCatChecks ? ' · 보드 원 ON' : ''}`;
  if (!arr.length) {
    list.innerHTML = '<span class="text-stone-500">아직 탐지한 칸이 없습니다.</span>';
    return;
  }
  list.innerHTML = arr.map(it => {
    const r = it.round || 1;
    const isCur = r === game.round;
    const rBadge = `<span class="opacity-75 mr-0.5">${r}R</span>`;
    const cls = it.hit
      ? (isCur ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-200' : 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300/80')
      : (isCur ? 'bg-stone-800/90 border-stone-500 text-stone-200' : 'bg-stone-900/80 border-stone-700 text-stone-400');
    return `
    <span title="${r}라운드 ${it.turn}턴 · ${it.by} — ${it.hit ? '발자국 발견' : '흔적 없음'}" class="px-2 py-0.5 rounded-md font-bold border ${cls}">
      ${rBadge}#${it.nodeId}${it.hit ? ' 🐾' : ''}
    </span>`;
  }).join('');
}
document.getElementById('btnToggleCatChecks')?.addEventListener('click', () => {
  localUI.catChecksEnabled = !localUI.catChecksEnabled;
  if (roomState?.game) {
    renderCatChecksPanel(roomState.game);
    drawBoard();
  }
});

// === FULL-GAME REPLAY PLAYER ===
function stopReplayTimer() {
  if (replayTimer) { clearInterval(replayTimer); replayTimer = null; }
  localUI.replayPlaying = false;
  const btn = document.getElementById('btnRepPlay');
  if (btn) btn.textContent = '▶ 재생';
}

window.startReplay = () => {
  const frames = roomState?.game?.replayFrames;
  if (!frames || !frames.length) return showToast('재생할 다시보기 기록이 없습니다.');
  stopReplayTimer();
  localUI.replayActive = true;
  localUI.replayIdx = 0;
  document.getElementById('replayBar').classList.remove('hidden');
  updateReplayUI();
};

function exitReplay() {
  stopReplayTimer();
  localUI.replayActive = false;
  document.getElementById('replayBar').classList.add('hidden');
  renderBoard();
}

function updateReplayUI() {
  const frames = roomState?.game?.replayFrames || [];
  if (!frames.length) return;
  localUI.replayIdx = Math.max(0, Math.min(frames.length - 1, localUI.replayIdx));
  const f = frames[localUI.replayIdx];
  document.getElementById('replayCaption').textContent = `[${f.round}R ${f.turn}T] ${f.caption}`;
  document.getElementById('replayStepText').textContent = `${localUI.replayIdx + 1} / ${frames.length}`;
  const slider = document.getElementById('replaySlider');
  slider.max = frames.length - 1;
  slider.value = localUI.replayIdx;
  renderBoard();
}

document.getElementById('btnExitReplay').addEventListener('click', exitReplay);
document.getElementById('btnRepFirst').addEventListener('click', () => { stopReplayTimer(); localUI.replayIdx = 0; updateReplayUI(); });
document.getElementById('btnRepPrev').addEventListener('click', () => { stopReplayTimer(); localUI.replayIdx--; updateReplayUI(); });
document.getElementById('btnRepNext').addEventListener('click', () => { stopReplayTimer(); localUI.replayIdx++; updateReplayUI(); });
document.getElementById('btnRepLast').addEventListener('click', () => { stopReplayTimer(); localUI.replayIdx = (roomState?.game?.replayFrames?.length || 1) - 1; updateReplayUI(); });
document.getElementById('replaySlider').addEventListener('input', e => { stopReplayTimer(); localUI.replayIdx = Number(e.target.value); updateReplayUI(); });
document.getElementById('btnRepPlay').addEventListener('click', () => {
  if (localUI.replayPlaying) { stopReplayTimer(); return; }
  const frames = roomState?.game?.replayFrames || [];
  if (localUI.replayIdx >= frames.length - 1) localUI.replayIdx = 0;
  localUI.replayPlaying = true;
  document.getElementById('btnRepPlay').textContent = '⏸ 일시정지';
  replayTimer = setInterval(() => {
    if (localUI.replayIdx < frames.length - 1) {
      localUI.replayIdx++;
      updateReplayUI();
    } else {
      stopReplayTimer();
    }
  }, 1050);
});

function toggleSideDrawer(forceState) {
  localUI.sideDrawerOpen = (typeof forceState === 'boolean') ? forceState : !localUI.sideDrawerOpen;
  const drawer = document.getElementById('sideDrawer');
  const tab = document.getElementById('btnSideTab');
  if (localUI.sideDrawerOpen) {
    drawer.classList.remove('-translate-x-full');
    tab.classList.add('opacity-0', 'pointer-events-none');
  } else {
    drawer.classList.add('-translate-x-full');
    if (roomState?.game) tab.classList.remove('opacity-0', 'pointer-events-none');
  }
}

document.getElementById('btnSideTab').addEventListener('click', () => toggleSideDrawer());
document.getElementById('btnCloseSideDrawer').addEventListener('click', () => toggleSideDrawer(false));

function renderSideDrawer(game, me) {
  const body = document.getElementById('sideDrawerBody');
  if (!body || !game) return;
  const showMouseCardTypes = (me.team === 'mouse' || game.phase === 'GAME_OVER');
  const mCardsMeta = CARD_META?.MOUSE_CARDS || [
    { id: 'sprint', imgKey: 'mouse_card_sprint', name: '질주', desc: '2칸 연속 이동 (고양이 무시)' },
    { id: 'wall', imgKey: 'mouse_card_wall', name: '담 넘기', desc: '같은 건물 블록 건너편 이동' },
    { id: 'hole', imgKey: 'mouse_card_hole', name: '쥐구멍 이동', desc: '맞은편 쥐구멍으로 이동' }
  ];

  const mouseSection = `
    <div class="space-y-2">
      <div class="text-xs font-extrabold text-sky-300 flex items-center justify-between">
        <span>🐭 생쥐 특수 카드 사용 현황</span>
        <span class="text-[10px] text-stone-400">${showMouseCardTypes ? '종류 공개(아군)' : '종류 비공개'}</span>
      </div>
      ${game.mice.map(m => {
        const totalCnt = m.totalCardCount || 4;
        const usedCnt = m.cards ? (totalCnt - ((m.cards.sprint || 0) + (m.cards.wall || 0) + (m.cards.hole || 0))) : (m.usedCardCount || 0);
        return `
          <div class="p-2.5 rounded-xl bg-stone-900/80 border border-stone-700 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-white">${m.name}</span>
              <span class="text-[11px] font-bold ${usedCnt > 0 ? 'text-amber-300' : 'text-stone-400'}">${usedCnt} / ${totalCnt}장 사용 (${totalCnt - usedCnt}장 남음)</span>
            </div>
            ${showMouseCardTypes && m.cards ? `
              <div class="flex flex-wrap gap-1">
                ${mCardsMeta.map(mc => {
                  const avail = m.cards[mc.id];
                  return `<button type="button" onclick="zoomCard('${mc.imgKey}','생쥐 능력 카드','${escAttr(mc.name)}','${escAttr(mc.desc)}')" class="px-2 py-0.5 rounded text-[10px] font-bold border ${avail ? 'bg-sky-500/15 border-sky-400/60 text-sky-200' : 'bg-stone-800 border-stone-700 text-stone-500 line-through'}">${mc.name} ${avail ? (avail > 1 ? `×${avail}` : '보유') : '사용됨'}</button>`;
                }).join('')}
              </div>
            ` : `
              <div class="flex gap-1">
                ${[0, 1, 2, 3].map(i => `<span class="flex-1 text-center py-0.5 rounded text-[10px] font-bold border ${i < usedCnt ? 'bg-amber-500/20 border-amber-400/60 text-amber-300' : 'bg-stone-800 border-stone-700 text-stone-400'}">${i < usedCnt ? '사용됨(비공개)' : '미사용'}</span>`).join('')}
              </div>
            `}
          </div>`;
      }).join('')}
    </div>`;

  const catSection = `
    <div class="space-y-2">
      <div class="text-xs font-extrabold text-orange-300 flex items-center justify-between">
        <span>🐱 고양이 팀 장착 증강</span>
        <span class="text-[10px] text-stone-400">클릭 시 카드 확대</span>
      </div>
      ${game.cats.map(c => `
        <div class="p-2.5 rounded-xl bg-stone-900/80 border border-stone-700 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white">${c.name}</span>
            <span class="text-[10px] text-stone-400">총 ${(c.cards || []).length}장 장착</span>
          </div>
          <div class="space-y-1">
            ${(c.cards || []).map(card => {
              const effId = card.copiedId || card.id;
              const used = Boolean(c.usedOnce?.[effId]);
              const tierLabel = card.tier === 'gold' ? '3단계 · 골드' : card.tier === 'silver' ? '2단계 · 실버' : '1단계 · 브론즈';
              const tierCol = card.tier === 'gold' ? 'border-amber-400/60 text-amber-300' : card.tier === 'silver' ? 'border-slate-400/60 text-slate-200' : 'border-orange-700/70 text-orange-200';
              return `
                <button type="button" onclick="zoomCard('${card.id}','${tierLabel}','${escAttr(card.name)}','${escAttr(card.desc)}')" class="w-full p-1.5 rounded-lg bg-stone-950/70 border ${tierCol} hover:bg-stone-800 text-left transition">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-bold">${card.name}</span>
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">${used ? '사용됨' : tierLabel.split(' · ')[1]}</span>
                  </div>
                  <div class="text-[10px] text-stone-400 mt-0.5 leading-snug">${card.desc}</div>
                </button>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>`;

  body.innerHTML = mouseSection + catSection;
}

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
document.getElementById('btnModeClassic').addEventListener('click', () => {
  if (roomState?.me?.isHost) socket.emit('room:setMode', { cheeseMode: 'classic' });
});
document.getElementById('btnModeThree').addEventListener('click', () => {
  if (roomState?.me?.isHost) socket.emit('room:setMode', { cheeseMode: 'three' });
});
document.getElementById('btnClaimAllMouse').addEventListener('click', () => socket.emit('room:claimTeamAll', { team: 'mouse' }));
document.getElementById('btnClaimAllCat').addEventListener('click', () => socket.emit('room:claimTeamAll', { team: 'cat' }));
document.getElementById('btnReleaseExtra').addEventListener('click', () => socket.emit('room:releaseExtraSeats'));
document.getElementById('chkShowCatChecks').addEventListener('change', e => {
  if (roomState?.me?.isHost) socket.emit('room:setMode', { showCatChecks: e.target.checked });
  else e.target.checked = Boolean(roomState?.lobby?.showCatChecks);
});


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
  document.getElementById('btnSideTab').classList.add('hidden');
  toggleSideDrawer(false);
    document.getElementById('entryForms').classList.add('hidden');
    document.getElementById('waitingRoom').classList.remove('hidden');
    document.getElementById('displayRoomCode').textContent = lobby.code;
    document.getElementById('myTeamBadge').textContent = me.team === 'mouse' ? `🐭 생쥐 팀 (${(me.seatKeys||[]).length}마리 조종)` : me.team === 'cat' ? `🐱 고양이 팀 (${(me.seatKeys||[]).length}마리 조종)` : '👀 관전자';

    const mySeatKeys = me.seatKeys || [];
    document.getElementById('seatList').innerHTML = lobby.seats.map(s => {
      const isMine = mySeatKeys.includes(s.seatKey);
      const isOccupiedByOther = Boolean(s.playerName) && !isMine;
      return `
      <button ${isOccupiedByOther ? 'disabled' : ''} onclick="claimSeat('${s.seatKey}')" class="p-2.5 rounded-xl border text-left transition ${isMine ? 'bg-amber-500/20 border-amber-400' : isOccupiedByOther ? 'bg-stone-900/50 border-stone-800 opacity-65 cursor-not-allowed' : 'bg-stone-900/70 border-stone-700 hover:border-amber-400/60'}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold ${s.team === 'mouse' ? 'text-sky-300' : 'text-orange-300'}">${s.label}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded ${isMine ? 'bg-amber-400 text-stone-950 font-extrabold' : isOccupiedByOther ? 'bg-stone-800 text-stone-400' : 'bg-purple-500/25 text-purple-200'}">${isMine ? '내가 조종' : isOccupiedByOther ? '다른 유저' : '🤖 AI'}</span>
        </div>
        <div class="text-[11px] text-stone-300 mt-0.5">${isMine ? `${s.playerName} (클릭 시 AI로 전환)` : isOccupiedByOther ? `${s.playerName} ${s.connected ? '🟢' : '🔴'}` : '클릭해 내가 직접 조종'}</div>
      </button>`;
    }).join('');

    const isThree = lobby.cheeseMode === 'three';
    document.getElementById('btnModeClassic').className = `p-2 rounded-lg border text-left transition ${!isThree ? 'bg-amber-500/20 border-amber-400' : 'bg-stone-900 border-stone-700 opacity-70'} ${me.isHost ? 'cursor-pointer hover:border-amber-400/70' : 'cursor-default'}`;
    document.getElementById('btnModeThree').className = `p-2 rounded-lg border text-left transition ${isThree ? 'bg-amber-500/20 border-amber-400' : 'bg-stone-900 border-stone-700 opacity-70'} ${me.isHost ? 'cursor-pointer hover:border-amber-400/70' : 'cursor-default'}`;
    document.getElementById('modeHint').textContent = me.isHost ? '클릭해 모드 변경' : (isThree ? '현재: 치즈 3개 모드' : '현재: 기본 모드');
    const chkChecks = document.getElementById('chkShowCatChecks');
    chkChecks.checked = Boolean(lobby.showCatChecks);
    chkChecks.disabled = !me.isHost;

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
  if (!localUI.sideDrawerOpen) document.getElementById('btnSideTab').classList.remove('hidden', 'opacity-0', 'pointer-events-none');
  document.getElementById('roundBadge').classList.remove('hidden');
  document.getElementById('phaseBadge').classList.remove('hidden');
  document.getElementById('roundBadge').textContent = `${game.round} / 3 라운드${game.cheeseMode === 'three' ? ' · 치즈3' : ''}`;

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
    d.className = `turn-pip border !w-5 !h-5 !text-[10px] ${t === game.turn ? 'bg-amber-500 text-stone-950 border-amber-300 scale-110' : 'bg-stone-900 text-stone-400 border-stone-700'}`;
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

  const tb = document.getElementById('topBanner');
  if (game.bannerEvent?.text) {
    const toneCls = game.bannerEvent.tone === 'cheese'
      ? 'bg-amber-500/95 text-stone-950 border-amber-300'
      : game.bannerEvent.tone === 'mouse'
      ? 'bg-sky-500/95 text-stone-950 border-sky-300'
      : 'bg-orange-500/95 text-stone-950 border-orange-300';
    tb.className = `sticky top-[52px] z-20 px-3 py-2 text-center text-xs sm:text-sm font-extrabold border-b shadow-lg ${toneCls}`;
    tb.textContent = game.bannerEvent.text;
  } else {
    tb.classList.add('hidden');
  }
  if (game.lastActionPopup?.id && game.lastActionPopup.id !== lastSeenPopupId) {
    lastSeenPopupId = game.lastActionPopup.id;
    showActionNotice(game.lastActionPopup.text, game.lastActionPopup.tone);
  }
  renderSideDrawer(game, me);
  renderCatChecksPanel(game);
  renderControls(game, me);
  document.getElementById('publicLog').innerHTML = game.publicLog.map(item =>
    `<div class="p-1.5 rounded bg-stone-900/70"><span class="text-amber-400 font-bold mr-1">[${item.turn}]</span>${item.msg}</div>`
  ).join('');
  resizeCanvas();
}

window.claimSeat = seatKey => socket.emit('room:claimSeat', { seatKey });

function renderCatCardBadges(cat, canUseNow = false) {
  return (cat.cards || []).map(card => {
    const effId = card.copiedId || card.id;
    const tierCol = card.tier === 'gold'
      ? 'border-amber-400/70 text-amber-300 bg-amber-500/15'
      : card.tier === 'silver'
      ? 'border-slate-400/70 text-slate-200 bg-slate-500/15'
      : 'border-orange-700/80 text-orange-200 bg-orange-950/50';
    const tierLabel = card.tier === 'gold' ? '3단계 · 골드' : card.tier === 'silver' ? '2단계 · 실버' : '1단계 · 브론즈';
    const isActivatable = ['bronze_1','bronze_3','bronze_5','silver_1','silver_2','gold_1','gold_4','gold_5'].includes(effId);
    const alreadyUsedOnce = Boolean(cat.usedOnce?.[effId]);
    const isTargeting = (localUI.catMode === 'ability' && localUI.activeAbility?.cardId === effId);
    const showBtn = canUseNow && isActivatable && !alreadyUsedOnce;
    const btnText = effId === 'silver_1' ? (cat.sprintMode ? '질주 ON' : '질주 OFF') : (isTargeting ? '취소' : '발동');
    return `
      <div class="inline-flex items-center rounded-md border ${tierCol} overflow-hidden text-[11px]">
        <button type="button" onclick="event.stopPropagation(); zoomCard('${card.id}','${tierLabel}','${escAttr(card.name)}','${escAttr(card.desc)}')" title="${escAttr(card.desc)}" class="px-2 py-0.5 font-bold hover:bg-white/10 transition">${card.name} ⓘ</button>
        ${showBtn ? `<button type="button" onclick="event.stopPropagation(); useCatAbility(${cat.id},'${effId}')" class="px-2 py-0.5 font-extrabold ${isTargeting || (effId === 'silver_1' && cat.sprintMode) ? 'bg-emerald-400 text-stone-950' : 'bg-amber-500 hover:bg-amber-400 text-stone-950'}">${btnText}</button>` : ''}
        ${canUseNow && alreadyUsedOnce ? `<span class="px-1.5 py-0.5 text-[10px] bg-stone-800 text-stone-500">사용됨</span>` : ''}
      </div>`;
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
        <div class="flex flex-wrap justify-center gap-2 pt-1">
          ${game.replayFrames?.length ? `<button onclick="startReplay()" class="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-stone-950 font-extrabold text-xs">🎬 전체 게임 다시보기 (${game.replayFrames.length}장면)</button>` : ''}
          <button onclick="leaveCurrentRoom()" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs">로비로 나가기</button>
        </div>
      </div>`;
    return;
  }

  if (game.phase === 'SETUP_CHEESE') {
    const need = (game.cheeseMode === 'three' || game.round === 1 ? 3 : 2) - game.cheeses.length;
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
        ${game.mice.map(m => {
          const isMine = (me.seatIndices || []).includes(m.id);
          const isSel = (localUI.selectedMouseId === m.id);
          return `
          <button type="button" ${!isMine || m.delivered ? 'disabled' : ''} onclick="pickMouse(${m.id})" class="p-2 rounded-xl border text-left transition ${isMine ? (isSel ? 'bg-sky-500/25 border-sky-400 ring-1 ring-sky-300' : 'bg-stone-900 border-stone-600 hover:border-sky-400/70') : 'bg-stone-900/60 border-stone-800 opacity-70 cursor-not-allowed'}">
            <div class="text-xs font-bold text-white flex items-center justify-between">
              <span>${m.name}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded ${isMine ? 'bg-sky-500 text-stone-950 font-extrabold' : 'bg-stone-800 text-stone-400'}">${isMine ? (isSel ? '조종 중' : '내 말') : (m.isAI ? '🤖 AI' : '팀원 말')}</span>
            </div>
            <div class="text-[11px] text-amber-300 mt-0.5">${m.delivered ? '🕳️ 배달 완료' : m.movedThisTurn ? `✓ #${m.pendingPos} 예정` : `현재 #${m.pos}`}</div>
          </button>`;
        }).join('')}
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        ${mCards.map(mc => {
          const avail = activeM?.cards?.[mc.id];
          const isSel = localUI.selectedMouseCard === mc.id;
          return `
            <div class="flex flex-col gap-1">
              <button ${avail ? '' : 'disabled'} onclick="toggleMCard('${mc.id}')" class="p-1.5 rounded-xl border text-center ${isSel ? 'bg-amber-500/25 border-amber-400' : 'bg-stone-900 border-stone-700'} ${avail ? '' : 'opacity-35'}">
                ${ASSETS?.[mc.imgKey] ? `<img src="${ASSETS[mc.imgKey]}" class="w-full rounded-md mb-1" />` : ''}
                <div class="text-[11px] font-bold text-white">${mc.name}${avail > 1 ? ` <span class="text-amber-300">×${avail}</span>` : (!avail ? " (0)" : "")}</div>
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
        ? '본인 고양이를 선택하면 이동 가능한 교차로가 주황색으로 표시됩니다.'
        : localUI.catMode === 'search'
        ? '🔍 단서 수색 중: 초록색으로 표시된 인접 칸을 한 칸씩 클릭해 차례대로 탐색하세요 (발견 시 즉시 종료!).'
        : localUI.catMode === 'capture'
        ? '🎯 포획 시도: 빨간색으로 표시된 인접 칸 1곳을 클릭하세요!'
        : game.cats[localUI.selectedCatId]?.sprintMode ? '💨 [날쌘 걸음 ON] 3칸 범위의 주황색 교차로를 클릭한 뒤 아래 [3칸 이동 확정] 버튼을 누르세요!' : '주황색 교차로를 클릭해 이동(0~2칸)한 뒤, 아래 [단서 수색] 또는 [포획 시도] 버튼을 누르세요.')
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
        ${game.cats.map(c => {
          const isMine = (me.seatIndices || []).includes(c.id);
          return `
          <div onclick="${(!isMine || c.actedThisTurn) ? '' : `pickCat(${c.id})`}" class="p-2.5 rounded-xl border transition ${c.actedThisTurn ? 'bg-stone-900/40 border-stone-800 opacity-45' : isMine ? 'bg-orange-500/20 border-orange-400 cursor-pointer' : 'bg-stone-900/60 border-stone-800 opacity-75'}">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-white">${c.name} <span class="ml-1 text-[10px] px-1.5 py-0.5 rounded ${isMine ? 'bg-orange-500 text-stone-950 font-extrabold' : 'bg-stone-800 text-stone-400'}">${isMine ? '내 말' : (c.isAI ? 'AI 팀원' : '팀원 말')}</span></span>
              <span class="text-[11px] text-amber-300">${c.actedThisTurn ? '✓ 완료' : isMine ? '● 이동·행동 가능' : '조작 불가'}</span>
            </div>
            <div class="mt-1.5 flex flex-wrap gap-1.5">${renderCatCardBadges(c, isMine && !c.actedThisTurn)}</div>
          </div>`;
        }).join('')}
      </div>
      ${localUI.catMode === 'ability' && localUI.activeAbility ? `
        <div class="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/60 text-xs text-amber-200 flex items-center justify-between gap-2">
          <span>✨ 카드 능력 대상 칸/교차로를 보드에서 클릭하세요!</span>
          <button onclick="cancelCatAbility()" class="px-2 py-1 rounded bg-stone-800 text-stone-200 font-bold text-[11px]">취소</button>
        </div>` : ''}
      ${localUI.controllingClone ? `
        <div class="p-2 rounded-xl bg-purple-500/20 border border-purple-400/60 text-xs text-purple-200 font-bold">
          🥷 분신 고양이 조종 중! 보라색 교차로 이동 후 수색/포획을 실행하세요.
        </div>` : ''}
      ${localUI.selectedCatId !== null && localUI.catMoveEdge !== null ? `
        ${!localUI.controllingClone && game.cats[localUI.selectedCatId]?.sprintMode ? `
          <button onclick="execCatSprintOnly()" class="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs">💨 [날쌘 걸음] 3칸 이동 확정 (행동 없음)</button>
        ` : `
          ${game.cats[localUI.selectedCatId]?.searchingThisTurn ? `
            <div class="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/60 space-y-2">
              <div class="text-xs font-bold text-emerald-300">🔍 한 칸씩 단서 수색 진행 중 (발자국 발견 시 즉시 종료)</div>
              <div class="text-[11px] text-stone-300">초록색 칸을 클릭해 계속 탐색하거나 수색을 마칠 수 있습니다.</div>
              <button onclick="endCatSearchEarly()" class="w-full py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs">수색 그만하기 (턴 종료)</button>
            </div>
          ` : `
            <div class="grid grid-cols-2 gap-2 pt-1">
              <button onclick="setCatSearchMode()" class="py-2 rounded-lg ${localUI.catMode === 'search' ? 'bg-emerald-500 text-stone-950' : 'bg-stone-800 hover:bg-stone-700 text-emerald-300 border border-emerald-500/40'} font-extrabold text-xs">🔍 ${localUI.controllingClone ? '분신 ' : ''}단서 수색 (한 칸씩)</button>
              <button  onclick="setCatCaptureMode()" class="py-2 rounded-lg ${localUI.catMode === 'capture' ? 'bg-red-500 text-white' : 'bg-stone-800 hover:bg-stone-700 text-red-300 border border-red-500/40'} font-extrabold text-xs ">🎯 ${localUI.controllingClone ? '분신 ' : ''}포획 시도</button>
            </div>
          `}
        `}` : `<div class="text-[11px] text-stone-400">행동할 고양이를 선택하면 이동 범위 가이드라인과 카드 [발동] 버튼이 활성화됩니다.</div>`}
    `;
  } else if (game.phase === 'DRAFT') {
    const picked = new Set(game.draftPickedCats || []);
    const myUnpickedCats = game.cats.filter(c => (me.seatIndices || []).includes(c.id) && !picked.has(c.id));
    inst.textContent = me.team === 'cat'
      ? `라운드 종료! 공개된 3장의 증강 카드 중 각 고양이가 1장씩 선택합니다 (${picked.size}/3 완료).`
      : `고양이 팀이 각자 증강 카드를 선택하는 중입니다 (${picked.size}/3 완료)...`;
    if (me.team !== 'cat') { el.innerHTML = `<div class="text-xs text-stone-400 text-center py-4">고양이 3마리가 각자 증강 카드를 고르고 있습니다...</div>`; return; }
    el.innerHTML = `
      <div class="space-y-2.5">
        <div class="flex flex-wrap gap-1.5 text-[11px]">
          ${game.cats.map(c => `<span class="px-2 py-0.5 rounded-full border font-bold ${picked.has(c.id) ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300' : 'bg-stone-900 border-stone-700 text-stone-300'}">${c.name} ${picked.has(c.id) ? '✓ 완료' : '대기'}</span>`).join('')}
        </div>
        ${myUnpickedCats.length ? `
          <div class="grid grid-cols-3 gap-2">
            ${game.draftOptions.map((c, idx) => `
              <button onclick="pickDraft(${idx})" class="p-2 rounded-xl border text-center transition ${localUI.draftCardIdx === idx ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-300' : 'bg-stone-900 border-stone-700 hover:border-amber-400/60'}">
                ${ASSETS?.[c.id] ? `<img src="${ASSETS[c.id]}" class="w-full rounded-lg mb-1" />` : ''}
                <div class="text-[11px] font-bold text-amber-300 leading-tight">${c.name}</div>
                <div class="text-[10px] text-stone-300 mt-1 leading-snug">${c.desc}</div>
              </button>`).join('')}
          </div>
          ${localUI.draftCardIdx !== null ? `<div class="flex flex-wrap gap-1.5 pt-1">${myUnpickedCats.map(c => `<button onclick="equipDraft(${c.id})" class="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-stone-950 font-extrabold text-xs">${c.name}에 장착</button>`).join('')}</div>` : '<div class="text-[11px] text-amber-200 text-center">위에서 장착할 카드를 먼저 클릭하세요.</div>'}
        ` : `<div class="text-xs text-emerald-300 text-center py-3 font-bold">✓ 내 고양이 증강 선택 완료! 다른 고양이의 선택을 기다리는 중...</div>`}
      </div>`;
  }
}

window.pickMouse = id => { if (!(roomState?.me?.seatIndices || []).includes(id)) { showToast('본인이 조종하는 생쥐 말만 움직일 수 있습니다!'); return; } localUI.selectedMouseId = id; localUI.selectedMouseCard = null; renderAll(); };
window.toggleMCard = cid => { localUI.selectedMouseCard = localUI.selectedMouseCard === cid ? null : cid; renderAll(); };
window.confirmMouse = () => socket.emit('game:action', { type: 'confirmMouseTurn' });
window.pickCat = id => { if (!(roomState?.me?.seatIndices || []).includes(id)) { showToast('본인이 조종하는 고양이 말만 움직일 수 있습니다!'); return; } localUI.selectedCatId = id; localUI.catMoveEdge = roomState.game.cats[id].edgeId; localUI.catMode = roomState.game.cats[id].searchingThisTurn ? 'search' : 'move'; renderAll(); };
window.setCatCaptureMode = () => { localUI.catMode = 'capture'; showToast('빨간색으로 표시된 인접 원형 칸 중 1곳을 클릭하세요!'); renderAll(); };
window.cancelCatAbility = () => {
  localUI.catMode = 'move';
  localUI.activeAbility = null;
  renderAll();
};

window.useCatAbility = (catId, cardId) => {
  if (!(roomState?.me?.seatIndices || []).includes(catId)) return showToast('본인이 조종하는 고양이 카드만 발동할 수 있습니다!');
  if (localUI.catMode === 'ability' && localUI.activeAbility?.cardId === cardId) {
    cancelCatAbility();
    return;
  }
  // Instant server abilities (no board target click needed)
  if (cardId === 'silver_1') {
    const c = roomState?.game?.cats?.[catId];
    localUI.selectedCatId = catId;
    localUI.catMoveEdge = c ? c.edgeId : localUI.catMoveEdge;
    localUI.catMode = 'move';
    localUI.activeAbility = null;
    localUI.controllingClone = false;
    socket.emit('game:action', { type: 'catAction', catId, ability: { cardId: 'silver_1' } });
    showToast(c?.sprintMode ? '날쌘 걸음 해제 (기본 2칸 이동)' : '💨 [날쌘 걸음] ON! 3칸 범위 교차로를 클릭한 뒤 아래 [3칸 이동 확정]을 누르세요.');
    return;
  }
  if (['gold_1', 'gold_5'].includes(cardId)) {
    localUI.selectedCatId = catId;
    socket.emit('game:action', { type: 'catAction', catId, ability: { cardId } });
    return;
  }
  if (cardId === 'gold_4') {
    socket.emit('game:action', { type: 'catAction', catId, ability: { cardId: 'gold_4' } });
    localUI.controllingClone = true;
    localUI.catMode = 'move';
    localUI.catMoveEdge = roomState.game.cloneCat?.edgeId ?? roomState.game.cats[catId].edgeId;
    showToast('🥷 분신 고양이 소환! 보라색 교차로로 이동 후 수색/포획하세요.');
    renderAll();
    return;
  }
  // Target-click abilities: bronze_1 (edge), bronze_5 (ally edge), bronze_3 (node), silver_2 (node)
  localUI.catMode = 'ability';
  localUI.activeAbility = { catId, cardId };
  const msgs = {
    bronze_1: '⚡ 다른 고양이와 인접한 하늘색 빈 교차로를 클릭하세요!',
    bronze_5: '📢 부를 다른 고양이(하늘색 표시)를 클릭하세요!',
    bronze_3: '🔔 방울을 설치할 원형 칸 1곳을 클릭하세요!',
    silver_2: '🚧 이번 라운드 봉쇄할 원형 칸 1곳을 클릭하세요!'
  };
  showToast(msgs[cardId] || '대상을 보드에서 클릭하세요!');
  renderAll();
};

window.execCatSprintOnly = () => {
  socket.emit('game:action', { type: 'catAction', catId: localUI.selectedCatId, edgeId: localUI.catMoveEdge, actionType: 'search', targetNodes: [] });
  localUI.selectedCatId = null; localUI.catMoveEdge = null; localUI.catMode = 'search'; localUI.controllingClone = false;
};

window.setCatSearchMode = () => {
  localUI.catMode = 'search';
  showToast('🔍 초록색으로 표시된 주변 칸을 한 칸씩 클릭해 탐색하세요!');
  renderAll();
};
window.endCatSearchEarly = () => {
  socket.emit('game:action', { type: 'catAction', catId: localUI.selectedCatId, edgeId: localUI.catMoveEdge, actionType: 'searchEnd', isClone: localUI.controllingClone });
  localUI.selectedCatId = null; localUI.catMoveEdge = null; localUI.catMode = 'move'; localUI.controllingClone = false;
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

  // Draw Quadrant Labels A, B, C, D
  const qSc = canvas.width / GRAPH.width;
  const qBadges = [
    { label: 'A', x: 310, y: 310 },
    { label: 'B', x: 940, y: 310 },
    { label: 'C', x: 310, y: 930 },
    { label: 'D', x: 940, y: 930 }
  ];
  ctx.save();
  ctx.font = `900 ${Math.round(54 * qSc)}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  qBadges.forEach(q => {
    ctx.fillStyle = 'rgba(120, 75, 30, 0.22)';
    ctx.fillText(q.label, q.x * qSc, q.y * qSc);
  });
  ctx.restore();

  const { game, me } = roomState;
  const sc = canvas.width / GRAPH.width;

  // === REPLAY MODE OVERRIDE RENDERING ===
  if (localUI.replayActive && game.replayFrames?.length) {
    const f = game.replayFrames[localUI.replayIdx];
    if (f) {
      f.cluesPast.forEach(nid => { ctx.save(); ctx.globalAlpha = 0.45; drawSprite('token_clue', NODES[nid].x, NODES[nid].y, 44); ctx.restore(); });
      f.cluesCurrent.forEach(nid => drawSprite('token_clue', NODES[nid].x, NODES[nid].y, 48));
      if (f.bellNode && NODES[f.bellNode]) drawSprite('token_aug1', NODES[f.bellNode].x, NODES[f.bellNode].y, 50);
      if (f.blockedNode && NODES[f.blockedNode]) drawSprite('token_aug2', NODES[f.blockedNode].x, NODES[f.blockedNode].y, 50);

      f.mice.forEach(m => {
        if (m.trail && m.trail.length > 1) {
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = m.id === 0 ? 'rgba(56,189,248,0.75)' : 'rgba(168,85,247,0.75)';
          ctx.lineWidth = 5 * sc;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          m.trail.forEach((nid, i) => {
            const n = NODES[nid];
            if (!n) return;
            if (i === 0) ctx.moveTo(n.x * sc, n.y * sc);
            else ctx.lineTo(n.x * sc, n.y * sc);
          });
          ctx.stroke();
          ctx.restore();
        }
      });

      f.cheeses.forEach(c => {
        if (c.stolenBy !== null || !NODES[c.nodeId]) return;
        const n = NODES[c.nodeId];
        drawRing(n.x, n.y, 24, '#f59e0b', 'rgba(245,158,11,0.35)', 4);
        ctx.font = `bold ${Math.round(22 * sc)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🧀', n.x * sc, n.y * sc);
      });

      f.mice.forEach(m => {
        if (!m.pos || !NODES[m.pos]) return;
        const n = NODES[m.pos];
        drawRing(n.x, n.y, 24, m.id === 0 ? '#38bdf8' : '#a855f7', 'rgba(15,23,42,0.55)', 4);
        drawSprite(m.img, n.x, n.y, 38);
      });

      f.cats.forEach(c => {
        if (c.edgeId === null || !EDGES[c.edgeId]) return;
        drawSprite(c.img, EDGES[c.edgeId].x, EDGES[c.edgeId].y, 38);
      });
      if (f.cloneCat?.active && f.cloneCat.edgeId !== null && EDGES[f.cloneCat.edgeId]) {
        drawSprite('cat_4', EDGES[f.cloneCat.edgeId].x, EDGES[f.cloneCat.edgeId].y, 36);
      }
      return;
    }
  }

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
    if (localUI.catMode === 'ability' && localUI.activeAbility) {
      const { catId, cardId } = localUI.activeAbility;
      if (cardId === 'bronze_1') {
        const occ = getCatOccupiedEdges(game);
        game.cats.forEach(o => {
          if (o.id !== catId && o.edgeId !== null) (EDGE_ADJ[o.edgeId] || []).forEach(eid => {
            if (!occ.has(eid)) drawRing(EDGES[eid].x, EDGES[eid].y, 16, '#38bdf8', 'rgba(56,189,248,0.38)', 4);
          });
        });
      } else if (cardId === 'bronze_5') {
        game.cats.forEach(o => {
          if (o.id !== catId && o.edgeId !== null) drawRing(EDGES[o.edgeId].x, EDGES[o.edgeId].y, 24, '#38bdf8', 'rgba(56,189,248,0.30)', 4);
        });
      } else {
        GRAPH.nodes.forEach(n => drawRing(n.x, n.y, 18, 'rgba(250,204,21,0.65)', 'rgba(250,204,21,0.12)', 2.5));
      }
    } else {
      const isClone = localUI.controllingClone;
      const cat = game.cats[localUI.selectedCatId];
      if (!cat?.searchingThisTurn) {
        const reachable = isClone ? getCloneReachableEdges(game) : getCatReachableEdges(game, localUI.selectedCatId);
        reachable.forEach(eid => {
          const isChosen = (eid === localUI.catMoveEdge);
          const col = isChosen ? '#facc15' : (isClone ? '#c084fc' : '#fb923c');
          const fill = isChosen ? 'rgba(250,204,21,0.38)' : (isClone ? 'rgba(192,132,252,0.32)' : 'rgba(251,146,60,0.32)');
          drawRing(EDGES[eid].x, EDGES[eid].y, isChosen ? 21 : 14, col, fill, isChosen ? 4 : 3);
        });
      }
      if (localUI.catMoveEdge !== null && (localUI.catMode === 'search' || localUI.catMode === 'capture')) {
        const adjNodes = getCatAdjacentNodes(localUI.catMoveEdge, !isClone && catHasLonelyBonus(game, cat));
        const searched = new Set(cat?.searchedNodes || []);
        const isCap = (localUI.catMode === 'capture');
        adjNodes.forEach(nid => {
          if (!isCap && searched.has(nid)) {
            drawRing(NODES[nid].x, NODES[nid].y, 22, '#78716c', 'rgba(120,113,108,0.35)', 3);
          } else {
            drawRing(NODES[nid].x, NODES[nid].y, 24, isCap ? '#ef4444' : '#4ade80', isCap ? 'rgba(239,68,68,0.32)' : 'rgba(74,222,128,0.32)', 4);
          }
        });
      }
    }
  }

  // Semi-transparent circles on checked nodes when room setting showCatChecks is ON
  if (localUI.catChecksEnabled !== false && game.showCatChecks && game.catCheckedNodes?.length) {
    const seen = new Set();
    game.catCheckedNodes.forEach(it => {
      if (seen.has(it.nodeId) || !NODES[it.nodeId]) return;
      seen.add(it.nodeId);
      const n = NODES[it.nodeId];
      drawRing(n.x, n.y, 21, it.hit ? 'rgba(52,211,153,0.55)' : 'rgba(148,163,184,0.55)', it.hit ? 'rgba(52,211,153,0.18)' : 'rgba(148,163,184,0.24)', 2.5);
    });
  }

  // Augment Tokens (증강 토큰1 = 쥐목에 방울 달기, 증강 토큰2 = 넌 못 지나간다.)
  if (game.bellNode && NODES[game.bellNode]) {
    drawSprite('token_aug1', NODES[game.bellNode].x, NODES[game.bellNode].y, 50);
  }
  if (game.blockedNode && game.blockedNodeRound === game.round && NODES[game.blockedNode]) {
    drawSprite('token_aug2', NODES[game.blockedNode].x, NODES[game.blockedNode].y, 50);
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
  if (game.cloneCat?.active && game.cloneCat.edgeId !== null) {
    const ce = EDGES[localUI.controllingClone && localUI.catMoveEdge !== null ? localUI.catMoveEdge : game.cloneCat.edgeId];
    if (ce) {
      drawRing(ce.x, ce.y, 22, '#c084fc', 'rgba(192,132,252,0.25)', 3);
      drawSprite('cat_4', ce.x, ce.y, 36);
    }
  }
}

function findHit(bx, by) {
  const g = roomState?.game;
  const preferEdge = (g && (g.phase === 'SETUP_CATS' || (g.phase === 'CAT_TURN' && localUI.catMode === 'move') || (g.phase === 'CAT_TURN' && localUI.catMode === 'ability' && ['bronze_1','bronze_5'].includes(localUI.activeAbility?.cardId))));
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
    if (localUI.catMode === 'ability' && localUI.activeAbility) {
      const { catId, cardId } = localUI.activeAbility;
      if (['bronze_3', 'silver_2'].includes(cardId) && hit.kind === 'node') {
        socket.emit('game:action', { type: 'catAction', catId, ability: { cardId, nodeId: hit.id } });
        localUI.catMode = 'search'; localUI.activeAbility = null;
        return;
      }
      if (['bronze_1', 'bronze_5'].includes(cardId) && hit.kind === 'edge') {
        socket.emit('game:action', { type: 'catAction', catId, ability: { cardId, edgeId: hit.id } });
        localUI.catMode = 'search'; localUI.activeAbility = null;
        return;
      }
      showToast('하이라이트된 올바른 대상을 클릭하세요.');
      return;
    }
    if (localUI.catMode === 'search' && localUI.selectedCatId !== null && localUI.catMoveEdge !== null && hit.kind === 'node') {
      socket.emit('game:action', { type: 'catAction', catId: localUI.selectedCatId, edgeId: localUI.catMoveEdge, actionType: 'searchStep', targetNodes: [hit.id], isClone: localUI.controllingClone });
      return;
    }
    if (localUI.catMode === 'capture' && localUI.selectedCatId !== null && localUI.catMoveEdge !== null && hit.kind === 'node') {
      socket.emit('game:action', { type: 'catAction', catId: localUI.selectedCatId, edgeId: localUI.catMoveEdge, actionType: 'capture', targetNodes: [hit.id], isClone: localUI.controllingClone });
      localUI.selectedCatId = null; localUI.catMoveEdge = null; localUI.catMode = 'move'; localUI.controllingClone = false;
    } else if (hit.kind === 'edge') {
      if (game.cats[localUI.selectedCatId]?.searchingThisTurn) {
        showToast('이미 수색을 시작했습니다. 초록색 칸을 클릭해 수색을 이어가세요.');
        return;
      }
      if (localUI.selectedCatId === null) {
        const c = game.cats.find(x => (me.seatIndices || []).includes(x.id) && x.edgeId === hit.id && !x.actedThisTurn);
        if (c) { pickCat(c.id); return; }
        showToast('본인의 고양이 말만 조작할 수 있습니다!');
        return;
      }
      if (localUI.selectedCatId !== null) {
        const reachable = localUI.controllingClone ? getCloneReachableEdges(game) : getCatReachableEdges(game, localUI.selectedCatId);
        if (!reachable.includes(hit.id)) {
          showToast('하이라이트된 이동 범위 내의 교차로를 선택하세요.');
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
