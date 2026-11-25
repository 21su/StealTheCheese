/**
 * 치즈를 훔쳐라! — 튜토리얼 모듈 (v18)
 * 1) 📖 안내문 튜토리얼 (6단계, 퀴즈 제거)
 * 2) 🐭 생쥐 실전 체험 (직접 클릭해 이동 · 치즈 획득 · 질주 카드 · 쥐구멍 배달)
 * 3) 🐱 고양이 실전 체험 (직접 클릭해 교차로 이동 · 순차 단서 수색 · 포획 승리)
 */
(function () {
  const STORAGE_KEY = 'stc_tutorial_hide_auto_v1';
  let activeTab = 'guide'; // 'guide' | 'mouse' | 'cat'
  let currentStep = 0;
  let boardHighlight = 'all';

  const STEPS = [
    { id: 'goal', label: '1. 게임 목표', subtitle: '2대 3 비대칭 팀전의 핵심 승리 조건' },
    { id: 'board', label: '2. 보드 구조', subtitle: 'A·B·C·D 4구역과 이중 경로를 한눈에' },
    { id: 'turn', label: '3. 턴 진행', subtitle: '4단계 턴 흐름과 치즈 획득 시 턴 -3' },
    { id: 'mouse', label: '4. 생쥐 플레이', subtitle: '은신 이동과 특수 이동 카드 4장' },
    { id: 'cat', label: '5. 고양이 플레이', subtitle: '순차 수색, 포획, 그리고 증강 드래프트' },
    { id: 'ui', label: '6. 화면 UI 안내', subtitle: '사이드 패널 · 전체 탐지 목록 · 1인 연습 · 다시보기' },
  ];

  // === Interactive Playable Mouse Tutorial State ===
  function createMousePlayState() {
    return {
      stage: 0, // 0: move to #24, 1: steal cheese at #14, 2: activate sprint & jump over cat to #12, 3: deliver to burrow #2, 4: complete
      turn: 5,
      mouseNode: 34,
      trail: [34],
      catEdge: 'e_14_13', // Cat standing on intersection between #14 and #13
      hasCheese: false,
      cheeseNode: 14,
      sprintSelected: false,
      sprintLeft: 2,
      banner: '',
      log: '미션 1: 반짝이는 파란 칸(#24)을 클릭해 치즈 방향으로 1칸 이동해 보세요.',
    };
  }
  let mousePlay = createMousePlayState();

  // === Interactive Playable Cat Tutorial State ===
  function createCatPlayState() {
    return {
      stage: 0, // 0: move cat 2 steps to e_24_14, 1: search #25 (miss) then #24 (footprint!), 2: move to e_14_13 & select capture, 3: capture #13, 4: complete
      catEdge: 'e_35_25',
      catActionMode: 'move', // 'move' | 'search' | 'capture'
      checked: [], // [{ nodeId, hit }]
      clues: [],
      mouseHiddenNode: 13,
      mouseTrail: [34, 24, 14, 13],
      banner: '📢 A 구역 치즈가 도둑맞았습니다! 도주로를 차단하세요.',
      log: '미션 1: 주황색으로 빛나는 교차로(②번)를 클릭해 A 구역 길목으로 2칸 이동해 보세요.',
    };
  }
  let catPlay = createCatPlayState();

  function getAssetSrc(key) {
    if (typeof ASSETS !== 'undefined' && ASSETS && ASSETS[key]) return ASSETS[key];
    return '';
  }

  // ==================== TAB 1: GUIDE TUTORIAL (6 STEPS, NO QUIZ) ====================
  function renderStep0Goal() {
    return `
      <div class="tut-fade space-y-5">
        <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/40">
          <div class="text-xs font-extrabold text-amber-300 mb-1">🧀 한 줄 요약</div>
          <p class="text-sm sm:text-base font-bold text-white leading-relaxed">
            <span class="text-sky-300">생쥐 2명</span>은 숨어서 치즈를 훔쳐 달아나고,
            <span class="text-orange-300">고양이 3명</span>은 발자국을 쫓아 포획하는
            <span class="text-amber-300">2vs3 비대칭 추리·추격 게임</span>입니다.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div class="p-4 rounded-2xl bg-sky-950/35 border border-sky-400/40 space-y-2.5">
            <div class="flex items-center gap-2.5">
              <span class="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-xl">🐭</span>
              <div>
                <div class="text-sm font-extrabold text-sky-300">생쥐 팀 (2인 협동)</div>
                <div class="text-[11px] text-stone-400">은신 · 동선 분산 · 치즈 배달</div>
              </div>
            </div>
            <ul class="text-xs sm:text-sm text-stone-200 space-y-1.5 leading-relaxed">
              <li>• 이동 위치를 <b>비공개</b>로 숨기며 이동</li>
              <li>• 매 라운드 치즈 3개 중 <b>각자 1개씩</b> 획득</li>
              <li>• <b>서로 다른 쥐구멍</b>으로 배달하면 라운드 성공</li>
            </ul>
            <div class="px-3 py-2 rounded-xl bg-sky-500/15 border border-sky-400/30 text-xs font-extrabold text-sky-200">
              🏆 승리 조건: 총 3라운드 배달 완수
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-orange-950/35 border border-orange-400/40 space-y-2.5">
            <div class="flex items-center gap-2.5">
              <span class="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-400/50 flex items-center justify-center text-xl">🐱</span>
              <div>
                <div class="text-sm font-extrabold text-orange-300">고양이 팀 (3인 협동)</div>
                <div class="text-[11px] text-stone-400">추적 · 길목 포위 · 즉시 포획</div>
              </div>
            </div>
            <ul class="text-xs sm:text-sm text-stone-200 space-y-1.5 leading-relaxed">
              <li>• 교차로를 <b>공개 이동</b>하며 구역 길목 봉쇄</li>
              <li>• 인접 칸을 수색해 생쥐의 <b>발자국 단서</b> 탐색</li>
              <li>• 라운드마다 <b>증강 카드</b>를 골라 능력 강화</li>
            </ul>
            <div class="px-3 py-2 rounded-xl bg-orange-500/15 border border-orange-400/30 text-xs font-extrabold text-orange-200">
              🏆 승리 조건: 15턴 방어 또는 생쥐 1마리 포획
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderStep1Board() {
    const hl = boardHighlight;
    const dim = (group) => (hl === 'all' || hl === group ? '1' : '0.22');
    const pulse = (group) => (hl === group ? 'tut-svg-pulse' : '');
    const btnCls = (key) =>
      hl === key
        ? 'bg-amber-500 text-stone-950 border-amber-300 font-extrabold'
        : 'bg-stone-900 text-stone-300 border-stone-700 hover:border-amber-400/60 font-bold';

    return `
      <div class="tut-fade space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm font-extrabold text-white">항목을 클릭하면 아래 보드 그림에서 위치가 강조됩니다</div>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" data-hl="all" class="tut-hl-btn px-2.5 py-1 rounded-lg border text-[11px] transition ${btnCls('all')}">전체 보기</button>
            <button type="button" data-hl="zones" class="tut-hl-btn px-2.5 py-1 rounded-lg border text-[11px] transition ${btnCls('zones')}">A·B·C·D 구역</button>
            <button type="button" data-hl="mouse" class="tut-hl-btn px-2.5 py-1 rounded-lg border text-[11px] transition ${btnCls('mouse')}">🐭 원형 칸·쥐구멍</button>
            <button type="button" data-hl="cat" class="tut-hl-btn px-2.5 py-1 rounded-lg border text-[11px] transition ${btnCls('cat')}">🐱 교차로</button>
            <button type="button" data-hl="center" class="tut-hl-btn px-2.5 py-1 rounded-lg border text-[11px] transition ${btnCls('center')}">🔴 중앙 초기화</button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div class="md:col-span-6 p-3 rounded-2xl bg-[#221b16] border border-stone-700">
            <svg viewBox="0 0 320 260" class="w-full h-auto rounded-xl bg-[#2c231c]">
              <g opacity="${dim('zones')}" class="${pulse('zones')}">
                <rect x="10" y="10" width="145" height="115" rx="10" fill="#3a2f25" stroke="#d97706" stroke-width="1.5" stroke-dasharray="4 3"/>
                <rect x="165" y="10" width="145" height="115" rx="10" fill="#3a2f25" stroke="#d97706" stroke-width="1.5" stroke-dasharray="4 3"/>
                <rect x="10" y="135" width="145" height="115" rx="10" fill="#3a2f25" stroke="#d97706" stroke-width="1.5" stroke-dasharray="4 3"/>
                <rect x="165" y="135" width="145" height="115" rx="10" fill="#3a2f25" stroke="#d97706" stroke-width="1.5" stroke-dasharray="4 3"/>
                <text x="24" y="32" fill="#fcd34d" font-size="13" font-weight="800">A 구역 🧀</text>
                <text x="230" y="32" fill="#fcd34d" font-size="13" font-weight="800">B 구역 🧀</text>
                <text x="24" y="238" fill="#fcd34d" font-size="13" font-weight="800">C 구역 🧀</text>
                <text x="220" y="238" fill="#7dd3fc" font-size="13" font-weight="800">D 구역 (출발)</text>
              </g>
              <g opacity="${dim('mouse')}" class="${pulse('mouse')}">
                <line x1="65" y1="68" x2="255" y2="68" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3 3"/>
                <line x1="65" y1="68" x2="65" y2="192" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3 3"/>
                <line x1="255" y1="68" x2="255" y2="192" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3 3"/>
                <line x1="65" y1="192" x2="255" y2="192" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3 3"/>
                <circle cx="115" cy="68" r="11" fill="#fffbeb" stroke="#f59e0b" stroke-width="2.5"/>
                <text x="115" y="72" text-anchor="middle" font-size="11">🧀</text>
                <circle cx="205" cy="68" r="11" fill="#fffbeb" stroke="#f59e0b" stroke-width="2.5"/>
                <text x="205" y="72" text-anchor="middle" font-size="11">🧀</text>
                <circle cx="115" cy="192" r="11" fill="#fffbeb" stroke="#f59e0b" stroke-width="2.5"/>
                <text x="115" y="196" text-anchor="middle" font-size="11">🧀</text>
                <circle cx="205" cy="192" r="10" fill="#1c1917" stroke="#38bdf8" stroke-width="2.5"/>
                <text x="205" y="196" text-anchor="middle" font-size="10">🐭</text>
                <circle cx="65" cy="68" r="12" fill="#0c4a6e" stroke="#7dd3fc" stroke-width="2.5"/>
                <text x="65" y="72" text-anchor="middle" fill="#e0f2fe" font-size="9" font-weight="800">2번</text>
                <circle cx="255" cy="68" r="12" fill="#0c4a6e" stroke="#7dd3fc" stroke-width="2.5"/>
                <text x="255" y="72" text-anchor="middle" fill="#e0f2fe" font-size="9" font-weight="800">9번</text>
                <circle cx="65" cy="192" r="12" fill="#0c4a6e" stroke="#7dd3fc" stroke-width="2.5"/>
                <text x="65" y="196" text-anchor="middle" fill="#e0f2fe" font-size="8" font-weight="800">142</text>
                <circle cx="255" cy="192" r="12" fill="#0c4a6e" stroke="#7dd3fc" stroke-width="2.5"/>
                <text x="255" y="196" text-anchor="middle" fill="#e0f2fe" font-size="8" font-weight="800">149</text>
              </g>
              <g opacity="${dim('cat')}" class="${pulse('cat')}">
                <rect x="155" y="62" width="10" height="10" rx="2" fill="#fb923c" stroke="#fff" stroke-width="1.5"/>
                <rect x="85" y="125" width="10" height="10" rx="2" fill="#fb923c" stroke="#fff" stroke-width="1.5"/>
                <rect x="225" y="125" width="10" height="10" rx="2" fill="#fb923c" stroke="#fff" stroke-width="1.5"/>
                <rect x="155" y="187" width="10" height="10" rx="2" fill="#fb923c" stroke="#fff" stroke-width="1.5"/>
              </g>
              <g opacity="${dim('center')}" class="${pulse('center')}">
                <circle cx="160" cy="130" r="24" fill="#dc2626" fill-opacity="0.28" stroke="#ef4444" stroke-width="2"/>
                <circle cx="160" cy="130" r="9" fill="#ef4444" stroke="#fff" stroke-width="2"/>
                <text x="160" y="114" text-anchor="middle" fill="#fecaca" font-size="9" font-weight="800">중앙 초기화</text>
              </g>
            </svg>
          </div>

          <div class="md:col-span-6 space-y-2.5 text-xs sm:text-sm text-stone-200 leading-relaxed">
            <div class="p-3 rounded-xl bg-stone-900/80 border border-stone-700">
              <div class="font-extrabold text-amber-300 mb-0.5">1. A·B·C·D 4개 구역</div>
              치즈 3개는 3개 구역의 <b>하얀 칸</b>에 비공개 배치되고, 생쥐 2마리는 빈 구역 쥐구멍 앞 <b>검은 칸</b>에서 출발합니다.
            </div>
            <div class="p-3 rounded-xl bg-stone-900/80 border border-stone-700">
              <div class="font-extrabold text-sky-300 mb-0.5">2. 생쥐는 원형 칸 (150개)</div>
              도로로 이어진 원형 칸을 1칸씩 숨어 이동하며, 네 구석 <b>쥐구멍(2·9·142·149번)</b>으로 치즈를 배달합니다.
            </div>
            <div class="p-3 rounded-xl bg-stone-900/80 border border-stone-700">
              <div class="font-extrabold text-orange-300 mb-0.5">3. 고양이는 교차로 (249개) + 중앙 복귀</div>
              칸 사이 교차로를 0~2칸 이동해 인접 칸을 수색·포획합니다. <b>2·3라운드 시작 시 중앙 붉은 교차로로 초기화</b>되어 미리 대기를 막습니다.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderStep2Turn() {
    const items = [
      { num: '1', color: 'sky', title: '생쥐 비공개 이동', desc: '생쥐 A·B가 인접 원형 칸으로 1칸씩 이동합니다. (고양이가 서 있는 교차로 통과 불가)' },
      { num: '2', color: 'amber', title: '치즈 획득 시 구역 선언 + 턴 -3', desc: '치즈 칸 도착 시 "A~D 구역 도난!"만 공개되고 턴 마커가 3칸 되돌아갑니다. (최소 1턴)' },
      { num: '3', color: 'orange', title: '고양이 교차로 이동', desc: '고양이 3마리가 원하는 순서대로 교차로를 0~2칸 이동해 도주로와 쥐구멍 길목을 차단합니다.' },
      { num: '4', color: 'emerald', title: '순차 수색 또는 포획', desc: '인접 칸을 한 칸씩 수색해 발자국을 찾거나, 확신이 들면 1칸을 지목해 포획을 시도합니다.' },
    ];
    const badgeColor = {
      sky: 'bg-sky-500 text-stone-950',
      amber: 'bg-amber-400 text-stone-950',
      orange: 'bg-orange-400 text-stone-950',
      emerald: 'bg-emerald-400 text-stone-950',
    };
    return `
      <div class="tut-fade space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${items
            .map(
              (it) => `
            <div class="p-4 rounded-2xl bg-stone-900/85 border border-stone-700 space-y-1.5">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full ${badgeColor[it.color]} font-extrabold text-xs flex items-center justify-center shrink-0">${it.num}</span>
                <span class="text-sm font-extrabold text-white">${it.title}</span>
              </div>
              <p class="text-xs sm:text-sm text-stone-300 leading-relaxed">${it.desc}</p>
            </div>`
            )
            .join('')}
        </div>
        <div class="p-4 rounded-2xl bg-amber-500/12 border border-amber-400/45 flex items-start gap-3">
          <span class="text-2xl leading-none">💡</span>
          <div class="text-xs sm:text-sm text-stone-200 leading-relaxed">
            <b class="text-amber-300">라운드 종료 조건:</b> 치즈를 든 생쥐 2마리가 <b>서로 다른 쥐구멍</b>에 도착하면 즉시 라운드가 끝납니다.
            먼저 배달을 마친 생쥐는 다음 라운드까지 안전하게 대기(포획 면역)합니다.
          </div>
        </div>
      </div>
    `;
  }

  function renderStep3Mouse() {
    const cards = [
      { key: 'mouse_card_sprint', name: '질주', qty: '생쥐당 2장', rule: '2칸 연속 이동 · 고양이 교차로 통과 가능', warn: '치즈 칸 사용 불가' },
      { key: 'mouse_card_wall', name: '담 넘기', qty: '생쥐당 1장', rule: '같은 블록 건너편 칸으로 직행', warn: '치즈 칸 사용 불가' },
      { key: 'mouse_card_hole', name: '쥐구멍 이동', qty: '생쥐당 1장', rule: '현재 쥐구멍에서 맞은편 쥐구멍으로 이동', warn: '쥐구멍 칸에서만 사용' },
    ];
    return `
      <div class="tut-fade space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          ${cards
            .map((c) => {
              const src = getAssetSrc(c.key);
              const imgHtml = src
                ? `<img src="${src}" alt="${c.name}" onclick="if(window.openCardZoom)openCardZoom('${c.key}','생쥐 특수 이동 카드','${c.name} (${c.qty})','${c.rule} / ${c.warn}')" class="w-28 mx-auto rounded-lg border border-stone-600 shadow-lg cursor-zoom-in hover:scale-105 transition" />`
                : `<div class="w-28 h-36 mx-auto rounded-lg bg-sky-950/60 border border-sky-500/40 flex items-center justify-center text-3xl">🃏</div>`;
              return `
                <div class="p-3.5 rounded-2xl bg-stone-900/85 border border-sky-500/35 text-center space-y-2">
                  ${imgHtml}
                  <div>
                    <span class="inline-block px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-extrabold">${c.qty}</span>
                    <div class="text-sm font-extrabold text-white mt-1">${c.name}</div>
                  </div>
                  <p class="text-xs text-stone-300 leading-snug">${c.rule}</p>
                  <div class="text-[11px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-lg py-1 px-2">${c.warn}</div>
                </div>`;
            })
            .join('')}
        </div>
        <div class="p-3.5 rounded-2xl bg-sky-950/35 border border-sky-400/40 text-xs sm:text-sm text-stone-200 leading-relaxed">
          <b class="text-sky-300">🐭 생쥐 심리전 팁:</b> 카드를 사용하면 <b>"누가 썼는지"만 공개되고 카드 종류는 숨겨집니다.</b>
          두 생쥐는 같은 칸에서 턴을 마칠 수 없으며, 제자리 대기도 불가능하니 미리 탈출 경로를 나눠 움직이세요!
        </div>
      </div>
    `;
  }

  function renderStep4Cat() {
    const aug1 = getAssetSrc('token_aug1');
    const aug2 = getAssetSrc('token_aug2');
    return `
      <div class="tut-fade space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-400/40 space-y-1.5">
            <div class="text-sm font-extrabold text-emerald-300">🔎 ① 단서 수색 (한 칸씩 순차 지목)</div>
            <p class="text-xs sm:text-sm text-stone-200 leading-relaxed">
              내 교차로와 인접한 원형 칸을 <b>한 칸씩 차례로 클릭</b>해 확인합니다.
              이번 라운드 생쥐가 지나간 흔적(발자국)이 나오면 <b>그 즉시 수색과 턴이 종료</b>됩니다.
            </p>
          </div>
          <div class="p-4 rounded-2xl bg-rose-950/30 border border-rose-400/40 space-y-1.5">
            <div class="text-sm font-extrabold text-rose-300">🐾 ② 포획 시도 (인접 1칸 지목)</div>
            <p class="text-xs sm:text-sm text-stone-200 leading-relaxed">
              생쥐가 지금 서 있다고 확신하는 인접 칸 1곳을 지목합니다.
              적중하면 <b>그 즉시 고양이 팀 승리!</b> 빗나가면 해당 고양이의 턴이 종료됩니다.
            </p>
          </div>
        </div>
        <div class="p-4 rounded-2xl bg-stone-900/85 border border-amber-500/35 space-y-2.5">
          <div class="text-sm font-extrabold text-amber-300">✨ 라운드 증강 드래프트 & 증강 토큰 2종</div>
          <p class="text-xs sm:text-sm text-stone-200 leading-relaxed">
            1라운드 시작 시 <b>브론즈 증강 각 1장</b>을 받고, 1·2라운드가 끝나면 <b>실버·골드 3장을 공개한 뒤 고양이 3마리가 각자 1장씩 선택</b>합니다.
          </p>
          <div class="flex flex-wrap gap-2.5 pt-1">
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-800/90 border border-emerald-500/40 text-xs text-stone-200">
              ${aug1 ? `<img src="${aug1}" class="w-5 h-5" alt="초록 토큰"/>` : '🟢'}
              <span><b>초록 링</b>: 쥐목에 방울 달기 등 알림 표시</span>
            </div>
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-800/90 border border-purple-500/40 text-xs text-stone-200">
              ${aug2 ? `<img src="${aug2}" class="w-5 h-5" alt="보라 토큰"/>` : '🟣'}
              <span><b>보라 링</b>: 넌 못 지나간다 등 봉쇄 표시</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderStep5UI() {
    const uiItems = [
      { icon: '📋', title: '왼쪽 접이식 [카드·증강] 탭', desc: '화면 왼쪽 중앙 노란 탭을 누르면 양 팀의 생쥐 카드 사용 여부와 고양이별 장착 증강을 언제든 펼쳐 보고 다시 접을 수 있습니다.' },
      { icon: '🔎', title: '오른쪽 [고양이 탐지 목록 (전체)] + ON/OFF 토글', desc: '모든 라운드의 탐지 기록(1R·2R·3R)이 누적 표시되며, 오른쪽 상단 ON/OFF 토글로 목록과 보드 반투명 원을 언제든 켜고 끌 수 있습니다.' },
      { icon: '🤖', title: '로비 자리 클릭 (1인 다중 조종 / AI)', desc: '5명이 다 모이지 않아도 로비에서 여러 자리를 클릭해 혼자 생쥐 전체나 고양이 전체를 조종하며 연습할 수 있습니다.' },
      { icon: '🎬', title: '게임 종료 후 [전체 다시보기]', desc: '게임이 완전히 끝나면 재생 바가 열려, 모든 라운드의 생쥐 비밀 동선과 고양이 추격 과정을 턴 단위로 복기할 수 있습니다.' },
    ];
    return `
      <div class="tut-fade space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${uiItems
            .map(
              (u) => `
            <div class="p-4 rounded-2xl bg-stone-900/85 border border-stone-700 space-y-1.5">
              <div class="flex items-center gap-2">
                <span class="text-lg">${u.icon}</span>
                <span class="text-sm font-extrabold text-amber-200">${u.title}</span>
              </div>
              <p class="text-xs sm:text-sm text-stone-300 leading-relaxed">${u.desc}</p>
            </div>`
            )
            .join('')}
        </div>
        <div class="p-4 rounded-2xl bg-gradient-to-r from-sky-500/15 via-stone-900 to-orange-500/15 border border-amber-400/40 flex flex-wrap items-center justify-between gap-3">
          <div class="text-xs sm:text-sm font-bold text-stone-200">
            이제 직접 클릭하며 실전 감각을 익혀볼까요?
          </div>
          <div class="flex gap-2">
            <button type="button" data-goto-tab="mouse" class="tut-goto-tab px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-stone-950 font-extrabold text-xs">🐭 생쥐 실전 체험 →</button>
            <button type="button" data-goto-tab="cat" class="tut-goto-tab px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-stone-950 font-extrabold text-xs">🐱 고양이 실전 체험 →</button>
          </div>
        </div>
      </div>
    `;
  }

  const GUIDE_RENDERERS = [
    renderStep0Goal,
    renderStep1Board,
    renderStep2Turn,
    renderStep3Mouse,
    renderStep4Cat,
    renderStep5UI,
  ];

  // ==================== TAB 2: PLAYABLE MOUSE TUTORIAL ====================
  // Mini-board coordinates (subset of A-zone: burrow #2, nodes #12, #13, #14, #24, #34)
  const M_NODES = {
    2: { x: 66, y: 56, label: '2번 쥐구멍', isHole: true },
    12: { x: 148, y: 56, label: '#12' },
    13: { x: 242, y: 56, label: '#13' },
    14: { x: 336, y: 56, label: '#14' },
    24: { x: 336, y: 146, label: '#24' },
    34: { x: 336, y: 222, label: '#34 (출발)' },
    23: { x: 242, y: 146, label: '#23' },
    22: { x: 148, y: 146, label: '#22' },
  };
  const M_LINKS = [
    [2, 12], [12, 13], [13, 14], [14, 24], [24, 34],
    [12, 22], [13, 23], [22, 23], [23, 24],
  ];

  function renderMousePlayable() {
    const s = mousePlay;
    const stepLabels = ['① 은신 이동', '② 치즈 획득(턴-3)', '③ 질주 돌파', '④ 쥐구멍 배달'];
    // Determine clickable target node(s) for current mission
    const targets = new Set();
    if (s.stage === 0) targets.add(24);
    else if (s.stage === 1) targets.add(14);
    else if (s.stage === 2 && s.sprintSelected) targets.add(12);
    else if (s.stage === 3) targets.add(2);

    const catX = 289;
    const catY = 56; // Cat standing right on intersection between #14 and #13!

    return `
      <div class="tut-fade space-y-3.5">
        <!-- Mission Progress Strip -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap gap-1.5">
            ${stepLabels
              .map((lbl, idx) => {
                const cls =
                  idx < s.stage
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                    : idx === s.stage
                    ? 'bg-sky-500 text-stone-950 border-sky-300 font-extrabold'
                    : 'bg-stone-900 border-stone-700 text-stone-500';
                return `<span class="px-2.5 py-1 rounded-lg border text-[11px] font-bold ${cls}">${idx < s.stage ? '✓ ' : ''}${lbl}</span>`;
              })
              .join('')}
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 rounded-lg bg-stone-900 border border-amber-400/50 text-xs font-extrabold text-amber-300">현재 턴: ${s.turn} / 15</span>
            <span class="px-2.5 py-1 rounded-lg ${s.hasCheese ? 'bg-amber-500/25 border-amber-400 text-amber-200' : 'bg-stone-900 border-stone-700 text-stone-400'} border text-xs font-bold">${s.hasCheese ? '🧀 치즈 보유' : '치즈 미보유'}</span>
          </div>
        </div>

        <!-- Live Instruction Banner -->
        <div class="p-3 rounded-xl ${s.stage === 4 ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100' : 'bg-sky-950/45 border-sky-400/50 text-sky-100'} border text-xs sm:text-sm font-bold leading-relaxed">
          ${s.log}
        </div>
        ${
          s.banner
            ? `<div class="px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-400/60 text-xs font-extrabold text-amber-200 text-center">${s.banner}</div>`
            : ''
        }

        <div class="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
          <!-- Interactive Mini-Board SVG -->
          <div class="md:col-span-8 p-3 rounded-2xl bg-[#221b16] border border-stone-700">
            <svg viewBox="0 0 400 265" class="w-full h-auto rounded-xl bg-[#2c231c] select-none">
              <text x="16" y="24" fill="#fcd34d" font-size="11" font-weight="800">A 구역 실전 연습 보드</text>
              <!-- Roads -->
              ${M_LINKS.map(([a, b]) => {
                const na = M_NODES[a];
                const nb = M_NODES[b];
                const inTrail = s.trail.includes(a) && s.trail.includes(b);
                return `<line x1="${na.x}" y1="${na.y}" x2="${nb.x}" y2="${nb.y}" stroke="${inTrail ? '#38bdf8' : '#6b5b4d'}" stroke-width="${inTrail ? 4 : 2.5}" stroke-dasharray="${inTrail ? '' : '4 3'}"/>`;
              }).join('')}

              <!-- Cat blocking intersection between #14 and #13 -->
              <g>
                <circle cx="${catX}" cy="${catY}" r="16" fill="#ea580c" fill-opacity="0.28" stroke="#fb923c" stroke-width="2"/>
                <circle cx="${catX}" cy="${catY}" r="11" fill="#c2410c" stroke="#fed7aa" stroke-width="2"/>
                <text x="${catX}" y="${catY + 4}" text-anchor="middle" font-size="12">🐱</text>
                <text x="${catX}" y="${catY + 28}" text-anchor="middle" fill="#fdba74" font-size="9" font-weight="800">고양이 길목 차단</text>
              </g>

              <!-- Nodes -->
              ${Object.entries(M_NODES)
                .map(([idStr, n]) => {
                  const id = Number(idStr);
                  const isTarget = targets.has(id);
                  const isMouse = s.mouseNode === id;
                  const isCheese = !s.hasCheese && s.cheeseNode === id;
                  const fill = n.isHole ? '#0c4a6e' : isMouse ? '#0284c7' : isCheese ? '#fef3c7' : '#3d332a';
                  const stroke = isTarget ? '#38bdf8' : isCheese ? '#f59e0b' : '#8a7968';
                  return `
                    <g data-mnode="${id}" class="${isTarget ? 'tut-mnode cursor-pointer' : ''}">
                      ${isTarget ? `<circle cx="${n.x}" cy="${n.y}" r="24" fill="#38bdf8" fill-opacity="0.24" stroke="#38bdf8" stroke-width="2.5" class="tut-svg-pulse"/>` : ''}
                      <circle cx="${n.x}" cy="${n.y}" r="16" fill="${fill}" stroke="${stroke}" stroke-width="${isTarget || isMouse ? 3 : 2}"/>
                      <text x="${n.x}" y="${n.y + 4}" text-anchor="middle" fill="${isCheese && !isMouse ? '#78350f' : '#fff'}" font-size="${isMouse || isCheese || n.isHole ? '13' : '10'}" font-weight="800">
                        ${isMouse ? '🐭' : isCheese ? '🧀' : n.isHole ? '🕳️' : `#${id}`}
                      </text>
                      <text x="${n.x}" y="${n.y + 30}" text-anchor="middle" fill="${isTarget ? '#7dd3fc' : '#a8a29e'}" font-size="9" font-weight="700">${n.label}</text>
                    </g>
                  `;
                })
                .join('')}
            </svg>
          </div>

          <!-- Right Action Panel for Mouse Playable -->
          <div class="md:col-span-4 space-y-2.5">
            <div class="p-3 rounded-2xl bg-stone-900/90 border border-stone-700 space-y-2">
              <div class="text-xs font-extrabold text-sky-300">🃏 생쥐 특수 이동 카드</div>
              <button type="button" id="btnTutMouseSprint" ${s.stage !== 2 ? 'disabled' : ''} class="w-full p-2.5 rounded-xl border text-left transition ${
                s.sprintSelected
                  ? 'bg-sky-500 text-stone-950 border-sky-300 font-extrabold ring-2 ring-sky-300/60'
                  : s.stage === 2
                  ? 'bg-sky-500/20 hover:bg-sky-500/35 border-sky-400 text-sky-100 font-extrabold tut-svg-pulse'
                  : 'bg-stone-800/70 border-stone-700 text-stone-500 cursor-not-allowed'
              }">
                <div class="flex items-center justify-between text-xs">
                  <span>⚡ 질주</span>
                  <span>남은 ${s.sprintLeft}장</span>
                </div>
                <div class="text-[10px] opacity-85 mt-0.5">2칸 연속 이동 · 고양이 교차로 통과</div>
              </button>
              <div class="text-[11px] text-stone-400 leading-relaxed">
                • 일반 이동으로는 고양이가 서 있는 교차로를 넘을 수 없습니다.<br/>
                • <b>질주</b>를 쓰면 고양이 교차로를 넘어 2칸 이동할 수 있습니다.
              </div>
            </div>
            ${
              s.stage === 4
                ? `<div class="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/50 text-xs text-emerald-200 leading-relaxed">
                    🎉 <b>생쥐 체험 완료!</b><br/>이제 상단 <b>🐱 고양이 실전 체험</b> 탭에서 추적과 포획도 연습해 보세요!
                   </div>`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  function handleMouseNodeClick(nodeId) {
    const s = mousePlay;
    if (s.stage === 0 && nodeId === 24) {
      s.mouseNode = 24;
      s.trail.push(24);
      s.turn = 6;
      s.stage = 1;
      s.log = '좋아요! 미션 2: 이제 치즈가 놓인 #14번 칸을 클릭해 치즈를 훔쳐 보세요.';
      renderTutorial();
    } else if (s.stage === 1 && nodeId === 14) {
      s.mouseNode = 14;
      s.trail.push(14);
      s.hasCheese = true;
      s.turn = Math.max(1, s.turn - 3); // 6 -> 3
      s.stage = 2;
      s.banner = '📢 "A 구역 치즈가 도둑맞았습니다!" — 구역만 공개 + 턴 마커 3칸 되돌림 (6턴 → 3턴)';
      s.log = '미션 3: 고양이가 #14↔#13 길목을 막았습니다! 오른쪽 [⚡ 질주] 카드를 클릭한 뒤 #12번 칸으로 돌파해 보세요.';
      renderTutorial();
    } else if (s.stage === 2 && s.sprintSelected && nodeId === 12) {
      s.mouseNode = 12;
      s.trail.push(13, 12);
      s.sprintSelected = false;
      s.sprintLeft = 1;
      s.turn += 1;
      s.stage = 3;
      s.banner = '🃏 "생쥐 A가 특수 카드를 사용했습니다!" (카드 종류는 고양이에게 비공개)';
      s.log = '완벽한 돌파! 미션 4: 마지막으로 왼쪽 구석 [2번 쥐구멍]을 클릭해 치즈를 배달해 보세요.';
      renderTutorial();
    } else if (s.stage === 3 && nodeId === 2) {
      s.mouseNode = 2;
      s.trail.push(2);
      s.stage = 4;
      s.banner = '🏆 치즈 배달 완료! (배달한 생쥐는 다음 라운드까지 포획 면역)';
      s.log = '축하합니다! 생쥐의 핵심 플레이(은신 이동 → 치즈 획득·턴-3 → 질주 돌파 → 쥐구멍 배달)를 모두 체험했습니다!';
      renderTutorial();
    }
  }

  // ==================== TAB 3: PLAYABLE CAT TUTORIAL ====================
  const C_NODES = {
    12: { x: 86, y: 66, label: '#12' },
    13: { x: 196, y: 66, label: '#13' },
    14: { x: 306, y: 66, label: '#14' },
    23: { x: 196, y: 176, label: '#23' },
    24: { x: 306, y: 176, label: '#24' },
    25: { x: 368, y: 176, label: '#25' },
  };
  const C_EDGES = {
    e_35_25: { x: 348, y: 226, label: '출발 교차로' },
    e_24_14: { x: 306, y: 121, label: '② A구역 길목', adj: [14, 24, 25] },
    e_14_13: { x: 251, y: 66, label: '③ 추격 교차로', adj: [13, 14] },
  };

  function renderCatPlayable() {
    const s = catPlay;
    const stepLabels = ['① 교차로 이동', '② 순차 단서 수색', '③ 추격 이동', '④ 포획 승리'];
    const curEdgeObj = C_EDGES[s.catEdge];

    const moveTargets = new Set();
    const searchTargets = new Set();
    const captureTargets = new Set();

    if (s.stage === 0) moveTargets.add('e_24_14');
    else if (s.stage === 1) {
      // Guide user: #25 (miss) or #24 (hit -> ends search immediately!)
      if (!s.checked.some((c) => c.nodeId === 25)) searchTargets.add(25);
      if (!s.checked.some((c) => c.nodeId === 24)) searchTargets.add(24);
    } else if (s.stage === 2) {
      moveTargets.add('e_14_13');
    } else if (s.stage === 3 && s.catActionMode === 'capture') {
      captureTargets.add(13);
    }

    return `
      <div class="tut-fade space-y-3.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap gap-1.5">
            ${stepLabels
              .map((lbl, idx) => {
                const cls =
                  idx < s.stage
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                    : idx === s.stage
                    ? 'bg-orange-500 text-stone-950 border-orange-300 font-extrabold'
                    : 'bg-stone-900 border-stone-700 text-stone-500';
                return `<span class="px-2.5 py-1 rounded-lg border text-[11px] font-bold ${cls}">${idx < s.stage ? '✓ ' : ''}${lbl}</span>`;
              })
              .join('')}
          </div>
          <span class="px-2.5 py-1 rounded-lg bg-stone-900 border border-emerald-400/50 text-xs font-bold text-emerald-300">탐지 기록: ${s.checked.length}곳</span>
        </div>

        <div class="p-3 rounded-xl ${s.stage === 4 ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100' : 'bg-orange-950/45 border-orange-400/50 text-orange-100'} border text-xs sm:text-sm font-bold leading-relaxed">
          ${s.log}
        </div>
        ${
          s.banner
            ? `<div class="px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-400/60 text-xs font-extrabold text-amber-200 text-center">${s.banner}</div>`
            : ''
        }

        <div class="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
          <div class="md:col-span-8 p-3 rounded-2xl bg-[#221b16] border border-stone-700">
            <svg viewBox="0 0 410 260" class="w-full h-auto rounded-xl bg-[#2c231c] select-none">
              <text x="16" y="24" fill="#fdba74" font-size="11" font-weight="800">고양이 추적 연습 보드 (생쥐 위치 비공개)</text>
              <!-- Grid lines -->
              <line x1="86" y1="66" x2="306" y2="66" stroke="#6b5b4d" stroke-width="2.5" stroke-dasharray="4 3"/>
              <line x1="196" y1="66" x2="196" y2="176" stroke="#6b5b4d" stroke-width="2.5" stroke-dasharray="4 3"/>
              <line x1="306" y1="66" x2="306" y2="176" stroke="#6b5b4d" stroke-width="2.5" stroke-dasharray="4 3"/>
              <line x1="196" y1="176" x2="368" y2="176" stroke="#6b5b4d" stroke-width="2.5" stroke-dasharray="4 3"/>
              <line x1="348" y1="226" x2="306" y2="121" stroke="#fb923c" stroke-width="2" stroke-dasharray="3 3" opacity="0.6"/>
              <line x1="306" y1="121" x2="251" y2="66" stroke="#fb923c" stroke-width="2" stroke-dasharray="3 3" opacity="0.6"/>

              <!-- Circle Nodes -->
              ${Object.entries(C_NODES)
                .map(([idStr, n]) => {
                  const id = Number(idStr);
                  const isSearch = searchTargets.has(id);
                  const isCapture = captureTargets.has(id);
                  const chk = s.checked.find((c) => c.nodeId === id);
                  const revealedMouse = s.stage === 4 && id === s.mouseHiddenNode;
                  const fill = revealedMouse
                    ? '#dc2626'
                    : chk?.hit
                    ? '#065f46'
                    : chk
                    ? '#292524'
                    : '#3d332a';
                  const stroke = isCapture
                    ? '#ef4444'
                    : isSearch
                    ? '#34d399'
                    : chk?.hit
                    ? '#34d399'
                    : '#8a7968';
                  const clickable = isSearch || isCapture;
                  return `
                    <g data-cnode="${id}" class="${clickable ? 'tut-cnode cursor-pointer' : ''}">
                      ${
                        clickable
                          ? `<circle cx="${n.x}" cy="${n.y}" r="24" fill="${isCapture ? '#ef4444' : '#34d399'}" fill-opacity="0.25" stroke="${isCapture ? '#ef4444' : '#34d399'}" stroke-width="2.5" class="tut-svg-pulse"/>`
                          : ''
                      }
                      <circle cx="${n.x}" cy="${n.y}" r="16" fill="${fill}" stroke="${stroke}" stroke-width="${clickable || chk ? 3 : 2}"/>
                      <text x="${n.x}" y="${n.y + 4}" text-anchor="middle" fill="#fff" font-size="${revealedMouse || chk?.hit ? '13' : '10'}" font-weight="800">
                        ${revealedMouse ? '🐭' : chk?.hit ? '🐾' : chk ? '✕' : `#${id}`}
                      </text>
                      <text x="${n.x}" y="${n.y + 30}" text-anchor="middle" fill="${isCapture ? '#fca5a5' : isSearch ? '#6ee7b7' : '#a8a29e'}" font-size="9" font-weight="700">
                        ${revealedMouse ? '포획 성공!' : chk?.hit ? `#${id} 발자국` : chk ? `#${id} 없음` : n.label}
                      </text>
                    </g>
                  `;
                })
                .join('')}

              <!-- Intersections -->
              ${Object.entries(C_EDGES)
                .map(([eid, e]) => {
                  const isHere = s.catEdge === eid;
                  const isMove = moveTargets.has(eid);
                  return `
                    <g data-cedge="${eid}" class="${isMove ? 'tut-cedge cursor-pointer' : ''}">
                      ${isMove ? `<circle cx="${e.x}" cy="${e.y}" r="20" fill="#fb923c" fill-opacity="0.3" stroke="#fb923c" stroke-width="2.5" class="tut-svg-pulse"/>` : ''}
                      <circle cx="${e.x}" cy="${e.y}" r="${isHere ? 14 : 9}" fill="${isHere ? '#ea580c' : isMove ? '#f97316' : '#57534e'}" stroke="#fff" stroke-width="2"/>
                      ${isHere ? `<text x="${e.x}" y="${e.y + 4}" text-anchor="middle" font-size="13">🐱</text>` : ''}
                      <text x="${e.x}" y="${e.y - 18}" text-anchor="middle" fill="${isMove ? '#fdba74' : '#d6d3d1'}" font-size="9" font-weight="800">${e.label}</text>
                    </g>
                  `;
                })
                .join('')}
            </svg>
          </div>

          <!-- Right Action Panel for Cat Playable -->
          <div class="md:col-span-4 space-y-2.5">
            <div class="p-3 rounded-2xl bg-stone-900/90 border border-stone-700 space-y-2">
              <div class="text-xs font-extrabold text-orange-300">🐱 고양이 행동 선택</div>
              <button type="button" id="btnTutCatCapture" ${s.stage !== 3 ? 'disabled' : ''} class="w-full p-2.5 rounded-xl border text-left transition ${
                s.catActionMode === 'capture' && s.stage === 3
                  ? 'bg-rose-500 text-white border-rose-300 font-extrabold ring-2 ring-rose-300/60'
                  : s.stage === 3
                  ? 'bg-rose-500/20 hover:bg-rose-500/35 border-rose-400 text-rose-100 font-extrabold tut-svg-pulse'
                  : 'bg-stone-800/70 border-stone-700 text-stone-500 cursor-not-allowed'
              }">
                <div class="text-xs">🐾 포획 시도 모드</div>
                <div class="text-[10px] opacity-85 mt-0.5">인접한 1칸 지목 · 적중 시 즉시 승리</div>
              </button>
              <div class="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800 space-y-1">
                <div class="text-[11px] font-bold text-emerald-300">🔎 탐지 기록</div>
                <div class="flex flex-wrap gap-1 text-[11px]">
                  ${
                    s.checked.length
                      ? s.checked
                          .map(
                            (c) =>
                              `<span class="px-2 py-0.5 rounded border font-bold ${
                                c.hit
                                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                                  : 'bg-stone-800 border-stone-600 text-stone-400'
                              }">1R #${c.nodeId}${c.hit ? ' 🐾' : ''}</span>`
                          )
                          .join('')
                      : '<span class="text-stone-500">아직 없음</span>'
                  }
                </div>
              </div>
            </div>
            ${
              s.stage === 4
                ? `<div class="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/50 text-xs text-emerald-200 leading-relaxed">
                    🎉 <b>고양이 체험 완료!</b><br/>이제 방을 만들거나 입장해 실제 게임을 즐겨보세요!
                   </div>`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  function handleCatEdgeClick(eid) {
    const s = catPlay;
    if (s.stage === 0 && eid === 'e_24_14') {
      s.catEdge = eid;
      s.stage = 1;
      s.catActionMode = 'search';
      s.log = '미션 2: 초록색 인접 칸(#25 또는 #24)을 한 칸씩 클릭해 단서를 수색해 보세요! 발자국이 나오면 즉시 수색이 끝납니다.';
      renderTutorial();
    } else if (s.stage === 2 && eid === 'e_14_13') {
      s.catEdge = eid;
      s.stage = 3;
      s.catActionMode = 'move';
      s.log = '미션 4: 생쥐가 #13번 칸에 숨어 있는 것 같습니다! 오른쪽 [🐾 포획 시도 모드]를 누른 뒤 빨간 #13번 칸을 클릭하세요.';
      renderTutorial();
    }
  }

  function handleCatNodeClick(nid) {
    const s = catPlay;
    if (s.stage === 1) {
      const hit = s.mouseTrail.includes(nid);
      if (!s.checked.some((c) => c.nodeId === nid)) {
        s.checked.push({ nodeId: nid, hit });
      }
      if (hit) {
        s.clues.push(nid);
        s.stage = 2;
        s.banner = `🐾 #${nid}번 칸에서 발자국 발견! (즉시 수색·턴 종료)`;
        s.log = '발자국을 찾았습니다! 미션 3: 다음 턴이 되어 주황색 [③ 추격 교차로]로 이동해 생쥐를 몰아붙여 보세요.';
      } else {
        s.banner = `❌ #${nid}번 칸에는 흔적이 없습니다. 인접한 #24번 칸을 계속 수색해 보세요!`;
        s.log = '흔적이 없을 때는 남은 인접 칸을 한 칸씩 이어서 수색할 수 있습니다. 초록색 #24번 칸을 클릭해 보세요.';
      }
      renderTutorial();
    } else if (s.stage === 3 && s.catActionMode === 'capture' && nid === 13) {
      s.stage = 4;
      s.banner = '🏆 #13번 칸에서 생쥐 포획 성공! 고양이 팀 즉시 승리!';
      s.log = '축하합니다! 고양이의 핵심 플레이(교차로 이동 → 순차 수색·발자국 발견 → 추격 → 포획 승리)를 모두 체험했습니다!';
      renderTutorial();
    }
  }

  // ==================== MASTER RENDER & NAVIGATION ====================
  function renderTutorial() {
    const tabGuide = document.getElementById('tutTabGuide');
    const tabMouse = document.getElementById('tutTabMouse');
    const tabCat = document.getElementById('tutTabCat');
    const progWrap = document.getElementById('tutGuideProgressWrap');
    const guideNav = document.getElementById('tutGuideNav');
    const playNav = document.getElementById('tutPlayNav');
    const switchBtn = document.getElementById('btnTutSwitchTeam');

    const tabCls = (active, color) =>
      active
        ? `px-3.5 py-1.5 rounded-xl text-xs font-extrabold border transition ${color}`
        : 'px-3.5 py-1.5 rounded-xl text-xs font-bold border border-stone-700 bg-stone-900 text-stone-400 hover:text-stone-200 transition';

    tabGuide.className = tabCls(activeTab === 'guide', 'bg-amber-500 text-stone-950 border-amber-300 shadow');
    tabMouse.className = tabCls(activeTab === 'mouse', 'bg-sky-500 text-stone-950 border-sky-300 shadow');
    tabCat.className = tabCls(activeTab === 'cat', 'bg-orange-500 text-stone-950 border-orange-300 shadow');

    const bodyEl = document.getElementById('tutBody');

    if (activeTab === 'guide') {
      progWrap.classList.remove('hidden');
      guideNav.classList.remove('hidden');
      playNav.classList.add('hidden');

      const step = STEPS[currentStep];
      const pct = Math.round(((currentStep + 1) / STEPS.length) * 100);
      document.getElementById('tutStepSubtitle').textContent = step.subtitle;
      document.getElementById('tutProgressBar').style.width = `${pct}%`;
      document.getElementById('tutCounter').textContent = `${currentStep + 1} / ${STEPS.length}`;

      const pillsEl = document.getElementById('tutStepPills');
      pillsEl.innerHTML = STEPS.map((s, idx) => {
        const active = idx === currentStep;
        const done = idx < currentStep;
        const cls = active
          ? 'bg-amber-500 text-stone-950 border-amber-300 font-extrabold shadow'
          : done
          ? 'bg-amber-500/15 text-amber-200 border-amber-500/40 font-bold hover:bg-amber-500/25'
          : 'bg-stone-900 text-stone-400 border-stone-700 font-semibold hover:text-stone-200 hover:border-stone-500';
        return `<button type="button" data-step="${idx}" class="tut-step-pill px-2.5 py-1 rounded-lg border text-[11px] ${cls}">${s.label}</button>`;
      }).join('');

      pillsEl.querySelectorAll('.tut-step-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentStep = Number(btn.dataset.step);
          renderTutorial();
        });
      });

      bodyEl.innerHTML = GUIDE_RENDERERS[currentStep]();
      bodyEl.scrollTop = 0;

      bodyEl.querySelectorAll('.tut-hl-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          boardHighlight = btn.dataset.hl;
          renderTutorial();
        });
      });
      bodyEl.querySelectorAll('.tut-goto-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeTab = btn.dataset.gotoTab;
          if (activeTab === 'mouse') mousePlay = createMousePlayState();
          if (activeTab === 'cat') catPlay = createCatPlayState();
          renderTutorial();
        });
      });

      const prevBtn = document.getElementById('btnTutPrev');
      const nextBtn = document.getElementById('btnTutNext');
      prevBtn.disabled = currentStep === 0;
      nextBtn.textContent = currentStep === STEPS.length - 1 ? '🐭 생쥐 실전 체험 →' : '다음 ▶';
    } else if (activeTab === 'mouse') {
      progWrap.classList.add('hidden');
      guideNav.classList.add('hidden');
      playNav.classList.remove('hidden');
      document.getElementById('tutStepSubtitle').textContent = '직접 칸과 카드를 클릭하며 생쥐의 핵심 플레이를 체험해 보세요';
      switchBtn.textContent = '🐱 고양이 실전 체험 →';

      bodyEl.innerHTML = renderMousePlayable();
      bodyEl.scrollTop = 0;

      bodyEl.querySelectorAll('.tut-mnode').forEach((el) => {
        el.addEventListener('click', () => handleMouseNodeClick(Number(el.dataset.mnode)));
      });
      document.getElementById('btnTutMouseSprint')?.addEventListener('click', () => {
        if (mousePlay.stage !== 2) return;
        mousePlay.sprintSelected = true;
        mousePlay.log = '⚡ 질주 활성화! 이제 고양이 교차로 너머의 반짝이는 [#12번 칸]을 클릭해 2칸 돌파하세요.';
        renderTutorial();
      });
    } else if (activeTab === 'cat') {
      progWrap.classList.add('hidden');
      guideNav.classList.add('hidden');
      playNav.classList.remove('hidden');
      document.getElementById('tutStepSubtitle').textContent = '교차로 이동 · 순차 수색 · 포획까지 고양이 플레이를 직접 체험해 보세요';
      switchBtn.textContent = '🐭 생쥐 실전 체험 →';

      bodyEl.innerHTML = renderCatPlayable();
      bodyEl.scrollTop = 0;

      bodyEl.querySelectorAll('.tut-cedge').forEach((el) => {
        el.addEventListener('click', () => handleCatEdgeClick(el.dataset.cedge));
      });
      bodyEl.querySelectorAll('.tut-cnode').forEach((el) => {
        el.addEventListener('click', () => handleCatNodeClick(Number(el.dataset.cnode)));
      });
      document.getElementById('btnTutCatCapture')?.addEventListener('click', () => {
        if (catPlay.stage !== 3) return;
        catPlay.catActionMode = 'capture';
        catPlay.log = '🐾 포획 모드 ON! 이제 빨간색으로 빛나는 [#13번 칸]을 클릭해 생쥐를 포획하세요!';
        renderTutorial();
      });
    }
  }

  function openTutorial(tab = 'guide', stepIdx = 0) {
    activeTab = tab;
    currentStep = Math.max(0, Math.min(STEPS.length - 1, stepIdx));
    const modal = document.getElementById('tutorialModal');
    if (!modal) return;
    const chk = document.getElementById('chkTutHideAuto');
    if (chk) chk.checked = localStorage.getItem(STORAGE_KEY) === '1';
    renderTutorial();
    modal.classList.remove('hidden');
  }

  function closeTutorial() {
    const modal = document.getElementById('tutorialModal');
    if (!modal) return;
    modal.classList.add('hidden');
    const chk = document.getElementById('chkTutHideAuto');
    if (chk && chk.checked) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  }

  function initTutorial() {
    const modal = document.getElementById('tutorialModal');
    if (!modal) return;

    document.getElementById('btnTutorial')?.addEventListener('click', () => openTutorial('guide', 0));
    document.getElementById('btnLobbyTutorial')?.addEventListener('click', () => openTutorial('guide', 0));
    document.getElementById('btnCloseTutorial')?.addEventListener('click', closeTutorial);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeTutorial();
    });

    document.getElementById('tutTabGuide')?.addEventListener('click', () => {
      activeTab = 'guide';
      renderTutorial();
    });
    document.getElementById('tutTabMouse')?.addEventListener('click', () => {
      activeTab = 'mouse';
      renderTutorial();
    });
    document.getElementById('tutTabCat')?.addEventListener('click', () => {
      activeTab = 'cat';
      renderTutorial();
    });

    document.getElementById('btnTutPrev')?.addEventListener('click', () => {
      if (activeTab === 'guide' && currentStep > 0) {
        currentStep -= 1;
        renderTutorial();
      }
    });

    document.getElementById('btnTutNext')?.addEventListener('click', () => {
      if (activeTab === 'guide') {
        if (currentStep < STEPS.length - 1) {
          currentStep += 1;
          renderTutorial();
        } else {
          activeTab = 'mouse';
          mousePlay = createMousePlayState();
          renderTutorial();
        }
      }
    });

    document.getElementById('btnTutResetPlay')?.addEventListener('click', () => {
      if (activeTab === 'mouse') mousePlay = createMousePlayState();
      else if (activeTab === 'cat') catPlay = createCatPlayState();
      renderTutorial();
    });

    document.getElementById('btnTutSwitchTeam')?.addEventListener('click', () => {
      if (activeTab === 'mouse') {
        activeTab = 'cat';
        catPlay = createCatPlayState();
      } else {
        activeTab = 'mouse';
        mousePlay = createMousePlayState();
      }
      renderTutorial();
    });

    document.getElementById('chkTutHideAuto')?.addEventListener('change', (e) => {
      if (e.target.checked) localStorage.setItem(STORAGE_KEY, '1');
      else localStorage.removeItem(STORAGE_KEY);
    });

    document.addEventListener('keydown', (e) => {
      if (modal.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeTutorial();
      else if (activeTab === 'guide' && e.key === 'ArrowRight' && currentStep < STEPS.length - 1) {
        currentStep += 1;
        renderTutorial();
      } else if (activeTab === 'guide' && e.key === 'ArrowLeft' && currentStep > 0) {
        currentStep -= 1;
        renderTutorial();
      }
    });

    if (localStorage.getItem(STORAGE_KEY) !== '1') {
      setTimeout(() => {
        if (modal.classList.contains('hidden')) openTutorial('guide', 0);
      }, 600);
    }
  }

  window.openTutorial = openTutorial;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTutorial);
  } else {
    initTutorial();
  }
})();
