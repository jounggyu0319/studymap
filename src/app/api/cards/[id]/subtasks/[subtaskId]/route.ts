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

// PATCH /api/cards/[id]/subtasks/[subtaskId] — progress 0~100 (100이면 is_done true)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { id: cardId, subtaskId } = await params

  let body: { progress?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }

  const n = Number(body.progress)
  if (!Number.isFinite(n)) {
    return NextResponse.json({ error: 'progress(0~100 숫자)를 보내주세요.' }, { status: 400 })
  }
  const progress = Math.min(100, Math.max(0, Math.round(n)))
  const is_done = progress >= 100

  const { data: card } = await supabase
    .from('cards')
    .select('id')
    .eq('id', cardId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!card) {
    return NextResponse.json({ error: '카드를 찾을 수 없어요.' }, { status: 404 })
  }

  const { data: st } = await supabase
    .from('subtasks')
    .select('id, card_id')
    .eq('id', subtaskId)
    .maybeSingle()

  if (!st || st.card_id !== cardId) {
    return NextResponse.json({ error: '서브태스크를 찾을 수 없어요.' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('subtasks')
    .update({ progress, is_done })
    .eq('id', subtaskId)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: '수정에 실패했어요.' }, { status: 500 })
  }

  return NextResponse.json({ subtask: mapSubtaskRow(data as Record<string, unknown>) })
}
