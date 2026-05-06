'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { Card, Subtask, Note } from '@/types/card'
import { calcProgress } from '@/types/card'
import { remainingDays } from '@/lib/priority'

export type { Card, Subtask }

function getProgressColor(percentage: number): string {
  if (percentage <= 33) return 'bg-red-400'
  if (percentage <= 66) return 'bg-yellow-400'
  if (percentage < 100) return 'bg-blue-400'
  return 'bg-green-400'
}

/** 목록 좌측 바: D-3 이내 빨강 / D-7 이내 노랑 / 그 외 초록 */
export function getListAccentBarClass(card: Card): string {
  const r = remainingDays(card.dueDate ?? null)
  if (r <= 3) return 'bg-red-500'
  if (r <= 7) return 'bg-amber-400'
  return 'bg-emerald-500'
}

export function getDdayLabel(dueDate: string | null): string {
  if (!dueDate) return '마감일 없음'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return '날짜 오류'
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays > 0) return `D-${diffDays}`
  if (diffDays === 0) return 'D-Day'
  return `D+${Math.abs(diffDays)}`
}

export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return '날짜 설정'
  const date = new Date(dueDate)
  if (Number.isNaN(date.getTime())) return '-'
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

interface CardListRowProps {
  card: Card
  subtasks: Subtask[]
  onClick: () => void
  onDelete?: (cardId: string) => void
}

