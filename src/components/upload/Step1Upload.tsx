'use client'

import { useRef } from 'react'
import type { DocumentType } from '@/types/upload'

interface Folder {
  id: string
  name: string
}

const PLACEHOLDERS: Record<DocumentType, string> = {
  syllabus:
    '강의계획서를 붙여넣으면 중간·기말 범위를 주차별로 나누어 정리해 드려요. 계절학기(3·5주 등)도 문서에 적힌 주차 기준으로 동일하게 처리합니다.',
  assignment:
    '과제 공지나 안내문을 붙여넣으면 마감일별로 할 일을 추출해드려요. PDF를 올린 뒤에도 메모를 함께 넣을 수 있어요.',
  goal:
    '목표와 기간을 자유롭게 써주세요. 자세히 쓸수록 더 정확한 계획이 만들어져요.',
}

interface Step1UploadProps {
  documentType: DocumentType | null
  onDocumentTypeChange: (t: DocumentType) => void
  folderId: string | null
  folders: Folder[]
  file: File | null
  text: string
  isLoading: boolean
  error: string | null
  onFolderChange: (id: string | null) => void
  onFileChange: (file: File | null) => void
  onTextChange: (text: string) => void
  onExtract: () => void
}

const HWP_WARNING = 'HWP 파일은 지원하지 않아요. PDF로 저장하거나 텍스트를 복사해서 붙여넣어 주세요.'

const DOC_OPTIONS: { value: DocumentType; label: string; icon: string }[] = [
  { value: 'syllabus', label: '강의계획서', icon: '📋' },
  { value: 'assignment', label: '과제·공지', icon: '📌' },
  { value: 'goal', label: '자유 목표', icon: '🎯' },
]

export default function Step1Upload({
  documentType,
  onDocumentTypeChange,
  folderId,
  folders,
  file,
  text,
  isLoading,
  error,
  onFolderChange,
  onFileChange,
  onTextChange,
  onExtract,
}: Step1UploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canExtract =
    documentType != null && (!!file || text.trim().length > 0) && !isLoading

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    if (!selected) return
    const ext = selected.name.split('.').pop()?.toLowerCase()
    if (ext === 'hwp') {
      alert(HWP_WARNING)
      e.target.value = ''
      return
    }
    onFileChange(selected)
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-gray-900">문서 추가</h2>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">문서 유형</p>
        <div className="flex flex-wrap gap-2">
          {DOC_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onDocumentTypeChange(opt.value)}
              disabled={isLoading}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40
                ${documentType === opt.value
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'}`}
            >
              <span aria-hidden>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
        {documentType == null && (
          <p className="mt-2 text-xs text-gray-500">문서 유형을 선택한 뒤 추출할 수 있어요.</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">폴더</label>
        {folders.length > 0 ? (
          <select
            value={folderId ?? ''}
            onChange={e => onFolderChange(e.target.value || null)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300"
            style={{ color: '#1f2937', colorScheme: 'light' }}
          >
            <option value="">폴더 없음</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-gray-500 rounded-xl border border-dashed border-gray-200 px-3 py-2 bg-gray-50/80">
            대시보드 상단의 <strong className="font-medium text-gray-700">폴더 추가</strong>로 과목별로 나눈 뒤, 여기서 넣을 폴더를 고를 수 있어요.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          텍스트 붙여넣기
        </label>
        <textarea
          value={text}
          onChange={e => onTextChange(e.target.value)}
          disabled={isLoading}
          rows={8}
          placeholder={
            documentType == null
              ? '위에서 문서 유형을 먼저 선택해 주세요.'
              : PLACEHOLDERS[documentType]
          }
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-50 disabled:text-gray-400"
          style={{ color: '#1f2937', colorScheme: 'light' }}
        />
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400">
        <div className="flex-1 h-px bg-gray-100" />
        PDF만 / 텍스트만 / 둘 다 가능
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.hwp"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="w-full rounded-xl border-2 border-dashed border-gray-200 px-4 py-4 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40"
        >
          {file ? (
            <span className="text-gray-800 font-medium">📄 {file.name}</span>
          ) : (
            'PDF 파일 선택'
          )}
        </button>
        {file && (
          <button
            type="button"
            onClick={() => { onFileChange(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
            className="mt-1 text-xs text-gray-400 hover:text-gray-600"
          >
            파일 제거
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      <button
        type="button"
        onClick={onExtract}
        disabled={!canExtract}
        className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-700 transition-colors disabled:opacity-40"
      >
        {isLoading ? 'AI가 할 일을 분석하고 있어요...' : 'AI로 할 일 추출하기'}
      </button>
    </div>
  )
}
