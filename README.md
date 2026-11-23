# 🧀 치즈를 훔쳐라! — 온라인 멀티플레이어 웹 게임

공식 규칙서(`RuleBook/치즈를 훔쳐라.docx`)와 보드·카드·토큰 에셋을 기반으로 제작된 **2vs3 비대칭 추리·추격 온라인 멀티플레이어(Node.js + Socket.IO)** 프로젝트입니다.

## 📁 폴더 구조

```text
WebGame/
├── package.json              # Node.js + Express + Socket.IO 의존성
├── render.yaml               # Render 무료 티어 원클릭 배포 설정
├── README.md                 # 무료 서버 비교 및 배포 가이드
├── steal_the_cheese_local.html # 서버 없이 바로 실행하는 로컬 패스앤플레이 버전
├── server/
│   ├── index.js              # Express + Socket.IO 실시간 방/로비/재접속/팀 채팅 서버
│   └── gameEngine.js         # 서버 권한(Server-Authoritative) 게임 엔진 + 진영별 비공개 필터링
└── public/
    ├── index.html            # 온라인 멀티플레이어 웹 클라이언트
    ├── style.css             # 반응형 UI 스타일
    ├── client.js             # Socket.IO 통신 및 캔버스 보드 렌더링
    └── data/
        ├── board_graph.json  # 150개 원형 칸·249개 교차로·100개 담넘기 블록 좌표 그래프
        └── assets_bundle.json # 메인 보드·18종 카드·토큰 이미지 번들
```

## 🔐 핵심 멀티플레이어 기능
- **서버 권한 비공개 정보 보호**: 치즈 위치, 생쥐 A·B 위치, 비밀 이동 기록지, 사용된 특수 카드 종류는 서버에만 저장되며 **고양이 팀 브라우저에는 절대 전송되지 않습니다.**
- **초대 코드 방 시스템**: 4자리 방 코드로 최대 5명(생쥐 A·B, 고양이 1·2·3)이 입장하며, 빈 자리는 AI 봇으로 채워 1~5명 누구나 플레이할 수 있습니다.
- **자동 재접속**: 새로고침이나 모바일 화면 전환 시 `localStorage`의 세션 토큰으로 기존 자리에 자동 복귀합니다.
- **진영별 비밀 채팅**: 생쥐 팀 전용 비밀 채팅과 전체 공개 채팅을 지원합니다.

## 🆓 100% 무료 배포 서버 비교 (2026년 기준)

| 서비스 | 무료 한도 | WebSocket 지원 | 카드 등록 | 특징 |
| :--- | :--- | :--- | :--- | :--- |
| **[Render Free](https://render.com/docs/free)** ⭐추천 | 월 750시간 (1개 서버 상시 가능) | 지원 (WebSocket 통신 중 절전 안 됨) | **불필요** | Express+Socket.IO 하나로 프론트+서버 동시 무료 배포 |
| **[Koyeb Free](https://www.koyeb.com/docs/compare/render-vs-koyeb)** | 1개 무료 인스턴스 (512MB RAM) | 지원 (최대 12시간 연결) | 필요 | 1시간 유휴 시 절전, GitHub 자동 배포 |
| **[Railway Free](https://railway.com/pricing)** | 첫 30일 $5, 이후 월 $1 크레딧 | 지원 | GitHub 인증 | 소규모 테스트에 적합, 크레딧 소진 시 중지 |
| **[Vercel Hobby](https://vercel.com/docs/plans/hobby)** | 월 100GB 대역폭 (비상업용) | 정적 프론트 전용 | 불필요 | 프론트만 분리 호스팅할 때 선택 (Render 단독 배포 시 불필요) |

## 🚀 Render로 5분 만에 무료 배포하기 (카드 등록 없음)
1. 이 `WebGame/` 폴더의 내용을 새 **GitHub 저장소**에 업로드합니다.
2. [Render](https://render.com/docs/free)에 GitHub 계정으로 로그인합니다.
3. **New + → Blueprint** (또는 **Web Service**)를 선택하고 GitHub 저장소를 연결합니다.
4. `render.yaml`이 자동 인식되며 **Plan: Free**, **Build Command: `npm install`**, **Start Command: `npm start`**가 설정됩니다.
5. **Deploy**를 누르면 `https://steal-the-cheese-game.onrender.com` 같은 HTTPS 주소가 생성되며, 친구들에게 링크와 4자리 방 코드만 공유하면 바로 멀티플레이할 수 있습니다!

> 참고: 무료 플랜은 아무도 접속하지 않고 15분이 지나면 절전 모드에 들어가며, 첫 접속 시 약 30~60초 후 깨어납니다. 게임 중(WebSocket 연결 상태)에는 절전되지 않습니다.

## 💻 내 컴퓨터에서 로컬 테스트하기
```bash
npm install
npm start
# 브라우저에서 http://localhost:3000 접속 (탭 여러 개로 동시 접속 테스트 가능)
```
