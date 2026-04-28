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

### Feature 3 — main-chat-progress ✅ (Feature 7·후속에서 확장)
- 대시보드: **768px+** 우측 사이드바, 미만은 하단 고정 채팅 + FAB
- `/api/chat-progress` → 후보 매칭 + **progressUpdate**(완료 100 / 부분 % / 취소 0 / 모호하면 되묻기)
- **서브태스크 삭제:** `action: remove_subtask` + 히스토리 전달, 짧은 긍정(맞아 등) 시 이전 발화 병합(`effectiveMessage`), DB `DELETE` 후 `subtaskRemoved`
- 카드 2+ 동점·낮은 conf → 과목 되묻기 유지

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
- **`src/app/layout.tsx`** — 우하단 고정 **「🐛 오류 제보」** → 카카오 오픈채팅(새 탭), 모바일·데스크톱 공통

## 저장소
- GitHub: **`jounggyu0319/studymap`** (`main`), 원격 푸시 사용 중

## 알려진 이슈 / 다음 할 일
- [ ] **syllabus 추출 실사용 테스트 미완료** ← 다양한 강의계획서로 추출 품질 검증 필요 (핵심 미완성 항목)
- [ ] goal 추출 실사용 테스트
- [ ] Problem Sets 추출 프롬프트 지속 다듬기
- [ ] 캘린더 뷰 (마감일 월간 달력)
- [ ] Vercel 배포

## 해결된 주요 버그
- pdf-parse v2→v1.1.1 다운그레이드
- RLS INSERT 정책 누락 → 전체 추가
- Supabase snake_case → camelCase 매핑
- Buffer → btoa + Uint8Array 교체 (브라우저 호환)
- 파일명 한글/공백 → safeFileName 변환
