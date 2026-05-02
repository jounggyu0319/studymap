'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type CSSProperties,
  type RefObject,
} from 'react'
import type { Note } from '@/types/card'

const PLACEHOLDERS = [
  "예: 'IO PPT 3 봤어' 또는 '통계 책 100p 읽었어'",
  '과목명 + 내용을 구체적으로 입력하면 더 정확해요',
  "예: '마케팅 서평 서론 썼어' '경제 PPT 5 절반 함'",
]

export interface ChatMessage {
  role: 'user' | 'ai'
  text: string
  /** DB 반영이 일어난 assistant 턴 — API history carry-forward용 */
  progressApplied?: boolean
  targetCardId?: string | null
  targetSubtaskId?: string | null
  /** 서버가 삭제 확인을 요청한 assistant 턴 */
  pendingDelete?: { targetSubtaskId: string; subtaskName: string }
}

export interface UseChatProgressOptions {
  onSubtaskProgress: (subtaskId: string, progress: number, isDone: boolean) => void
  onSubtaskRemoved?: (subtaskId: string) => void
  /** 모바일 하단 바 높이·스크롤 여백 동기화 (데스크톱에서는 생략 가능) */
  onExpandedChange?: (expanded: boolean) => void
  /** 상세 패널이 열린 카드 id — 없으면 생략 */
  activeCardId?: string | null
  /** chat-progress에서 메모 저장 성공 시 */
  onMemoSaved?: () => void
  /** chat-progress에서 서브태스크 추가 성공 시 */
  onSubtaskAdded?: () => void
}

export interface ChatProgressApi {
  messages: ChatMessage[]
  input: string
  setInput: (v: string) => void
  send: () => Promise<void>
  isLoading: boolean
  hasMessages: boolean
  phIndex: number
  inputRef: RefObject<HTMLInputElement | null>
  scrollRef: RefObject<HTMLDivElement | null>
  confirmPendingDelete: (messageIndex: number, targetSubtaskId: string) => Promise<void>
  cancelPendingDelete: (messageIndex: number) => void
}

function serializeHistoryForApi(messages: ChatMessage[]): unknown[] {
  return messages.map(m => {
    const row: Record<string, unknown> = { role: m.role, text: m.text }
    if (m.role === 'ai' && m.progressApplied) {
      row.progressApplied = true
      if (m.targetCardId !== undefined) row.targetCardId = m.targetCardId
      if (m.targetSubtaskId !== undefined) row.targetSubtaskId = m.targetSubtaskId
    }
    return row
  })
}

/** API/프록시에 따라 pendingDelete·id 타입이 달라질 수 있어 정규화 */
function parsePendingDeletePayload(raw: unknown): {
  targetSubtaskId: string
  subtaskName: string
  message: string
} | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const data = raw as Record<string, unknown>
  const flag = data.pendingDelete
  const isPending =
    flag === true ||
    flag === 1 ||
    (typeof flag === 'string' && ['true', '1', 'yes'].includes(flag.toLowerCase()))

  if (!isPending) return null

  const rid = data.targetSubtaskId
  let targetSubtaskId = ''
  if (typeof rid === 'string' && rid.trim()) targetSubtaskId = rid.trim()
  else if (typeof rid === 'number' && Number.isFinite(rid)) targetSubtaskId = String(rid)

  if (!targetSubtaskId) return null

  const subtaskName = typeof data.subtaskName === 'string' ? data.subtaskName : ''
  const message =
    typeof data.message === 'string' && data.message.trim()
      ? data.message.trim()
      : subtaskName
        ? `${subtaskName}을(를) 삭제할까요?`
        : '삭제할까요?'

  return { targetSubtaskId, subtaskName, message }
}

