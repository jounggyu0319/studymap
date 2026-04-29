import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CONFIDENCE_AUTO = 0.7
const CONFIDENCE_TIE_WINDOW = 0.1
const CLARIFY_MIN_CONF_CARDS = 0.4

const CLARIFY_MSG =
  "어느 과목 카드인지 조금 더 알려주실 수 있어요? (예: 'IO 중간 2강')"

const CLARIFY_PROGRESS_MSG =
  "어떤 과목을 얼마나 하셨나요? 예: 'IO PPT 3 80%' 또는 '통계 책 300p 중 280p'"

/** 채팅으로 새 카드/과제를 만들 수 없을 때 안내 */
const UNSUPPORTED_CREATE_VIA_CHAT_MSG =
  '채팅으로 **새 과제·카드·서브태스크를 추가**하는 기능은 아직 없어요. 오른쪽 아래 **「+ 강의계획서 / 과제 추가」**에서 올려 주세요. **이미 있는 서브태스크 삭제(빼기)**와 **진행률(%) 변경**은 이 채팅에서 할 수 있어요.'

type ChatTurn = { role: 'user' | 'ai'; text: string }

function parseHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return []
  const out: ChatTurn[] = []
  for (const row of raw) {
    if (row && typeof row === 'object' && 'role' in row && 'text' in row) {
      const role = (row as { role: string }).role
      const text = String((row as { text: unknown }).text ?? '')
      if ((role === 'user' || role === 'ai') && text.trim()) out.push({ role, text: text.trim() })
    }
  }
  return out
}

/** 서브태스크 삭제·제외 요청 (진행률 숫자 빼기와 구분) */
function looksLikeRemoveSubtaskRequest(msg: string): boolean {
  const m = msg.trim()
  if (!m) return false
  if (/\d+\s*%|\d+\s*퍼센트|진행\s*률/.test(m) && /빼|줄여/.test(m)) return false
  return /제거|삭제|없애\s*줘|없애주|빼\s*줘|빼주세요|빼고\s*싶|제외|목록에서\s*빼|필요\s*없|안\s*할래|안\s*할\s*거|빼$|빼요$/i.test(
    m,
  )
}

/** 짧은 긍정·확인 — 직전 학생 메시지와 합쳐 해석 */
function looksLikeAffirmation(msg: string): boolean {
  const t = msg.trim()
  if (t.length > 24) return false
  return /^(맞아|맞아요|맞습니다|응|네|네요|그래|그렇게|오케이|ok|okay|yes|ㅇㅇ|해줘|해\s*주세요|좋아|그럼|확인|ㅇㅋ)$/i.test(
    t,
  )
}

function buildEffectiveUserMessage(message: string, history: ChatTurn[]): string {
  if (!looksLikeAffirmation(message)) return message
  const priorUsers = history.filter(h => h.role === 'user').map(h => h.text.trim())
  const lastPrior = priorUsers[priorUsers.length - 1]
  if (!lastPrior || lastPrior === message.trim()) return message
  return `${lastPrior}\n(확인·후속: ${message.trim()})`
}

function formatHistoryForPrompt(history: ChatTurn[]): string {
  if (history.length === 0) return '(이전 대화 없음)'
  return history
    .slice(-8)
    .map(h => `${h.role === 'user' ? '학생' : '어시스턴트'}: ${h.text}`)
    .join('\n')
}

/** "기출 넣어줘"처럼 생성 요청인지 (진행 보고와 구분) */
function looksLikeCreateTaskRequest(msg: string): boolean {
  const m = msg.trim()
  const addVerb =
    /넣어\s*(줘|주세요)?|추가\s*해\s*(줘|주세요)?|추가해줘|등록해|만들어\s*줘|도\s*넣어/.test(m)
  if (!addVerb) return false

  const createNoun =
    /기출|과제\s*(를|을)\s*(넣|추가)|할\s*일\s*(을|를)\s*(넣|추가)|새\s*(카드|과제)|카드\s*(를|을)\s*(추가|만들)|서브태스크|항목\s*(을|를)\s*(넣|추가)|풀이\s*도\s*넣/.test(m)
  if (!createNoun) return false

  if (
    /(?:PPT|ppt|피피티)\s*\d+/.test(m) &&
    /완료|끝|다\s*했|봤어/.test(m) &&
    !/기출|새\s*과제|카드/.test(m)
  ) {
    return false
  }

  return true
}

