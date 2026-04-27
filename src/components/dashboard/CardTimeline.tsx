'use client'

import CardItem, { Card, Subtask } from './CardItem'

interface CardTimelineProps {
  cards: Card[]
  subtasks: Subtask[]
  onDueDateChange: (cardId: string, dueDate: string | null) => void
  onDelete: (cardId: string) => void
}

function getDueDateTimestamp(card: Card): number {
  const dueDate = card.dueDate ?? (card as unknown as Record<string, unknown>).due_date as string | null ?? null
  if (!dueDate) return Number.POSITIVE_INFINITY
  const parsed = new Date(dueDate).getTime()
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

export default function CardTimeline({ cards, subtasks, onDueDateChange, onDelete }: CardTimelineProps) {
  const sortedCards = [...cards].sort((a, b) => getDueDateTimestamp(a) - getDueDateTimestamp(b))

  if (sortedCards.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-16 text-center">
        <p className="text-sm text-gray-400">아직 추가된 과제가 없어요</p>
      </div>
    )
  }

  return (
    <section className="space-y-6">
      {sortedCards.map(card => (
        <CardItem
          key={card.id}
          card={card}
          subtasks={subtasks.filter(s => s.cardId === card.id)}
          onDueDateChange={onDueDateChange}
          onDelete={onDelete}
        />
      ))}
    </section>
  )
}
