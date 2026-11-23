const fs = require('fs');
const path = require('path');

const GRAPH = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../public/data/board_graph.json'), 'utf8')
);

const CAT_CARDS = {
  bronze: [
    { id: 'bronze_1', tier: 'bronze', name: '합류는 기본 소양', tag: '이동', desc: '이번 게임에서 한 번만 다른 고양이와 인접한 칸으로 이동할 수 있다. 그 턴 행동할 수 없다.', once: true, active: true },
    { id: 'bronze_2', tier: 'bronze', name: '증강된 힘', tag: '보조', desc: '다음 라운드에 실버 카드 대신 골드 카드를 뽑습니다.', passive: true },
    { id: 'bronze_3', tier: 'bronze', name: '쥐목에 방울 달기', tag: '정보', desc: '칸 1곳을 고른다. 다음 턴에 쥐가 그 칸을 지나면 즉시 알려야 한다.', active: true },
    { id: 'bronze_4', tier: 'bronze', name: '고양이는 외롭지 않아', tag: '수색', desc: '같은 구역에 다른 고양이가 없다면 수색 범위가 1칸 늘어난다.', passive: true },
    { id: 'bronze_5', tier: 'bronze', name: '니가 와', tag: '팀', desc: '이번 게임에서 한 번만 다른 고양이 한 마리를 자신과 인접한 칸으로 이동시킨다. 이 턴 행동할 수 없다.', once: true, active: true }
  ],
  silver: [
    { id: 'silver_1', tier: 'silver', name: '날쌘 걸음', tag: '이동', desc: '한 칸 더 이동할 수 있다. 그 턴 수색, 포획할 수 없다.', toggle: true },
    { id: 'silver_2', tier: 'silver', name: '넌 못 지나간다.', tag: '방해', desc: '칸 1곳을 고른다. 다음 라운드 동안 쥐는 그 칸을 지나갈 수 없다.', active: true },
    { id: 'silver_3', tier: 'silver', name: '양보단 질', tag: '보조', desc: '브론즈 카드를 1장 없애고, 골드 카드를 1장 뽑는다.', instant: true },
    { id: 'silver_4', tier: 'silver', name: '질보단 양', tag: '보조', desc: '남은 브론즈 카드 두 장을 획득한다.', instant: true },
    { id: 'silver_5', tier: 'silver', name: '실패는 두렵지않아', tag: '이동', desc: '단서 수색을 5번 실패했다면, 원하는 위치로 이동할 수 있다.', passive: true }
  ],
  gold: [
    { id: 'gold_1', tier: 'gold', name: '라면 먹는 중', tag: '팀', desc: '이번 게임 동안 이동할 수 없는 대신 다른 고양이의 행동을 한 번씩 더 수행할 수 있다. 뽑은 능력도 사용 가능하다.', active: true },
    { id: 'gold_2', tier: 'gold', name: '제트 팩 장착!', tag: '팀', desc: '포획할 수 없다. 턴을 1회 추가로 얻고 인접한 아군을 함께 이동시킬 수 있다.', passive: true },
    { id: 'gold_3', tier: 'gold', name: '질보단 양 II', tag: '보조', desc: '남은 실버 카드 두 장을 획득한다.', instant: true },
    { id: 'gold_4', tier: 'gold', name: '금지된 인술', tag: '보조', desc: '행동하는 대신 분신을 하나 조종할 수 있다.', active: true },
    { id: 'gold_5', tier: 'gold', name: '카피닌묘', tag: '보조', desc: '다른 고양이의 카드를 하나 고른다. 그 카드와 같은 효과로 취급한다.', active: true }
  ]
};

const MOUSE_CARDS = [
  { id: 'sprint', imgKey: 'mouse_card_sprint', name: '질주', desc: '도로를 따라 인접한 칸으로 2칸 연속 이동 (교차로의 고양이 무시 통과).' },
  { id: 'wall', imgKey: 'mouse_card_wall', name: '담 넘기', desc: '같은 건물 블록(점선 구역) 안의 건너편 칸으로 즉시 뛰어넘기.' },
  { id: 'hole', imgKey: 'mouse_card_hole', name: '쥐구멍 이동', desc: '쥐구멍 칸에 있을 때 마주 보는 반대편 구역의 쥐구멍으로 즉시 이동.' }
];

// Graph index
const NODES = {};
GRAPH.nodes.forEach(n => { NODES[n.id] = n; });
const EDGES = {};
const NODE_EDGES = {};
const NODE_ADJ = {};
Object.keys(NODES).forEach(id => { NODE_EDGES[id] = []; NODE_ADJ[id] = []; });
GRAPH.edges.forEach(e => {
  EDGES[e.id] = e;
  NODE_EDGES[e.u].push(e.id);
  NODE_EDGES[e.v].push(e.id);
  NODE_ADJ[e.u].push({ to: e.v, edgeId: e.id });
  NODE_ADJ[e.v].push({ to: e.u, edgeId: e.id });
});
const EDGE_ADJ = {};
GRAPH.edges.forEach(e => {
  const s = new Set();
  NODE_EDGES[e.u].forEach(eid => { if (eid !== e.id) s.add(eid); });
  NODE_EDGES[e.v].forEach(eid => { if (eid !== e.id) s.add(eid); });
  EDGE_ADJ[e.id] = Array.from(s);
});

