# System Patterns

## 아키텍처
```
사용자 브라우저 (Next.js App Router)
  └─ /dashboard — 메인 대시보드 (카드 목록 + 하단 채팅창)
  └─ /api/* — API 라우트 (서버리스)
       ├─ Supabase PostgreSQL (cards, subtasks, folders)
       ├─ Supabase Storage (PDF 파일)
       └─ Claude Haiku API (문서 파싱, 채팅 매칭)
```

## 코딩 패턴

### API 라우트 기본 구조
```typescript
// 인증 확인 → Supabase 쿼리 → camelCase 변환 → 응답
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### Supabase snake_case → camelCase 변환
Supabase 응답은 항상 snake_case. 프론트엔드로 넘기기 전 변환 필수.
```typescript
const mapped = data.map(row => ({
  id: row.id,
  cardId: row.card_id,
  isDone: row.is_done,
  // ...
}))
```

### RLS 정책 작성 원칙
SELECT와 INSERT를 반드시 별도로 작성.
```sql
-- SELECT
CREATE POLICY "users can view own cards"
ON cards FOR SELECT USING (auth.uid() = user_id);

-- INSERT
CREATE POLICY "users can insert own cards"
ON cards FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### PDF 파싱
```javascript
// lib/pdf-parse.js 직접 참조 (v1.1.1, ENOENT 우회)
const pdfParse = require('../../lib/pdf-parse')
```

### 파일명 안전 변환
```typescript
const safeFileName = fileName
  .replace(/[^a-zA-Z0-9._-]/g, '_')
  .replace(/_+/g, '_')
```

### 가중치 계산
```typescript
// "PPT 7-12" → 6, "PPT 13" → 1, "Ch. 9-10" → 2
function parseWeight(title: string): number {
  const rangeMatch = title.match(/(\d+)\s*[-~]\s*(\d+)/)
  if (rangeMatch) return parseInt(rangeMatch[2]) - parseInt(rangeMatch[1]) + 1
  return 1
}
```

### 채팅 진척도 매칭
- confidence ≥ 0.7 → 자동 완료 처리
- 미만 → 안내 메시지 ("어떤 과목인지 더 알려줄 수 있어요?")
- 카드 목록 전체를 Claude Haiku 컨텍스트로 전달
