import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ConfirmCardsRequest } from '@/types/upload'

export const runtime = 'nodejs'

// GET /api/cards — 마감일 순 카드 목록 + 서브태스크
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('*')
    .eq('user_id', user.id)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (cardsError) {
    return NextResponse.json({ error: '카드를 불러오지 못했어요.' }, { status: 500 })
  }

  const cardIds = cards.map(c => c.id)
  const { data: subtasks, error: subtasksError } = await supabase
    .from('subtasks')
    .select('*')
    .in('card_id', cardIds.length > 0 ? cardIds : ['none'])
    .order('order_index', { ascending: true })

  if (subtasksError) {
    return NextResponse.json({ error: '서브태스크를 불러오지 못했어요.' }, { status: 500 })
  }

  return NextResponse.json({ cards, subtasks: subtasks ?? [] })
}

// POST /api/cards — 확정: Storage 업로드 → 카드 N개 + 서브태스크 저장
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body: ConfirmCardsRequest = await request.json()
  const { folderId, subject, fileBase64, fileName, items } = body

  if (!items || items.length === 0) {
    return NextResponse.json({ error: '저장할 항목이 없습니다.' }, { status: 400 })
  }

  // 1단계: 파일 Storage 업로드 (PDF인 경우)
  let fileUrl: string | null = null
  if (fileBase64 && fileName) {
    const buffer = Buffer.from(fileBase64, 'base64')
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${user.id}/${Date.now()}-${safeFileName}`
    const { error: uploadError } = await supabase.storage
      .from('files')
      .upload(filePath, buffer, { contentType: 'application/pdf', upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: `파일 업로드 실패: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('files').getPublicUrl(filePath)
    fileUrl = urlData.publicUrl
  }

  // 2단계: 카드 N개 INSERT
  const cardsToInsert = items.map(item => ({
    user_id: user.id,
    folder_id: folderId,
    subject,
    title: item.title,
    type: item.type,
    due_date: item.dueDate,
    weight: item.weight,
    weight_reason: item.weightReason,
    file_url: fileUrl,
  }))

  const { data: createdCards, error: cardsError } = await supabase
    .from('cards')
    .insert(cardsToInsert)
    .select()

  if (cardsError || !createdCards) {
    return NextResponse.json({ error: `카드 저장 실패: ${cardsError?.message ?? 'unknown'}` }, { status: 500 })
  }

  // 3단계: 서브태스크 INSERT (AI가 빈 배열을 주면 카드만 생기고 진척 UI가 망가지므로 1개 기본값)
  const subtasksToInsert = createdCards.flatMap((card, i) => {
    const item = items[i]
    const raw = Array.isArray(item.subtasks) ? item.subtasks : []
    const list =
      raw.length > 0
        ? raw
        : [{ title: `${item.title} — 진행`, weight: 1, orderIndex: 0 }]
    return list.map((st, j) => ({
      card_id: card.id,
      title: st.title,
      weight: typeof st.weight === 'number' && st.weight > 0 ? st.weight : 1,
      order_index: typeof st.orderIndex === 'number' ? st.orderIndex : j,
      progress: 0,
      is_done: false,
    }))
  })

  let createdSubtasks: Record<string, unknown>[] = []
  if (subtasksToInsert.length > 0) {
    const { data: insertedSubtasks, error: subtasksError } = await supabase
      .from('subtasks')
      .insert(subtasksToInsert)
      .select()

    if (subtasksError) {
      return NextResponse.json({ error: `서브태스크 저장 실패: ${subtasksError.message}` }, { status: 500 })
    }
    createdSubtasks = insertedSubtasks ?? []
  }

  // snake_case → camelCase 변환
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappedSubtasks = createdSubtasks.map((s: any) => {
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
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappedCards = createdCards.map((c: any) => ({
    id: c.id, userId: c.user_id, folderId: c.folder_id,
    subject: c.subject, title: c.title, type: c.type,
    dueDate: c.due_date, weight: c.weight, weightReason: c.weight_reason,
    fileUrl: c.file_url, createdAt: c.created_at,
  }))

  return NextResponse.json({ cards: mappedCards, subtasks: mappedSubtasks, fileUrl }, { status: 201 })
}
