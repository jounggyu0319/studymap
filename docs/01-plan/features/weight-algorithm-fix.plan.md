# weight-algorithm-fix Planning Document

> **Summary**: 서브태스크 가중치를 개수 기반 균등 배분에서 텍스트 내 숫자 범위 파싱 기반으로 변경 — "PPT 7-12" → weight 6, "PPT 13" → weight 1
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
| **Problem** | 서브태스크를 1개 완료해도 모두 같은 가중치라 진척도가 학습량을 반영하지 못한다 |
| **Solution** | 서브태스크 텍스트에서 숫자 범위(PPT 7-12, Ch.9-10)를 파싱해 항목 수만큼 가중치 부여 |
| **Function/UX Effect** | "PPT 7-12 복습" 완료 시 6포인트, "PPT 13 복습" 완료 시 1포인트 — 학습량 비례 진척도 |
| **Core Value** | 진척도가 실제 공부량을 정직하게 반영해 사용자 신뢰도 상승 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 균등 가중치는 "가벼운 퀴즈 1개 = 기말고사 범위 6챕터" 로 계산되어 진척도가 왜곡됨 |
| **WHO** | 강의계획서/시험 범위를 업로드하는 SKY 대학생 |
| **RISK** | 파싱 실패 시 기본값(1.0)으로 폴백 — 기존과 동일하므로 안전 |
| **SUCCESS** | "PPT 7-12 복습" weight=6, "PPT 13 복습" weight=1로 저장됨을 DB에서 확인 |
| **SCOPE** | 추출 시점 가중치 산정만. 사용자 수동 조정은 기존 검토 화면에서 유지 |

---

## 1. Overview

### 1.1 Purpose

AI가 서브태스크 텍스트에서 숫자 범위를 파싱해 학습 분량에 비례한 가중치를 자동 산정. 진척도가 실제 공부량을 반영하게 한다.

### 1.2 파싱 패턴

| 패턴 예시 | 파싱 결과 | weight |
|-----------|-----------|--------|
| "PPT 7-12 학습" | 12 - 7 + 1 = 6 | 6 |
| "PPT 13 학습" | 단일 번호 = 1 | 1 |
| "Ch. 9-10 복습" | 10 - 9 + 1 = 2 | 2 |
| "1~3강 복습" | 3 - 1 + 1 = 3 | 3 |
| "기출문제 풀이" | 숫자 없음 → 기본값 | 1 |
| "과거 시험 문제 (2001년 이후)" | 연도 제외 → 기본값 | 1 |

### 1.3 구현 위치

`/api/extract` 의 Claude Haiku 프롬프트에 가중치 산정 지시 추가. AI가 JSON 응답 시 각 서브태스크의 weight를 파싱된 범위 기반으로 직접 계산.

---

## 2. Scope

### 2.1 In Scope

- [ ] `/api/extract` 프롬프트에 범위 기반 가중치 산정 지시 추가
- [ ] subtasks 배열의 각 항목에 파싱된 weight 값 반환
- [ ] 숫자 범위 없으면 기본값 1.0 사용
- [ ] 연도(2001, 2024 등 4자리 숫자)는 범위로 해석하지 않음

### 2.2 Out of Scope

- 사용자 수동 가중치 수정 UI (기존 검토 화면에 이미 있음)
- 서브태스크 추가 이후 재계산 (수동 입력 시는 1.0 기본값)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 프롬프트에 "숫자 범위를 파싱해 weight 산정" 규칙 추가 | High | Pending |
| FR-02 | "PPT X-Y", "Ch. X-Y", "X~Y강" 패턴 → (Y - X + 1) | High | Pending |
| FR-03 | 단일 번호 → 1, 숫자 없음 → 1 (기본값) | High | Pending |
| FR-04 | 연도 패턴(4자리 숫자 단독) → 범위 계산에서 제외 | High | Pending |
| FR-05 | subtasks 각 항목의 weight가 범위 기반으로 DB에 저장 | High | Pending |

### 3.2 업데이트된 Haiku 프롬프트 추가 규칙

```
서브태스크 weight 산정 규칙:
- "PPT X-Y", "X~Y강", "Ch. X-Y" 패턴이면 (Y - X + 1)을 weight로 사용
- 단일 번호(PPT 13)이면 weight = 1
- 숫자가 없으면 weight = 1
- 연도처럼 보이는 4자리 숫자(2001, 2024)는 범위 계산 제외
- subtasks 내 모든 weight의 합이 카드 내에서 상대적 의미를 가짐 (정규화 불필요)
```

### 3.3 Non-Functional Requirements

| Category | Criteria |
|----------|----------|
| 안전성 | 파싱 실패 시 기본값 1.0 — 기존 동작과 동일 |
| 변경 범위 | `/api/extract` 프롬프트 수정만. DB 스키마 변경 없음 |

---

## 4. Success Criteria

- [ ] "PPT 7-12 학습" → subtasks.weight = 6으로 DB 저장
- [ ] "PPT 13 학습" → subtasks.weight = 1로 DB 저장
- [ ] "기출문제 풀이" → subtasks.weight = 1 (기본값)
- [ ] 기존 추출 품질(과목명, 유형, 마감일) 저하 없음

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AI가 연도를 범위로 잘못 파싱 | Medium | Low | 프롬프트에 연도 예외 명시 |
| 비정형 텍스트 파싱 실패 | Low | Medium | 실패 시 1.0 기본값으로 폴백 |

---

## 6. Architecture Considerations

### 6.1 변경 파일

- `src/app/api/extract/route.ts` — 프롬프트 수정만

### 6.2 DB 변경

없음 — `subtasks.weight` 컬럼 이미 존재.

---

## 7. Next Steps

1. [ ] `/pdca do weight-algorithm-fix` (Design 생략 — 프롬프트 수정만)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-26 | Initial draft | jounggyu |