const RED_EDGES = GRAPH.edges.filter(e => e.red).map(e => e.id);
const HOLES = [2, 9, 142, 149];
const QUAD_LETTERS = ['A', 'B', 'C', 'D'];
const OPPOSITE_HOLE = { 2: 149, 149: 2, 9: 142, 142: 9 };
const QUAD_START_BLACKS = {
  0: [1, 2, 3, 11, 12, 13],
  1: [8, 9, 10, 18, 19, 20],
  2: [131, 132, 133, 141, 142, 143],
  3: [138, 139, 140, 148, 149, 150]
};
const WALL_ADJ = GRAPH.wallAdj;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class GameEngine {
  constructor(seats, options = {}) {
    const bronzeDeck = shuffle(CAT_CARDS.bronze.map(c => ({ ...c })));
    const silverDeck = shuffle(CAT_CARDS.silver.map(c => ({ ...c })));
    const goldDeck = shuffle(CAT_CARDS.gold.map(c => ({ ...c })));

    this.state = {
      cheeseMode: options.cheeseMode === 'three' ? 'three' : 'classic',
      round: 1,
      turn: 1,
      phase: 'SETUP_CHEESE', // SETUP_CHEESE, SETUP_MICE, SETUP_CATS, MOUSE_TURN, CAT_TURN, DRAFT, GAME_OVER
      winner: null,
      winReason: '',
      decks: { bronze: bronzeDeck, silver: silverDeck, gold: goldDeck },
      cheeses: [],
      stolenTokens: [],
      cluesCurrent: [],
      cluesPast: [],
      specialTrackMarks: {},
      bellNode: null,
      blockedNode: null,
      blockedNodeRound: 0,
      usedHolesThisRound: [],
      mice: [0, 1].map(i => ({
        id: i,
        name: seats.mice[i]?.name || (i === 0 ? '생쥐 A' : '생쥐 B'),
        isAI: Boolean(seats.mice[i]?.isAI),
        img: `mouse_${i + 1}`,
        pos: null,
        hasCheese: false,
        delivered: false,
        stolenQuad: null,
        allowedStartQuad: null,
        movedThisTurn: false,
        pendingPos: null,
        pendingCard: null,
        cards: { sprint: true, wall: true, hole: true },
        trail: [],
        log: []
      })),
      cats: [0, 1, 2].map(i => ({
        id: i,
        name: seats.cats[i]?.name || `고양이 ${i + 1}`,
        isAI: Boolean(seats.cats[i]?.isAI),
        img: `cat_${i + 1}`,
        edgeId: null,
        cards: [bronzeDeck.pop()],
        usedOnce: {},
        actedThisTurn: false,
        extraTurns: 0,
        failedSearches: 0,
        sprintMode: false,
        searchingThisTurn: false,
        searchedNodes: []
      })),
      cloneCat: { active: false, ownerId: null, edgeId: null },
      setupMouseIdx: 0,
      setupCatIdx: 0,
      relocateAllowedQuads: null,
      draftOptions: [],
      draftTier: 'silver',
      bannerEvent: null,
      lastActionPopup: null,
      publicLog: []
    };
    this.addLog('🎲 1라운드 시작! 생쥐 팀이 치즈 3개를 비밀리에 배치합니다.');
  }

  setBanner(text, tone = 'amber') {
    this.state.bannerEvent = { id: Date.now() + Math.random(), text, tone };
  }

  setActionPopup(text, tone = 'info') {
    this.state.lastActionPopup = { id: Date.now() + Math.random(), text, tone };
  }

  addLog(msg) {
    this.state.publicLog.unshift({ turn: `${this.state.round}R-${this.state.turn}T`, msg });
    if (this.state.publicLog.length > 60) this.state.publicLog.pop();
  }

  requiredCheeseCount() {
    return (this.state.cheeseMode === 'three' || this.state.round === 1) ? 3 : 2;
  }

  catHasCard(cat, cardId) {
    return cat.cards.some(c => c.id === cardId || c.copiedId === cardId);
  }

  getCatOccupiedEdges(excludeCatId = -1, excludeClone = false) {
    const s = new Set();
    this.state.cats.forEach(c => { if (c.id !== excludeCatId && c.edgeId !== null) s.add(c.edgeId); });
    if (!excludeClone && this.state.cloneCat.active && this.state.cloneCat.edgeId !== null) {
      s.add(this.state.cloneCat.edgeId);
    }
    return s;
  }

  catHasLonelyBonus(cat) {
    if (!this.catHasCard(cat, 'bronze_4') || cat.edgeId === null) return false;
    const myQ = NODES[EDGES[cat.edgeId].u].q;
    return !this.state.cats.some(o => o.id !== cat.id && o.edgeId !== null && NODES[EDGES[o.edgeId].u].q === myQ);
  }

  getCatAdjacentNodes(edgeId, extraRange = false) {
    const e = EDGES[edgeId];
    const base = new Set([e.u, e.v]);
    if (extraRange) {
      [e.u, e.v].forEach(nid => NODE_ADJ[nid].forEach(({ to }) => base.add(to)));
    }
    return Array.from(base);
  }

  getMouseLegalMoves(mouseId, cardType = null) {
    const m = this.state.mice[mouseId];
    if (!m || m.delivered || m.pos === null) return [];
    const other = this.state.mice[1 - mouseId];
    const otherPos = other.delivered ? null : (other.pendingPos !== null ? other.pendingPos : other.pos);
    const catEdges = this.getCatOccupiedEdges();
    const blocked = (this.state.blockedNode && this.state.blockedNodeRound === this.state.round) ? this.state.blockedNode : null;
    const usedHoles = new Set(this.state.usedHolesThisRound);
    const out = new Set();

    if (!cardType) {
      NODE_ADJ[m.pos].forEach(({ to, edgeId }) => {
        if (catEdges.has(edgeId) || to === otherPos || to === blocked) return;
        if (HOLES.includes(to) && usedHoles.has(to) && m.hasCheese) return;
        out.add(to);
      });
    } else if (cardType === 'sprint' && m.cards.sprint) {
      NODE_ADJ[m.pos].forEach(({ to: mid }) => {
        if (mid === blocked) return;
        NODE_ADJ[mid].forEach(({ to }) => {
          if (to === m.pos || to === otherPos || to === blocked) return;
          if (HOLES.includes(to) && usedHoles.has(to) && m.hasCheese) return;
          out.add(to);
        });
      });
    } else if (cardType === 'wall' && m.cards.wall) {
      (WALL_ADJ[String(m.pos)] || []).forEach(to => {
        if (to === otherPos || to === blocked) return;
        if (HOLES.includes(to) && usedHoles.has(to) && m.hasCheese) return;
        out.add(to);
      });
    } else if (cardType === 'hole' && m.cards.hole && HOLES.includes(m.pos)) {
      const opp = OPPOSITE_HOLE[m.pos];
      if (opp && opp !== otherPos && opp !== blocked && !(usedHoles.has(opp) && m.hasCheese)) {
        out.add(opp);
      }
    }
    return Array.from(out);
  }

  getCatReachableEdges(catId, isClone = false) {
    const cat = isClone ? this.state.cloneCat : this.state.cats[catId];
    if (!cat || cat.edgeId === null) return [];
    if (!isClone && this.catHasCard(cat, 'gold_1')) return [cat.edgeId];
    const occupied = this.getCatOccupiedEdges(isClone ? -1 : catId, isClone);
    if (!isClone && this.catHasCard(cat, 'silver_5') && cat.failedSearches >= 5) {
      return GRAPH.edges.map(e => e.id).filter(eid => eid === cat.edgeId || !occupied.has(eid));
    }
    const maxSteps = (!isClone && cat.sprintMode && this.catHasCard(cat, 'silver_1')) ? 3 : 2;
    const dist = { [cat.edgeId]: 0 };
    const q = [cat.edgeId];
    while (q.length) {
      const cur = q.shift();
      if (dist[cur] >= maxSteps) continue;
      for (const nxt of EDGE_ADJ[cur]) {
        if (dist[nxt] === undefined) {
          dist[nxt] = dist[cur] + 1;
          q.push(nxt);
        }
      }
    }
    return Object.keys(dist).map(Number).filter(eid => eid === cat.edgeId || !occupied.has(eid));
  }

  // === ACTIONS ===
  placeCheese(nodeId) {
    if (this.state.phase !== 'SETUP_CHEESE') return { error: '치즈 배치 단계가 아닙니다.' };
    const n = NODES[nodeId];
    if (!n || n.type !== 'white') return { error: '치즈는 하얀 원형 칸에만 배치할 수 있습니다.' };
    const existing = this.state.cheeses.find(c => c.nodeId === nodeId);
    if (existing) {
      if (!existing.carriedOver) {
        this.state.cheeses = this.state.cheeses.filter(c => c.nodeId !== nodeId);
      }
      return { ok: true };
    }
    if (this.state.cheeses.some(c => c.quad === n.q)) return { error: '한 구역에는 치즈를 1개만 배치할 수 있습니다.' };
    if (this.state.relocateAllowedQuads && !this.state.relocateAllowedQuads.includes(n.q)) {
      return { error: '생쥐가 없고 기존 치즈도 없는 빈 구역에 배치하세요.' };
    }
    this.state.cheeses.push({ nodeId, quad: n.q, stolenBy: null, carriedOver: false });

    if (this.state.cheeses.length >= this.requiredCheeseCount()) {
      if (this.state.round === 1 || this.state.cheeseMode === 'three') {
        this.state.phase = 'SETUP_MICE';
        this.state.setupMouseIdx = 0;
        const usedQ = new Set(this.state.cheeses.map(c => c.quad));
        const startQ = [0, 1, 2, 3].find(q => !usedQ.has(q));
        this.state.mice.forEach(m => { m.allowedStartQuad = startQ; m.pos = null; });
      } else {
        this.startMouseTurn();
      }
    }
    return { ok: true };
  }

  placeMouseStart(nodeId) {
    if (this.state.phase !== 'SETUP_MICE') return { error: '생쥐 시작 위치 선택 단계가 아닙니다.' };
    const m = this.state.mice[this.state.setupMouseIdx];
    if (!QUAD_START_BLACKS[m.allowedStartQuad].includes(nodeId)) {
      return { error: '지정된 구역의 쥐구멍 앞 검은 칸 6곳 중 하나를 선택하세요.' };
    }
    if (this.state.mice[1 - m.id].pos === nodeId) {
      return { error: '두 생쥐는 같은 칸에서 시작할 수 없습니다.' };
    }
    m.pos = nodeId;
    m.trail = [nodeId];
    m.log.push(`0턴 시작: #${nodeId}`);

    if (this.state.setupMouseIdx === 0) {
      this.state.setupMouseIdx = 1;
    } else if (this.state.round === 1) {
      this.state.phase = 'SETUP_CATS';
      this.state.setupCatIdx = 0;
      this.addLog('🐭 생쥐 팀이 치즈 3개와 시작 위치를 비밀리에 확정했습니다.');
    } else if (this.state.cheeseMode === 'three') {
      this.addLog(`🐭 ${this.state.round}라운드(치즈 3개 모드): 생쥐 팀이 빈 구역 쥐구멍 앞에서 출발합니다!`);
      this.startMouseTurn();
    } else {
      this.state.stolenTokens = [];
      const occQ = new Set([this.state.mice[0].allowedStartQuad, this.state.mice[1].allowedStartQuad, ...this.state.cheeses.map(c => c.quad)]);
      this.state.relocateAllowedQuads = [0, 1, 2, 3].filter(q => !occQ.has(q));
      this.state.phase = 'SETUP_CHEESE';
      this.addLog(`🐭 ${this.state.round}라운드: 생쥐 팀이 새 시작 위치를 정하고 치즈를 배치합니다.`);
    }
    return { ok: true };
  }

  placeCatStart(edgeId) {
    if (this.state.phase !== 'SETUP_CATS') return { error: '고양이 초기 배치 단계가 아닙니다.' };
    if (!RED_EDGES.includes(edgeId)) return { error: '중앙의 붉은 교차로 4곳 중 하나를 선택하세요.' };
    if (this.state.cats.some(c => c.edgeId === edgeId)) return { error: '이미 다른 고양이가 배치된 교차로입니다.' };
    const cat = this.state.cats[this.state.setupCatIdx];
    cat.edgeId = edgeId;
    this.addLog(`🐱 ${cat.name} 배치 완료 (브론즈 증강: [${cat.cards[0].name}])`);
    if (this.state.setupCatIdx < 2) {
      this.state.setupCatIdx++;
    } else {
      this.startMouseTurn();
    }
    return { ok: true };
  }

  startMouseTurn() {
    this.state.phase = 'MOUSE_TURN';
    this.state.mice.forEach(m => {
      m.movedThisTurn = m.delivered;
      m.pendingPos = null;
      m.pendingCard = null;
    });
  }

  stageMouseMove(mouseId, nodeId, cardType = null) {
    if (this.state.phase !== 'MOUSE_TURN') return { error: '생쥐 팀 턴이 아닙니다.' };
    const m = this.state.mice[mouseId];
    if (!m || m.delivered) return { error: '이미 배달 완료한 생쥐입니다.' };
    const legal = this.getMouseLegalMoves(mouseId, cardType);
    if (!legal.includes(nodeId)) return { error: '이동할 수 없는 칸입니다.' };
    m.pendingPos = nodeId;
    m.pendingCard = cardType;
    m.movedThisTurn = true;
    return { ok: true };
  }

  confirmMouseTurn() {
    if (this.state.phase !== 'MOUSE_TURN') return { error: '생쥐 팀 턴이 아닙니다.' };
    if (this.state.mice.some(m => !m.delivered && !m.movedThisTurn)) {
      return { error: '활동 중인 모든 생쥐의 이동을 선택하세요.' };
    }
    this.state.mice.forEach(m => {
      if (m.delivered || m.pendingPos === null) return;
      const prev = m.pos;
      m.pos = m.pendingPos;
      m.trail.push(m.pos);
      let cardNote = '';
      if (m.pendingCard) {
        m.cards[m.pendingCard] = false;
        const cname = MOUSE_CARDS.find(c => c.id === m.pendingCard).name;
        cardNote = ` [${cname}]`;
        if (!this.state.specialTrackMarks[this.state.turn]) this.state.specialTrackMarks[this.state.turn] = [];
        this.state.specialTrackMarks[this.state.turn].push(m.id === 0 ? 'A' : 'B');
        const cmsg = `🎴 ${m.name}가 특수 카드를 사용했습니다! (카드 비공개)`;
        this.addLog(cmsg);
        this.setBanner(cmsg, 'mouse');
      }
      m.log.push(`${this.state.turn}턴: #${prev} → #${m.pos}${cardNote}`);

      if (this.state.bellNode && m.pos === this.state.bellNode) {
        this.addLog(`🔔 [쥐목에 방울 달기] 발동! 생쥐가 #${this.state.bellNode}번 칸을 지났습니다!`);
      }

      const ch = this.state.cheeses.find(c => c.nodeId === m.pos && c.stolenBy === null);
      if (ch && !m.hasCheese) {
        ch.stolenBy = m.id;
        m.hasCheese = true;
        m.stolenQuad = ch.quad;
        const prevTurn = this.state.turn;
        this.state.turn = Math.max(1, this.state.turn - 3);
        const qLabel = QUAD_LETTERS[ch.quad] || '?';
        const msg = `🧀 ${qLabel} 구역 치즈가 도둑맞았습니다! (턴 -3: ${prevTurn}턴 → ${this.state.turn}턴)`;
        this.addLog(msg);
        this.setBanner(msg, 'cheese');
        this.setActionPopup(msg, 'found');
      }

      if (m.hasCheese && HOLES.includes(m.pos) && !this.state.usedHolesThisRound.includes(m.pos)) {
        m.delivered = true;
        this.state.usedHolesThisRound.push(m.pos);
        this.addLog(`🕳️ ${m.name}가 #${m.pos}번 쥐구멍에 치즈 배달 완료! (포획 면역)`);
      }
      m.pendingPos = null;
      m.pendingCard = null;
    });

    this.state.bellNode = null;
    if (this.state.mice.every(m => m.delivered)) {
      this.handleRoundClear();
    } else {
      this.startCatTurn();
    }
    return { ok: true };
  }

  startCatTurn() {
    this.state.phase = 'CAT_TURN';
    this.state.cats.forEach(c => {
      c.actedThisTurn = false;
      c.extraTurns = this.catHasCard(c, 'gold_2') ? 1 : 0;
      c.sprintMode = false;
      c.searchingThisTurn = false;
      c.searchedNodes = [];
    });
  }

  catAction({ catId, edgeId, actionType, targetNodes = [], ability = null, isClone = false }) {
    if (this.state.phase !== 'CAT_TURN') return { error: '고양이 팀 턴이 아닙니다.' };
    const cat = this.state.cats[catId];
    if (!cat || cat.actedThisTurn) return { error: '이미 행동한 고양이입니다.' };

    // Active card abilities
    if (ability) {
      if (ability.cardId === 'bronze_3' && ability.nodeId) {
        this.state.bellNode = ability.nodeId;
        this.addLog(`🔔 ${cat.name}가 [쥐목에 방울 달기] 카드를 사용했습니다!`);
        this.setBanner(`✨ ${cat.name}가 [쥐목에 방울 달기] 카드를 사용했습니다!`, 'cat');
        return { ok: true };
      }
      if (ability.cardId === 'silver_2' && ability.nodeId) {
        this.state.blockedNode = ability.nodeId;
        this.state.blockedNodeRound = this.state.round;
        this.addLog(`🚧 ${cat.name}가 [넌 못 지나간다.]로 #${ability.nodeId}번 칸을 봉쇄했습니다!`);
        this.setBanner(`✨ ${cat.name}가 [넌 못 지나간다.] 카드를 사용했습니다!`, 'cat');
        return { ok: true };
      }
      if (ability.cardId === 'bronze_1' && !cat.usedOnce.bronze_1) {
        const occ = this.getCatOccupiedEdges();
        const valid = this.state.cats.some(o => o.id !== catId && EDGE_ADJ[o.edgeId].includes(ability.edgeId)) && !occ.has(ability.edgeId);
        if (!valid) return { error: '다른 고양이 인접 빈 교차로를 선택하세요.' };
        cat.edgeId = ability.edgeId;
        cat.usedOnce.bronze_1 = true;
        this.addLog(`⚡ ${cat.name}가 [합류는 기본 소양]으로 합류했습니다! (행동 불가)`);
        this.setBanner(`✨ ${cat.name}가 [합류는 기본 소양] 카드를 사용했습니다!`, 'cat');
        this.finishCat(catId);
            return { ok: true };
      }
      if (ability.cardId === 'bronze_5' && !cat.usedOnce.bronze_5) {
        const target = this.state.cats.find(o => o.id !== catId && o.edgeId === ability.edgeId);
        if (!target) return { error: '소환할 다른 고양이를 선택하세요.' };
        const free = EDGE_ADJ[cat.edgeId].find(eid => !this.getCatOccupiedEdges().has(eid));
        if (free === undefined) return { error: '인접 빈 교차로가 없습니다.' };
        target.edgeId = free;
        cat.usedOnce.bronze_5 = true;
        this.addLog(`📢 ${cat.name}가 [니가 와]로 ${target.name}을(를) 소환했습니다! (행동 불가)`);
        this.setBanner(`✨ ${cat.name}가 [니가 와] 카드를 사용했습니다!`, 'cat');
        this.finishCat(catId);
            return { ok: true };
      }
      if (ability.cardId === 'silver_1') {
        cat.sprintMode = !cat.sprintMode;
        if (cat.sprintMode) {
          this.addLog(`💨 ${cat.name}가 [날쌘 걸음] 카드를 활성화했습니다!`);
          this.setBanner(`✨ ${cat.name}가 [날쌘 걸음] 카드를 사용했습니다!`, 'cat');
        }
        return { ok: true };
      }
      if (ability.cardId === 'gold_4') {
        if (!this.state.cloneCat.active) {
          const free = EDGE_ADJ[cat.edgeId].find(eid => !this.getCatOccupiedEdges().has(eid)) ?? cat.edgeId;
          this.state.cloneCat = { active: true, ownerId: catId, edgeId: free };
          this.addLog(`🥷 ${cat.name}가 [금지된 인술]로 분신 고양이를 소환했습니다!`);
          this.setBanner(`✨ ${cat.name}가 [금지된 인술] 카드를 사용했습니다!`, 'cat');
        }
        return { ok: true };
      }
      if (ability.cardId === 'gold_1') {
        const other = this.state.cats.find(o => o.id !== catId && o.actedThisTurn);
        if (!other) return { error: '행동을 마친 다른 고양이가 없습니다.' };
        other.actedThisTurn = false;
        this.addLog(`🍜 ${cat.name}가 [라면 먹는 중]으로 ${other.name}에게 추가 행동을 부여했습니다!`);
        this.setBanner(`✨ ${cat.name}가 [라면 먹는 중] 카드를 사용했습니다!`, 'cat');
        this.finishCat(catId);
            return { ok: true };
      }
      if (ability.cardId === 'gold_5') {
        const otherCards = [];
        this.state.cats.forEach(o => { if (o.id !== catId) o.cards.forEach(c => otherCards.push(c)); });
        if (otherCards.length) {
          const copy = otherCards[0];
          const myCard = cat.cards.find(c => c.id === 'gold_5');
          if (myCard) {
            myCard.copiedId = copy.id;
            myCard.desc = `[복사됨: ${copy.name}] ${copy.desc}`;
            this.addLog(`🎭 ${cat.name}가 [카피닌묘]로 [${copy.name}] 능력을 복사했습니다!`);
            this.setBanner(`✨ ${cat.name}가 [카피닌묘] 카드를 사용했습니다!`, 'cat');
          }
        }
        return { ok: true };
      }
    }

    // Move validation (if already mid-search, stay locked on current edge!)
    const actor = isClone ? this.state.cloneCat : cat;
    const prevEdge = actor.edgeId;
    if (!cat.searchingThisTurn) {
      const legalEdges = this.getCatReachableEdges(catId, isClone);
      if (!legalEdges.includes(edgeId)) return { error: '이동할 수 없는 교차로입니다.' };
      actor.edgeId = edgeId;
    } else {
      edgeId = actor.edgeId;
    }

    if (!isClone && this.catHasCard(cat, 'gold_2') && prevEdge !== edgeId) {
      const adjAlly = this.state.cats.find(o => o.id !== catId && EDGE_ADJ[prevEdge].includes(o.edgeId));
      if (adjAlly) {
        const free = EDGE_ADJ[edgeId].find(eid => !this.getCatOccupiedEdges().has(eid));
        if (free !== undefined) {
          adjAlly.edgeId = free;
          this.addLog(`🚀 [제트 팩 장착!] ${cat.name}가 ${adjAlly.name}을(를) 함께 이동시켰습니다!`);
        }
      }
    }

    if (!isClone && cat.sprintMode && this.catHasCard(cat, 'silver_1')) {
      this.addLog(`💨 ${cat.name}가 [날쌘 걸음]으로 질주 이동했습니다 (행동 불가).`);
      this.finishCat(catId);
        return { ok: true };
    }

    const adj = this.getCatAdjacentNodes(edgeId, !isClone && this.catHasLonelyBonus(cat));
    const actorName = isClone ? '분신 고양이' : cat.name;

    if (actionType === 'searchStep') {
      const nid = targetNodes[0];
      if (!adj.includes(nid)) return { error: '현재 고양이의 수색 범위 내 칸을 클릭하세요.' };
      if (cat.searchedNodes.includes(nid)) return { error: '이번 턴에 이미 수색한 칸입니다.' };
      cat.searchingThisTurn = true;
      cat.searchedNodes.push(nid);

      const activeTrails = new Set();
      this.state.mice.forEach(m => { if (!m.delivered) m.trail.forEach(t => activeTrails.add(t)); });
      if (activeTrails.has(nid)) {
        if (!this.state.cluesCurrent.includes(nid) && this.state.cluesCurrent.length + this.state.cluesPast.length < 25) {
          this.state.cluesCurrent.push(nid);
        }
        const msg = `🐾 ${actorName} #${nid}번 칸 수색 → 발자국 발견! (수색 즉시 종료)`;
        this.addLog(msg);
        this.setBanner(msg, 'cat');
        this.setActionPopup(`🐾 #${nid}번 칸에서 흔적을 발견했습니다!`, 'found');
        this.finishCat(catId);
      } else {
        const remaining = adj.filter(x => !cat.searchedNodes.includes(x));
        this.addLog(`🔍 ${actorName} #${nid}번 칸 수색 → 흔적 없음${remaining.length ? ` (남은 칸 ${remaining.length}곳)` : ''}`);
        this.setActionPopup(`🔍 #${nid}번 칸에 흔적이 없습니다.`, 'miss');
        if (remaining.length === 0) {
          if (!isClone) cat.failedSearches++;
          this.finishCat(catId);
        }
      }
    } else if (actionType === 'searchEnd') {
      if (!cat.searchingThisTurn) return { error: '진행 중인 수색이 없습니다.' };
      if (!isClone) cat.failedSearches++;
      this.addLog(`🔍 ${actorName} 수색 종료`);
      this.finishCat(catId);
    } else if (actionType === 'search') {
      // Used by AI: search adjacent nodes one by one, stopping immediately on first clue hit!
      const validTargets = shuffle(targetNodes.filter(nid => adj.includes(nid)));
      if (!validTargets.length) return { error: '수색할 인접 칸을 1곳 이상 선택하세요.' };
      const activeTrails = new Set();
      this.state.mice.forEach(m => { if (!m.delivered) m.trail.forEach(t => activeTrails.add(t)); });
      let hitNode = null;
      const checked = [];
      for (const nid of validTargets) {
        checked.push(nid);
        if (activeTrails.has(nid)) {
          hitNode = nid;
          if (!this.state.cluesCurrent.includes(nid) && this.state.cluesCurrent.length + this.state.cluesPast.length < 25) {
            this.state.cluesCurrent.push(nid);
          }
          break;
        }
      }
      if (hitNode !== null) {
        this.addLog(`🐾 ${actorName} 수색(${checked.map(n=>'#'+n).join('→')}) → #${hitNode}번 칸 발자국 발견! (수색 종료)`);
        this.setActionPopup(`🐾 ${actorName}: #${hitNode}번 칸에서 흔적을 발견했습니다!`, 'found');
      } else {
        if (!isClone) cat.failedSearches++;
        this.addLog(`🔍 ${actorName} 수색(${checked.map(n=>'#'+n).join(', ')}) → 흔적 없음`);
        this.setActionPopup(`🔍 ${actorName}: 주변 구역에 흔적이 없습니다.`, 'miss');
      }
      this.finishCat(catId);
    } else if (actionType === 'capture') {
      if (cat.searchingThisTurn) return { error: '이미 수색을 시작해 포획할 수 없습니다.' };
      if (!isClone && this.catHasCard(cat, 'gold_2')) return { error: '[제트 팩 장착!] 고양이는 포획할 수 없습니다.' };
      const target = targetNodes[0];
      if (!adj.includes(target)) return { error: '인접한 원형 칸 1곳을 선택하세요.' };
      const caught = this.state.mice.find(m => !m.delivered && m.pos === target);
      if (caught) {
        this.addLog(`💥 ${actorName}가 #${target}번 칸 포획 성공!! ${caught.name} 검거!`);
        this.setActionPopup(`💥 #${target}번 칸 포획 성공! ${caught.name} 검거!`, 'found');
        this.state.phase = 'GAME_OVER';
        this.state.winner = 'cat';
        this.state.winReason = `${actorName}가 #${target}번 칸에서 ${caught.name}를 포획했습니다!`;
        return { ok: true };
      }
      this.addLog(`❌ ${actorName}가 #${target}번 칸 포획 시도 → 실패!`);
      this.setActionPopup(`❌ #${target}번 칸 포획 실패! 흔적이 없습니다.`, 'fail');
      this.finishCat(catId);
    } else {
      return { error: '올바른 행동을 선택하세요.' };
    }
    return { ok: true };
  }

  finishCat(catId) {
    const cat = this.state.cats[catId];
    if (cat.extraTurns > 0) {
      cat.extraTurns--;
      return;
    }
    cat.actedThisTurn = true;
    cat.sprintMode = false;
    cat.searchingThisTurn = false;
    cat.searchedNodes = [];
    if (this.state.cats.every(c => c.actedThisTurn)) {
      if (this.state.turn >= 15) {
        this.addLog('⏰ 15턴 제한 시간 초과! 고양이 팀이 승리했습니다.');
        this.state.phase = 'GAME_OVER';
        this.state.winner = 'cat';
        this.state.winReason = `${this.state.round}라운드 제한 시간(15턴) 초과로 고양이 팀이 승리했습니다!`;
      } else {
        this.state.turn++;
        this.startMouseTurn();
      }
    }
  }

  handleRoundClear() {
    this.addLog(`🎉 ${this.state.round}라운드 클리어!! 생쥐 팀이 치즈 2개를 모두 배달했습니다!`);
    if (this.state.round >= 3) {
      this.state.phase = 'GAME_OVER';
      this.state.winner = 'mouse';
      this.state.winReason = '생쥐 팀이 총 3라운드를 모두 완수하여 최종 승리했습니다!';
      return;
    }
    this.state.phase = 'DRAFT';
    const hasBoost = this.state.cats.some(c => this.catHasCard(c, 'bronze_2'));
    this.state.draftTier = (this.state.round === 1 && !hasBoost) ? 'silver' : 'gold';
    const deck = this.state.decks[this.state.draftTier];
    this.state.draftOptions = [];
    for (let i = 0; i < 3 && deck.length; i++) this.state.draftOptions.push(deck.pop());
  }

  selectDraftCard(cardIdx, catId) {
    if (this.state.phase !== 'DRAFT') return { error: '증강 선택 단계가 아닙니다.' };
    const card = this.state.draftOptions[cardIdx];
    const cat = this.state.cats[catId];
    if (!card || !cat) return { error: '유효하지 않은 선택입니다.' };
    cat.cards.push(card);
    this.addLog(`✨ ${cat.name}가 [${card.name}] 증강 카드를 장착했습니다!`);
    if (card.id === 'silver_3') {
      const bIdx = cat.cards.findIndex(c => c.tier === 'bronze');
      if (bIdx >= 0) cat.cards.splice(bIdx, 1);
      if (this.state.decks.gold.length) cat.cards.push(this.state.decks.gold.pop());
    } else if (card.id === 'silver_4') {
      for (let i = 0; i < 2 && this.state.decks.bronze.length; i++) cat.cards.push(this.state.decks.bronze.pop());
    } else if (card.id === 'gold_3') {
      for (let i = 0; i < 2 && this.state.decks.silver.length; i++) cat.cards.push(this.state.decks.silver.pop());
    }

    // Advance to next round
    this.state.round++;
    this.state.turn = 1;
    this.state.cluesPast = Array.from(new Set([...this.state.cluesPast, ...this.state.cluesCurrent]));
    this.state.cluesCurrent = [];
    this.state.specialTrackMarks = {};
    this.state.usedHolesThisRound = [];
    this.state.bellNode = null;
    // Reset all cats back to central red starting intersections each round
    const resetReds = shuffle(RED_EDGES);
    this.state.cats.forEach((c, idx) => {
      c.edgeId = resetReds[idx];
      c.searchingThisTurn = false;
      c.searchedNodes = [];
      c.sprintMode = false;
    });
    if (this.state.cloneCat.active) {
      this.state.cloneCat.edgeId = resetReds[3] ?? resetReds[0];
    }

    this.state.cheeses = this.state.cheeses.filter(c => c.stolenBy === null).map(c => ({ ...c, carriedOver: true }));
    this.state.mice.forEach(m => {
      m.allowedStartQuad = m.stolenQuad !== null ? m.stolenQuad : 0;
      m.pos = null;
      m.hasCheese = false;
      m.delivered = false;
      m.stolenQuad = null;
      m.trail = [];
      m.log.push(`--- ${this.state.round}라운드 시작 ---`);
    });
    if (this.state.cheeseMode === 'three') {
      this.state.stolenTokens = [];
      this.state.relocateAllowedQuads = null;
      this.state.phase = 'SETUP_CHEESE';
      this.addLog(`🔄 ${this.state.round}라운드(치즈 3개 모드) 시작! 남은 치즈 1개 유지 + 새 치즈 2개를 배치합니다.`);
    } else {
      this.state.phase = 'SETUP_MICE';
      this.state.setupMouseIdx = 0;
      this.addLog(`🔄 ${this.state.round}라운드 시작! 고양이들은 중앙 붉은 교차로로 복귀하며 이전 발자국은 유지됩니다.`);
    }
    return { ok: true };
  }

  // === STEP-BY-STEP AI (1 ATOMIC ACTION PER TICK) ===
  hasPendingAI() {
    if (this.state.phase === 'GAME_OVER') return false;
    const miceAllAI = this.state.mice.every(m => m.isAI);
    const catsAllAI = this.state.cats.every(c => c.isAI);
    if (this.state.phase === 'SETUP_CHEESE') return miceAllAI;
    if (this.state.phase === 'SETUP_MICE') return Boolean(this.state.mice[this.state.setupMouseIdx]?.isAI);
    if (this.state.phase === 'SETUP_CATS') return Boolean(this.state.cats[this.state.setupCatIdx]?.isAI);
    if (this.state.phase === 'MOUSE_TURN') {
      const anyAIUnmoved = this.state.mice.some(m => m.isAI && !m.delivered && !m.movedThisTurn);
      const allHumansDone = this.state.mice.every(m => m.isAI || m.delivered);
      return anyAIUnmoved || (allHumansDone && this.state.mice.every(m => m.delivered || m.movedThisTurn));
    }
    if (this.state.phase === 'CAT_TURN') {
      const humansRemaining = this.state.cats.some(c => !c.isAI && !c.actedThisTurn);
      if (humansRemaining) return false;
      return this.state.cats.some(c => c.isAI && !c.actedThisTurn);
    }
    if (this.state.phase === 'DRAFT') return catsAllAI;
    return false;
  }

  stepSingleAI() {
    if (!this.hasPendingAI()) return false;
    if (this.state.phase === 'SETUP_CHEESE') {
      const availQ = this.state.relocateAllowedQuads
        ? this.state.relocateAllowedQuads.filter(q => !this.state.cheeses.some(c => c.quad === q))
        : shuffle([0, 1, 2, 3]).filter(q => !this.state.cheeses.some(c => c.quad === q));
      if (!availQ.length) return false;
      const whites = GRAPH.nodes.filter(n => n.q === availQ[0] && n.type === 'white');
      this.placeCheese(whites[Math.floor(Math.random() * whites.length)].id);
      return true;
    }
    if (this.state.phase === 'SETUP_MICE') {
      const m = this.state.mice[this.state.setupMouseIdx];
      const opts = QUAD_START_BLACKS[m.allowedStartQuad].filter(nid => nid !== this.state.mice[1 - m.id].pos);
      this.placeMouseStart(opts[Math.floor(Math.random() * opts.length)]);
      return true;
    }
    if (this.state.phase === 'SETUP_CATS') {
      const freeRed = RED_EDGES.filter(eid => !this.state.cats.some(c => c.edgeId === eid));
      this.placeCatStart(freeRed[Math.floor(Math.random() * freeRed.length)]);
      return true;
    }
    if (this.state.phase === 'MOUSE_TURN') {
      const aiMouse = this.state.mice.find(m => m.isAI && !m.delivered && !m.movedThisTurn);
      if (aiMouse) {
        const legal = this.getMouseLegalMoves(aiMouse.id, null);
        const pick = legal.length ? legal[Math.floor(Math.random() * legal.length)] : aiMouse.pos;
        aiMouse.pendingPos = pick;
        aiMouse.movedThisTurn = true;
        return true;
      }
      if (this.state.mice.every(m => m.isAI || m.delivered) && this.state.mice.every(m => m.delivered || m.movedThisTurn)) {
        this.confirmMouseTurn();
        return true;
      }
      return false;
    }
    if (this.state.phase === 'CAT_TURN') {
      const c = this.state.cats.find(x => x.isAI && !x.actedThisTurn);
      if (!c) return false;
      const reach = this.getCatReachableEdges(c.id, false);
      const edge = reach[Math.floor(Math.random() * reach.length)];
      const adj = this.getCatAdjacentNodes(edge, this.catHasLonelyBonus(c));
      this.catAction({ catId: c.id, edgeId: edge, actionType: 'search', targetNodes: adj });
      return true;
    }
    if (this.state.phase === 'DRAFT') {
      const targetCat = this.state.cats.slice().sort((a, b) => a.cards.length - b.cards.length)[0];
      this.selectDraftCard(0, targetCat.id);
      return true;
    }
    return false;
  }

  // === SERVER-AUTHORITATIVE STATE FILTERING (CRITICAL FOR ANTI-CHEAT!) ===
  getFilteredState(viewerTeam) {
    const showSecrets = (viewerTeam === 'mouse' || this.state.phase === 'GAME_OVER');
    return {
      cheeseMode: this.state.cheeseMode,
      round: this.state.round,
      turn: this.state.turn,
      phase: this.state.phase,
      winner: this.state.winner,
      winReason: this.state.winReason,
      stolenTokens: this.state.stolenTokens,
      cluesCurrent: this.state.cluesCurrent,
      cluesPast: this.state.cluesPast,
      specialTrackMarks: this.state.specialTrackMarks,
      bellNode: this.state.bellNode,
      blockedNode: this.state.blockedNode,
      blockedNodeRound: this.state.blockedNodeRound,
      usedHolesThisRound: this.state.usedHolesThisRound,
      setupMouseIdx: this.state.setupMouseIdx,
      setupCatIdx: this.state.setupCatIdx,
      relocateAllowedQuads: showSecrets ? this.state.relocateAllowedQuads : null,
      draftOptions: (viewerTeam === 'cat' || this.state.phase === 'GAME_OVER') ? this.state.draftOptions : [],
      draftTier: this.state.draftTier,
      bannerEvent: this.state.bannerEvent,
      lastActionPopup: this.state.lastActionPopup,
      publicLog: this.state.publicLog,
      cats: this.state.cats,
      cloneCat: this.state.cloneCat,
      // STRICTLY FILTERED SECRET DATA:
      cheeses: showSecrets ? this.state.cheeses : [],
      mice: this.state.mice.map(m => showSecrets ? m : ({
        id: m.id,
        name: m.name,
        isAI: m.isAI,
        img: m.img,
        hasCheese: m.hasCheese,
        delivered: m.delivered,
        movedThisTurn: m.movedThisTurn,
        usedCardCount: Object.values(m.cards).filter(v => !v).length,
        totalCardCount: 3
        // pos, trail, log, pendingPos, cards (types) are COMPLETELY OMITTED for Cats!
      }))
    };
  }
}

module.exports = { GameEngine, CAT_CARDS, MOUSE_CARDS, GRAPH, NODES, EDGES, RED_EDGES, HOLES, QUAD_START_BLACKS };
