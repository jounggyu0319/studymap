'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Subtask } from '@/types/card'
import { calcProgress } from '@/types/card'

export type { Card, Subtask }

interface CardItemProps {
  card: Card
  subtasks: Subtask[]
  onDueDateChange: (cardId: string, dueDate: string | null) => void
  onDelete: (cardId: string) => void
}

/** 열림(∧ 위): 접기 의미 · 닫힘(∨ 아래): 펼치기 의미 — 기본 경로는 위쪽 화살표 */
function Chevron12({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      className={`shrink-0 text-gray-500 transition-transform duration-200 ${expanded ? '' : 'rotate-180'}`}
      aria-hidden
    >
      <path
        d="M2.5 7.5 L6 4 L9.5 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function getProgressColor(percentage: number): string {
  if (percentage <= 33) return 'bg-red-400'
  if (percentage <= 66) return 'bg-yellow-400'
  if (percentage < 100) return 'bg-blue-400'
  return 'bg-green-400'
}

function getDdayLabel(dueDate: string | null): string {
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

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return '날짜 설정'
  const date = new Date(dueDate)
  if (Number.isNaN(date.getTime())) return '-'
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

export default function CardItem({ card, subtasks, onDueDateChange, onDelete }: CardItemProps) {
  const [subtasksOpen, setSubtasksOpen] = useState(false)
  const [localSubtasks, setLocalSubtasks] = useState<Subtask[]>(subtasks)
  const [isEditingDate, setIsEditingDate] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const dueDate = card.dueDate ?? (card as unknown as Record<string, unknown>).due_date as string | null ?? null

  useEffect(() => { setLocalSubtasks(subtasks) }, [subtasks])
  useEffect(() => {
    if (isEditingDate) dateInputRef.current?.showPicker?.()
  }, [isEditingDate])

  const sortedSubtasks = useMemo(
    () => [...localSubtasks].sort((a, b) => a.orderIndex - b.orderIndex),
    [localSubtasks],
  )
  const nextTodo = useMemo(
    () => sortedSubtasks.find(s => (s.progress ?? 0) < 100),
    [sortedSubtasks],
  )
  const progress = useMemo(() => calcProgress(localSubtasks), [localSubtasks])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value || null
    onDueDateChange(card.id, val)
    setIsEditingDate(false)
  }

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
              {card.type}
            </span>
            <span className="truncate text-sm text-gray-500">{card.subject}</span>
          </div>
          <h3 className="truncate text-base font-semibold text-gray-900">{card.title}</h3>
        </div>

        <div className="shrink-0 text-right">
          {isEditingDate ? (
            <input
              ref={dateInputRef}
              type="date"
              defaultValue={dueDate ?? ''}
              onChange={handleDateChange}
              onBlur={() => setIsEditingDate(false)}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingDate(true)}
              className="text-right hover:opacity-70 transition-opacity"
              title="날짜 수정"
            >
              <p className="text-sm font-semibold text-gray-900">{getDdayLabel(dueDate)}</p>
              <p className="mt-1 text-xs text-gray-400 underline decoration-dotted">{formatDueDate(dueDate)}</p>
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${getProgressColor(progress)}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-11 text-right text-xs font-semibold text-gray-600">{progress}%</span>
        </div>
      </div>

      <p className="mt-3 truncate text-sm text-gray-600">
        {sortedSubtasks.length === 0
          ? '서브태스크가 없어요'
          : nextTodo
            ? `다음 할 일: ${nextTodo.title}`
            : '모든 할 일을 완료했어요 🎉'}
      </p>

      {sortedSubtasks.length > 0 && (
        <button
          type="button"
          onClick={() => setSubtasksOpen(v => !v)}
          className="mt-3 flex w-full items-center justify-between gap-2 py-1 text-left text-sm text-gray-700 hover:text-gray-900"
          aria-expanded={subtasksOpen}
        >
          <span>{subtasksOpen ? '서브태스크 닫기' : '서브태스크 보기'}</span>
          <Chevron12 expanded={subtasksOpen} />
        </button>
      )}

      {subtasksOpen && sortedSubtasks.length > 0 && (
        <div className="mt-2">
          <div className="border-t border-gray-200" />
          <ul className="mt-3 space-y-2">
            {sortedSubtasks.map(subtask => {
              const p = subtask.progress ?? (subtask.isDone ? 100 : 0)
              const done = p >= 100
              return (
                <li key={subtask.id} className="flex items-baseline justify-between gap-3">
                  <span
                    className={`min-w-0 flex-1 text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}
                  >
                    {subtask.title}
                  </span>
                  {p > 0 && p < 100 && (
                    <span className="shrink-0 text-xs font-medium tabular-nums text-gray-500">{p}%</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mt-4 flex justify-end border-t border-gray-200 pt-3">
        <button
          type="button"
          onClick={() => onDelete(card.id)}
          className="text-xs font-medium text-gray-500 underline decoration-gray-300 underline-offset-2 transition-colors hover:text-red-600 hover:decoration-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
        >
          카드 삭제
        </button>
      </div>
    </article>
  )
}