type RawCandidate = { cardId?: string; subtaskId?: string; confidence?: number }

type ProgressUpdate = {
  apply?: boolean
  percent?: number
  vague?: boolean
}

function dueTime(raw: string | null | undefined): number {
  if (raw == null || raw === '') return Number.POSITIVE_INFINITY
  const t = new Date(raw).getTime()
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

function clampProgress(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)))
}

/** 메시지에서 PPT/강/주차 번호 추출 (1번 피피티, PPT 3, 2강 등) */
function extractRequestedSlideOrLectureNumber(msg: string): number | null {
  const normalized = msg.replace(/\s+/g, ' ')
  const patterns: RegExp[] = [
    /(?:PPT|ppt|피피티)\s*(\d+)/i,
    /(\d+)\s*번(?:\s*(?:피피티|PPT|ppt))?/,
    /(\d+)\s*강\b/,
    /(\d+)\s*주차\b/,
  ]
  for (const re of patterns) {
    const m = normalized.match(re)
    if (m) {
      const n = parseInt(m[1], 10)
      if (Number.isFinite(n) && n > 0 && n <= 99) return n
    }
  }
  return null
}

/** 서브태스크 제목이 "N번" 항목과 일치하는지 (PPT / Problem #N / 문항 등, 10 vs 1 구분) */
function subtaskTitleMatchesNumber(title: string, n: number): boolean {
  const t = title.trim()
  const nb = String(n)
  if (new RegExp(`(?:PPT|ppt)\\s*${n}(?!\\d)`, 'i').test(t)) return true
  if (new RegExp(`피피티\\s*${n}(?!\\d)`).test(t)) return true
  if (new RegExp(`^${n}\\s*강\\b`).test(t)) return true
  if (new RegExp(`^${n}\\s*주차\\b`).test(t)) return true
  if (new RegExp(`^${n}\\s*[:：·]`).test(t)) return true
  if (new RegExp(`(?:Problem|PROBLEM|문제|문항)\\s*#?\\s*${n}(?!\\d)`, 'i').test(t)) return true
  if (new RegExp(`\\bQ\\s*${n}(?!\\d)\\b`, 'i').test(t)) return true
  if (new RegExp(`#\\s*${n}(?!\\d)(?:\\s|$)`, 'i').test(t)) return true
  if (new RegExp(`(?:제|항목)\\s*${n}(?!\\d)\\b`).test(t)) return true
  return false
}

function extractExamKind(msg: string): 'mid' | 'final' | null {
  if (/기말/.test(msg)) return 'final'
  if (/중간/.test(msg)) return 'mid'
  return null
}

function cardTitleMatchesExamKind(cardTitle: string, kind: 'mid' | 'final'): boolean {
  if (kind === 'mid') return /중간/.test(cardTitle)
  return /기말/.test(cardTitle)
}

