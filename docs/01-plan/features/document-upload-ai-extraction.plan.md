# document-upload-ai-extraction Planning Document

> **Summary**: 문서(PDF/이미지/텍스트)를 업로드하면 Claude Haiku가 할 일을 자동 추출하고, 사용자가 검토·확정하면 대시보드 카드가 생성되는 핵심 기능
>
> **Project**: 스터디맵 (StudyMap)
> **Version**: 0.1.0
> **Author**: jounggyu
> **Date**: 2026-04-26
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 강의계획서·과제 공지를 보고 할 일을 직접 입력하는 비용이 높아 관리 포기로 이어진다 |
| **Solution** | 문서를 올리면 Claude Haiku가 과목·유형·마감일·서브태스크를 자동 추출, 검토 후 한 번에 등록 |
| **Function/UX Effect** | 업로드 → AI 검토(수정 가능) → 확정 3단계로 입력 비용 ≈ 0, 원본 문서도 클라우드에 보관 |
| **Core Value** | "스터디맵"의 존재 이유 — 이 기능 없이는 앱이 성립하지 않는 핵심 차별점 |

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

### 1.1 Purpose

스터디맵의 핵심 가치 "입력 비용 ≈ 0"을 실현하는 기능. 사용자가 강의계획서나 과제 공지를 붙여넣거나 PDF로 올리면 AI가 할 일 목록을 자동으로 뽑아준다.

### 1.2 Background

- 기존 투두앱: 할 일을 직접 입력 → 귀찮아서 안 씀
- 스터디맵: 원본 문서에서 자동 추출 → 검토만 하면 됨
- Claude Haiku 사용: 빠르고 저렴 (문서 1개 ≈ $0.003)
- 원본 파일은 Supabase Storage에 보관 → 나중에 카드에서 열람 가능

### 1.3 Related Documents

- 브레인스토밍: `project_brainstorm.md`
- 이전 기능: `project-foundation.plan.md`

---

## 2. Scope

### 2.1 강의계획서의 역할

강의계획서는 **시험 일정·범위 파악 보조 자료**로만 활용한다.
- 강의 내용은 학기 중 수시로 변경될 수 있음
- 카드/서브태스크 생성의 기준은 강의계획서가 아닌 **실제 과제 공지·시험 범위 공지**
- 강의계획서 업로드 → 시험 날짜·범위만 추출 → 사용자가 세부 조정

### 2.2 지원 파일 형식

| 형식 | 지원 여부 | 비고 |
|------|-----------|------|
| 텍스트 붙여넣기 | ✅ v1 | 가장 권장하는 방식 |
| PDF (텍스트 기반) | ✅ v1 | 디지털 PDF만 가능 |
| HWP | ❌ | Node.js 지원 라이브러리 없음. "PDF로 저장하거나 텍스트를 복사해서 붙여넣어 주세요" 안내 |
| 이미지 PDF (스캔본) | ❌ v2 | Claude Vision 처리 예정 |
| Word/PPT | ❌ v2 | 추후 지원 예정 |

### 2.3 In Scope

- [ ] 업로드 UI: 폴더(학기) 선택 드롭다운 + 텍스트 붙여넣기 + PDF 파일 업로드
- [ ] PDF 텍스트 추출 (텍스트 기반 PDF만, 스캔본 제외)
- [ ] HWP 업로드 시 → 변환 안내 메시지 표시
- [ ] Claude Haiku API 호출 → 문서 맥락 기반으로 항목·유형·마감일·서브태스크·가중치 추출
- [ ] 문서 1개 업로드 → 카드 N개 생성 (항목 하나 = 카드 하나)
- [ ] 정보 불충분 감지 → 누락 항목 강조 + 사용자 직접 입력 요청
- [ ] AI 검토 화면: 추출 결과 수정/삭제/추가 + 가중치 수동 조정 가능
- [ ] 확정 시: 파일 Storage 업로드 → 카드 N개 + 서브태스크 DB 저장 (순서 보장)
- [ ] 원본 파일 Supabase Storage에 보관 → 카드에서 열람 링크 제공
- [ ] 연속 업로드: 확정 후 "다른 과제도 추가하기" 버튼
- [ ] 여러 문서를 한 번에 선택 → 직렬 처리 (한 개씩 순서대로 검토)

### 2.4 Out of Scope

