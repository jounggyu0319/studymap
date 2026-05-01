import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function mapNote(row: { id: string; card_id: string; content: string; created_at: string }) {
  return {
    id: row.id,
    cardId: row.card_id,
    content: row.content,
    createdAt: row.created_at,
  }
}

// GET /api/notes?cardId= — 해당 카드의 메모 목록 (created_at desc)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const cardId = request.nextUrl.searchParams.get('cardId')
  if (!cardId?.trim()) {
    return NextResponse.json({ error: 'cardId가 필요합니다.' }, { status: 400 })
  }

  const { data: card, error: cardErr } = await supabase
    .from('cards')
    .select('id')
    .eq('id', cardId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (cardErr || !card) {
    return NextResponse.json({ error: '카드를 찾을 수 없어요.' }, { status: 404 })
  }

  const { data: rows, error } = await supabase
    .from('notes')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: '메모를 불러오지 못했어요.' }, { status: 500 })
  }

  const notes = (rows ?? []).map(r =>
    mapNote(r as { id: string; card_id: string; content: string; created_at: string }),
  )
  return NextResponse.json({ notes })
}

// POST /api/notes { cardId, content }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: { cardId?: unknown; content?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 })
  }

  const cardId = typeof body.cardId === 'string' ? body.cardId.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!cardId || !content) {
    return NextResponse.json({ error: 'cardId와 content가 필요합니다.' }, { status: 400 })
  }

  const { data: card, error: cardErr } = await supabase
    .from('cards')
    .select('id')
    .eq('id', cardId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (cardErr || !card) {
    return NextResponse.json({ error: '카드를 찾을 수 없어요.' }, { status: 404 })
  }

  const { data: row, error } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      card_id: cardId,
      content,
    })
    .select()
    .single()

  if (error || !row) {
    return NextResponse.json(
      { error: `메모를 저장하지 못했어요: ${error?.message ?? 'unknown'}` },
      { status: 500 },
    )
  }

  return NextResponse.json(
    { note: mapNote(row as { id: string; card_id: string; content: string; created_at: string }) },
    { status: 201 },
  )
}
