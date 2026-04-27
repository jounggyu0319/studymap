'use client'

import { useState } from 'react'
import { CARD_TYPES } from '@/types/card'
import type { ExtractionResult, ExtractedItem } from '@/types/upload'

interface Step2ReviewProps {
  result: ExtractionResult
  file: File | null
  folderId: string | null
  isLoading: boolean
  error: string | null
  onBack: () => void
  onConfirm: (result: ExtractionResult) => void
}

export default function Step2Review({
  result,
  isLoading,
  error,
  onBack,
  onConfirm,
}: Step2ReviewProps) {
  const [items, setItems] = useState<ExtractedItem[]>(result.items)
  const [subject, setSubject] = useState(result.subject)

  const updateItem = (id: string, patch: Partial<ExtractedItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const addSubtask = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      const newSubtask = { id: crypto.randomUUID(), title: '', weight: 0.1 }
      return { ...item, subtasks: [...item.subtasks, newSubtask] }
    }))
  }

  const updateSubtask = (itemId: string, subtaskId: string, title: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        subtasks: item.subtasks.map(st => st.id === subtaskId ? { ...st, title } : st),
      }
    }))
  }

  const removeSubtask = (itemId: string, subtaskId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return { ...item, subtasks: item.subtasks.filter(st => st.id !== subtaskId) }
    }))
  }

  const hasErrors = items.some(item => !item.dueDate || !item.title.trim())

  const handleConfirm = () => {
    onConfirm({ ...result, subject, items })
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-gray-900">AI 추출 결과 검토</h2>

      {/* 신뢰도 낮음 경고 */}
      {result.confidence < 0.7 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          정보가 부족해요. 아래 항목을 직접 확인해주세요.
        </div>
      )}

      {/* 누락 정보 */}
      {result.missingInfo.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 space-y-1">
          {result.missingInfo.map((info, i) => <p key={i}>• {info}</p>)}
        </div>
      )}

      {/* 과목명 */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">과목명</label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>

      {/* 카드 목록 */}
      <div className="space-y-4">
        {items.map(item => {
          const missingDueDate = !item.dueDate
          const missingTitle = !item.title.trim()
          const hasError = missingDueDate || missingTitle

          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 space-y-3 ${hasError ? 'border-red-300 bg-red-50' : 'border-gray-100 bg-white'}`}
            >
              {/* 카드 헤더 */}
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  {/* 제목 */}
                  <input
                    value={item.title}
                    onChange={e => updateItem(item.id, { title: e.target.value })}
                    placeholder="카드 제목"
                    className={`w-full rounded-lg border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-300
                      ${missingTitle ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                  />

                  <div className="flex gap-2">
                    {/* 유형 */}
                    <select
                      value={item.type}
                      onChange={e => updateItem(item.id, { type: e.target.value as ExtractedItem['type'] })}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300"
                    >
                      {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    {/* 마감일 */}
                    <input
                      type="date"
                      value={item.dueDate ?? ''}
                      onChange={e => updateItem(item.id, { dueDate: e.target.value || null })}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300
                        ${missingDueDate ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                    />
                  </div>

                  {/* 가중치 + 근거 */}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>가중치</span>
                    <input
                      type="number"
                      min="0.1" max="1" step="0.05"
                      value={item.weight}
                      onChange={e => updateItem(item.id, { weight: parseFloat(e.target.value) })}
                      className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none"
                    />
                    <span className="text-gray-400 truncate" title={item.weightReason}>
                      {item.weightReason}
                    </span>
                  </div>
                </div>

                {/* 카드 삭제 */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-gray-300 hover:text-red-400 text-lg leading-none mt-1"
                  aria-label="카드 삭제"
                >
                  ×
                </button>
              </div>

              {/* 서브태스크 */}
              <div className="space-y-1.5 pl-1">
                {item.subtasks.map(st => (
                  <div key={st.id} className="flex items-center gap-2">
                    <span className="text-gray-300 text-xs">•</span>
                    <input
                      value={st.title}
                      onChange={e => updateSubtask(item.id, st.id, e.target.value)}
                      placeholder="서브태스크"
                      className="flex-1 rounded-lg border border-gray-100 px-2 py-1 text-xs focus:outline-none focus:border-gray-300"
                    />
                    <button
                      onClick={() => removeSubtask(item.id, st.id)}
                      className="text-gray-300 hover:text-red-400 text-sm"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addSubtask(item.id)}
                  className="text-xs text-gray-400 hover:text-gray-600 pl-3"
                >
                  + 서브태스크 추가
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {hasErrors && (
        <p className="text-xs text-red-500">빨간 항목의 제목과 마감일을 입력해주세요.</p>
      )}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* 버튼 */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          다시 올리기
        </button>
        <button
          onClick={handleConfirm}
          disabled={isLoading || items.length === 0}
          className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          {isLoading ? '저장 중...' : `이대로 확정 (${items.length}개)`}
        </button>
      </div>
    </div>
  )
}
