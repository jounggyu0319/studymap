# main-chat-progress Planning Document

> **Summary**: 대시보드 하단 고정 채팅창에 자연어 입력("IO 1~3강 봤어")하면 Claude Haiku가 카드 목록을 컨텍스트로 받아 해당 서브태스크를 자동 완료 처리하는 기능
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
| **Problem** | 체크박스를 직접 찾아 클릭하는 방식은 귀찮고, 이동 중 빠르게 진척도를 업데이트하기 어렵다 |
| **Solution** | 대시보드 하단 고정 채팅창에 자연어로 입력하면 AI가 카드를 매칭해 서브태스크를 자동 완료 처리 |
| **Function/UX Effect** | "IO 1~3강 봤어" → 해당 서브태스크 완료 + 진척도 즉시 업데이트. 체크박스 클릭도 병행 가능 |
| **Core Value** | 모바일에서 이동 중 한 줄 입력만으로 진척도 관리 — 스터디맵의 두 번째 핵심 차별점 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 체크박스 직접 클릭보다 자연어 입력이 모바일 환경에서 훨씬 빠름 |
| **WHO** | SKY 대학생 — 이동 중 "오늘 뭐 했어" 기록하고 싶은 상황 |
| **RISK** | AI 매칭 정확도 — 카드가 많아질수록 잘못 매칭할 가능성. 매칭 결과 표시로 보완 |
| **SUCCESS** | "IO 1~3강 봤어" 입력 → 5초 내 해당 서브태스크 완료 처리 + 진척도 업데이트 확인 |
| **SCOPE** | v1 — 서브태스크 완료 처리만. AI 공부계획 생성, 카드 상세 채팅은 v2 |

---

## 1. Overview

### 1.1 Purpose

체크박스를 찾아 클릭하는 마찰을 없애고, 자연어 한 줄로 진척도를 업데이트할 수 있게 한다. 모바일에서 특히 유용.

### 1.2 Background

- 기존 방식: 카드 클릭 → 펼치기 → 서브태스크 찾기 → 체크박스 클릭 (4단계)
- 새 방식: 채팅창에 "IO 1~3강 봤어" 입력 → AI가 처리 (1단계)
- 토큰 비용: 학기당 카드 5~10개 × 서브태스크 평균 3~5개 ≈ 요청당 ~1000토큰 → 실질 비용 무시 가능
- 체크박스 직접 클릭도 계속 지원

### 1.3 Related Documents

- 선행 기능: `document-upload-ai-extraction.plan.md`

---

## 2. Scope

### 2.1 In Scope

- [ ] 대시보드 하단 고정 채팅 입력창
- [ ] 입력 → `/api/chat-progress` POST → Claude Haiku 호출
- [ ] Haiku가 유저 카드+서브태스크 전체를 컨텍스트로 받아 매칭
- [ ] 매칭된 서브태스크 `is_done = true` 업데이트
- [ ] AI 응답 메시지 표시 ("IO 중간고사 카드의 '1~3강 복습'을 완료로 표시했어요")
- [ ] 대시보드 진척도 즉시 반영 (낙관적 업데이트)
- [ ] 매칭 실패 시 → "어떤 카드인지 못 찾았어요. 직접 체크해주세요" 안내

### 2.2 Out of Scope

- AI 공부계획 자동 생성 (v2)
- 카드 상세 화면의 별도 채팅창 (v2)
- 채팅 히스토리 저장 (v1은 세션 내만)
- 복수 서브태스크 동시 매칭 ("1~3강이랑 4~6강 다 봤어") → v2

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 대시보드 하단 고정 채팅 입력창 (항상 표시) | High | Pending |
| FR-02 | 입력 전송 → `/api/chat-progress` POST | High | Pending |
| FR-03 | API가 유저의 전체 카드+서브태스크를 Haiku에 컨텍스트로 전달 | High | Pending |
| FR-04 | Haiku가 매칭 결과를 JSON으로 반환 (`{cardId, subtaskId, confidence}`) | High | Pending |
| FR-05 | confidence ≥ 0.7이면 자동 완료 처리, 미만이면 확인 요청 | High | Pending |
| FR-06 | AI 응답 메시지 채팅창에 표시 | High | Pending |
| FR-07 | 완료 처리 후 대시보드 진척도 즉시 업데이트 | High | Pending |
| FR-08 | 매칭 실패 메시지 표시 | Medium | Pending |

### 3.2 Claude Haiku 응답 JSON 스펙

```json
{
  "matched": true,
  "cardId": "uuid",
  "subtaskId": "uuid",
  "confidence": 0.92,
  "message": "'IO 중간고사' 카드의 '1~3강 복습'을 완료로 표시했어요."
}
```

### 3.3 프롬프트 컨텍스트 구조

```
사용자 입력: "IO 1~3강 봤어"

카드 목록:
- [카드 ID: xxx] Industrial Organization > 중간고사
  서브태스크:
  - [ID: aaa] 강의 PPT 1~5 복습 (미완료)
  - [ID: bbb] 과거 시험 문제 풀이 (미완료)
- [카드 ID: yyy] ...

가장 잘 맞는 서브태스크를 찾아서 JSON으로 반환하세요.
```

### 3.4 Non-Functional Requirements

| Category | Criteria |
|----------|----------|
| 속도 | 입력 후 응답 < 5초 |
| 비용 | Haiku 사용, 요청당 ~$0.001 이하 |
| 정확도 | confidence 임계값 0.7로 오매칭 최소화 |

---

## 4. Success Criteria

- [ ] "IO 1~3강 봤어" 입력 → 5초 내 해당 서브태스크 완료 + 응답 메시지
- [ ] 진척도 게이지 즉시 업데이트
- [ ] 매칭 안 될 때 명확한 안내 메시지
- [ ] 체크박스 직접 클릭과 병행 동작

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AI 오매칭 | Medium | Medium | confidence < 0.7 시 확인 요청 |
| 카드 없을 때 호출 | Low | Low | 카드 0개면 채팅창 비활성화 |
| API 응답 지연 | Low | Low | 로딩 스피너 + 타임아웃 10초 |

---

## 6. Architecture Considerations

### 6.1 새 API

| Endpoint | Method | 설명 |
|----------|--------|------|
| `/api/chat-progress` | POST | 자연어 → 서브태스크 완료 처리 |

### 6.2 DB 변경

없음 — 기존 `subtasks.is_done` 컬럼 업데이트만 사용.

### 6.3 환경변수

`ANTHROPIC_API_KEY` — 기존 사용 중.

---

## 7. Next Steps

1. [ ] `/pdca design main-chat-progress`
2. [ ] `/pdca do main-chat-progress`

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-26 | Initial draft | jounggyu |
