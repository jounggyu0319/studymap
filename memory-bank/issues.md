# StudyMap — 알려진 이슈 트래커

> 작업 전 반드시 이 파일을 읽고 미해결 항목을 확인할 것.
> 상태: 🔴 미해결 · 🟡 진행중 · ✅ 해결됨

---

## 채팅 인식 (chat-progress / Haiku SYSTEM_PROMPT)

### CHAT-01 · activeCardId 무시 — 엉뚱한 카드 삭제 ✅
**발생 상황:** 경제통계학 카드 상세뷰가 열려있는 상태에서 "9주차 삭제해" 입력 → 재료역학 9주차 서브태스크가 삭제됨.  
**원인:** Haiku가 `activeCardId` 컨텍스트를 우선하지 않고 전체 후보 중 키워드 매칭이 먼저 된 카드를 선택.  
**해결:** `candidatesForDelete`를 activeCardId 카드 서브태스크만으로 제한 (TypeScript 레벨 강제). activeCardId 없을 때만 전체 후보 탐색. 커밋 6778203.

---

### CHAT-02 · 과거형 없는 문장을 완료로 판단 ✅
**발생 상황:** "피피티 13번 10쪽 제대로 복습" 입력 → 14주차 서브태스크를 100% 완료 처리.  
**원인:** "복습"이라는 명사/동사 원형만으로 진척 완료를 판단. 과거형 동사 없음.  
**해결:** SYSTEM_PROMPT에 confidence 보정 기준 + 예시 추가 (과거형 있음 0.8~1.0 / 명사만 0.3~0.5). remove_subtask threshold 0.85로 상향. 커밋 6778203.

---

### CHAT-03 · 슬라이드·쪽 번호를 서브태스크 번호로 혼동 ✅ (CHAT-02와 동일 원인)
**발생 상황:** "피피티 13번 10쪽 복습" → 13주차가 아닌 14주차에 매칭.  
**원인 재분석:** 14주차 매칭 자체는 키워드(가설검정) 기준으로 정확했음. 실제 문제는 intent를 progressUpdate로 잘못 판단한 CHAT-02와 동일 원인.  
**해결:** CHAT-02 해결(confidence calibration)로 함께 해결됨. 커밋 6778203.

---

### CHAT-04 · 맥락이 명확한데 과도한 재확인 요청 🔴 (후순위)
**발생 상황:**  
- "재료역학 9주차 복구해" → "새로 추가냐 복구냐?" 재확인  
- "복구야" → "진행률도 말씀해 주세요" 재확인  
- "0%야" → 그제야 실행 (3턴 소요)  
- "2일차 삭제 복구해" → "어떤 카드에 어떤 내용을 추가할까요?" (실사용 테스트 2026-05-03, 미해결 확인)  
**원인:** lastDeletedSubtask가 Haiku 컨텍스트에 전달되나 복구 의도 매칭 실패 추정.  
**구현:** 커밋 7cc0222 (ChatProgress.tsx + route.ts) — 실사용 미통과.  
**결정:** 복구 기능 후순위 보류. 추가 디버깅 시점 미정.

---

### CHAT-05 · 히스토리 맥락 미활용 🔴 (후순위, CHAT-04와 동일 원인)
**발생 상황:** Haiku가 방금 전 "재료역학 9주차를 삭제했습니다"라고 답했는데, 다음 턴에서 삭제된 항목의 내용을 다시 물어봄.  
**원인:** lastDeletedSubtask 전달은 구현됐으나 Haiku 매칭 실패.  
**구현:** 커밋 7cc0222 — 실사용 미통과.  
**결정:** CHAT-04와 묶어 후순위 보류.

---

### CHAT-06 · 여러 서브태스크 동시 조작 미지원 ✅
**발생 상황:**
- "3번까지 했어", "1~5번 다 봤어" → 여러 서브태스크 진척 일괄 업데이트 불가
- "9주차 과제 삭제해 2개 다" → 1개만 삭제됨 (실제 확인된 사례)