/** 한글·영문 약어 ↔ 과목/카드 제목 한 덩어리 */
function messageMatchesCardSubject(msg: string, subjectOrTitle: string): boolean {
  const s = subjectOrTitle.replace(/\s/g, '')
  const m = msg.replace(/\s/g, '')
  if (s.length >= 2 && (m.includes(s) || s.includes(m))) return true

  const pairs: [RegExp, RegExp][] = [
    [/산조론|산조\b|IO\b|I\.O\./i, /산업조직|Industrial\s*Organization/i],
    [/미적\b/i, /미적분|Calculus/i],
    [/재료역학|재료역\b|소재역학|재료\s*역학/i, /Mechanics\s+of\s+Materials|Strength\s+of\s+Materials|Materials\s+and\s+Lab/i],
    [/경통\b|경제통계/i, /Economic\s+Statistics|Econometrics/i],
    [/통계학(?!원)/i, /Statistics(?!\s+and\s+Probability)/i],
    [/회계원리|회계학/i, /Accounting|Financial\s+Accounting/i],
    [/마케팅/i, /Marketing/i],
    [/경제학\s*원론|미시경제|거시경제/i, /Economics|Microeconomics|Macroeconomics/i],
    [/영어\b|영작/i, /English|Writing/i],
    [/정치학개론|정치학\s*개론/i, /Political\s+Science|Politics|Introduction\s+to\s+Politics/i],
  ]
  for (const [msgRe, subRe] of pairs) {
    if (msgRe.test(msg) && subRe.test(subjectOrTitle)) return true
  }
  return false
}

/** 메시지가 카드의 subject 또는 title(영문 과제명 등)과 같은 과목인지 */
function messageMatchesCardContext(
  msg: string,
  subject: string,
  cardTitle: string,
): boolean {
  return (
    messageMatchesCardSubject(msg, subject) ||
    messageMatchesCardSubject(msg, cardTitle) ||
    messageMatchesCardSubject(msg, `${subject} ${cardTitle}`)
  )
}

function looksLikeCourseHint(msg: string): boolean {
  return /산조|산업|IO\b|미적|통계|경제|마케|회계|영어|토익|과목|강의|재료|소재|경통|문제|과제/i.test(
    msg,
  )
}

type Cand = { subtaskId: string; cardId: string | undefined; confidence: number }

type NarrowResult =
  | { ok: true; cands: Cand[] }
  | { ok: false; reason: 'no_ppt' | 'multi_exam'; slideN?: number }

