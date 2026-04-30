'use client'

import { useMemo } from 'react'
import type { Card, Subtask } from '@/types/card'
import { allCardsAtFullProgress, getTopPriorityCards, remainingDays } from '@/lib/priority'

export interface PriorityRecommendationProps {
  cards: Card[]
  subtasks: Subtask[]
  /** 압축 스타일 — 대시보드 상단 스트립용 */
  compact?: boolean
}

const RANK_BADGE = ['🔴 1위', '🟡 2위', '🟢 3위'] as const

function nextAndRestCount(remaining: Subtask[]): { next: Subtask | null; otherCount: number } {
  if (remaining.length === 0) return { next: null, otherCount: 0 }
  const sorted = [...remaining].sort((a, b) => a.orderIndex - b.orderIndex)
  return { next: sorted[0], otherCount: remaining.length - 1 }
}

function formatDue(d: Card['dueDate']): string {
  if (!d) return '마감일 없음'
  const t = new Date(d + 'T12:00:00')
  return t.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function PriorityRecommendation({
  cards,
  subtasks,
  compact = false,
}: PriorityRecommendationProps) {
  const top3 = useMemo(
    () => getTopPriorityCards(cards, subtasks, 3),
    [cards, subtasks],
  )

  const hideForAllComplete = useMemo(
    () => allCardsAtFullProgress(cards, subtasks),
    [cards, subtasks],
  )

  if (hideForAllComplete || top3.length === 0) return null

  if (compact) {
    return (
      <section
        className="rounded-lg border border-blue-100 bg-blue-50/90 px-2 py-2 shadow-sm"
        aria-label="오늘의 우선순위"
      >
        <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
          🎯 우선순위
        </h2>
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <ul>
            {top3.map((item, i) => {
              const d = remainingDays(item.card.dueDate)
              return (
                <li
                  key={item.card.id}
                  className={`px-2 py-1.5 ${i > 0 ? 'border-t-[0.5px] border-gray-200' : ''}`}
                >
                  <div className="mb-0.5 flex items-start justify-between gap-1">
                    <span className="text-[11px] font-medium text-gray-800">{RANK_BADGE[i] ?? '⭐'}</span>
                    <span className="shrink-0 text-[10px] text-gray-500">
                      {formatDue(item.card.dueDate)}
                      {d === 0 && item.card.dueDate && (
                        <span className="ml-0.5 font-medium text-red-600">(임박)</span>
                      )}
                    </span>
                  </div>
                  {(() => {
                    const { next, otherCount } = nextAndRestCount(item.remainingSubtasks)
                    if (next) {
                      return (
                        <div className="space-y-0.5">
                          <p className="line-clamp-2 text-[11px] leading-snug text-gray-900">
                            <span className="font-semibold">{item.card.subject}</span>
                            <span className="text-gray-500"> – </span>
                            <span>{next.title}</span>
                          </p>
                          {otherCount > 0 && (
                            <p className="text-[10px] text-gray-500">외 {otherCount}개</p>
                          )}
                        </div>
                      )
                    }
                    return (
                      <p className="line-clamp-2 text-[11px] leading-snug text-gray-900">
                        <span className="font-semibold">{item.card.subject}</span>
                        <span className="text-gray-500"> – </span>
                        <span>{item.card.title}</span>
                      </p>
                    )
                  })()}
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    )
  }

  return (
    <section
      className="mb-8 rounded-xl border border-blue-100 bg-blue-50 p-3"
      aria-label="오늘의 우선순위"
    >
      <h2 className="mb-2 text-sm font-semibold text-blue-700">🎯 오늘의 우선순위</h2>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <ul>
          {top3.map((item, i) => {
            const d = remainingDays(item.card.dueDate)
            return (
              <li
                key={item.card.id}
                className={`px-4 py-3 ${i > 0 ? 'border-t-[0.5px] border-gray-200' : ''}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800">{RANK_BADGE[i] ?? '⭐'}</span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {formatDue(item.card.dueDate)}
                    {d === 0 && item.card.dueDate && (
                      <span className="ml-1 font-medium text-red-600">(오늘·기한)</span>
                    )}
                  </span>
                </div>
                {(() => {
                  const { next, otherCount } = nextAndRestCount(item.remainingSubtasks)
                  if (next) {
                    return (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-sm text-gray-900">
                          <span className="font-semibold">{item.card.subject}</span>
                          <span className="text-gray-500"> – </span>
                          <span>{next.title}</span>
                        </p>
                        {otherCount > 0 && (
                          <p className="text-xs text-gray-500">외 {otherCount}개</p>
                        )}
                      </div>
                    )
                  }
                  return (
                    <p className="mt-1 text-sm text-gray-900">
                      <span className="font-semibold">{item.card.subject}</span>
                      <span className="text-gray-500"> – </span>
                      <span>{item.card.title}</span>
                    </p>
                  )
                })()}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
