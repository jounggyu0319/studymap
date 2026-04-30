import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CONFIDENCE_MIN_WRITE = 0.6

const SYSTEM_PROMPT = `당신은 학습 진척 관리 AI입니다.
사용자 발화에서 어느 카드(과목/과제)의 어느 서브태스크를 얼마나 완료했는지 파악하고,
아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

## 카드 매칭
1. activeCardId가 제공되면 해당 카드를 1순위로 고려
2. 메시지에 과목명/키워드가 있으면 candidates의 subject, subtasks.title과 매칭
   - "3장" → subtasks에 "3장" 포함 카드
   - "논문", "PPT", "1번 문제" 등도 동일하게 추론
3. 유일하게 특정되면 confidence 0.9+, 2개 이상 매칭이면 confidence 0.5 이하

## carry-forward
history 배열에서 마지막으로 progressApplied: true인 assistant 턴의
targetCardId / targetSubtaskId를 현재 맥락으로 이어받아라.
단, 현재 메시지에 새로운 카드/과목 키워드가 있으면 무시.

## progress 판단
- "다 했어", "완료", "끝냈어", "했어" → 100
- "반정도", "반쯤", "절반" → 50
- "3분의 2" → 67
- "30%" 등 숫자 비율 → 그대로
- 비율/수량 없이 동작만 언급 ("읽었어", "봤어", "공부했어") → vague
- "아직 못했어", "안했어", "취소" → 0

## 삭제 요청
"삭제해줘", "없애줘", "빼줘" 등 서브태스크 제거 의도 → action: "remove_subtask"

## 응답 형식
{
  "action": "progressUpdate" | "remove_subtask" | "askClarification" | "none",
  "targetCardId": "카드id 또는 null",
  "targetSubtaskId": "서브태스크id 또는 null",
  "progress": 0~100,
  "confidence": 0.0~1.0,
  "message": "사용자에게 보낼 짧은 한국어 확인 메시지"
}`

type ChatRole = 'user' | 'ai'

type HistoryTurn = {
  role: ChatRole
  text: string
  progressApplied?: boolean
  targetCardId?: string | null
  targetSubtaskId?: string | null
}

type CandidateSubtask = { id: string; title: string; progress: number }
type CandidateCard = {
  id: string
  subject: string
  type: string
  subtasks: CandidateSubtask[]
}

type HaikuResponse = {
  action?: string
  targetCardId?: string | null
  targetSubtaskId?: string | null
  progress?: number
  confidence?: number
  message?: string
}

function parseHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return []
  const out: HistoryTurn[] = []
  for (const row of raw) {
    if (row && typeof row === 'object' && 'role' in row && 'text' in row) {
      const role = (row as { role: string }).role
      const text = String((row as { text: unknown }).text ?? '').trim()
      if ((role === 'user' || role === 'ai') && text) {
        const r = row as {
          progressApplied?: unknown
          targetCardId?: unknown
          targetSubtaskId?: unknown
        }
        const turn: HistoryTurn = { role, text }
        if (role === 'ai' && r.progressApplied === true) {
          turn.progressApplied = true
          turn.targetCardId =
            typeof r.targetCardId === 'string' ? r.targetCardId : r.targetCardId === null ? null : undefined
          turn.targetSubtaskId =
            typeof r.targetSubtaskId === 'string'
              ? r.targetSubtaskId
              : r.targetSubtaskId === null
                ? null
                : undefined
        }
        out.push(turn)
      }
    }
  }
  return out
}

/** 짧은 긍정·확인 — 직전 학생 메시지와 합쳐 Haiku에 전달 */
function looksLikeAffirmation(msg: string): boolean {
  const t = msg.trim()
  if (t.length > 24) return false
  return /^(맞아|맞아요|맞습니다|응|네|네요|그래|그렇게|오케이|ok|okay|yes|ㅇㅇ|해줘|해\s*주세요|좋아|그럼|확인|ㅇㅋ)$/i.test(t)
}

