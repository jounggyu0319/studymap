import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function mapSubtaskRow(s: Record<string, unknown>) {
  const p = Math.min(100, Math.max(0, Math.round(Number(s.progress ?? 0))))
  return {
    id: s.id,
    cardId: s.card_id,
    title: s.title,
    progress: p,
    isDone: p >= 100 || !!s.is_done,
    weight: s.weight,
    orderIndex: s.order_index,
  }
}

// POST /api/subtasks — 서브태스크 생성
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  let body: { cardId?: unknown; title?: unknown; progress?: unknown; orderIndex?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }

  const cardId = typeof body.cardId === 'string' ? body.cardId.trim() : ''
  const titleRaw = typeof body.title === 'string' ? body.title.trim() : ''
  if (!cardId || !titleRaw) {
    return NextResponse.json({ error: 'cardId와 title은 필수예요.' }, { status: 400 })
  }

  const progNum = Number(body.progress)
  const progress =
    body.progress !== undefined && Number.isFinite(progNum)
      ? Math.min(100, Math.max(0, Math.round(progNum)))
      : 0
  const orderNum = Number(body.orderIndex)
  const orderIndex =
    body.orderIndex !== undefined && Number.isFinite(orderNum) ? Math.round(orderNum) : 0

  const { data: cardRow } = await supabase
    .from('cards')
    .select('id')
    .eq('id', cardId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!cardRow) {
    return NextResponse.json({ error: '카드를 찾을 수 없거나 권한이 없어요.' }, { status: 403 })
  }

  const { data: inserted, error: insErr } = await supabase
    .from('subtasks')
    .insert({
      card_id: cardId,
      title: titleRaw,
      progress,
      is_done: progress >= 100,
      order_index: orderIndex,
      weight: 1,
    })
    .select()
    .single()

  if (insErr || !inserted) {
    console.error('[subtasks POST]', insErr)
    return NextResponse.json({ error: '서브태스크를 추가하지 못했어요.' }, { status: 500 })
  }

  return NextResponse.json({
    subtask: mapSubtaskRow(inserted as Record<string, unknown>),
  })
}
