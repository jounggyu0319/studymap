# Active Context

## 현재 상태 (2026-04-29)
Feature 1~8 + UI·채팅·폴더·goal 규칙·전역 피드백까지 반영. **syllabus 추출은 여전히 실전 테스트·튜닝 여지 큼.**

## 지금 집중할 것
1. **syllabus 추출 품질 검증** — 여러 강의계획서, 중간·기말·주차 분리 정확도 (핵심)
2. goal·assignment 추출 실사용 테스트
3. Problem Sets 추출 프롬프트 다듬기
4. (선택) Vercel 배포 / 캘린더 뷰

## 완료된 것 (최근)
- **전역 「🐛 오류 제보」** — `layout.tsx` 우하단 고정 링크(Kakao 오픈채팅)
- **폴더 삭제** — `DELETE /api/folders/[id]`, 탭 호버 ✕ + confirm
- **goal 추출** — 단일 목표+나열 시 카드 1개·서브태스크는 사용자 문구 유지 (`EXTRACT_PROMPT_GOAL`)
- **채팅** — 서브태스크 삭제(빼줘), 대화 `history`, 다크 모드 입력 가독·CSS 미디어 레이아웃(768px 사이드)
- **업로드** — 문서 유형 필수 선택, syllabus 주차·중기말 규칙 보강
- **UI 2차** — CardItem/CardTimeline/대시보드 배경 고정, 삭제 버튼 대비
- **GitHub** — `jounggyu0319/studymap` 원격 연동
- **Feature 6·7·8** — 우선순위, 진척·채팅, 문서 유형 3종 (위 세부와 연계)

## Cursor 작업 시작 시
```
memory-bank/ 폴더를 읽고 현재 상태를 파악한 뒤 작업해줘.
```

## 작업 노선
- 방향 설정: 정규 + Claude (Cowork)
- 코드 구현: Cursor
- 컨텍스트: memory-bank/