**해결:** 채팅 다건 처리(Haiku 신뢰성 리스크 높음) 대신 **체크박스 직접 클릭**으로 대체.
- 미완료 클릭 → progress 100, is_done true
- 완료 클릭 → progress 0, is_done false (토글)
- 낙관적 업데이트 + PATCH `/api/subtasks/[id]` + 실패 시 롤백
- 신규: `src/app/api/subtasks/[id]/route.ts` (PATCH)
- 수정: `CardItem.tsx`, `CardTimeline.tsx`, `DashboardClient.tsx`
- 실사용 테스트 통과.

---

## UI / 가중치

### UI-01 · 가중치 알고리즘 직관성 문제 🟡
**발생 상황:** 경제통계학 기말고사 카드에서 14주차 하나(6개 중 1개)만 완료했는데 전체 진척도 40% 표시.  
**원인:** Feature 4의 텍스트 숫자 파싱 기반 분량 비례 가중치 — "Final 대비 정리" 키워드로 14주차에 높은 가중치 부여.  
**해결 방향 A:** 가중치 알고리즘 유지, 사용자에게 가중치 근거 표시.  
**해결 방향 B:** 균등 가중치로 변경 (서브태스크 개수로 나눔).  
**사용자 결정:** 해결 예정 (방향 미확정)

---

## 기능 부재

### FEAT-01 · 서브태스크 추가 기능 없음 ✅
**발생 상황:** 채팅에서 "9주차 서브태스크 추가해" → 처리 불가.  
**원인:** `POST /api/subtasks` API 미구현. 서브태스크는 문서 업로드 시 추출로만 생성 가능.  
**해결:** `src/app/api/subtasks/route.ts` 신규 생성 (POST). SYSTEM_PROMPT에 `add_subtask` action 추가. chat-progress에 INSERT 분기 추가. 커밋 76c0bf3.  
**잔여 과제:** 추가 성공 시 UI 자동 반영 핸들러(`onSubtaskAdded`) 미구현 — 현재는 새로고침 필요.

---

### FEAT-02 · 삭제 실행취소(undo) 없음 ❌ (기각)
**사유:** pendingDelete 확인 게이트가 이미 존재해 실수 삭제 가능성 낮음. 구현 비용 대비 효용 부족으로 사용자 결정에 의해 기각.

---

## 변경 이력

| 날짜 | 항목 | 내용 |
|------|------|------|
| 2026-05-02 | 전체 | 최초 작성 |
| 2026-05-03 | CHAT-01~03 | 삭제 확인 게이트 + candidates 분리 + confidence calibration 구현 (커밋 6778203) |
| 2026-05-03 | pendingDelete 버그 | remove_subtask confidence threshold 제거 → 항상 pendingDelete 게이트 통과. Haiku message 무시, TypeScript 고정 문구 사용 (커밋 b4a7483) |
| 2026-05-03 | pendingDelete 버튼 렌더링 버그 | data.pendingDelete === true 엄격 체크 → parsePendingDeletePayload()로 느슨한 정규화. 모바일 채팅 높이 min(42vh,260px)로 확대 (커밋 71b4d03) |
| 2026-05-03 | FEAT-01 | POST /api/subtasks 신규 구현 + chat-progress add_subtask 분기 추가 (커밋 76c0bf3). UI 자동 반영 핸들러는 잔여 과제. |
| 2026-05-03 | CHAT-06 | 체크박스 직접 클릭으로 대체 해결. PATCH /api/subtasks/[id] 신규, CardItem·CardTimeline·DashboardClient 수정. 실사용 테스트 통과. |
| 2026-05-03 | CHAT-04/05 | lastDeletedSubtask state 추적 (ChatProgress.tsx) + API carry-forward (route.ts) + SYSTEM_PROMPT 복구 섹션 추가. tsc 통과. 커밋 7cc0222. 실사용 검증 미완. |