- 이미지 PDF(스캔본) → v2
- Word/PPT/HWP 파일 직접 파싱 → v2
- 병렬 AI 처리 → v1은 직렬로 충분
- eTL 자동 연동 → 장기 로드맵
- 가중치 자동 재계산 (추가 자료 업로드 시) → v2

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 업로드 UI: 폴더 선택 드롭다운(기본값: 현재 활성 폴더) + 텍스트 붙여넣기 + PDF 파일 선택 | High | Pending |
| FR-02 | HWP 파일 선택 시 → "PDF로 저장하거나 텍스트를 붙여넣어 주세요" 안내 표시 | High | Pending |
| FR-03 | PDF에서 텍스트 추출 (pdf-parse, Node.js Runtime 전용 API Route) | High | Pending |
| FR-04 | Claude Haiku API로 문서 맥락 기반 구조화 데이터 추출 (항목 N개, 각 항목의 가중치 포함) | High | Pending |
| FR-05 | 추출 정보 불충분 시 → 누락 항목 강조 표시 + 사용자 직접 입력 요청 | High | Pending |
| FR-06 | AI 검토 화면: 카드 N개 미리보기 + 각 카드의 서브태스크·가중치 수정/삭제/추가 | High | Pending |
| FR-07 | 확정 시 순서대로 실행: ① 파일 Storage 업로드 → ② 카드 N개 + 서브태스크 DB 저장 | High | Pending |
| FR-08 | 원본 파일 Supabase Storage 비공개 저장 + 카드에 열람 링크 연결 | Medium | Pending |
| FR-09 | 여러 파일 선택 → 직렬 처리 (1개 검토·확정 → 다음 파일) | Medium | Pending |
| FR-10 | 확정 후 "다른 과제도 추가하기" 버튼으로 연속 업로드 | Medium | Pending |

### 3.2 유형 태그 목록

| 태그 | 설명 |
|------|------|
| 시험 | 중간고사, 기말고사 |
| 퀴즈 | 수업 중 퀴즈, 온라인 퀴즈 |
| 과제 | 개인 과제, 숙제 |
| 팀플 | 팀 프로젝트, 그룹 과제 |
| 발표 | 개인/팀 발표, PPT 발표 |
| 실습 | 실험 보고서, 코딩 실습 |
| 독서 | 도서 읽기, 논문 읽기 |
| 보고서 | 리포트, 분석 보고서 |
| 기타 | 위 분류 외 항목 |

### 3.3 Claude Haiku 추출 JSON 스펙

문서 1개 → 카드 N개. 항목 하나가 카드 하나.

```json
{
  "subject": "경제통계학",
  "items": [
    {
      "title": "중간고사 준비",
      "type": "시험",
      "dueDate": "2026-04-30",
      "weight": 0.35,
      "weightReason": "강의계획서에 중간고사 30% 명시",
      "subtasks": [
        { "title": "1~3강 복습", "weight": 0.1 },
        { "title": "4~6강 복습", "weight": 0.1 },
        { "title": "기출문제 풀기", "weight": 0.15 }
      ]
    },
    {
      "title": "기말고사 준비",
      "type": "시험",
      "dueDate": "2026-06-20",
      "weight": 0.40,
      "weightReason": "기말고사 40% 명시",
      "subtasks": [...]
    }
  ],
  "missingInfo": ["3주차 과제 마감일 누락"],
  "confidence": 0.85
}
```

- `weight`: AI가 문서 맥락(성적 비중 명시, 유형별 중요도)을 보고 판단. 검토 화면에서 수동 조정 가능
- `weightReason`: AI 판단 근거 — 검토 화면에 툴팁으로 표시

### 3.4 진척도 계산 공식

```
카드 진척도(%) =
  Σ(완료된 서브태스크.weight) / Σ(전체 서브태스크.weight) × 100

예시: 서브태스크 weight [0.1, 0.1, 0.15] 중 1개 완료(0.1)
  → 0.1 / 0.35 = 28.6%
```

### 3.5 정보 불충분 처리

- `confidence < 0.7` 또는 `missingInfo` 배열 항목 있으면 → 경고 표시
- 누락된 항목(마감일, 과목명 등)을 AI 검토 화면에서 빨간 테두리로 강조
- 사용자가 직접 입력 후 확정 가능 (강제 재업로드 아님)

### 3.6 Non-Functional Requirements

| Category | Criteria |
|----------|----------|
| 속도 | 텍스트 입력 기준 AI 응답 < 10초 |
| 비용 | Claude Haiku 사용, 문서 1개당 평균 $0.003 이하 |
| 파일 크기 | PDF 최대 10MB |
| 보안 | 파일은 Supabase Storage 비공개 버킷, 본인만 접근 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 텍스트 붙여넣기 → AI 추출 → 카드 생성 전체 플로우 동작
- [ ] PDF 업로드 → 텍스트 추출 → AI 추출 → 카드 생성 동작
- [ ] AI 검토 화면에서 서브태스크 수정/삭제/추가 후 확정 가능
- [ ] 정보 불충분 시 누락 항목 표시 동작
- [ ] 생성된 카드가 대시보드 타임라인에 마감일 순으로 표시
- [ ] 원본 파일 Supabase Storage 저장 + 카드에서 열람 가능

