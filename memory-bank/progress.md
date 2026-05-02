# Progress

## 완료된 기능

### Feature 1 — project-foundation ✅
- Google OAuth 로그인/로그아웃
- 기본 대시보드 쉘 (폴더탭 + 타임라인)
- Supabase 연결 + 환경변수 설정

### Feature 2 — document-upload-ai-extraction ✅
- 텍스트 붙여넣기 / PDF 업로드 → Claude Haiku 추출 → 즉시 카드 생성
- 카드 날짜 클릭 → 인라인 수정
- 카드 삭제 버튼 (DELETE API)
- (Feature 7 이후) 서브태스크는 **진행률 %** + 채팅으로 갱신

### Feature 3 — main-chat-progress ✅ (Feature 7·후속에서 확장, 2026-04 추론 Haiku 이전)
- 대시보드: **768px+** 우측 사이드바, 미만은 하단 고정 채팅 + FAB
- `/api/chat-progress` → **Claude Haiku 시스템 프롬프트만**으로 카드/서브태스크 매칭·진행률·삭제 의도 판단; TS는 **병합 메시지(`buildEffectiveUserMessage`) + JSON 파싱 + DB 실행**만
- **요청 본문:** `activeCardId`(상세 패널 열린 카드), `history`에 assistant 턴 `progressApplied` / `targetCardId` / `targetSubtaskId`(DB 반영된 턴만) → carry-forward
- **후보:** `candidates` JSON(`id`, `subject`, `type`, `subtasks[]`) 프롬프트 주입
- **분기:** `confidence < 0.6` → DB 없음; `progressUpdate` → PATCH; `remove_subtask` → DELETE; `askClarification` / `none` → 메시지만
- 짧은 긍정(맞아 등) 시 이전 user 발화 병합은 **TS 유지**
- **서브태스크 삭제·진행 반영** 성공 시 응답에 `progressApplied: true`(삭제 턴도 포함) + 클라이언트 히스토리 메타 동기화

### Feature 4 — weight-algorithm-fix ✅
- 서브태스크 텍스트에서 숫자 범위 파싱 → 분량 비례 가중치

### Feature 5 — instant-card-creation ✅
- 검토 단계 제거 → 추출 즉시 카드+서브태스크 저장
- DashboardClient에서 cards + subtasks 동시 상태 업데이트

### PPT 세분화 프롬프트 강화 ✅
- extract/route.ts 프롬프트에 【절대 금지】/【필수】 명시
- PPT 1-2 묶음 금지, 번호별 개별 분리 강제

### 서브태스크 로드 버그 수정 ✅
- dashboard/page.tsx: subtasks를 card_id 목록으로 필터링
- 기존: user 필터 없이 전체 조회 → RLS 빈 결과
- 수정: 해당 유저 카드의 subtasks만 정확히 로드

## Feature 6 — priority-recommendation ✅
- `src/lib/priority.ts` — `getTopPriorityCards`, `cardProgressRatio`(서브태스크 없으면 0), 임박·버퍼·유형가중치는 스펙과 동기화
- `src/components/PriorityRecommendation.tsx` — `DashboardClient`에서 카드 목록 **위**에 배치
- **UI(최종):** 🔴1위/🟡2위/🟢3위. **`과목 – 다음 서브태스크 1개`**(`orderIndex` 순) + 2개 이상일 때만 **`외 N개`**. 서브태스크 없는 카드는 `과목 – 카드 title`
- `allCardsAtFullProgress`이면(전부 1.0) 또는 Top3 점수 없으면 섹션 숨김

## Feature 7 — partial-progress + chat-ux ✅
- DB: `subtasks.progress` (0~100, 마이그레이션 파일 있음) · PATCH·채팅에서 `is_done = (progress >= 100)` 동기
- 채팅: Haiku `progressUpdate` — 완료·부분(반, 페이지 비율, 서론만 등)·취소·모호 시 진척 되묻기
- UI: 체크박스 제거, 1~99%만 옆에 표시, 100% 취소선, 카드 **진척 바**
- placeholder 3문장 3초 순환

## Feature 8 — upload-document-type ✅
- 업로드 패널: 📋 강의계획서 / 📌 과제·공지 / 🎯 자유 목표 + 유형별 placeholder — **문서 유형 기본 선택 없음(null)**, 미선택 시 추출·API 차단
- `POST /api/extract` — `documentType` + syllabus(주차·중/기말 분리·계절학기 등) / assignment / goal
- **goal:** 단일 목표 아래 나열 시 **카드 1개**, 세부는 **서브태스크(사용자 문구 유지)**; 세부 미기재 시에만 논리적 단계 추론
- **과제 묶음:** 과제·공지 유형에서 번호 문제 목록 → **카드 1개 + Problem N 서브태스크**; 마감 다른 과제만 분리
- **연도 없는 마감:** 프롬프트에 오늘 날짜 주입 → 가장 가까운 **미래** 월일로 dueDate
- **대시보드:** 채팅·카드 영역 스크롤·반응형(768px 기준 사이드/하단)
- **카드 UI:** 서브태스크 **보기/닫기** 토글 + 쉐브론