function narrowCandidates(
  message: string, // may be effectiveMessage (이전 발화 병합)
  deduped: Cand[],
  cards: Record<string, unknown>[],
  subtasks: Record<string, unknown>[],
): NarrowResult {
  let out = deduped
  const exam = extractExamKind(message)
  const slideN = extractRequestedSlideOrLectureNumber(message)

  if (slideN != null) {
    const filtered = out.filter((c) => {
      const st = subtasks.find((s) => s.id === c.subtaskId) as { title?: string } | undefined
      return st?.title && subtaskTitleMatchesNumber(String(st.title), slideN)
    })
    if (filtered.length === 0) return { ok: false, reason: 'no_ppt', slideN }
    out = filtered
  }

  if (looksLikeCourseHint(message)) {
    const cardById = new Map(cards.map((c) => [c.id as string, c]))
    const filtered = out.filter((c) => {
      const st = subtasks.find((s) => s.id === c.subtaskId) as { card_id?: string } | undefined
      const cid = (c.cardId && cardById.has(c.cardId) ? c.cardId : st?.card_id) as string | undefined
      const card = cid ? cardById.get(cid) : undefined
      const subject = card ? String((card as { subject?: string }).subject ?? '') : ''
      const ctitle = card ? String((card as { title?: string }).title ?? '') : ''
      return messageMatchesCardContext(message, subject, ctitle)
    })
    if (filtered.length > 0) out = filtered
  }

  if (exam) {
    const cardById = new Map(cards.map((c) => [c.id as string, c]))
    const filtered = out.filter((c) => {
      const st = subtasks.find((s) => s.id === c.subtaskId) as { card_id?: string } | undefined
      const cid = (c.cardId && cardById.has(c.cardId) ? c.cardId : st?.card_id) as string | undefined
      const card = cid ? cardById.get(cid) : undefined
      const title = card ? String((card as { title?: string }).title ?? '') : ''
      return cardTitleMatchesExamKind(title, exam)
    })
    if (filtered.length > 0) out = filtered
  }

  const uniqueCards = new Set(
    out.map((c) => {
      const st = subtasks.find((s) => s.id === c.subtaskId) as { card_id?: string } | undefined
      return (c.cardId ?? st?.card_id) as string
    }).filter(Boolean),
  )
  if (uniqueCards.size >= 2 && !exam && slideN != null) {
    return { ok: false, reason: 'multi_exam', slideN }
  }

  return { ok: true, cands: out }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const body = (await request.json()) as { message?: string; history?: unknown }
  const message = typeof body.message === 'string' ? body.message : ''
  const history = parseHistory(body.history)

  if (!message.trim()) return NextResponse.json({ error: '메시지를 입력해주세요.' }, { status: 400 })

  const effectiveMessage = buildEffectiveUserMessage(message.trim(), history)

  if (looksLikeCreateTaskRequest(message)) {
    return NextResponse.json({
      matched: false,
      progressApplied: false,
      unsupportedAction: 'create_task',
      message: UNSUPPORTED_CREATE_VIA_CHAT_MSG,
    })
  }

  const { data: cards } = await supabase.from('cards').select('*').eq('user_id', user.id)
  const cardIds = (cards ?? []).map((c: { id: string }) => c.id)
  const cardById = new Map(
    (cards ?? []).map((c: { id: string; due_date?: string | null }) => [c.id, c]),
  )

  const { data: subtasks } = await supabase
    .from('subtasks')
    .select('*')
    .in('card_id', cardIds.length > 0 ? cardIds : ['none'])

  const validSubtaskId = new Set((subtasks ?? []).map((r: { id: string }) => r.id))

  if (!cards?.length) {
    return NextResponse.json({ message: '아직 등록된 카드가 없어요. 먼저 강의계획서를 업로드해주세요.' })
  }

  const context = (cards ?? []).map((card: Record<string, unknown>) => {
    const cardSubtasks = (subtasks ?? []).filter((s: Record<string, unknown>) => s.card_id === card.id)
    const subtaskList = cardSubtasks
      .map((s: Record<string, unknown>) => {
        const p = typeof s.progress === 'number' ? s.progress : s.is_done ? 100 : 0
        return `    - [ID:${s.id}] 진행 ${p}% | ${s.title}`
      })
      .join('\n')
    return `[카드 ID:${card.id}] ${card.subject} > ${card.title} (마감: ${card.due_date ?? '없음'})\n  서브태스크:\n${subtaskList || '    (없음)'}`
  }).join('\n\n')

  const prompt = `학생 메시지를 분석해 **서브태스크 매칭**, **의도(action)**, 필요 시 **진행률(progress)** 를 JSON으로만 반환하세요.

## 최근 대화 (맥락)
${formatHistoryForPrompt(history)}

## 지금 학생 메시지 (해석·매칭의 기준)
"${effectiveMessage.replace(/"/g, '\\"')}"
- 메시지가 "맞아/응/해줘"처럼 짧으면, **바로 위 대화의 학생 요청**과 합쳐 한 가지 의도로 처리할 것.

카드·서브태스크 목록:
${context}

## action (필수)
- **remove_subtask**: 서브태스크를 **삭제·제외·빼 달라**는 요청 (예: 빼줘, 제거, 목록에서 빼기, 안 할 거야, 필요 없어).
- **set_progress**: **진행률·완료 여부** 보고만 (봤어, 50%, 다 했어 등).
- 제거 요청이면 **후보 서브태스크를 골라 matched true**로 두고, 확인 차원의 답만 하지 말 것. **바로 삭제 판단에 쓸 후보를 제시**할 것.

## 후보(candidates)
- 관련될 수 있는 서브태스크 **모두** confidence 내림차순 (최대 5개). 없으면 matched false.

### 한국어 약칭·번역명과 카드 매칭 (필수)
- 학생은 **한국어 약칭, 줄임말, 통칭, 번역에 가까운 표현**으로 과목을 말할 수 있음. 카드의 **subject**만 한글·영문이고 **title**만 영어 과제명이어도 **한 덩어리의 과목**으로 볼 것.
- **글자가 완전히 같아야 한다고 보지 말 것.** 의미·학문 분야가 같으면 같은 과목으로 후보에 넣을 것 (의미 기반 유사도).
- 예: "재료역학" "재료역" "소재역학" ↔ Mechanics of Materials, **Mechanics of Materials and Lab**, Strength of Materials, Materials and Lab 등 / "산조" "산조론" "IO" "I.O." ↔ Industrial Organization, 산업조직론 / "경통" ↔ 경제통계학, Economic Statistics, Econometrics 등.
- 학생이 **번호만** 말한 경우(예: "3번까지 풀었어")에는, 위에서 특정한 **그 과목 카드** 안의 Problem #3, 문제 3, 문항 3, Q3, #3 등과 연결. (PPT·강 번호 규칙은 아래 유지.)
- **한 약칭이 서로 다른 과목 카드 둘 이상에 동시에 쓰일 만큼 애매하면** 임의로 한 카드만 고르지 말 것. 해당하는 카드들에 비슷한 confidence로 후보를 남기거나 confidence를 낮춰 **시스템이 과목을 되묻는 흐름**(기존 clarify)이 나오게 할 것.

- **PPT·강 번호는 절대 혼동 금지:** 학생이 "1번 피피티" "PPT 1" "1강"이라고 하면, 서브태스크 제목에 **그 번호**(PPT 1, 피피티 1, 1강, 1주차 등)가 들어간 항목**만** 후보에 넣을 것. **PPT 5 제목인데 학생이 1번이라고 한 경우 후보에서 제외.**
- "중간" "기말"을 말하면 **해당 시험 카드**(카드 title에 중간고사/기말고사) 소속 서브태스크만 후보.
- 범위 표현("1~3강 봤어")은 포함 범위로만 해석; 단일 번호가 있으면 위 규칙 우선.

## progressUpdate (필수) — action이 **set_progress**일 때만 의미 있음. **remove_subtask**이면 apply: false, vague: false 로 두면 됨.
- **vague: true** → 숫자·비율 없이 "거의 다", "조금", "좀", "대충", "많이" 등 **수치 없는** 표현만 있을 때. 이 경우 **apply는 false**, percent 없음. 자동 반영 금지.
- 단, **"반"/"절반"/"반정도"**처럼 **비율이 명확한 표현**이 있으면 동사와 관계없이 **vague가 아님**. **비율·수량 표현이 명시**되어 있으면 동사가 무엇이든 **set_progress**로 처리하고 percent를 정함.
- **remove_subtask**에서는 vague를 true로 두지 말 것 (제거는 진행률 숫자가 없음).
- **apply: true, percent: 0~100** 인 경우만 DB 진행률 반영(아래 규칙).

### percent 해석 규칙 (vague가 false이고 set_progress일 때)
1. **완료 → percent 100**: "봤어", "끝냈어", "다 했어", "완료", "100%", "다 봤어", "다 읽었어"
2. **부분**
   - "반", "절반", "반 정도", "반정도", "반쯤", "하프" → 50
   - "350p 중 100p", "300페이지 중 100" → round(100/350*100) 등 비율 계산
   - "서론만", "도입부만" 등 글쓰기가 서론/본론/결론 3단계로 보이면 → 33 (한 단계만)
   - "1/3 했어", "3분의 1" → 33
   - 명시 퍼센트 "80%" → 80
3. **취소·미진행**: "아직", "못 봤", "안 했", "다시 안", "리셋" → percent 0
4. **vague: true** — 위 1~3에 해당하지 않을 때. 아래 예시를 참고해 판단.

### 완료 vs vague 판단 예시 (필수 참고)
| 메시지 | 판단 | 이유 |
|--------|------|------|
| "선물 샀어" | 100% | 구매는 됐거나 안 됐거나 — 이분법적 결과 |
| "과제 제출했어" | 100% | 제출은 완료가 명확 |
| "노래 부르고 선물 샀어" | 100% | ~고 연결 + 완료 동사 |
| "예약했어" | 100% | 예약 완료는 이분법적 |
| "피피티 1번 풂" | 100% | 명사형 완료, 결과 명확 |
| "과제 냈어" | 100% | 제출 완료 |
| "만들었어", "완성했어", "보냈어" | 100% | 결과가 이분법적 |
| "공부했어" | vague | 얼마나 했는지 불명확 |
| "책 읽었어" | vague | 전부인지 일부인지 불명확 |
| "연습했어" | vague | 부분 연습 가능성 있음 |
| "시작했어" | vague | 시작만 한 것, 정도 불명확 |
| "조금 봤어" | vague | 정도 부사 있음 |
| "논문 반정도 읽었어" | 50% | 비율 명시 → 동사 무관, vague 아님 |
| "반쯤 봤어" | 50% | 반 = 50% |
| "반정도 공부했어" | 50% | 비율 명시 → vague 아님 |
| "거의 다 읽었어" | vague | 비율 없음 |

## 반환 JSON 형식
{
  "action": "set_progress" | "remove_subtask",
  "matched": true,
  "candidates": [ { "cardId": "uuid", "subtaskId": "uuid", "confidence": 0.0~1.0 } ],
  "progressUpdate": {
    "apply": true,
    "percent": 100,
    "vague": false
  },
  "message": "한국어 한 문장 (remove면 삭제 완료 안내, set_progress면 반영 안내)"
}

- action, progressUpdate는 **항상** 포함.
- JSON만 출력.`

  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text : ''
    const json = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    const result = JSON.parse(json) as {
      action?: string
      matched?: boolean
      message?: string
      candidates?: RawCandidate[]
      cardId?: string
      subtaskId?: string
      confidence?: number
      progressUpdate?: ProgressUpdate
    }

    let action: 'set_progress' | 'remove_subtask' =
      result.action === 'remove_subtask' ? 'remove_subtask' : 'set_progress'
    if (action === 'set_progress' && looksLikeRemoveSubtaskRequest(effectiveMessage)) {
      action = 'remove_subtask'
    }

    const pu: ProgressUpdate = result.progressUpdate ?? {
      apply: true,
      percent: 100,
      vague: false,
    }

    if (action === 'set_progress' && pu.vague === true) {
      return NextResponse.json({
        matched: false,
        progressApplied: false,
        needClarification: true,
        needProgressClarification: true,
        cardId: null,
        subtaskId: null,
        message: CLARIFY_PROGRESS_MSG,
      })
    }

    let fromAi: RawCandidate[] = Array.isArray(result.candidates) ? result.candidates : []
    if (fromAi.length === 0 && result.matched && result.subtaskId) {
      fromAi = [
        {
          cardId: result.cardId,
          subtaskId: result.subtaskId,
          confidence: result.confidence,
        },
      ]
    }

    const rawFiltered = fromAi
      .filter(
        (c) =>
          typeof c.subtaskId === 'string' &&
          c.subtaskId.length > 0 &&
          validSubtaskId.has(c.subtaskId),
      )
      .map((c) => ({
        subtaskId: c.subtaskId as string,
        cardId: c.cardId as string | undefined,
        confidence: typeof c.confidence === 'number' && !Number.isNaN(c.confidence) ? c.confidence : 0,
      }))

    const bySt = new Map<string, (typeof rawFiltered)[0]>()
    for (const c of rawFiltered) {
      const prev = bySt.get(c.subtaskId)
      if (!prev || c.confidence > prev.confidence) bySt.set(c.subtaskId, c)
    }
    let deduped = [...bySt.values()].sort((a, b) => b.confidence - a.confidence)

    const narrow = narrowCandidates(
      effectiveMessage,
      deduped,
      (cards ?? []) as Record<string, unknown>[],
      (subtasks ?? []) as Record<string, unknown>[],
    )
    if (!narrow.ok && narrow.reason === 'no_ppt') {
      const n = narrow.slideN ?? '?'
      return NextResponse.json({
        matched: false,
        progressApplied: false,
        cardId: null,
        subtaskId: null,
        confidence: 0,
        message: `말씀하신 **${n}번**에 해당하는 서브태스크를 목록에서 찾지 못했어요. 중간/기말 중 어느 카드인지도 함께 적어 주세요. (예: '산업조직론 중간 PPT 1 완료')`,
      })
    }
    if (!narrow.ok && narrow.reason === 'multi_exam') {
      return NextResponse.json({
        matched: false,
        progressApplied: false,
        needClarification: true,
        cardId: null,
        subtaskId: null,
        confidence: 0,
        message:
          '중간고사 준비 카드인지 기말고사 준비 카드인지 알려주세요. 예: \'산업조직론 중간 PPT 1 완료\' 또는 \'IO 기말 피피티 1 끝\'',
      })
    }
    if (narrow.ok && narrow.cands.length > 0) {
      deduped = narrow.cands.sort((a, b) => b.confidence - a.confidence)
    }

    if (deduped.length === 0) {
      return NextResponse.json({
        matched: false,
        progressApplied: false,
        cardId: null,
        subtaskId: null,
        confidence: 0,
        message:
          (typeof result.message === 'string' && result.message.trim()
            ? result.message
            : '어떤 과제/강에 대한 말씀인지 찾지 못했어요. 과목이나 PPT 범위를 조금 더 구체적으로 말씀해주세요.'),
      })
    }

    const maxC = deduped[0].confidence
    const tieGroup = deduped.filter((c) => maxC - c.confidence <= CONFIDENCE_TIE_WINDOW)

    let chosen = tieGroup[0]
    if (tieGroup.length > 1) {
      chosen = [...tieGroup].sort((a, b) => {
        const ac = a.cardId ? cardById.get(a.cardId) : null
        const bc = b.cardId ? cardById.get(b.cardId) : null
        const da = ac ? (ac as { due_date?: string | null }).due_date : null
        const db = bc ? (bc as { due_date?: string | null }).due_date : null
        return dueTime(da) - dueTime(db)
      })[0]
    }

    const subtask = (subtasks ?? []).find(
      (s: Record<string, unknown>) => s.id === chosen.subtaskId,
    ) as { card_id: string } | undefined
    const cardId =
      chosen.cardId && cardById.has(chosen.cardId) ? chosen.cardId : (subtask?.card_id ?? '')

    const cardsOverThreshold = new Set(
      deduped
        .filter((c) => c.confidence >= CLARIFY_MIN_CONF_CARDS)
        .map((c) => {
          const st = (subtasks ?? []).find(
            (s: Record<string, unknown>) => s.id === c.subtaskId,
          ) as { card_id: string } | undefined
          const cid =
            c.cardId && cardById.has(c.cardId) ? c.cardId : (st?.card_id as string | undefined)
          return cid
        })
        .filter((cid): cid is string => Boolean(cid)),
    )

    if (chosen.confidence < CONFIDENCE_AUTO && cardsOverThreshold.size >= 2) {
      return NextResponse.json({
        matched: false,
        progressApplied: false,
        needClarification: true,
        cardId: null,
        subtaskId: null,
        confidence: chosen.confidence,
        message: CLARIFY_MSG,
      })
    }

    const wantApply = pu.apply === true
    let percent: number | undefined =
      typeof pu.percent === 'number' && !Number.isNaN(pu.percent) ? clampProgress(pu.percent) : undefined
    if (wantApply && percent === undefined) percent = 100

    const aiMsg =
      typeof result.message === 'string' && result.message.trim()
        ? result.message.trim()
        : action === 'remove_subtask'
          ? '해당 서브태스크를 삭제했어요.'
          : '반영했어요.'

    if (action === 'remove_subtask' && chosen.confidence >= CONFIDENCE_AUTO) {
      const { error: delErr } = await supabase.from('subtasks').delete().eq('id', chosen.subtaskId)
      if (delErr) {
        console.error('[chat-progress] subtask delete', delErr)
        return NextResponse.json({ error: '서브태스크를 삭제하지 못했어요.' }, { status: 500 })
      }
      return NextResponse.json({
        matched: true,
        subtaskRemoved: true,
        progressApplied: false,
        cardId: cardId || null,
        subtaskId: chosen.subtaskId,
        confidence: chosen.confidence,
        message: aiMsg,
      })
    }

    if (action === 'remove_subtask' && chosen.confidence < CONFIDENCE_AUTO) {
      if (cardsOverThreshold.size >= 2) {
        return NextResponse.json({
          matched: false,
          progressApplied: false,
          needClarification: true,
          cardId: null,
          subtaskId: null,
          confidence: chosen.confidence,
          message: CLARIFY_MSG,
        })
      }
      return NextResponse.json({
        matched: true,
        progressApplied: false,
        subtaskRemoved: false,
        cardId: cardId || null,
        subtaskId: chosen.subtaskId,
        confidence: chosen.confidence,
        message:
          '어느 항목을 빼야 할지 확신이 낮아 삭제하지 않았어요. 과목명과 항목 이름을 한 줄로 적어 주세요. (예: 정치학개론 논문 과제에서 발표 준비 빼줘)',
      })
    }

    if (wantApply && percent !== undefined && chosen.confidence >= CONFIDENCE_AUTO) {
      const is_done = percent >= 100

      // 다중 서브태스크 업데이트:
      // 메시지에 여러 행위가 명시된 경우(~고 연결, A랑 B, A와 B)에만 같은 카드의 고-confidence 후보 전체 업데이트
      // 단일 언급이면 chosen만 업데이트 (의도하지 않은 다중 완료 방지)
      const MULTI_CONFIDENCE = 0.85
      const hasMultipleActions = /(.+)[이랑와과,] (.+)했|(.+)[이랑와과,] (.+)샀|[고]\s/.test(effectiveMessage)
      const multiIds = hasMultipleActions
        ? deduped
            .filter((c) => {
              if (c.confidence < MULTI_CONFIDENCE) return false
              const st = (subtasks ?? []).find((s: Record<string, unknown>) => s.id === c.subtaskId) as { card_id?: string } | undefined
              const cid = c.cardId && cardById.has(c.cardId) ? c.cardId : (st?.card_id ?? '')
              return cid === cardId
            })
            .map((c) => c.subtaskId)
        : []

      const idsToUpdate = multiIds.length > 1 ? multiIds : [chosen.subtaskId]

      await supabase
        .from('subtasks')
        .update({ progress: percent, is_done })
        .in('id', idsToUpdate)

      return NextResponse.json({
        matched: true,
        progressApplied: true,
        progress: percent,
        cardId: cardId || null,
        subtaskId: chosen.subtaskId,
        subtaskIds: idsToUpdate,
        confidence: chosen.confidence,
        message: aiMsg,
      })
    }

    if (wantApply && percent !== undefined && chosen.confidence < CONFIDENCE_AUTO) {
      return NextResponse.json({
        matched: true,
        progressApplied: false,
        progress: null,
        cardId: cardId || null,
        subtaskId: chosen.subtaskId,
        confidence: chosen.confidence,
        message: '어느 항목인지 확신이 낮아 자동으로 진행률을 바꾸지 않았어요. 과목·항목을 더 구체적으로 말씀해주세요.',
      })
    }

    return NextResponse.json({
      matched: true,
      progressApplied: false,
      cardId: cardId || null,
      subtaskId: chosen.subtaskId,
      confidence: chosen.confidence,
      message: aiMsg,
    })
  } catch (e) {
    console.error('[chat-progress]', e)
    return NextResponse.json({ error: 'AI 처리에 실패했어요.' }, { status: 500 })
  }
}