function buildEffectiveUserMessage(message: string, history: HistoryTurn[]): string {
  if (!looksLikeAffirmation(message)) return message
  const priorUsers = history.filter(h => h.role === 'user').map(h => h.text.trim())
  const lastPrior = priorUsers[priorUsers.length - 1]
  if (!lastPrior || lastPrior === message.trim()) return message
  return `${lastPrior}\n(확인·후속: ${message.trim()})`
}

function clampProgress(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)))
}

function stripJsonFence(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
}

function buildCandidatesPayload(
  cards: Array<Record<string, unknown>>,
  subtasks: Array<Record<string, unknown>>,
): CandidateCard[] {
  return cards.map(card => {
    const id = String(card.id)
    const cardSubs = subtasks.filter(s => s.card_id === id)
    const sorted = [...cardSubs].sort(
      (a, b) => (Number(a.order_index) || 0) - (Number(b.order_index) || 0),
    )
    return {
      id,
      subject: String(card.subject ?? ''),
      type: String(card.type ?? ''),
      subtasks: sorted.map(s => {
        const pRaw = s.progress
        const done = Boolean(s.is_done)
        let progress =
          typeof pRaw === 'number' && !Number.isNaN(pRaw) ? Math.round(pRaw) : done ? 100 : 0
        progress = clampProgress(progress)
        return {
          id: String(s.id),
          title: String(s.title ?? ''),
          progress,
        }
      }),
    }
  })
}