## UI 개선 (2026-04-28) ✅
- **데스크톱:** 우측 진척 채팅 사이드바 **384px (`w-96`)**, 사이드바 빈 상태 안내 문구(중앙·`text-gray-400`)
- **모바일:** 하단 FAB를 **「＋ 새 할 일」** 텍스트 버튼으로 변경 (`bg-blue-600` / `rounded-full` / `shadow-md`)
- **카드(`CardItem`):** 테두리 **`border-gray-200`**, 삭제 버튼은 **UI 2차/접근성**에서 대비 개선, 진척 바 색상 구간(0~33 빨강 / 34~66 노랑 / 67~99 파랑 / 100 초록)
- **우선순위(`PriorityRecommendation`):** 섹션 래퍼 **`bg-blue-50` + `border-blue-100` + `rounded-xl` + `p-3`**, 타이틀 **「🎯 오늘의 우선순위」** (`text-blue-700`)

## UI 개선 2차 (2026-04-28, Cursor) ✅
- **CardItem.tsx:** border 전체 `border-gray-200`으로 통일 (날짜 입력·구분선·삭제 영역 포함)
- **CardTimeline.tsx:** 카드 간격 `space-y-4` → `space-y-6`
- **대시보드 배경 고정:** `page.tsx` + `DashboardClient.tsx`에 `backgroundColor: '#f3f4f6'` + `colorScheme: 'light'` 인라인 고정 (다크 모드에서도 밝은 배경 유지)

## UI / 접근성 보완 (2026-04~29) ✅
- **globals.css:** 다크 OS에서도 밝은 배경의 `input`/`textarea`/`select` 가독 (`color` + `color-scheme: light`)
- **채팅·업로드 패널:** 입력창 명시적 글자색·`color-scheme` (Composer는 Cursor 앱 설정 별도)
- **카드 삭제 버튼:** `text-gray-500` + 밑줄·호버 빨강 (저대비 `gray-300` 개선)

## 폴더 삭제 ✅
- **`DELETE /api/folders/[id]`** — 해당 유저 카드의 `folder_id`만 `null`, 폴더 행 삭제
- **DashboardClient** — 폴더 탭(전체 제외) 호버 시 ✕, 확인 후 삭제 및 로컬 상태 동기화

## 전역 피드백 ✅
- **`src/app/layout.tsx`** — 헤더 우측 **「🐛 오류 제보」** 링크 → 카카오 오픈채팅(새 탭), 모바일·데스크톱 공통

## Vercel 배포 ✅ (2026-04-29)
- GitHub `jounggyu0319/studymap` → Vercel 자동 배포 연결
- 프로덕션 URL: **`https://studymap-kohl.vercel.app`**
- 환경변수 3종 설정 완료 (SUPABASE_URL / ANON_KEY / ANTHROPIC_API_KEY)
- Supabase Redirect URL + Site URL → `https://studymap-kohl.vercel.app` 추가
- Google Cloud Console OAuth 승인 URI + JavaScript 원본 추가

## 대시보드 UI 2안 (`feat: 대시보드 UI 2안 적용`) ✅
- **파일:** `DashboardClient.tsx`, `CardTimeline.tsx`, `CardItem.tsx`, `PriorityRecommendation.tsx`(compact)
- **메인 컬럼:** 고정 헤더 블록 → 압축 **우선순위 스트립** → 폴더 필터 행 유지 → **시간 탭**(D-3 이내 / 이번 주 / 전체) → 스크롤 **콘텐츠**
- **탭 필터:** `remainingDays` 기준 ≤3 / ≤7 / 전체(`filteredCards`와 동일 베이스); 탭·폴더 변경 시 상세 선택 해제
- **목록:** `CardListRow` 한 줄(좌 색상 바, 과목·제목·다음 서브태스크, D-day, 미니 진척바, %, ›); 클릭 시 **같은 영역에서 상세**(라우팅 없음)
- **상세:** `CardDetailView` — breadcrumb, 마감 인라인 수정, 전체 진척 바, 서브태스크 **읽기 전용** 체크·개별 바, 하단 삭제
- **전환:** `md+` 가로 슬라이드; **`md` 미만** 페이드
- **유지:** 우측·모바일 채팅, 데이터/API 흐름(생성·삭제·진척·폴더)

