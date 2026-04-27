import type { Card, CardType, Subtask } from '@/types/card'
import { subtaskDoneFraction } from '@/types/card'

function typeWeight(t: CardType): number {
  if (t === '시험' || t === '퀴즈') return 1.5
  if (t === '발표' || t === '팀플') return 1.2
  return 1.0
}

/**
 * 남은 일 수. 음수(마감 지남)는 0으로 클램프.
 * 마감일 없으면 점수에서 멀리 보내기 위해 큰 값.
 */
export function remainingDays(dueDate: string | null, now = new Date()): number {
  if (!dueDate) return 365
  const due = new Date(dueDate + 'T12:00:00')
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d = Math.floor((due.getTime() - t0.getTime()) / 86400000)
  return Math.max(0, d)
}

/**
 * 7일 초과 1.0 / 3~7일 1.3 / 1~3일(남은 일수 2~3) 1.8 / 오늘·내일(0~1) 3.0
 * d=0(기한 경과)도 3.0
 */
function timeBoost(remainingD: number): number {
  if (remainingD > 7) return 1.0
  if (remainingD >= 3) return 1.3
  if (remainingD >= 2) return 1.8
  return 3.0
}

function subtasksForCard(subtasks: Subtask[], cardId: string) {
  return subtasks.filter((s) => s.cardId === cardId)
}

/**
 * 진척률 0~1. 서브태스크 없는 카드는 0.
 */
export function cardProgressRatio(card: Card, subtasks: Subtask[]): number {
  const st = subtasksForCard(subtasks, card.id)
  if (st.length === 0) return 0
  const totalW = st.reduce((a, s) => a + s.weight, 0)
  if (totalW <= 0) return st.every((s) => subtaskDoneFraction(s) >= 1) ? 1 : 0
  const doneW = st.reduce((a, s) => a + s.weight * subtaskDoneFraction(s), 0)
  return doneW / totalW
}

/**
 * score = (1 - 진척률) × (남은 weight / (남은 일수 + 1)) × 유형 가중치 × 임박 부스트
 * buffer = 남은 일수 × 3 - 남은 weight, 음수면 임박 부스트 +0.5
 */
export function cardPriorityScore(card: Card, subtasks: Subtask[]): number {
  const st = subtasksForCard(subtasks, card.id)
  const p = cardProgressRatio(card, subtasks)

  let remW: number
  if (st.length > 0) {
    const totalW = st.reduce((a, s) => a + s.weight, 0)
    const doneW = st.reduce((a, s) => a + s.weight * subtaskDoneFraction(s), 0)
    remW = totalW - doneW
  } else {
    remW = card.weight
  }
  if (remW <= 0) return 0

  const d = remainingDays(card.dueDate)
  let boost = timeBoost(d)
  const buffer = d * 3 - remW
  if (buffer < 0) boost += 0.5

  return (1 - p) * (remW / (d + 1)) * typeWeight(card.type) * boost
}

export interface PriorityItem {
  card: Card
  score: number
  /** 미완료 서브태스크만, 제목 표시용 */
  remainingSubtasks: Subtask[]
}

/** cards + subtasks 기준 점수 상위 limit장 (기본 3) */
export function getTopPriorityCards(
  cards: Card[],
  subtasks: Subtask[],
  limit = 3,
): PriorityItem[] {
  return cards
    .map((card) => ({
      card,
      score: cardPriorityScore(card, subtasks),
      remainingSubtasks: subtasksForCard(subtasks, card.id).filter(
        (s) => (s.progress ?? 0) < 100,
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * "모든 카드 완료(진척률 1.0)": **서브태스크가 있는 카드**만 — 전부 1.0이면 true.
 * 서브태스크가 없는 카드가 하나라도 있으면 false(진척 0 취급이라 '전부 완료'가 아님).
 */
export function allCardsAtFullProgress(cards: Card[], subtasks: Subtask[]): boolean {
  if (cards.length === 0) return false
  return cards.every((c) => {
    const st = subtasksForCard(subtasks, c.id)
    if (st.length === 0) return false
    return cardProgressRatio(c, subtasks) >= 1 - 1e-9
  })
}
