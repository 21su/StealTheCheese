/**
 * 치즈를 훔쳐라! — 가독성 중심 7단계 인터랙티브 튜토리얼 (v17)
 */
(function () {
  const STORAGE_KEY = 'stc_tutorial_hide_auto_v1';
  let currentStep = 0;
  let boardHighlight = 'all'; // 'all' | 'zones' | 'mouse' | 'cat' | 'center'
  const quizAnswers = {}; // { qIdx: choiceIdx }

  const STEPS = [
    { id: 'goal', label: '1. 게임 목표', subtitle: '2대 3 비대칭 팀전의 핵심 승리 조건' },
    { id: 'board', label: '2. 보드 구조', subtitle: 'A·B·C·D 4구역과 이중 경로를 한눈에' },
    { id: 'turn', label: '3. 턴 진행', subtitle: '4단계 턴 흐름과 치즈 획득 시 턴 -3' },
    { id: 'mouse', label: '4. 생쥐 플레이', subtitle: '은신 이동과 특수 이동 카드 4장' },
    { id: 'cat', label: '5. 고양이 플레이', subtitle: '순차 수색, 포획, 그리고 증강 드래프트' },
    { id: 'ui', label: '6. 화면 UI 안내', subtitle: '사이드 패널 · 탐지 목록 · 1인 연습 · 다시보기' },
    { id: 'quiz', label: '7. 30초 퀴즈', subtitle: '핵심 규칙 3문제로 실전 감각 확인하기' },
  ];

  const QUIZ_DATA = [
    {
      q: 'Q1. 생쥐가 치즈를 훔치면 어떤 일이 일어나나요?',
      options: [
        '해당 구역(A~D) 도난만 공개되고, 턴 마커가 3턴 되돌아간다 (최소 1턴)',
        '생쥐의 정확한 칸 번호가 공개되고, 즉시 라운드가 종료된다',
      ],
      correct: 0,
      explain: '정답! 치즈를 훔치면 보드에 표시를 남기지 않고 구역만 공개되며, 턴 마커를 3칸 되돌려 생쥐가 탈출할 시간을 법니다.',
    },
    {
      q: 'Q2. 고양이가 단서 수색 중 인접 칸에서 발자국을 발견하면?',
      options: [
        '남은 인접 칸까지 모두 계속 수색할 수 있다',
        '발자국을 발견한 즉시 수색과 해당 고양이의 턴이 종료된다',
      ],
      correct: 1,
      explain: '정답! 수색은 한 칸씩 순차적으로 지목하며, 발자국이 나오는 순간 즉시 수색이 종료됩니다. 어느 칸부터 찌를지가 중요합니다.',
    },
    {
      q: 'Q3. 생쥐가 특수 이동 카드(질주·담 넘기·쥐구멍 이동)를 사용하면?',
      options: [
        '카드를 사용한 생쥐만 공개되고, 어떤 카드를 썼는지는 비공개다',
        '사용한 카드의 종류와 도착 칸이 고양이에게 모두 공개된다',
      ],
      correct: 0,
      explain: '정답! 고양이에게는 "생쥐 A가 카드를 사용했다"까지만 공개됩니다. 질주인지 담 넘기인지 추리하는 심리전이 핵심입니다.',
    },
  ];

  function getAssetSrc(key) {
    if (typeof ASSETS !== 'undefined' && ASSETS && ASSETS[key]) return ASSETS[key];
    return '';
  }

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
              <!-- 4 Quadrants -->
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

              <!-- Mouse Circle Nodes & Holes -->
              <g opacity="${dim('mouse')}" class="${pulse('mouse')}">
                <line x1="65" y1="68" x2="115" y2="68" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3 3"/>
                <line x1="115" y1="68" x2="205" y2="68" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3 3"/>
                <line x1="205" y1="68" x2="255" y2="68" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3 3"/>
                <line x1="65" y1="68" x2="65" y2="192" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3 3"/>
                <line x1="255" y1="68" x2="255" y2="192" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3 3"/>
                <line x1="65" y1="192" x2="255" y2="192" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3 3"/>
                <!-- White nodes (cheese spots) -->
                <circle cx="115" cy="68" r="11" fill="#fffbeb" stroke="#f59e0b" stroke-width="2.5"/>
                <text x="115" y="72" text-anchor="middle" font-size="11">🧀</text>
                <circle cx="205" cy="68" r="11" fill="#fffbeb" stroke="#f59e0b" stroke-width="2.5"/>
                <text x="205" y="72" text-anchor="middle" font-size="11">🧀</text>
                <circle cx="115" cy="192" r="11" fill="#fffbeb" stroke="#f59e0b" stroke-width="2.5"/>
                <text x="115" y="196" text-anchor="middle" font-size="11">🧀</text>
                <!-- Black start nodes -->
                <circle cx="205" cy="192" r="10" fill="#1c1917" stroke="#38bdf8" stroke-width="2.5"/>
                <text x="205" y="196" text-anchor="middle" font-size="10">🐭</text>
                <!-- 4 Holes -->
                <circle cx="65" cy="68" r="12" fill="#0c4a6e" stroke="#7dd3fc" stroke-width="2.5"/>
                <text x="65" y="72" text-anchor="middle" fill="#e0f2fe" font-size="9" font-weight="800">2번</text>
                <circle cx="255" cy="68" r="12" fill="#0c4a6e" stroke="#7dd3fc" stroke-width="2.5"/>
                <text x="255" y="72" text-anchor="middle" fill="#e0f2fe" font-size="9" font-weight="800">9번</text>
                <circle cx="65" cy="192" r="12" fill="#0c4a6e" stroke="#7dd3fc" stroke-width="2.5"/>
                <text x="65" y="196" text-anchor="middle" fill="#e0f2fe" font-size="8" font-weight="800">142</text>
                <circle cx="255" cy="192" r="12" fill="#0c4a6e" stroke="#7dd3fc" stroke-width="2.5"/>
                <text x="255" y="196" text-anchor="middle" fill="#e0f2fe" font-size="8" font-weight="800">149</text>
              </g>

              <!-- Cat Intersections -->
              <g opacity="${dim('cat')}" class="${pulse('cat')}">
                <rect x="155" y="62" width="10" height="10" rx="2" fill="#fb923c" stroke="#fff" stroke-width="1.5"/>
                <rect x="85" y="125" width="10" height="10" rx="2" fill="#fb923c" stroke="#fff" stroke-width="1.5"/>
                <rect x="225" y="125" width="10" height="10" rx="2" fill="#fb923c" stroke="#fff" stroke-width="1.5"/>
                <rect x="155" y="187" width="10" height="10" rx="2" fill="#fb923c" stroke="#fff" stroke-width="1.5"/>
              </g>

              <!-- Center Red Reset Intersections -->
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
      {
        num: '1',
        color: 'sky',
        title: '생쥐 비공개 이동',
        desc: '생쥐 A·B가 인접 원형 칸으로 1칸씩 이동합니다. (고양이가 서 있는 교차로 통과 불가)',
      },
      {
        num: '2',
        color: 'amber',
        title: '치즈 획득 시 구역 선언 + 턴 -3',
        desc: '치즈 칸 도착 시 "A~D 구역 도난!"만 공개되고 턴 마커가 3칸 되돌아갑니다. (최소 1턴)',
      },
      {
        num: '3',
        color: 'orange',
        title: '고양이 교차로 이동',
        desc: '고양이 3마리가 원하는 순서대로 교차로를 0~2칸 이동해 도주로와 쥐구멍 길목을 차단합니다.',
      },
      {
        num: '4',
        color: 'emerald',
        title: '순차 수색 또는 포획',
        desc: '인접 칸을 한 칸씩 수색해 발자국을 찾거나, 확신이 들면 1칸을 지목해 포획을 시도합니다.',
      },
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
            </div>
          `
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
      {
        key: 'mouse_card_sprint',
        name: '질주',
        qty: '생쥐당 2장',
        rule: '2칸 연속 이동 · 고양이 교차로 통과 가능',
        warn: '치즈 칸 사용 불가',
      },
      {
        key: 'mouse_card_wall',
        name: '담 넘기',
        qty: '생쥐당 1장',
        rule: '같은 블록 건너편 칸으로 직행',
        warn: '치즈 칸 사용 불가',
      },
      {
        key: 'mouse_card_hole',
        name: '쥐구멍 이동',
        qty: '생쥐당 1장',
        rule: '현재 쥐구멍에서 맞은편 쥐구멍으로 이동',
        warn: '쥐구멍 칸에서만 사용',
      },
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
                </div>
              `;
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
      {
        icon: '📋',
        title: '왼쪽 접이식 [카드·증강] 탭',
        desc: '화면 왼쪽 중앙 노란 탭을 누르면 양 팀의 생쥐 카드 사용 여부와 고양이별 장착 증강을 언제든 펼쳐 보고 다시 접을 수 있습니다.',
      },
      {
        icon: '🔎',
        title: '오른쪽 [고양이 탐지 목록] + 반투명 체크',
        desc: '이번 라운드에 고양이가 확인한 칸 번호가 자동 기록되며, 방 설정이 켜져 있으면 보드 위에도 반투명 원으로 표시됩니다.',
      },
      {
        icon: '🤖',
        title: '로비 자리 클릭 (1인 다중 조종 / AI)',
        desc: '5명이 다 모이지 않아도 로비에서 여러 자리를 클릭해 혼자 생쥐 전체나 고양이 전체를 조종하며 연습할 수 있습니다.',
      },
      {
        icon: '🎬',
        title: '게임 종료 후 [전체 다시보기]',
        desc: '게임이 완전히 끝나면 재생 바가 열려, 모든 라운드의 생쥐 비밀 동선과 고양이 추격 과정을 턴 단위로 복기할 수 있습니다.',
      },
    ];
    return `
      <div class="tut-fade space-y-3">
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
            </div>
          `
            )
            .join('')}
        </div>
        <div class="p-3 rounded-xl bg-stone-900/70 border border-stone-700 text-xs text-stone-400 text-center">
          언제든 상단 <b class="text-amber-200">🎓 튜토리얼</b> 또는 <b class="text-stone-200">📖 규칙·증강 도감</b> 버튼으로 다시 열어볼 수 있습니다.
        </div>
      </div>
    `;
  }

  function renderStep6Quiz() {
    const answeredCount = Object.keys(quizAnswers).length;
    const correctCount = QUIZ_DATA.filter((q, idx) => quizAnswers[idx] === q.correct).length;
    return `
      <div class="tut-fade space-y-3.5">
        <div class="flex items-center justify-between">
          <div class="text-xs sm:text-sm font-bold text-stone-300">핵심 규칙 3문제를 눌러 바로 확인해 보세요!</div>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
            answeredCount === QUIZ_DATA.length && correctCount === QUIZ_DATA.length
              ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50'
              : 'bg-stone-800 text-amber-300 border border-stone-700'
          }">정답 ${correctCount} / ${QUIZ_DATA.length}</span>
        </div>

        ${QUIZ_DATA.map((item, qIdx) => {
          const picked = quizAnswers[qIdx];
          const isAnswered = picked !== undefined;
          const isCorrect = picked === item.correct;
          return `
            <div class="p-3.5 rounded-2xl bg-stone-900/85 border border-stone-700 space-y-2">
              <div class="text-xs sm:text-sm font-extrabold text-white">${item.q}</div>
              <div class="grid grid-cols-1 gap-1.5">
                ${item.options
                  .map((opt, oIdx) => {
                    let cls = 'bg-stone-800/90 hover:bg-stone-700/90 border-stone-600 text-stone-200';
                    if (isAnswered) {
                      if (oIdx === item.correct) {
                        cls = 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold';
                      } else if (oIdx === picked) {
                        cls = 'bg-rose-500/20 border-rose-400 text-rose-200';
                      } else {
                        cls = 'bg-stone-900/60 border-stone-800 text-stone-500';
                      }
                    }
                    return `
                      <button type="button" data-q="${qIdx}" data-o="${oIdx}" class="tut-quiz-opt text-left px-3 py-2 rounded-xl border text-xs sm:text-sm transition ${cls}">
                        ${oIdx === 0 ? '① ' : '② '}${opt}
                      </button>
                    `;
                  })
                  .join('')}
              </div>
              ${
                isAnswered
                  ? `<div class="text-xs leading-relaxed px-3 py-2 rounded-xl ${
                      isCorrect
                        ? 'bg-emerald-500/12 text-emerald-200 border border-emerald-500/30'
                        : 'bg-amber-500/12 text-amber-200 border border-amber-500/30'
                    }">${isCorrect ? '✅ ' : '💡 '}${item.explain}</div>`
                  : ''
              }
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  const RENDERERS = [
    renderStep0Goal,
    renderStep1Board,
    renderStep2Turn,
    renderStep3Mouse,
    renderStep4Cat,
    renderStep5UI,
    renderStep6Quiz,
  ];

  function renderTutorial() {
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

    const bodyEl = document.getElementById('tutBody');
    bodyEl.innerHTML = RENDERERS[currentStep]();
    bodyEl.scrollTop = 0;

    // Bind Step 2 interactive board highlights
    bodyEl.querySelectorAll('.tut-hl-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        boardHighlight = btn.dataset.hl;
        renderTutorial();
      });
    });

    // Bind Step 7 interactive quiz buttons
    bodyEl.querySelectorAll('.tut-quiz-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        quizAnswers[Number(btn.dataset.q)] = Number(btn.dataset.o);
        renderTutorial();
      });
    });

    const prevBtn = document.getElementById('btnTutPrev');
    const nextBtn = document.getElementById('btnTutNext');
    prevBtn.disabled = currentStep === 0;
    if (currentStep === STEPS.length - 1) {
      nextBtn.textContent = '🎮 튜토리얼 완료!';
    } else {
      nextBtn.textContent = '다음 ▶';
    }
  }

  function openTutorial(stepIdx = 0) {
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
    // Mark seen so first-time auto-open does not annoy on next reload if user checked or finished
    const chk = document.getElementById('chkTutHideAuto');
    if (chk && chk.checked) {
      localStorage.setItem(STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function initTutorial() {
    const modal = document.getElementById('tutorialModal');
    if (!modal) return;

    document.getElementById('btnTutorial')?.addEventListener('click', () => openTutorial(0));
    document.getElementById('btnLobbyTutorial')?.addEventListener('click', () => openTutorial(0));
    document.getElementById('btnCloseTutorial')?.addEventListener('click', closeTutorial);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeTutorial();
    });

    document.getElementById('btnTutPrev')?.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep -= 1;
        renderTutorial();
      }
    });

    document.getElementById('btnTutNext')?.addEventListener('click', () => {
      if (currentStep < STEPS.length - 1) {
        currentStep += 1;
        renderTutorial();
      } else {
        localStorage.setItem(STORAGE_KEY, '1');
        const chk = document.getElementById('chkTutHideAuto');
        if (chk) chk.checked = true;
        closeTutorial();
        if (typeof showToast === 'function') {
          showToast('🎓 튜토리얼 완료! 방을 만들거나 참가해 게임을 시작해 보세요.');
        }
      }
    });

    document.getElementById('chkTutHideAuto')?.addEventListener('change', (e) => {
      if (e.target.checked) localStorage.setItem(STORAGE_KEY, '1');
      else localStorage.removeItem(STORAGE_KEY);
    });

    document.addEventListener('keydown', (e) => {
      if (modal.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeTutorial();
      else if (e.key === 'ArrowRight' && currentStep < STEPS.length - 1) {
        currentStep += 1;
        renderTutorial();
      } else if (e.key === 'ArrowLeft' && currentStep > 0) {
        currentStep -= 1;
        renderTutorial();
      }
    });

    // Auto-open gently once for brand-new visitors after assets finish loading
    if (localStorage.getItem(STORAGE_KEY) !== '1') {
      setTimeout(() => {
        if (modal.classList.contains('hidden')) openTutorial(0);
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