## 대시보드 UI 여백 압축 (`fix: 대시보드 UI 여백 압축 및 모바일 최적화`) ✅
- 메인 컬럼 **`max-w-2xl` 제거** → 사이드바 제외 가로 활용
- 헤더·카드 영역 `px-3 py-2` 등으로 패딩 축소, 폴더/탭 컨트롤 크기 축소
- 카드 행·상세·우선순위 스트립 간격·폰트 단계적 압축; 목록 `space-y-1.5`

## PWA 설정 ✅ (2026-04-29)
- `public/manifest.json` — name·start_url(`/dashboard`)·standalone·theme_color
- `layout.tsx` metadata — manifest / themeColor / appleWebApp / openGraph
- 앱 아이콘: **노트+지도핀** 디자인 (`icon-192.png`, `icon-512.png`) — Python PIL 생성
- Safari 공유 → 홈 화면에 추가로 앱처럼 설치 가능

## 저장소
- GitHub: **`jounggyu0319/studymap`** (`main`), SSH 키 인증, Vercel 자동 재배포

## Haiku 일임 방식 전환 ✅ (2026-04-30)
- `chat-progress` TypeScript 추론 규칙 전부 제거 → SYSTEM_PROMPT가 카드 매칭·진척 판단·삭제 의도 전부 처리
- TypeScript는 `buildEffectiveUserMessage` + confidence gate + DB 실행만
- `activeCardId` 요청 본문 추가 → 상세 패널 열린 카드 우선 컨텍스트

## 카카오 로그인 추가 ✅ (2026-04-30)
- `src/app/login/page.tsx` — 카카오 버튼 추가 (`#FEE500` / `supabase.auth.signInWithOAuth({ provider: 'kakao' })`)
- 카카오 개발자 콘솔: 개인 개발자 비즈 앱 전환 → 심사 없이 외부 사용자 로그인 가능
- KOE004(로그인 활성화 ON), KOE205(동의항목 이메일 필수) 오류 해결

## 모바일 FAB 겹침 버그 수정 ✅ (2026-04-30)
- `CardDetailView` 래퍼에 `pb-40 md:pb-0` 추가 → 삭제 버튼이 하단 FAB에 가려지는 문제 해결

## 탭 복귀 자동 새로고침 ✅ (2026-04-30)
- `DashboardClient`에 `visibilitychange` 이벤트 리스너 추가
- 탭 포커스 복귀 시 백그라운드로 `refreshData()` 실행 → 깜빡임 없이 데이터 갱신

## 완료 카드 자동 이동 ✅ (2026-04-30)
- 모든 서브태스크 진척률 100% 도달 시 → `getOrCreateDoneFolder()` → PATCH `folder_id`
- `✅ 완료` 폴더: 전체 탭 `filteredCards`에서 제외, 탭 목록 항상 맨 마지막, 삭제 버튼 없음

## 메모 기능 구현 ✅ (2026-05-02)
- **DB:** `notes` 테이블 (id, user_id, card_id, content, created_at) + RLS
- **API:** `GET/POST /api/notes`, `DELETE /api/notes/[id]`
- **Haiku:** `action: "memo"` 추가 — "메모해줘", "저장해줘", 정보성 문장 등 판단 → `memoContent` 정제 저장
- **데스크톱:** ChatProgress 사이드바 "📝 메모" 버튼 → 메모 모드 전환, 목록·삭제, `notesReloadVersion`으로 자동 갱신
- **모바일:** `CardDetailView` 서브태스크 아래 "📝 메모 보기 ›" → 메모 하위 페이지(뒤로 가기 포함)
- **연결:** `DashboardClient` `notesRefreshKey` → `CardTimeline` → `CardDetailView` prop 전달

## 이슈 트래커 생성 ✅ (2026-05-02)
- `memory-bank/issues.md` 신규 생성
- 채팅 인식 버그 7건 + UI/가중치 1건 + 기능 부재 2건 문서화
- 상세 내용: `memory-bank/issues.md` 참고

## 알려진 이슈 / 다음 할 일
- [ ] **채팅 인식 개선** — `memory-bank/issues.md` CHAT-01~06 참고 (activeCardId 무시, 과거형 판단, 번호 혼동 등)
- [ ] **syllabus 추출 실사용 테스트 미완료** ← 다양한 강의계획서로 추출 품질 검증 필요 (핵심 미완성 항목)
- [ ] goal 추출 실사용 테스트
- [ ] Problem Sets 추출 프롬프트 지속 다듬기
- [ ] 캘린더 뷰 (마감일 월간 달력)
- [ ] 베타 테스트 피드백 수집 및 반영

## 해결된 주요 버그
- pdf-parse v2→v1.1.1 다운그레이드
- RLS INSERT 정책 누락 → 전체 추가
- Supabase snake_case → camelCase 매핑
- Buffer → btoa + Uint8Array 교체 (브라우저 호환)
- 파일명 한글/공백 → safeFileName 변환
