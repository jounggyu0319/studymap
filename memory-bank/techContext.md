# Tech Context

## 기술 스택
- **Frontend**: Next.js 16 (App Router, TypeScript, Tailwind CSS)
- **Database**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **인증**: Google OAuth 2.0
- **AI**: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **PDF 파싱**: pdf-parse v1.1.1 (`lib/pdf-parse.js` 직접 참조)
- **배포**: Vercel (예정)

## DB 스키마
```sql
folders:  id, user_id, name, order_index, created_at + RLS (SELECT/INSERT)
cards:    id, user_id, folder_id, subject, title, type, due_date, weight, weight_reason, file_url, created_at + RLS (SELECT/INSERT)
subtasks: id, card_id, title, is_done, weight, order_index, created_at + RLS (SELECT/INSERT)
Storage:  files 버킷 (비공개) + RLS (SELECT/INSERT)
```

## API 목록
| Endpoint | Method | 역할 |
|---|---|---|
| `/api/extract` | POST | PDF/텍스트 → Claude Haiku 추출 |
| `/api/cards` | GET/POST | 카드 목록 조회 / 카드+서브태스크 생성 |
| `/api/cards/[id]` | PATCH/DELETE | 날짜 수정 / 카드 삭제 |
| `/api/cards/[id]/subtasks/[subtaskId]` | PATCH | 서브태스크 완료 토글 |
| `/api/chat-progress` | POST | Haiku JSON → 서브태스크 진행률 PATCH / 삭제 DELETE (`activeCardId`, carry-forward `history`) |

## 핵심 패턴 및 주의사항

### RLS 정책
- SELECT(USING)와 INSERT(WITH CHECK) 반드시 별도 작성
- storage.objects, cards, subtasks 모두 적용 필요

### Supabase 응답 처리
- 응답은 항상 snake_case → camelCase 변환 필요
- dashboard/page.tsx 및 /api/cards POST에서 변환

### PDF 파싱
- pdf-parse v2 사용 금지 (테스트파일 로드 버그)
- v1.1.1 사용, `lib/pdf-parse.js`로 직접 참조 (ENOENT 우회)

### 파일 업로드
- 파일명 한글/공백 → safeFileName 변환 (Supabase Storage Invalid key 방지)
- Buffer → btoa + Uint8Array 교체 (브라우저 호환)

### 가중치 알고리즘
- 서브태스크 텍스트에서 숫자 범위 파싱 → 분량 비례 가중치
- "PPT 7-12" → weight 6, "PPT 13" → weight 1
- 숫자 범위, 챕터 수, "Ch. 9-10" 패턴 파싱

### 채팅 진척도 매칭
- confidence ≥ 0.7이면 자동 완료 처리
- 미만이면 안내 메시지 반환
- "PPT 4번 봤어" → "PPT 3-5" 범위 내 포함 인식
