import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MAX_NAME_LEN = 48

// POST /api/folders — 새 폴더
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: '폴더 이름을 입력해주세요.' }, { status: 400 })
  }
  if (name.length > MAX_NAME_LEN) {
    return NextResponse.json({ error: `폴더 이름은 ${MAX_NAME_LEN}자 이하로 해주세요.` }, { status: 400 })
  }

  const { data: last } = await supabase
    .from('folders')
    .select('order_index')
    .eq('user_id', user.id)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  const orderIndex = (last?.order_index ?? -1) + 1

  const { data: row, error } = await supabase
    .from('folders')
    .insert({
      user_id: user.id,
      name,
      order_index: orderIndex,
    })
    .select()
    .single()

  if (error || !row) {
    return NextResponse.json({ error: `폴더를 만들지 못했어요: ${error?.message ?? 'unknown'}` }, { status: 500 })
  }

  return NextResponse.json({
    folder: {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      orderIndex: row.order_index,
      createdAt: row.created_at,
    },
  }, { status: 201 })
}
