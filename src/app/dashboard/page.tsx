import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Header from '@/components/layout/Header'
import DashboardClient from './DashboardClient'
import type { Card, Subtask, Folder } from '@/types/card'

// Supabase snake_case → camelCase 변환
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCard(r: any): Card {
  return {
    id: r.id, userId: r.user_id, folderId: r.folder_id,
    subject: r.subject, title: r.title, type: r.type,
    dueDate: r.due_date, weight: r.weight, weightReason: r.weight_reason,
    fileUrl: r.file_url, createdAt: r.created_at,
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSubtask(r: any): Subtask {
  const rawP = r.progress ?? r.Progress
  let progress =
    typeof rawP === 'number' && !Number.isNaN(rawP) ? Math.round(rawP) : undefined
  const done = r.is_done ?? r.isDone ?? false
  if (progress === undefined) progress = done ? 100 : 0
  progress = Math.min(100, Math.max(0, progress))
  return {
    id: r.id,
    cardId: r.card_id ?? r.cardId,
    title: r.title,
    progress,
    isDone: progress >= 100,
    weight: r.weight,
    orderIndex: r.order_index ?? r.orderIndex ?? 0,
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFolder(r: any): Folder {
  return { id: r.id, userId: r.user_id, name: r.name, orderIndex: r.order_index, createdAt: r.created_at }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cards } = await supabase
    .from('cards').select('*').eq('user_id', user.id).order('due_date', { ascending: true, nullsFirst: false })

  const cardIds = (cards ?? []).map(c => c.id)
  const [{ data: subtasks }, { data: folders }] = await Promise.all([
    supabase.from('subtasks').select('*')
      .in('card_id', cardIds.length > 0 ? cardIds : ['none'])
      .order('order_index', { ascending: true }),
    supabase.from('folders').select('*').eq('user_id', user.id).order('order_index', { ascending: true }),
  ])

  return (
    <div
      className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-x-hidden bg-[#f3f4f6]"
      style={{ backgroundColor: '#f3f4f6' }}
    >
      <Header user={user} />
      <DashboardClient
        initialCards={(cards ?? []).map(mapCard)}
        initialSubtasks={(subtasks ?? []).map(mapSubtask)}
        initialFolders={(folders ?? []).map(mapFolder)}
      />
    </div>
  )
}