export function useChatProgress({
  onSubtaskProgress,
  onSubtaskRemoved,
  onExpandedChange,
  activeCardId = null,
  onMemoSaved,
  onSubtaskAdded,
}: UseChatProgressOptions): ChatProgressApi {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [phIndex, setPhIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setInterval(() => {
      setPhIndex(i => (i + 1) % PLACEHOLDERS.length)
    }, 3000)
    return () => clearInterval(t)
  }, [])

  const hasMessages = messages.length > 0

  useEffect(() => {
    onExpandedChange?.(hasMessages)
  }, [hasMessages, onExpandedChange])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isLoading])

  const cancelPendingDelete = useCallback((messageIndex: number) => {
    setMessages(prev =>
      prev.map((m, i) => (i === messageIndex ? { ...m, pendingDelete: undefined } : m)),
    )
  }, [])

  const confirmPendingDelete = useCallback(
    async (messageIndex: number, targetSubtaskId: string) => {
      if (isLoading) return
      setIsLoading(true)
      try {
        const body: Record<string, unknown> = {
          confirmedDelete: true,
          targetSubtaskId,
        }
        if (activeCardId) body.activeCardId = activeCardId

        const res = await fetch('/api/chat-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()

        if (data.error) {
          setMessages(prev => [...prev, { role: 'ai', text: data.error }])
          return
        }

        setMessages(prev =>
          prev.map((m, i) => {
            if (i !== messageIndex) return m
            const sid =
              typeof data.subtaskId === 'string' && data.subtaskId.length > 0
                ? data.subtaskId
                : targetSubtaskId
            return {
              role: 'ai',
              text: typeof data.message === 'string' ? data.message : '삭제했어요.',
              progressApplied: true,
              ...(data.cardId != null ? { targetCardId: data.cardId as string } : {}),
              targetSubtaskId: sid,
            }
          }),
        )

        if (data.subtaskRemoved === true && data.subtaskId != null) {
          onSubtaskRemoved?.(data.subtaskId)
        }
      } catch {
        setMessages(prev => [...prev, { role: 'ai', text: '오류가 발생했어요. 다시 시도해주세요.' }])
      } finally {
        setIsLoading(false)
        inputRef.current?.focus()
      }
    },
    [activeCardId, isLoading, onSubtaskRemoved],
  )

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const historySnapshot = messages.slice(-12)
    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setIsLoading(true)

    try {
      const body: Record<string, unknown> = {
        message: text,
        history: serializeHistoryForApi(historySnapshot),
      }
      if (activeCardId) body.activeCardId = activeCardId

      const res = await fetch('/api/chat-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as Record<string, unknown>

      if (process.env.NODE_ENV === 'development') {
        console.debug('[useChatProgress] /api/chat-progress response', {
          pendingDelete: data.pendingDelete,
          typeofPendingDelete: typeof data.pendingDelete,
          targetSubtaskId: data.targetSubtaskId,
          typeofTargetSubtaskId: typeof data.targetSubtaskId,
          message: data.message,
        })
      }

      if (typeof data.error === 'string' && data.error) {
        const errText = data.error
        setMessages(prev => [...prev, { role: 'ai', text: errText }])
        return
      }

      const pending = parsePendingDeletePayload(data)
      if (pending) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[useChatProgress] pendingDelete branch — appending message with buttons', pending)
        }
        setMessages(prev => [
          ...prev,
          {
            role: 'ai',
            text: pending.message,
            pendingDelete: {
              targetSubtaskId: pending.targetSubtaskId,
              subtaskName: pending.subtaskName,
            },
          },
        ])
        return
      }

      const dbApplied = Boolean(data.progressApplied) || Boolean(data.subtaskRemoved)
      const aiPayload: ChatMessage = {
        role: 'ai',
        text: typeof data.message === 'string' ? data.message : '',
      }
      if (dbApplied && (typeof data.cardId === 'string' || typeof data.subtaskId === 'string')) {
        aiPayload.progressApplied = true
        if (typeof data.cardId === 'string') aiPayload.targetCardId = data.cardId
        if (typeof data.subtaskId === 'string') aiPayload.targetSubtaskId = data.subtaskId
      }
      setMessages(prev => [...prev, aiPayload])

      if (data.progressApplied && typeof data.subtaskId === 'string' && typeof data.progress === 'number') {
        onSubtaskProgress(data.subtaskId, data.progress, data.progress >= 100)
      }
      if (data.subtaskRemoved === true && typeof data.subtaskId === 'string') {
        onSubtaskRemoved?.(data.subtaskId)
      }
      if (data.memoSaved === true) {
        onMemoSaved?.()
      }
      if (data.subtaskAdded === true) {
        onSubtaskAdded?.()
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '오류가 발생했어요. 다시 시도해주세요.' }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [
    input,
    isLoading,
    messages,
    onSubtaskProgress,
    onSubtaskRemoved,
    activeCardId,
    onMemoSaved,
    onSubtaskAdded,
  ])

  return {
    messages,
    input,
    setInput,
    send,
    isLoading,
    hasMessages,
    phIndex,
    inputRef,
    scrollRef,
    confirmPendingDelete,
    cancelPendingDelete,
  }
}

