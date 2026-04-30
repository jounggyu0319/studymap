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
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <p className="text-sm text-gray-400">이 구간에 표시할 카드가 없어요</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-[12rem] w-full overflow-hidden">
      <div
        className={`flex w-[200%] transition-transform duration-300 ease-out motion-reduce:transition-none ${
          detailOpen ? '-translate-x-1/2' : 'translate-x-0'
        }`}
      >
        <section className="w-1/2 shrink-0 space-y-2 pr-1">
          {sortedCards.map(card => (
            <CardListRow
              key={card.id}
              card={card}
              subtasks={subtasks.filter(s => s.cardId === card.id)}
              onClick={() => onSelectCard(card.id)}
            />
          ))}
        </section>
        <div className="w-1/2 shrink-0 pl-1">
          {selectedCard ? (
            <CardDetailView
              card={selectedCard}
              subtasks={selectedSubtasks}
              onBack={() => onSelectCard(null)}
              onDueDateChange={onDueDateChange}
              onDelete={handleDeleteDetail}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center text-sm text-gray-400">
              카드를 선택해 주세요
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
