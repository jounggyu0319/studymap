import type { CardType } from './card'

/** 업로드 문서 유형 — /api/extract documentType */
export type DocumentType = 'syllabus' | 'assignment' | 'goal'

export interface ExtractedSubtask {
  id: string        // 클라이언트 임시 ID
  title: string
  weight: number
}

export interface ExtractedItem {
  id: string        // 클라이언트 임시 ID
  title: string
  type: CardType
  dueDate: string | null
  weight: number
  weightReason: string
  subtasks: ExtractedSubtask[]
  hasError: boolean // 필수 필드 누락 여부
}

export interface ExtractionResult {
  subject: string
  items: ExtractedItem[]
  missingInfo: string[]
  confidence: number
}

// /api/cards POST 요청 body
export interface ConfirmCardsRequest {
  folderId: string | null
  subject: string
  fileBase64: string | null
  fileName: string | null
  items: Array<{
    title: string
    type: CardType
    dueDate: string | null
    weight: number
    weightReason: string
    subtasks: Array<{
      title: string
      weight: number
      orderIndex: number
    }>
  }>
}
