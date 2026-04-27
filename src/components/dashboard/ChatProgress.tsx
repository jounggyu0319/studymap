'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type CSSProperties,
  type RefObject,
} from 'react'

const PLACEHOLDERS = [
  "예: 'IO PPT 3 봤어' 또는 '통계 책 100p 읽었어'",
  '과목명 + 내용을 구체적으로 입력하면 더 정확해요',
  "예: '마케팅 서평 서론 썼어' '경제 PPT 5 절반 함'",
]

export interface ChatMessage {
  role: 'user' | 'ai'
  text: string
}

export interface UseChatProgressOptions {
  onSubtaskProgress: (subtaskId: string, progress: number, isDone: boolean) => void
  onSubtaskRemoved?: (subtaskId: string) => void
  /** 모바일 하단 바 높이·스크롤 여백 동기화 (데스크톱에서는 생략 가능) */
  onExpandedChange?: (expanded: boolean) => void
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
}

export function useChatProgress({
  onSubtaskProgress,
  onSubtaskRemoved,
  onExpandedChange,
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

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const historySnapshot = messages.slice(-12)
    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historySnapshot,
        }),
      })
      const data = await res.json()

      if (data.error) {
        setMessages(prev => [...prev, { role: 'ai', text: data.error }])
        return
      }

      setMessages(prev => [...prev, { role: 'ai', text: data.message }])

      if (data.progressApplied && data.subtaskId != null && typeof data.progress === 'number') {
        onSubtaskProgress(data.subtaskId, data.progress, data.progress >= 100)
      }
      if (data.subtaskRemoved === true && data.subtaskId != null) {
        onSubtaskRemoved?.(data.subtaskId)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '오류가 발생했어요. 다시 시도해주세요.' }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [input, isLoading, messages, onSubtaskProgress, onSubtaskRemoved])

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
            <div key={i} className="flex w-full justify-start">
              <p style={{ ...textAi, maxWidth: aiMax }}>{m.text}</p>
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
          <div key={i} className="flex justify-start">
            <p style={{ ...textAi, maxWidth: aiMax }}>{m.text}</p>
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
