'use client'

import { useEffect } from 'react'
import Step1Upload from './Step1Upload'
import Step3Confirm from './Step3Confirm'
import { useUploadPanel } from '@/hooks/useUploadPanel'
import type { Card } from '@/types/card'

import type { Subtask } from '@/types/card'

interface UploadPanelProps {
  isOpen: boolean
  defaultFolderId: string | null
  folders: Array<{ id: string; name: string }>
  onClose: () => void
  onCardsCreated: (cards: Card[], subtasks: Subtask[]) => void
}

async function saveCards(
  extractionResult: { subject: string; items: Array<{ title: string; type: string; dueDate: string | null; weight: number; weightReason: string; subtasks: Array<{ title: string; weight: number }> }> },
  folderId: string | null,
  file: File | null
) {
  let fileBase64: string | null = null
  let fileName: string | null = null
  if (file) {
    const arrayBuf = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    fileBase64 = btoa(binary)
    fileName = file.name
  }

  const res = await fetch('/api/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folderId,
      subject: extractionResult.subject,
      fileBase64,
      fileName,
      items: extractionResult.items.map(item => ({
        title: item.title,
        type: item.type,
        dueDate: item.dueDate,
        weight: item.weight,
        weightReason: item.weightReason,
        subtasks: item.subtasks.map((st, i) => ({
          title: st.title,
          weight: st.weight,
          orderIndex: i,
        })),
      })),
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? '저장에 실패했어요.')
  return { cards: data.cards, subtasks: data.subtasks ?? [] }
}

export default function UploadPanel({
  isOpen,
  defaultFolderId,
  folders,
  onClose,
  onCardsCreated,
}: UploadPanelProps) {
  const panel = useUploadPanel()

  useEffect(() => {
    if (isOpen) panel.open(defaultFolderId)
    else panel.close()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    if (isOpen) panel.setFolderId(defaultFolderId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultFolderId, isOpen])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/20" onClick={!panel.isLoading ? onClose : undefined} aria-hidden />

      <aside
        className="fixed right-0 top-0 z-[110] flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl"
        style={{ colorScheme: 'light' }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-500">
            {panel.step === 1 ? '문서 업로드' : '추가 완료'}
          </span>
          <button
            onClick={onClose}
            disabled={panel.isLoading}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none disabled:opacity-30"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="flex-1 px-6 py-6">
          {panel.step === 1 && (
            <Step1Upload
              documentType={panel.documentType}
              onDocumentTypeChange={panel.setDocumentType}
              folderId={panel.folderId}
              folders={folders}
              file={panel.file}
              text={panel.text}
              isLoading={panel.isLoading}
              error={panel.error}
              onFolderChange={panel.setFolderId}
              onFileChange={panel.setFile}
              onTextChange={panel.setText}
              onExtract={async () => {
                panel.setError(null)
                if (panel.documentType === null) {
                  panel.setError('문서 유형을 선택해 주세요.')
                  return
                }
                panel.setLoading(true)
                try {
                  // 1단계: AI 추출
                  const formData = new FormData()
                  formData.append('documentType', panel.documentType)
                  if (panel.file) formData.append('file', panel.file)
                  if (panel.text.trim()) formData.append('text', panel.text)

                  const res = await fetch('/api/extract', { method: 'POST', body: formData })
                  const extracted = await res.json()
                  if (!res.ok) throw new Error(extracted.error ?? 'AI 분석에 실패했어요.')
                  if (!Array.isArray(extracted.items) || extracted.items.length === 0) {
                    const hint = Array.isArray(extracted.missingInfo) && extracted.missingInfo.length > 0
                      ? extracted.missingInfo.join(' ')
                      : '추출된 할 일이 없어요. 내용을 조금 더 넣거나 다른 문서 유형을 선택해 보세요.'
                    throw new Error(hint)
                  }

                  // 2단계: 검토 없이 즉시 카드 저장
                  const { cards, subtasks } = await saveCards(extracted, panel.folderId, panel.file)
                  onCardsCreated(cards, subtasks)
                  panel.setStep(3)
                } catch (e) {
                  panel.setError(e instanceof Error ? e.message : '오류가 발생했어요.')
                } finally {
                  panel.setLoading(false)
                }
              }}
            />
          )}

          {panel.step === 3 && (
            <Step3Confirm
              onAddMore={panel.resetToStep1}
              onClose={onClose}
            />
          )}
        </div>
      </aside>
    </>
  )
}
