'use client'

import { useMemo } from 'react'
import { remainingDays } from '@/lib/priority'
import { CardListRow, CardDetailView, type Card, type Subtask } from './CardItem'

export type { Card, Subtask }

function getDueDateTimestamp(card: Card): number {
  const dueDate = card.dueDate ?? (card as unknown as Record<string, unknown>).due_date as string | null ?? null
  if (!dueDate) return Number.POSITIVE_INFINITY
  const parsed = new Date(dueDate).getTime()
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

export type TimeFilterTab = 'd3' | 'week' | 'all'

interface CardTimelineProps {
  cards: Card[]
  subtasks: Subtask[]
  onDueDateChange: (cardId: string, dueDate: string | null) => void
  onDelete: (cardId: string) => void
  timeTab: TimeFilterTab
  selectedCardId: string | null
  onSelectCard: (id: string | null) => void
  notesRefreshKey?: number
}

function filterCardsByTimeTab(cards: Card[], tab: TimeFilterTab): Card[] {
  if (tab === 'all') return cards
  return cards.filter(c => {
    const r = remainingDays(c.dueDate ?? null)
    if (tab === 'd3') return r <= 3
    return r <= 7
  })
}

export default function CardTimeline({
  cards,
  subtasks,
  onDueDateChange,
  onDelete,
  timeTab,
  selectedCardId,
  onSelectCard,
  notesRefreshKey = 0,
}: CardTimelineProps) {
  const tabCards = useMemo(() => filterCardsByTimeTab(cards, timeTab), [cards, timeTab])

  const sortedCards = useMemo(
    () => [...tabCards].sort((a, b) => getDueDateTimestamp(a) - getDueDateTimestamp(b)),
    [tabCards],
  )

  const selectedCard = useMemo(
    () => (selectedCardId ? sortedCards.find(c => c.id === selectedCardId) ?? cards.find(c => c.id === selectedCardId) : null),
    [selectedCardId, sortedCards, cards],
  )

  const selectedSubtasks = selectedCard
    ? subtasks.filter(s => s.cardId === selectedCard.id)
    : []

  const detailOpen = Boolean(selectedCardId && selectedCard)

  const handleDeleteDetail = (cardId: string) => {
    onDelete(cardId)
    onSelectCard(null)
  }

  if (sortedCards.length === 0 && !detailOpen) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-8 text-center">
        <p className="text-sm text-gray-400">이 구간에 표시할 카드가 없어요</p>
      </div>
    )
  }

  const listSection = (
    <section className="space-y-1.5 md:w-1/2 md:shrink-0 md:pr-1">
      {sortedCards.map(card => (
        <CardListRow
          key={card.id}
          card={card}
          subtasks={subtasks.filter(s => s.cardId === card.id)}
          onClick={() => onSelectCard(card.id)}
        />
      ))}
    </section>
  )

  const detailPanel =
    selectedCard != null ? (
      <CardDetailView
        card={selectedCard}
        subtasks={selectedSubtasks}
        onBack={() => onSelectCard(null)}
        onDueDateChange={onDueDateChange}
        onDelete={handleDeleteDetail}
        notesRefreshKey={notesRefreshKey}
      />
    ) : (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-6 text-center text-sm text-gray-400">
        카드를 선택해 주세요
      </div>
    )

  return (
    <div className="relative min-h-[12rem] w-full">
      {/* 모바일: 페이드 전환 (슬라이드는 좁은 화면에서 부자연스러움) */}
      <div className="relative min-h-[12rem] w-full overflow-hidden md:hidden">
        <div
          className={`transition-opacity duration-200 ease-out motion-reduce:transition-none ${
            detailOpen
              ? 'pointer-events-none absolute inset-0 opacity-0'
              : 'relative opacity-100'
          }`}
        >
          {listSection}
        </div>
        <div
          className={`transition-opacity duration-200 ease-out motion-reduce:transition-none ${
            detailOpen
              ? 'relative min-h-[12rem] opacity-100'
              : 'pointer-events-none absolute inset-0 opacity-0'
          }`}
        >
          {detailPanel}
        </div>
      </div>

      {/* 데스크톱: 좌우 슬라이드 */}
      <div className="relative hidden min-h-[12rem] w-full overflow-hidden md:block">
        <div
          className={`flex w-[200%] transition-transform duration-300 ease-out motion-reduce:transition-none ${
            detailOpen ? '-translate-x-1/2' : 'translate-x-0'
          }`}
        >
          {listSection}
          <div className="w-1/2 shrink-0 pl-1">{detailPanel}</div>
        </div>
      </div>
    </div>
  )
}
