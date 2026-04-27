import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// DELETE /api/folders/:id — 폴더 삭제, 소속 카드는 folder_id만 null
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id: folderId } = await params
  if (!folderId?.trim()) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const { error: updateErr } = await supabase
    .from('cards')
    .update({ folder_id: null })
    .eq('folder_id', folderId)
    .eq('user_id', user.id)

  if (updateErr) {
    console.error('[folders DELETE] cards update', updateErr)
    return NextResponse.json({ error: '카드를 전체로 옮기지 못했어요.' }, { status: 500 })
  }

  const { error: delErr } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId)
    .eq('user_id', user.id)

  if (delErr) {
    console.error('[folders DELETE]', delErr)
    return NextResponse.json({ error: '폴더를 삭제하지 못했어요.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
