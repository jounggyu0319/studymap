# document-upload-ai-extraction Design Document

> **Summary**: 대시보드 우측에서 슬라이드인 되는 3단계 패널(업로드→AI 검토→확정)로 할 일을 자동 추출하고 카드 N개를 생성하는 핵심 기능 설계
>
> **Project**: 스터디맵 (StudyMap)
> **Version**: 0.1.0
> **Author**: jounggyu
> **Date**: 2026-04-26
> **Status**: Draft
> **Planning Doc**: [document-upload-ai-extraction.plan.md](../01-plan/features/document-upload-ai-extraction.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 할 일 입력 비용 0으로 만들기 — 문서만 올리면 AI가 알아서 추출 |
| **WHO** | SKY 대학생 (학기 중 과목 5개, 과제/시험/팀플이 섞여 복잡한 상황) |
| **RISK** | Claude API 비용 예상 초과 / 정보 불충분 문서에서 추출 품질 저하 |
| **SUCCESS** | 강의계획서 업로드 → 30초 내 서브태스크 목록 생성 → 대시보드 카드 확인 |
| **SCOPE** | v1 — 텍스트 붙여넣기 + PDF 텍스트 추출. 이미지 PDF(스캔본)는 v2 |

---

## 1. Overview

### 1.1 Design Goals

- 3단계 플로우(업로드→검토→확정)를 URL 이동 없이 슬라이드 패널로 처리
- 서버사이드에서만 Claude API 키 사용 (클라이언트 노출 차단)
- 문서 1개 → 카드 N개 생성 흐름을 명확히 구조화
- 확정 전까지 DB/Storage에 아무것도 쓰지 않음 (취소 시 부작용 없음)

### 1.2 Design Principles

- **단방향 데이터 흐름**: 업로드 → 추출 → 검토 상태가 부모 컴포넌트에서 내려옴
- **서버사이드 AI 호출**: `ANTHROPIC_API_KEY` 절대 클라이언트 노출 금지
- **낙관적 UI 없음**: 확정 응답 받은 후에만 대시보드 카드 표시

---

## 2. Architecture

### 2.0 선택된 아키텍처: Option C — 슬라이드 플로우형

| Criteria | Option A: 모달 통합 | Option B: 전용 페이지 | **Option C: 슬라이드 패널** |
|----------|:-:|:-:|:-:|
| **파일 수** | 적음 | 많음 | 중간 |
| **UX** | 컨텍스트 유지 어려움 | URL 이동으로 자연스러움 | 대시보드 유지하며 자연스러운 흐름 |
| **모바일** | 보통 | 좋음 | 좋음 |
| **확장성** | 낮음 | 높음 | 높음 |
| **브레인스토밍 UI 일치** | 낮음 | 중간 | **높음** |

**선택 이유**: 대시보드를 유지하면서 3단계 플로우를 자연스럽게 처리. 브레인스토밍의 "하단 업로드 영역" UX와 가장 일치.

### 2.1 컴포넌트 다이어그램

```
dashboard/page.tsx (Server Component)
├── Header.tsx
├── FolderTabs.tsx
├── CardTimeline.tsx          ← 카드 목록 (타임라인)
└── UploadPanel.tsx           ← 슬라이드 패널 (Client Component)
    ├── Step1Upload.tsx       ← 폴더선택 + 파일/텍스트 입력
    ├── Step2Review.tsx       ← AI 추출 결과 검토·수정
    └── Step3Confirm.tsx      ← 확정 완료 화면
```

### 2.2 데이터 흐름

```
[Step1] 사용자 입력 (텍스트/PDF)
    ↓
[API] POST /api/extract
    → PDF이면 pdf-parse로 텍스트 추출
    → Claude Haiku 호출 → ExtractionResult JSON 반환
    ↓
[Step2] 추출 결과 렌더링 + 사용자 수정
    ↓  (수정된 데이터)
[API] POST /api/cards (확정 버튼 클릭)
    → Supabase Storage 파일 업로드 (PDF인 경우)
    → folders/cards/subtasks DB INSERT
    ↓
[Step3] 완료 + 대시보드 카드 갱신
```

### 2.3 의존성

| 컴포넌트 | 의존 대상 | 용도 |
|---------|---------|------|
| `Step1Upload` | `useUploadPanel` 훅 | 입력 상태 관리 |
| `Step2Review` | `ExtractedResult` 타입 | AI 결과 표시·수정 |
| `Step3Confirm` | `useRouter`, `useUploadPanel` | 대시보드 갱신 + 패널 닫기 |
| `/api/extract` | `pdf-parse`, `@anthropic-ai/sdk` | 텍스트 추출 + AI 호출 |
| `/api/cards` | `@supabase/ssr` | DB 저장 + Storage 업로드 |

---

## 3. Data Model

### 3.1 TypeScript 타입 정의

```typescript
// 추출된 서브태스크
interface ExtractedSubtask {
  id: string           // 클라이언트 임시 ID (crypto.randomUUID)
  title: string
  weight: number       // 0.0 ~ 1.0
}

// 추출된 카드 항목 (AI 결과 → 검토 화면)
interface ExtractedItem {
  id: string           // 클라이언트 임시 ID
  title: string
  type: CardType
  dueDate: string | null   // "YYYY-MM-DD"
  weight: number
  weightReason: string
  subtasks: ExtractedSubtask[]
  hasError: boolean    // 필수 필드 누락 여부
}

// AI 추출 전체 결과
interface ExtractionResult {
  subject: string
  items: ExtractedItem[]
  missingInfo: string[]
  confidence: number   // 0.0 ~ 1.0
}

// 유형 태그
type CardType =
  | '시험' | '퀴즈' | '과제' | '팀플'
  | '발표' | '실습' | '독서' | '보고서' | '기타'

// DB 카드 레코드
interface Card {
  id: string
  userId: string
  folderId: string | null
  subject: string
  title: string
  type: CardType
  dueDate: string | null
  weight: number
  weightReason: string | null
  fileUrl: string | null
  createdAt: string
}

// DB 서브태스크 레코드
interface Subtask {
  id: string
  cardId: string
  title: string
  isDone: boolean
  weight: number
  orderIndex: number
}
```

### 3.2 Entity 관계

```
[User] 1 ─── N [Folder]
[User] 1 ─── N [Card]
[Folder] 1 ─── N [Card]
[Card] 1 ─── N [Subtask]
```

### 3.3 DB 스키마

```sql
-- 폴더
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folders_own" ON folders USING (auth.uid() = user_id);

-- 카드
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  folder_id UUID REFERENCES folders,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  due_date DATE,
  weight DECIMAL DEFAULT 1.0,
  weight_reason TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards_own" ON cards USING (auth.uid() = user_id);

-- 서브태스크
CREATE TABLE subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES cards ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  is_done BOOLEAN DEFAULT FALSE,
  weight DECIMAL DEFAULT 1.0,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subtasks_own" ON subtasks
  USING (card_id IN (SELECT id FROM cards WHERE user_id = auth.uid()));
```

---

## 4. API 명세

### 4.1 엔드포인트 목록

| Method | Path | 설명 | Auth |
|--------|------|------|------|
| POST | `/api/extract` | 문서 → AI 할 일 추출 | Required |
| POST | `/api/cards` | 카드 N개 확정 저장 | Required |
| GET | `/api/cards` | 카드 목록 조회 (타임라인) | Required |
| PATCH | `/api/cards/[id]/subtasks/[subtaskId]` | 서브태스크 완료 토글 | Required |

### 4.2 POST /api/extract

**Request (multipart/form-data):**
```
file?: File          // PDF 파일 (택1)
text?: string        // 붙여넣기 텍스트 (택1)
```

**Response (200):**
```json
{
  "subject": "경제통계학",
  "items": [
    {
      "id": "tmp-uuid",
      "title": "중간고사 준비",
      "type": "시험",
      "dueDate": "2026-04-30",
      "weight": 0.35,
      "weightReason": "강의계획서 중간고사 30% 명시",
      "subtasks": [
        { "id": "tmp-uuid", "title": "1~3강 복습", "weight": 0.1 },
        { "id": "tmp-uuid", "title": "기출문제 풀기", "weight": 0.15 }
      ],
      "hasError": false
    }
  ],
  "missingInfo": [],
  "confidence": 0.88
}
```

**Error Responses:**
- `400`: 파일/텍스트 모두 없음, PDF 텍스트 추출 실패
- `401`: 미인증
- `500`: Claude API 오류

**구현 주의:**
```typescript
export const runtime = 'nodejs'  // pdf-parse Edge Runtime 불가
```

### 4.3 POST /api/cards

**Request:**
```json
{
  "folderId": "uuid | null",
  "subject": "경제통계학",
  "file": "base64 | null",
  "fileName": "syllabus.pdf | null",
  "items": [
    {
      "title": "중간고사 준비",
      "type": "시험",
      "dueDate": "2026-04-30",
      "weight": 0.35,
      "weightReason": "...",
      "subtasks": [
        { "title": "1~3강 복습", "weight": 0.1, "orderIndex": 0 }
      ]
    }
  ]
}
```

**Response (201):**
```json
{
  "cards": [
    { "id": "uuid", "title": "중간고사 준비", ... }
  ],
  "fileUrl": "https://...supabase.co/storage/..."
}
```

---

## 5. UI/UX 설계

### 5.1 화면 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  스터디맵                           신정규  로그아웃      │
├─────────────────────────────────────────────────────────┤
│  [26-1학기]  [+ 폴더 추가]                               │
│  정렬: 마감 급한 순 ▼                                    │
├──────────────────────────────┬──────────────────────────┤
│                              │  UploadPanel (슬라이드)   │
│  CardTimeline                │  ┌────────────────────┐  │
│  (카드 목록)                  │  │ Step 1: 업로드      │  │
│                              │  │ Step 2: AI 검토     │  │
│                              │  │ Step 3: 완료        │  │
│  [+ 강의계획서 / 과제 추가]   │  └────────────────────┘  │
└──────────────────────────────┴──────────────────────────┘
```

### 5.2 사용자 플로우

```
대시보드
  → "+ 강의계획서 / 과제 추가" 클릭
  → UploadPanel 슬라이드인 (오른쪽에서)

[Step 1 — 업로드]
  → 폴더 선택 드롭다운 (기본: 현재 폴더)
  → PDF 파일 드롭 or 텍스트 붙여넣기
  → HWP 선택 시 안내 메시지 표시
  → "AI로 할 일 추출하기" 버튼
  → 로딩 스피너 (AI 처리 중)

[Step 2 — AI 검토]
  → 카드 미리보기 N개 표시
  → confidence < 0.7이면 경고 배너
  → missingInfo 있으면 해당 카드 빨간 테두리
  → 각 카드: 제목/유형/마감일/가중치 수정 가능
  → 서브태스크: 수정/삭제/추가 가능
  → "다시 올리기" | "이대로 확정" 버튼

[Step 3 — 완료]
  → "카드 N개가 추가됐어요!" 메시지
  → 생성된 카드 미리보기 (진척도 0%)
  → "다른 과제도 추가하기" | "대시보드로 돌아가기"
```

### 5.3 컴포넌트 목록

| 컴포넌트 | 위치 | 역할 |
|---------|------|------|
| `UploadPanel` | `src/components/upload/UploadPanel.tsx` | 슬라이드 패널 컨테이너, step 상태 관리 |
| `Step1Upload` | `src/components/upload/Step1Upload.tsx` | 폴더선택 + 파일/텍스트 입력 |
| `Step2Review` | `src/components/upload/Step2Review.tsx` | AI 결과 검토·수정 UI |
| `Step3Confirm` | `src/components/upload/Step3Confirm.tsx` | 완료 화면 |
| `ReviewCard` | `src/components/upload/ReviewCard.tsx` | Step2의 카드 단위 수정 컴포넌트 |
| `CardTimeline` | `src/components/dashboard/CardTimeline.tsx` | 타임라인 카드 목록 |
| `useUploadPanel` | `src/hooks/useUploadPanel.ts` | 패널 열기/닫기 + step 상태 |

### 5.4 Page UI Checklist

#### Step 1 — 업로드 화면

- [ ] 드롭다운: 폴더 선택 (기본값: 현재 활성 폴더)
- [ ] 텍스트영역: 텍스트 붙여넣기 입력란 (placeholder: "강의계획서 또는 과제 공지를 붙여넣으세요")
- [ ] 버튼: PDF 파일 선택 (클릭 시 파일 선택 다이얼로그)
- [ ] 텍스트: 선택된 파일명 표시
- [ ] 경고: HWP 파일 선택 시 "PDF로 저장하거나 텍스트를 복사해서 붙여넣어 주세요" 메시지
- [ ] 버튼: "AI로 할 일 추출하기" (텍스트 or 파일 있을 때만 활성화)
- [ ] 로딩: 추출 중 스피너 + "AI가 할 일을 분석하고 있어요..."

#### Step 2 — AI 검토 화면

- [ ] 배너: confidence < 0.7일 때 "정보가 부족해요. 아래 항목을 확인해주세요" 경고
- [ ] 텍스트: 과목명 표시 + 수정 가능
- [ ] 카드목록: 추출된 카드 N개 (ReviewCard 컴포넌트)
  - [ ] 입력: 카드 제목 수정
  - [ ] 드롭다운: 유형 태그 선택 (9종)
  - [ ] 날짜입력: 마감일 (누락 시 빨간 테두리)
  - [ ] 슬라이더or입력: 가중치 (0.1~1.0) + weightReason 툴팁
  - [ ] 서브태스크 목록: 체크박스 없이 텍스트만 (아직 미완료 상태)
  - [ ] 버튼: 서브태스크 삭제 (각 항목)
  - [ ] 입력: 서브태스크 직접 추가
  - [ ] 버튼: 카드 전체 삭제
- [ ] 버튼: "다시 올리기" (Step 1으로 이동)
- [ ] 버튼: "이대로 확정" (로딩 스피너 포함)

#### Step 3 — 완료 화면

- [ ] 텍스트: "카드 N개가 추가됐어요!" 완료 메시지
- [ ] 카드 미리보기: 생성된 카드 요약 (제목, 유형태그, 마감일, 진척도 0%)
- [ ] 버튼: "다른 과제도 추가하기" (Step 1으로 초기화)
- [ ] 버튼: "대시보드로 돌아가기" (패널 닫기)

#### 대시보드 — CardTimeline

- [ ] 카드: 마감일 순 정렬 (가장 급한 것이 위)
- [ ] 카드 접힌 상태: 유형태그 + 과목명 + 제목 / D-day + 마감일 / 진척도 게이지 + % / "다음 할 일" 한 줄
- [ ] 진척도 색상: 0~39% 빨강, 40~69% 주황, 70~100% 초록
- [ ] 카드 클릭: 서브태스크 목록 펼침 (체크박스)

---

## 6. 에러 처리

| 상황 | 처리 방식 | 사용자 메시지 |
|------|---------|-------------|
| PDF 텍스트 추출 실패 | 400 반환 | "PDF에서 텍스트를 읽을 수 없어요. 텍스트를 직접 붙여넣어 주세요." |
| HWP 파일 업로드 | 클라이언트 차단 | "HWP는 지원하지 않아요. PDF로 저장하거나 텍스트를 복사해주세요." |
| Claude API 오류 | 500 반환 | "AI 분석에 실패했어요. 잠시 후 다시 시도해주세요." |
| confidence 낮음 | 경고 표시 (차단 아님) | "정보가 부족해요. 아래 항목을 직접 확인해주세요." |
| DB 저장 실패 | 500 반환 | "저장에 실패했어요. 다시 시도해주세요." |
| 미인증 API 호출 | 401 반환 | → `/login` 리다이렉트 |

---

## 7. 보안

- [ ] `ANTHROPIC_API_KEY` 서버사이드 전용 (NEXT_PUBLIC_ 접두사 없음)
- [ ] Supabase Storage `files` 버킷: 비공개(private) 설정
- [ ] 파일 다운로드 URL: Supabase `createSignedUrl` (만료 시간 1시간)
- [ ] RLS: folders/cards/subtasks 모두 `user_id = auth.uid()` 정책 적용
- [ ] PDF 파일 크기 제한: 10MB (서버에서 검증)
- [ ] 텍스트 입력 최대 길이: 50,000자 (토큰 비용 제한)

---

## 8. 테스트 계획

### 8.1 L1: API 테스트

| # | Endpoint | Method | 시나리오 | 예상 Status |
|---|----------|--------|---------|:-----------:|
| 1 | `/api/extract` | POST | 텍스트 입력 → 정상 추출 | 200 |
| 2 | `/api/extract` | POST | 텍스트/파일 둘 다 없음 | 400 |
| 3 | `/api/extract` | POST | 미인증 | 401 |
| 4 | `/api/cards` | POST | 카드 N개 확정 저장 | 201 |
| 5 | `/api/cards` | POST | 미인증 | 401 |
| 6 | `/api/cards` | GET | 카드 목록 마감일 순 | 200 |

### 8.2 L2: UI 액션 테스트

| # | 화면 | 액션 | 예상 결과 |
|---|------|------|---------|
| 1 | Step1 | 텍스트 입력 후 "AI로 할 일 추출하기" 클릭 | 로딩 후 Step2 진입 |
| 2 | Step1 | HWP 파일 선택 | 안내 메시지 표시 |
| 3 | Step2 | 서브태스크 삭제 | 목록에서 제거 |
| 4 | Step2 | 마감일 빈 상태로 "확정" | 해당 카드 빨간 테두리 표시 |
| 5 | Step2 | "이대로 확정" | 로딩 후 Step3 진입 |
| 6 | Step3 | "대시보드로 돌아가기" | 패널 닫힘 + 카드 목록 갱신 |

### 8.3 L3: E2E 시나리오

| # | 시나리오 | 단계 | 성공 기준 |
|---|---------|------|---------|
| 1 | 텍스트 업로드 전체 | 로그인 → 텍스트 입력 → AI 추출 → 검토 → 확정 | 대시보드에 카드 N개 표시 |
| 2 | PDF 업로드 전체 | 로그인 → PDF 선택 → AI 추출 → 확정 | 카드 생성 + 파일 링크 동작 |
| 3 | 연속 업로드 | 확정 후 "다른 과제도 추가하기" → 두 번째 업로드 | 두 번째 카드도 정상 생성 |

---

## 9. 레이어 구조

| 컴포넌트 | 레이어 | 위치 |
|---------|-------|------|
| `UploadPanel`, `Step1~3`, `ReviewCard` | Presentation | `src/components/upload/` |
| `CardTimeline`, `CardItem` | Presentation | `src/components/dashboard/` |
| `useUploadPanel` | Application | `src/hooks/useUploadPanel.ts` |
| `ExtractionResult`, `Card`, `Subtask` 타입 | Domain | `src/types/upload.ts`, `src/types/card.ts` |
| `/api/extract`, `/api/cards` | Infrastructure | `src/app/api/extract/route.ts`, `src/app/api/cards/route.ts` |

---

## 10. 코딩 컨벤션

| 항목 | 규칙 |
|------|------|
| 컴포넌트 | PascalCase (`Step1Upload.tsx`) |
| 훅 | camelCase, `use` 접두사 (`useUploadPanel.ts`) |
| API Route | `route.ts` (Next.js 규칙) |
| 상수 | UPPER_SNAKE_CASE (`MAX_FILE_SIZE`) |
| 주석 | 한국어 |
| 환경변수 | `ANTHROPIC_API_KEY` (서버 전용, NEXT_PUBLIC_ 없음) |

---

## 11. 구현 가이드

### 11.1 파일 구조

```
src/
├── app/
│   ├── api/
│   │   ├── extract/route.ts        ← PDF 파싱 + Claude Haiku 호출
│   │   └── cards/
│   │       ├── route.ts            ← 카드 목록 조회 + N개 생성
│   │       └── [id]/
│   │           └── subtasks/
│   │               └── [subtaskId]/route.ts  ← 완료 토글
│   └── dashboard/page.tsx          ← CardTimeline + UploadPanel 포함
├── components/
│   ├── upload/
│   │   ├── UploadPanel.tsx
│   │   ├── Step1Upload.tsx
│   │   ├── Step2Review.tsx
│   │   ├── Step3Confirm.tsx
│   │   └── ReviewCard.tsx
│   └── dashboard/
│       ├── CardTimeline.tsx
│       └── CardItem.tsx
├── hooks/
│   └── useUploadPanel.ts
└── types/
    ├── upload.ts                   ← ExtractionResult, ExtractedItem 등
    └── card.ts                     ← Card, Subtask, CardType
```

### 11.2 구현 순서

1. [ ] DB 테이블 생성 (Supabase SQL Editor)
2. [ ] Supabase Storage `files` 버킷 생성 (비공개)
3. [ ] 타입 정의 (`src/types/upload.ts`, `src/types/card.ts`)
4. [ ] `useUploadPanel` 훅 (step 상태, 열기/닫기)
5. [ ] `/api/extract` — PDF 파싱 + Claude Haiku 호출
6. [ ] `Step1Upload` 컴포넌트
7. [ ] `ReviewCard` 컴포넌트
8. [ ] `Step2Review` 컴포넌트
9. [ ] `/api/cards` — Storage 업로드 + DB 저장
10. [ ] `Step3Confirm` 컴포넌트
11. [ ] `UploadPanel` (step 라우팅)
12. [ ] `CardTimeline` + `CardItem` 컴포넌트
13. [ ] `dashboard/page.tsx` 통합

### 11.3 Session Guide

#### Module Map

| 모듈 | Scope Key | 설명 | 예상 턴 |
|------|-----------|------|:-------:|
| DB + 타입 + API | `module-1` | 테이블 생성, 타입 정의, `/api/extract`, `/api/cards` | 15~20 |
| 업로드 UI | `module-2` | `Step1Upload`, `useUploadPanel`, `UploadPanel` | 15~20 |
| 검토 UI | `module-3` | `ReviewCard`, `Step2Review`, `Step3Confirm` | 15~20 |
| 대시보드 통합 | `module-4` | `CardTimeline`, `CardItem`, `dashboard/page.tsx` 통합 | 10~15 |

#### Recommended Session Plan

| 세션 | 범위 | Scope |
|------|------|-------|
| Session 1 (현재) | Plan + Design | 완료 |
| Session 2 | DB + API 구현 | `--scope module-1` |
| Session 3 | 업로드 UI | `--scope module-2` |
| Session 4 | 검토 UI | `--scope module-3` |
| Session 5 | 대시보드 통합 + Check | `--scope module-4` |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-26 | Initial draft (Option C 선택) | jounggyu |
