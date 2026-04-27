# Active Context

## 현재 상태 (2026-04-28)
Feature 1~8 + UI 개선 완료. 기능은 동작하지만 **syllabus 추출은 다양한 강의계획서로 충분히 테스트되지 않은 미완성 상태**.

## 지금 집중할 것
1. **syllabus 추출 품질 검증** — 여러 과목 강의계획서로 테스트, 중간·기말 범위 파싱 정확도 확인 및 프롬프트 개선 (핵심)
2. goal 추출 실사용 테스트
3. Problem Sets 추출 프롬프트 다듬기

## 완료된 것 (최근)
- **UI 개선 2차** — CardItem border 통일, CardTimeline 간격 확대, 대시보드 배경 `#f3f4f6` 고정 (다크모드 대응)
- **UI 개선 1차** — 사이드바 384px, FAB 「＋ 새 할 일」, 진척 바 색상 구간, 우선순위 섹션 파란 배경
- **반응형 레이아웃 안정화** — CSS 미디어 쿼리 직접 삽입 방식으로 Tailwind v4 + Next.js SSR 충돌 해결
- **Feature 7** — `progress` 0~100, 채팅 완료/부분/취소/모호 되묻기
- **Feature 8** — 업로드 문서 유형 3종(syllabus / assignment / goal)
- **Feature 6** — Top 3 우선순위 (부분 진척 반영)

## Cursor 작업 시작 시
```
memory-bank/ 폴더를 읽고 현재 상태를 파악한 뒤 작업해줘.
```

## 작업 노선
- 방향 설정: 정규 + Claude (Cowork)
- 코드 구현: Cursor
- 컨텍스트: memory-bank/