const bubbleUserBase: CSSProperties = {
  background: '#e5e7eb',
  borderRadius: '12px 12px 2px 12px',
  padding: '6px 12px',
  fontSize: 13,
  color: '#111827',
  colorScheme: 'light',
  display: 'inline-block',
  textAlign: 'left',
  wordBreak: 'break-word',
}

const textAi: CSSProperties = {
  fontSize: 13,
  color: '#6b7280',
}

export function ChatMessageList({
  api,
  variant,
}: {
  api: ChatProgressApi
  variant: 'mobile' | 'desktop'
}) {
  const { messages, isLoading, scrollRef } = api
  const userMax = variant === 'desktop' ? '80%' : '80%'
  const aiMax = variant === 'desktop' ? '85%' : '85%'

  if (variant === 'desktop') {
    return (
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
        style={{ padding: '12px 14px', colorScheme: 'light' }}
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-1 flex-col items-center justify-center px-2 text-center text-sm text-gray-400">
            <p>오늘 한 것을 입력해보세요</p>
            <p className="mt-3">
              예) &quot;재료역학 3강 절반 했어&quot;
              <br />
              &quot;알고리즘 과제 2번까지 풀었어&quot;
            </p>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex w-full justify-end">
              <span style={{ ...bubbleUserBase, maxWidth: userMax, alignSelf: 'flex-end' }}>{m.text}</span>
            </div>
          ) : (
            <div key={i} className="flex w-full flex-col items-start gap-1.5">
              <p style={{ ...textAi, maxWidth: aiMax }}>{m.text}</p>
              {m.pendingDelete ? (
                <div
                  className="flex shrink-0 flex-wrap gap-2 pt-0.5"
                  data-pending-delete={m.pendingDelete.targetSubtaskId}
                >
                  <button
                    type="button"
                    disabled={api.isLoading}
                    onClick={() =>
                      void api.confirmPendingDelete(i, m.pendingDelete!.targetSubtaskId)
                    }
                    className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[12px] font-medium text-red-800 hover:bg-red-100 disabled:opacity-40"
                  >
                    삭제 확인
                  </button>
                  <button
                    type="button"
                    disabled={api.isLoading}
                    onClick={() => api.cancelPendingDelete(i)}
                    className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  >
                    취소
                  </button>
                </div>
              ) : null}
            </div>
          ),
        )}
        {isLoading && (
          <div className="flex w-full justify-start">
            <p style={{ ...textAi, maxWidth: aiMax }}>분석 중...</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 space-y-2 overflow-y-auto py-1.5"
      style={{ colorScheme: 'light' }}
    >
      {messages.map((m, i) =>
        m.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <span style={{ ...bubbleUserBase, maxWidth: userMax }}>{m.text}</span>
          </div>
        ) : (
          <div key={i} className="flex flex-col items-start gap-1.5">
            <p style={{ ...textAi, maxWidth: aiMax }}>{m.text}</p>
            {m.pendingDelete ? (
              <div
                className="flex shrink-0 flex-wrap gap-2 pt-0.5"
                data-pending-delete={m.pendingDelete.targetSubtaskId}
              >
                <button
                  type="button"
                  disabled={api.isLoading}
                  onClick={() =>
                    void api.confirmPendingDelete(i, m.pendingDelete!.targetSubtaskId)
                  }
                  className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[12px] font-medium text-red-800 hover:bg-red-100 disabled:opacity-40"
                >
                  삭제 확인
                </button>
                <button
                  type="button"
                  disabled={api.isLoading}
                  onClick={() => api.cancelPendingDelete(i)}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  취소
                </button>
              </div>
            ) : null}
          </div>
        ),
      )}
      {isLoading && (
        <div className="flex justify-start">
          <p style={{ ...textAi, maxWidth: aiMax }}>분석 중...</p>
        </div>
      )}
    </div>
  )
}