function historyForModel(history: HistoryTurn[]): unknown[] {
  return history.slice(-12).map(h => {
    const base: Record<string, unknown> = {
      role: h.role === 'user' ? 'user' : 'assistant',
      text: h.text,
    }
    if (h.role === 'ai' && h.progressApplied) {
      base.progressApplied = true
      if (h.targetCardId !== undefined) base.targetCardId = h.targetCardId
      if (h.targetSubtaskId !== undefined) base.targetSubtaskId = h.targetSubtaskId
    }
    return base
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const body = (await request.json()) as {
    message?: string
    history?: unknown
    activeCardId?: string | null
  }
  const message = typeof body.message === 'string' ? body.message : ''
  const history = parseHistory(body.history)
  const activeCardId =
    typeof body.activeCardId === 'string' && body.activeCardId.length > 0 ? body.activeCardId : null

  if (!message.trim()) return NextResponse.json({ error: '메시지를 입력해주세요.' }, { status: 400 })

  const effectiveMessage = buildEffectiveUserMessage(message.trim(), history)

  const { data: cards } = await supabase.from('cards').select('*').eq('user_id', user.id)
  const cardIds = (cards ?? []).map((c: { id: string }) => c.id)
  const cardById = new Map((cards ?? []).map((c: { id: string }) => [c.id, c]))

  const { data: subtasks } = await supabase
    .from('subtasks')
    .select('*')
    .in('card_id', cardIds.length > 0 ? cardIds : ['none'])

  const validSubtaskId = new Set((subtasks ?? []).map((r: { id: string }) => r.id))

  if (!cards?.length) {
    return NextResponse.json({
      matched: false,
      progressApplied: false,
      message: '아직 등록된 카드가 없어요. 먼저 강의계획서를 업로드해주세요.',
    })
  }

  const candidates = buildCandidatesPayload(
    (cards ?? []) as Record<string, unknown>[],
    (subtasks ?? []) as Record<string, unknown>[],
  )

  const userPayload = {
    userMessage: effectiveMessage,
    activeCardId: activeCardId && cardById.has(activeCardId) ? activeCardId : null,
    candidates,
    history: historyForModel(history),
  }

  const userContent = `다음 JSON을 바탕으로 지시에 따라 응답 JSON만 출력하세요.\n\n${JSON.stringify(userPayload)}`

  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text : ''
    const jsonText = stripJsonFence(raw)
    let parsed: HaikuResponse
    try {
      parsed = JSON.parse(jsonText) as HaikuResponse
    } catch {
      console.error('[chat-progress] JSON parse', jsonText.slice(0, 200))
      return NextResponse.json({ error: 'AI 응답을 해석하지 못했어요.' }, { status: 500 })
    }

    const action = typeof parsed.action === 'string' ? parsed.action : 'none'
    const confidence =
      typeof parsed.confidence === 'number' && !Number.isNaN(parsed.confidence)
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0
    const aiMessage =
      typeof parsed.message === 'string' && parsed.message.trim()
        ? parsed.message.trim()
        : '알겠어요.'

    let targetSubtaskId =
      typeof parsed.targetSubtaskId === 'string' && parsed.targetSubtaskId.length > 0
        ? parsed.targetSubtaskId
        : null
    let targetCardId =
      typeof parsed.targetCardId === 'string' && parsed.targetCardId.length > 0
        ? parsed.targetCardId
        : null

    if (targetSubtaskId && !validSubtaskId.has(targetSubtaskId)) {
      targetSubtaskId = null
    }
    if (targetCardId && !cardById.has(targetCardId)) {
      targetCardId = null
    }

    const subtaskRow = targetSubtaskId
      ? ((subtasks ?? []).find((s: { id: string }) => s.id === targetSubtaskId) as
          | { id: string; card_id: string }
          | undefined)
      : undefined

    const resolvedCardId = subtaskRow
      ? subtaskRow.card_id
      : targetCardId && cardById.has(targetCardId)
        ? targetCardId
        : null

    const lowConfidence = confidence < CONFIDENCE_MIN_WRITE

    if (lowConfidence) {
      return NextResponse.json({
        matched: false,
        progressApplied: false,
        needClarification: true,
        cardId: resolvedCardId,
        subtaskId: targetSubtaskId,
        confidence,
        message: aiMessage,
      })
    }

    if (action === 'askClarification' || action === 'none') {
      return NextResponse.json({
        matched: action !== 'none',
        progressApplied: false,
        ...(action === 'askClarification' ? { needClarification: true } : {}),
        cardId: resolvedCardId,
        subtaskId: targetSubtaskId,
        confidence,
        message: aiMessage,
      })
    }

    if (!targetSubtaskId) {
      return NextResponse.json({
        matched: false,
        progressApplied: false,
        needClarification: true,
        cardId: resolvedCardId,
        subtaskId: null,
        confidence,
        message: aiMessage,
      })
    }

    if (action === 'remove_subtask') {
      const { error: delErr } = await supabase.from('subtasks').delete().eq('id', targetSubtaskId)
      if (delErr) {
        console.error('[chat-progress] subtask delete', delErr)
        return NextResponse.json({ error: '서브태스크를 삭제하지 못했어요.' }, { status: 500 })
      }
      return NextResponse.json({
        matched: true,
        subtaskRemoved: true,
        progressApplied: true,
        cardId: resolvedCardId,
        subtaskId: targetSubtaskId,
        confidence,
        message: aiMessage,
      })
    }

    if (action === 'progressUpdate') {
      const rawP = parsed.progress
      const progress =
        typeof rawP === 'number' && !Number.isNaN(rawP) ? clampProgress(rawP) : 0
      const is_done = progress >= 100

      const { error: upErr } = await supabase
        .from('subtasks')
        .update({ progress, is_done })
        .eq('id', targetSubtaskId)

      if (upErr) {
        console.error('[chat-progress] subtask update', upErr)
        return NextResponse.json({ error: '진행률을 반영하지 못했어요.' }, { status: 500 })
      }

      return NextResponse.json({
        matched: true,
        progressApplied: true,
        progress,
        cardId: resolvedCardId,
        subtaskId: targetSubtaskId,
        confidence,
        message: aiMessage,
      })
    }

    return NextResponse.json({
      matched: false,
      progressApplied: false,
      cardId: resolvedCardId,
      subtaskId: targetSubtaskId,
      confidence,
      message: aiMessage,
    })
  } catch (e) {
    console.error('[chat-progress]', e)
    return NextResponse.json({ error: 'AI 처리에 실패했어요.' }, { status: 500 })
  }
}