export function CardListRow({ card, subtasks, onClick, onDelete }: CardListRowProps) {
  const dueDate = card.dueDate ?? (card as unknown as Record<string, unknown>).due_date as string | null ?? null
  const sorted = useMemo(
    () => [...subtasks].sort((a, b) => a.orderIndex - b.orderIndex),
    [subtasks],
  )
  const nextTodo = sorted.find(s => (s.progress ?? 0) < 100)
  const progress = useMemo(() => calcProgress(subtasks), [subtasks])
  const nextLine =
    sorted.length === 0 ? '서브태스크 없음' : nextTodo ? nextTodo.title : '완료 🎉'

  const isTutorial = card.subject === '한눈 가이드'

  return (
    <div className={`group relative flex w-full items-center rounded-lg border shadow-sm transition-colors ${isTutorial ? 'border-blue-200 bg-blue-50 hover:border-blue-300 hover:bg-blue-100/60' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/80'}`}>
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-0 pr-2 text-left"
      >
        <div
          className={`min-h-[2.25rem] w-[3px] shrink-0 self-stretch rounded-full ${getListAccentBarClass(card)}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="shrink-0 text-[10px] font-medium text-gray-500">{card.subject}</span>
            {isTutorial && (
              <span className="shrink-0 rounded bg-blue-100 px-1.5 py-px text-[10px] font-medium text-blue-700">도움말</span>
            )}
            <span className="min-w-0 truncate text-sm font-semibold text-gray-900">{card.title}</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-gray-500">{nextLine}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pr-1">
          <span className="w-12 text-right text-[11px] font-semibold tabular-nums text-gray-700">
            {getDdayLabel(dueDate)}
          </span>
          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${getProgressColor(progress)}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-7 text-right text-[11px] font-semibold tabular-nums text-gray-600">
            {progress}%
          </span>
          <span className="text-gray-400" aria-hidden>
            ›
          </span>
        </div>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onDelete(card.id)
          }}
          className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          aria-label="카드 삭제"
        >
          ✕
        </button>
      )}
    </div>
  )
}

interface CardDetailViewProps {
  card: Card
  subtasks: Subtask[]
  onBack: () => void
  onDueDateChange: (cardId: string, dueDate: string | null) => void
  onDelete: (cardId: string) => void
  /** chat-progress memo 저장 시 증가 → 메모 목록 갱신 */
  notesRefreshKey?: number
  onSubtaskToggle?: (subtaskId: string, done: boolean) => void
}

function formatNoteDateMobile(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
}

export function CardDetailView({
  card,
  subtasks,
  onBack,
  onDueDateChange,
  onDelete,
  notesRefreshKey = 0,
  onSubtaskToggle,
}: CardDetailViewProps) {
  const [memoMode, setMemoMode] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [localSubtasks, setLocalSubtasks] = useState<Subtask[]>(subtasks)
  const [isEditingDate, setIsEditingDate] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const dueDate = card.dueDate ?? (card as unknown as Record<string, unknown>).due_date as string | null ?? null

  useEffect(() => {
    setLocalSubtasks(subtasks)
  }, [subtasks])
  useEffect(() => {
    setMemoMode(false)
  }, [card.id])

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes?cardId=${encodeURIComponent(card.id)}`)
      if (!res.ok) return
      const data = (await res.json()) as { notes?: Note[] }
      setNotes(Array.isArray(data.notes) ? data.notes : [])
    } catch {
      /* ignore */
    }
  }, [card.id])

  useEffect(() => {
    if (memoMode) void loadNotes()
  }, [memoMode, card.id, loadNotes, notesRefreshKey])

  useEffect(() => {
    if (isEditingDate) dateInputRef.current?.showPicker?.()
  }, [isEditingDate])

  const sortedSubtasks = useMemo(
    () => [...localSubtasks].sort((a, b) => a.orderIndex - b.orderIndex),
    [localSubtasks],
  )
  const progress = useMemo(() => calcProgress(localSubtasks), [localSubtasks])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value || null
    onDueDateChange(card.id, val)
    setIsEditingDate(false)
  }

  const deleteNoteMobile = async (noteId: string) => {
    const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
    if (res.ok) setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  if (memoMode) {
    return (
      <div
        className="rounded-lg border border-gray-200 bg-white px-3 pt-3 pb-40 shadow-sm md:p-3"
        style={{ colorScheme: 'light' }}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
          <button
            type="button"
            onClick={() => setMemoMode(false)}
            className="text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            ← 뒤로
          </button>
          <span className="text-sm font-semibold text-gray-900">{card.subject}</span>
        </div>
        <div className="space-y-3">
          {notes.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              아직 메모가 없어요. 채팅창에서 기록하면 여기에 나타나요.
            </p>
          ) : (
            notes.map(n => (
              <div
                key={n.id}
                className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-[13px]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="shrink-0 text-[11px] text-gray-400">
                    {formatNoteDateMobile(n.createdAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void deleteNoteMobile(n.id)}
                    className="shrink-0 text-base leading-none text-gray-400 hover:text-red-600"
                    aria-label="메모 삭제"
                  >
                    🗑️
                  </button>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-gray-800">{n.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  const isTutorial = card.subject === '한눈 가이드'

  return (
    <div className={`rounded-lg border px-3 pt-3 pb-40 shadow-sm md:p-3 ${isTutorial ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <div
        className={`mb-2 flex flex-wrap items-center gap-2 border-b pb-2 ${isTutorial ? 'border-blue-100' : 'border-gray-100'}`}
      >
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium text-gray-600 hover:text-gray-900"
        >
          ← 목록
        </button>
        <span className="text-xs text-gray-300" aria-hidden>
          /
        </span>
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 truncate text-xs text-gray-500">
          <span className="font-medium text-gray-700">{card.subject}</span>
          {isTutorial && (
            <span className="shrink-0 rounded bg-blue-100 px-1.5 py-px text-[10px] font-medium text-blue-700">
              도움말
            </span>
          )}
          <span className="text-gray-400"> · </span>
          <span className="min-w-0 truncate">{card.title}</span>
        </p>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
          {card.type}
        </span>
        <span className="text-sm text-gray-600">{card.subject}</span>
      </div>
      <h2 className="text-base font-semibold text-gray-900">{card.title}</h2>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">마감</span>
          {isEditingDate ? (
            <input
              ref={dateInputRef}
              type="date"
              defaultValue={dueDate ?? ''}
              onChange={handleDateChange}
              onBlur={() => setIsEditingDate(false)}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingDate(true)}
              className="text-left font-semibold text-gray-900 hover:opacity-80"
            >
              {getDdayLabel(dueDate)}{' '}
              <span className="text-xs font-normal text-gray-400 underline decoration-dotted">
                ({formatDueDate(dueDate)})
              </span>
            </button>
          )}
        </div>
        <span className="text-gray-300">|</span>
        <span className="text-gray-600">
          진척 <span className="font-semibold text-gray-900">{progress}%</span>
        </span>
      </div>

      <div className="mt-3">
        <div className="mb-0 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${getProgressColor(progress)}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-medium text-gray-500">서브태스크</p>
        <ul className="space-y-2">
          {sortedSubtasks.length === 0 ? (
            <li className="text-sm text-gray-400">서브태스크가 없어요</li>
          ) : (
            sortedSubtasks.map(st => {
              const p = st.progress ?? (st.isDone ? 100 : 0)
              const done = p >= 100
              return (
                <li key={st.id} className="flex items-start gap-2 rounded-md border border-gray-100 bg-gray-50/50 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => onSubtaskToggle?.(st.id, !done)}
                    className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-gray-300 opacity-80"
                    aria-label={done ? '완료' : '미완료'}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}
                    >
                      {st.title}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 min-w-[4rem] flex-1 max-w-[200px] overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={`h-full rounded-full ${getProgressColor(p)}`}
                          style={{ width: `${p}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[11px] font-medium tabular-nums text-gray-500">
                        {p}%
                      </span>
                    </div>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </div>

      <div className="mt-4 border-t border-gray-200 pt-3 md:hidden">
        <button
          type="button"
          onClick={() => setMemoMode(true)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 text-left text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
        >
          📝 메모 보기 ›
        </button>
      </div>

      <div className="mt-5 flex justify-end border-t border-gray-200 pt-3">
        <button
          type="button"
          onClick={() => onDelete(card.id)}
          className="text-xs font-medium text-gray-500 underline decoration-gray-300 underline-offset-2 transition-colors hover:text-red-600 hover:decoration-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
        >
          카드 삭제
        </button>
      </div>
    </div>
  )
}