export function ChatInputRowMobile({ api }: { api: ChatProgressApi }) {
  const { input, setInput, send, isLoading, hasMessages, phIndex, inputRef } = api
  return (
    <div
      className={`flex items-center gap-2 ${hasMessages ? 'border-t border-solid border-[#e5e7eb]' : ''}`}
      style={{ height: '32px', minHeight: '32px', flexShrink: 0 }}
    >
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && void send()}
        placeholder={PLACEHOLDERS[phIndex]}
        disabled={isLoading}
        className="min-w-0 flex-1 px-3 text-[13px] text-gray-900 placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-50"
        style={{
          height: '100%',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          color: '#111827',
          colorScheme: 'light',
        }}
      />
      <button
        type="button"
        onClick={() => void send()}
        disabled={!input.trim() || isLoading}
        className="text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-30"
        style={{ flexShrink: 0, color: '#374151', colorScheme: 'light' }}
      >
        전송
      </button>
    </div>
  )
}

export function ChatInputRowDesktop({ api }: { api: ChatProgressApi }) {
  const { input, setInput, send, isLoading, phIndex, inputRef } = api
  return (
    <div
      className="flex shrink-0 flex-row items-center gap-2"
      style={{ borderTop: '0.5px solid #e5e7eb', padding: '10px 14px' }}
    >
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && void send()}
        placeholder={PLACEHOLDERS[phIndex]}
        disabled={isLoading}
        className="min-w-0 flex-1 text-[13px] text-gray-900 placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-50"
        style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '6px 10px',
          boxSizing: 'border-box',
          color: '#111827',
          colorScheme: 'light',
        }}
      />
      <button
        type="button"
        onClick={() => void send()}
        disabled={!input.trim() || isLoading}
        className="text-[13px] font-medium text-gray-700 transition-colors hover:opacity-80 disabled:opacity-30"
        style={{ fontWeight: 500 }}
      >
        전송
      </button>
    </div>
  )
}

function formatNoteDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
}

export function DesktopProgressSidebar({
  api,
  activeCardId,
  notesReloadVersion = 0,
  onOpenUpload,
}: {
  api: ChatProgressApi
  activeCardId: string | null
  /** 메모 저장 시 증가시켜 목록 갱신 */
  notesReloadVersion?: number
  onOpenUpload: () => void
}) {
  const [mode, setMode] = useState<'chat' | 'memo'>('chat')
  const [notes, setNotes] = useState<Note[]>([])

  const loadNotes = useCallback(async () => {
    if (!activeCardId) return
    try {
      const res = await fetch(`/api/notes?cardId=${encodeURIComponent(activeCardId)}`)
      if (!res.ok) return
      const data = (await res.json()) as { notes?: Note[] }
      setNotes(Array.isArray(data.notes) ? data.notes : [])
    } catch {
      /* ignore */
    }
  }, [activeCardId])

  useEffect(() => {
    if (!activeCardId) {
      setMode('chat')
    }
  }, [activeCardId])

  useEffect(() => {
    if (mode === 'memo' && activeCardId) {
      void loadNotes()
    }
  }, [mode, activeCardId, loadNotes, notesReloadVersion])

  const scrollRefMemo = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRefMemo.current
    if (el && mode === 'memo') el.scrollTop = 0
  }, [mode, notes])

  const deleteNote = async (noteId: string) => {
    const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
    if (res.ok) setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  return (
    <aside
      className="sm-desktop-sidebar min-h-0 w-96 shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white"
      style={{ colorScheme: 'light' }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
        {mode === 'chat' ? (
          <>
            <span className="text-sm font-semibold text-gray-900">진척도 업데이트</span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={!activeCardId}
                onClick={() => setMode('memo')}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                📝 메모
              </button>
              <button
                type="button"
                onClick={onOpenUpload}
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                ＋ 새 할 일
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setMode('chat')}
            className="text-sm font-medium text-gray-800 hover:text-gray-900"
          >
            ← 채팅
          </button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {mode === 'chat' ? (
          <ChatMessageList api={api} variant="desktop" />
        ) : (
          <div
            ref={scrollRefMemo}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
            style={{ padding: '12px 14px', colorScheme: 'light' }}
          >
            {notes.length === 0 ? (
              <p className="text-center text-sm text-gray-400">
                아직 메모가 없어요. 채팅창에서 기록하면 여기에 나타나요.
              </p>
            ) : (
              notes.map(n => (
                <div
                  key={n.id}
                  className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-[13px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {formatNoteDate(n.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void deleteNote(n.id)}
                      className="shrink-0 text-base leading-none text-gray-400 hover:text-red-600"
                      aria-label="메모 삭제"
                    >
                      🗑️
                    </button>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-gray-800">{n.content}</p>
                </div>
              ))
            )}
          </div>
        )}
        <ChatInputRowDesktop api={api} />
      </div>
    </aside>
  )
}