### 4.2 Quality Criteria

- [ ] TypeScript 에러 0개
- [ ] `npm run build` 성공
- [ ] API 에러 시 사용자에게 명확한 메시지 표시

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Claude API 비용 급증 | Medium | Low | Haiku 사용 + 요청당 최대 토큰 제한 설정 |
| 스캔본 PDF 텍스트 추출 실패 | Medium | Medium | 텍스트 추출 실패 시 "텍스트 직접 붙여넣기" 안내 |
| AI가 마감일/과목명 잘못 추출 | Medium | Medium | 검토 화면에서 수정 가능 + confidence 표시 |
| Supabase Storage 파일 용량 한도 | Low | Low | 무료 플랜 1GB 충분 (PDF 평균 1MB) |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change |
|----------|------|--------|
| `cards` 테이블 | DB (신규) | 카드 정보 저장 |
| `subtasks` 테이블 | DB (신규) | 서브태스크 + 가중치 저장 |
| `files` 버킷 | Supabase Storage (신규) | 원본 문서 보관 |
| `/api/extract` | API Route (신규) | Claude Haiku 호출 |
| `/api/cards` | API Route (신규) | 카드 CRUD |

---

## 7. Architecture Considerations

### 7.1 Project Level: Dynamic (유지)

### 7.2 Key Architectural Decisions

| Decision | Selected | Rationale |
|----------|----------|-----------|
| AI 모델 | Claude Haiku | 빠르고 저렴, 구조화 추출에 충분한 성능 |
| PDF 파싱 | `pdf-parse` npm 패키지 | 서버사이드 텍스트 추출, 무료. **Node.js Runtime 전용** — Edge Runtime 불가, `export const runtime = 'nodejs'` 필수 |
| HWP 처리 | 미지원 | Node.js HWP 파싱 라이브러리 없음. UI에서 PDF 변환 또는 텍스트 붙여넣기 안내 |
| 파일 저장 | Supabase Storage | 이미 스택에 있음, 별도 설정 불필요 |
| 업로드 타이밍 | 확정 시 업로드 | 검토 중 취소해도 고아 파일 없음. 확정 시 1~2초 추가 소요 → 로딩 스피너로 처리 |
| API 방식 | Next.js API Route (서버) | API 키 클라이언트 노출 방지 |
| 처리 방식 | 직렬 (1개씩 순서대로) | 병렬 대비 구현 단순, v1에 충분 |
| 가중치 설정 | AI 초기 설정 + 사용자 수동 조정 | 문서 맥락(성적 비중 등) 기반으로 AI가 초기값 판단, 검토 화면에서 조정 가능 |

### 7.3 DB 스키마 (신규)

```sql
-- 폴더 (학기/목적별 분류)
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,          -- "26-1학기", "토익 준비"
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folders_own" ON folders
  USING (auth.uid() = user_id);

-- 카드 (항목 하나 = 카드 하나)
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  folder_id UUID REFERENCES folders,
  subject TEXT NOT NULL,             -- 과목명
  title TEXT NOT NULL,               -- 카드 제목 (예: "중간고사 준비")
  type TEXT NOT NULL,                -- 유형 태그
  due_date DATE,                     -- 마감일
  weight DECIMAL DEFAULT 1.0,        -- AI 판단 가중치 (수동 조정 가능)
  weight_reason TEXT,                -- AI 가중치 판단 근거
  file_url TEXT,                     -- Supabase Storage URL (원본 문서)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards_own" ON cards
  USING (auth.uid() = user_id);

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
  USING (card_id IN (
    SELECT id FROM cards WHERE user_id = auth.uid()
  ));
```

---

## 8. Convention Prerequisites

### 8.1 Environment Variables 추가

| Variable | Purpose | Scope |
|----------|---------|-------|
| `ANTHROPIC_API_KEY` | Claude Haiku API 호출 | Server only |

---

## 9. Next Steps

1. [ ] `/pdca design document-upload-ai-extraction` 실행
2. [ ] Supabase에 cards, subtasks 테이블 생성
3. [ ] Supabase Storage `files` 버킷 생성 (비공개)
4. [ ] `/pdca do document-upload-ai-extraction` 구현

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-26 | Initial draft | jounggyu |
