# instant-card-creation Planning Document

> **Summary**: AI 추출 완료 즉시 카드를 자동 생성 — 검토(Step 2) 단계 제거. 카드 생성 후 대시보드 인라인 수정은 유지
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
| **Problem** | 검토 단계가 투두리스트와 다를 게 없고, "자동화"라는 핵심 가치를 스스로 깎는다 |
| **Solution** | AI 추출 완료 → 즉시 카드 생성. 검토 없이 바로 대시보드에 나타남 |
| **Function/UX Effect** | 업로드 → AI 분석 중 → 완료! 카드 N개 생성됨. 수정은 카드 클릭으로 인라인 처리 |
| **Core Value** | "입력 비용 ≈ 0"의 완성 — 검토조차 없이 바로 쓸 수 있는 진정한 자동화 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 검토 단계가 있으면 자동화의 의미가 퇴색. 틀려도 나중에 고치면 됨 |
| **WHO** | 빠르게 세팅하고 싶은 학기 초 SKY 대학생 |
| **RISK** | AI 추출 오류가 바로 카드로 생성됨 → 카드 삭제/수정 기능이 필수 선행 |
| **SUCCESS** | PDF 업로드 후 10초 내 대시보드에 카드 자동 생성 확인 |
| **SCOPE** | Step 2 제거 + Step 3 → 완료 토스트로 대체. 카드 인라인 수정 유지 |

---

## 1. Overview

### 1.1 Purpose

현재 3단계(업로드→검토→확정) 플로우에서 Step 2(검토)를 제거해 업로드 → 즉시 생성으로 단축. AI를 믿고 바로 쓰는 경험 제공.

### 1.2 변경 전후

| 현재 | 변경 후 |
|------|---------|
| Step 1: 업로드 | Step 1: 업로드 |
| Step 2: AI 검토 (수정/삭제) | ~~Step 2 제거~~ |
| Step 3: 확정 → 카드 생성 | → AI 분석 중 스피너 |
| | → 완료 토스트 ("카드 2개 추가됨!") |

### 1.3 수정/삭제는 어디서?

- **카드 수정**: 대시보드 카드 클릭 → 제목/날짜/유형 인라인 수정 (기존 날짜 수정 기능 확장)
- **카드 삭제**: 카드에 삭제 버튼 추가 (이번 Feature에서 함께 구현)

---

## 2. Scope

### 2.1 In Scope

- [ ] UploadPanel Step 2(검토) 제거
- [ ] AI 추출 완료 → 즉시 `/api/cards` POST → 카드 생성
- [ ] 완료 토스트 메시지 ("카드 N개가 추가됐어요!") + 대시보드 자동 갱신
- [ ] 카드 삭제 기능 추가 (카드 우측 상단 × 버튼 → 삭제 확인 없이 즉시)
- [ ] 카드 인라인 수정 확장: 제목, 유형태그, 서브태스크 추가/삭제

### 2.2 Out of Scope

- 삭제 취소(Undo) 기능 (v2)
- 서브태스크 내용 인라인 수정 (v2)
- 배치 삭제 (v2)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | UploadPanel: AI 추출 완료 직후 자동으로 `/api/cards` POST 호출 | High | Pending |
| FR-02 | 성공 시 토스트 메시지 표시 + 패널 닫기 + 대시보드 카드 추가 | High | Pending |
| FR-03 | 카드 삭제 API: `DELETE /api/cards/[id]` | High | Pending |
| FR-04 | CardItem에 삭제 버튼 추가 (펼친 상태에서 노출) | High | Pending |
| FR-05 | 카드 제목/유형 인라인 수정 (카드 펼침 상태에서) | Medium | Pending |
| FR-06 | 업로드 실패 시 에러 토스트 표시 | High | Pending |

### 3.2 새 API

| Endpoint | Method | 설명 |
|----------|--------|------|
| `DELETE /api/cards/[id]` | DELETE | 카드 + 서브태스크 삭제 (CASCADE) |

### 3.3 Non-Functional Requirements

| Category | Criteria |
|----------|----------|
| 속도 | 업로드 → 카드 생성 완료 < 15초 (AI 추출 포함) |
| UX | 실패 시 명확한 에러 메시지 + 재시도 가능 |

---

## 4. Success Criteria

- [ ] PDF 업로드 → 스피너 → 토스트 → 대시보드에 카드 자동 표시
- [ ] Step 2 화면이 더 이상 나타나지 않음
- [ ] 카드 삭제 버튼 클릭 → 카드 즉시 사라짐 + DB 삭제 확인
- [ ] 업로드 실패 시 에러 토스트 표시

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AI 오추출로 잘못된 카드 생성 | Medium | Medium | 카드 삭제/수정으로 즉시 정정 가능 |
| 업로드 중 패널 닫기 | Low | Low | 업로드 중 닫기 버튼 비활성화 |

---

## 6. Architecture Considerations

### 6.1 변경 파일

- `src/components/upload/UploadPanel.tsx` — Step 2 제거, 즉시 저장 로직
- `src/components/dashboard/CardItem.tsx` — 삭제 버튼, 인라인 수정
- `src/app/api/cards/[id]/route.ts` — DELETE 메서드 추가

### 6.2 DB 변경

없음 — CASCADE 삭제는 기존 `subtasks` FK에 이미 설정됨.

---

## 7. Next Steps

1. [ ] `/pdca do instant-card-creation` (단순 변경이라 Design 생략)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-26 | Initial draft | jounggyu |
