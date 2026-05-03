export type CardType =
  | '시험' | '퀴즈' | '과제' | '팀플'
  | '발표' | '실습' | '독서' | '보고서' | '기타'

export const CARD_TYPES: CardType[] = [
  '시험', '퀴즈', '과제', '팀플',
  '발표', '실습', '독서', '보고서', '기타',
]

export interface Folder {
  id: string
  userId: string
  name: string
  orderIndex: number
  createdAt: string
}

export interface Card {
  id: string
  userId: string
  folderId: string | null
  subject: string
  title: string
  type: CardType
  dueDate: string | null
  weight: number
  weightReason: string | null
  fileUrl: string | null
  createdAt: string
}

export interface Subtask {
  id: string
  cardId: string
  title: string
  /** 0–100. 100이면 완료(is_done과 동기) */
  progress: number
  isDone: boolean
  weight: number
  orderIndex: number
}

/** 0~1 완료 비율 (가중치 반영) */
export function subtaskDoneFraction(s: Subtask): number {
  const p = s.progress ?? (s.isDone ? 100 : 0)
  return Math.min(100, Math.max(0, p)) / 100
}

// 진척도: 완료 서브태스크 수 / 전체 서브태스크 수 (균등 가중치)
export function calcProgress(subtasks: Subtask[]): number {
  if (subtasks.length === 0) return 0
  const acc = subtasks.reduce((sum, s) => sum + subtaskDoneFraction(s), 0)
  return Math.round((acc / subtasks.length) * 100)
}

export interface Note {
  id: string
  cardId: string
  content: string
  createdAt: string
}
