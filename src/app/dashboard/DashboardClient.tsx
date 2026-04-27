'use client'

import { useMemo, useState } from 'react'
import CardTimeline from '@/components/dashboard/CardTimeline'
import UploadPanel from '@/components/upload/UploadPanel'
import {
  useChatProgress,
  ChatMessageList,
  ChatInputRowMobile,
  ChatInputRowDesktop,
} from '@/components/dashboard/ChatProgress'
import PriorityRecommendation from '@/components/PriorityRecommendation'
import type { Card, Subtask, Folder } from '@/types/card'

interface DashboardClientProps {
  initialCards: Card[]
  initialSubtasks: Subtask[]
  initialFolders: Folder[]
}

export default function DashboardClient({
  initialCards,
  initialSubtasks,
  initialFolders,
}: DashboardClientProps) {
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks)
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [folderAddOpen, setFolderAddOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [folderAddError, setFolderAddError] = useState<string | null>(null)
  const [folderAddLoading, setFolderAddLoading] = useState(false)
  const [chatExpanded, setChatExpanded] = useState(false)

  const chat = useChatProgress({
    onSubtaskProgress: (subtaskId, progress, isDone) => {
      setSubtasks(prev =>
        prev.map(st =>
          st.id === subtaskId ? { ...st, progress, isDone: isDone || progress >= 100 } : st,
        ),
      )
    },
    onSubtaskRemoved: subtaskId => {
      setSubtasks(prev => prev.filter(st => st.id !== subtaskId))
    },
    onExpandedChange: setChatExpanded,
  })

  const filteredCards = activeFolderId
    ? cards.filter(c => c.folderId === activeFolderId)
    : cards

  const scopedSubtasks = useMemo(() => {
    const ids = new Set(filteredCards.map(c => c.id))
    return subtasks.filter(s => ids.has(s.cardId))
  }, [filteredCards, subtasks])

  const handleDueDateChange = async (cardId: string, dueDate: string | null) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, dueDate } : c))
    await fetch(`/api/cards/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueDate }),
    })
  }

  const handleDelete = async (cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId))
    setSubtasks(prev => prev.filter(st => st.cardId !== cardId))
    await fetch(`/api/cards/${cardId}`, { method: 'DELETE' })
  }

  const handleCardsCreated = (newCards: Card[], newSubtasks: Subtask[] = []) => {
    setCards(prev => [...prev, ...newCards])
    setSubtasks(prev => [...prev, ...newSubtasks])
  }

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) {
      setFolderAddError('이름을 입력해주세요.')
      return
    }
    setFolderAddLoading(true)
    setFolderAddError(null)
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '폴더를 만들지 못했어요.')
      const f = data.folder as Folder
      setFolders(prev => [...prev, f].sort((a, b) => a.orderIndex - b.orderIndex))
      setActiveFolderId(f.id)
      setNewFolderName('')
      setFolderAddOpen(false)
    } catch (e) {
      setFolderAddError(e instanceof Error ? e.message : '오류가 났어요.')
    } finally {
      setFolderAddLoading(false)
    }
  }

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (
      !confirm(
        `'${folderName}' 폴더를 삭제할까요?\n카드는 삭제되지 않고 '전체'로 이동합니다.`,
      )
    ) {
      return
    }
    const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' })
    if (!res.ok) return
    setFolders(prev => prev.filter(f => f.id !== folderId))
    setCards(prev => prev.map(c => (c.folderId === folderId ? { ...c, folderId: null } : c)))
    if (activeFolderId === folderId) setActiveFolderId(null)
  }

  const mainColumn = (
    <main
      className="sm-main-col min-h-0 w-full flex-1 overflow-y-auto"
      style={{
        paddingBottom: chatExpanded ? '128px' : '68px',
        transition: 'padding-bottom 0.2s ease',
      }}
    >
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PriorityRecommendation cards={filteredCards} subtasks={scopedSubtasks} />

        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveFolderId(null)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors
                ${!activeFolderId ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-700'}`}
            >
              전체
            </button>
            {folders.map(folder => {
              const isActive = activeFolderId === folder.id
              return (
                <div
                  key={folder.id}
                  className={`group inline-flex shrink-0 items-stretch overflow-hidden rounded-xl text-sm font-medium transition-colors
                    ${isActive ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-700'}`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(folder.id)}
                    className="whitespace-nowrap px-4 py-2 text-left hover:opacity-90"
                  >
                    {folder.name}
                  </button>
                  <button
                    type="button"
                    className={`flex items-center px-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100
                      ${isActive ? 'text-white/70 hover:text-red-300' : 'text-gray-400 hover:text-red-600'}`}
                    aria-label={`${folder.name} 폴더 삭제`}
                    onClick={e => {
                      e.stopPropagation()
                      void handleDeleteFolder(folder.id, folder.name)
                    }}
                  >
                    <span aria-hidden className="text-base leading-none">
                      ✕
                    </span>
                  </button>
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => {
                setFolderAddOpen(v => !v)
                setFolderAddError(null)
              }}
              className="whitespace-nowrap rounded-xl border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50"
              aria-expanded={folderAddOpen}
            >
              + 폴더
            </button>
          </div>
          {folderAddOpen && (
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="min-w-[12rem] flex-1">
                <label htmlFor="new-folder-name" className="sr-only">
                  새 폴더 이름
                </label>
                <input
                  id="new-folder-name"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void handleCreateFolder()
                  }}
                  placeholder="예: 미적분학, 경제학원론"
                  disabled={folderAddLoading}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleCreateFolder()}
                disabled={folderAddLoading}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
              >
                {folderAddLoading ? '만드는 중…' : '만들기'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFolderAddOpen(false)
                  setFolderAddError(null)
                  setNewFolderName('')
                }}
                disabled={folderAddLoading}
                className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              >
                취소
              </button>
              {folderAddError && <p className="w-full text-sm text-red-600">{folderAddError}</p>}
            </div>
          )}
        </div>

        <CardTimeline
          cards={filteredCards}
          subtasks={subtasks}
          onDueDateChange={handleDueDateChange}
          onDelete={handleDelete}
        />
      </div>
    </main>
  )

  const desktopSidebar = (
    <aside
      className="sm-desktop-sidebar min-h-0 w-96 shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white"
      style={{ colorScheme: 'light' }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
        <span className="text-sm font-semibold text-gray-900">진척도 업데이트</span>
        <button
          type="button"
          onClick={() => setIsPanelOpen(true)}
          className="text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          ＋ 새 할 일
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatMessageList api={chat} variant="desktop" />
        <ChatInputRowDesktop api={chat} />
      </div>
    </aside>
  )

  const mobileChatChrome = (
    <>
      <div
        className="sm-mobile-chat pointer-events-auto fixed inset-x-0 bottom-0 z-50 flex w-full flex-col"
        style={{
          backgroundColor: '#ffffff',
          borderTop: '2px solid #e5e7eb',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
          height: chatExpanded ? '120px' : '60px',
          minHeight: chatExpanded ? '120px' : '60px',
          transition: 'height 0.2s ease, min-height 0.2s ease',
          colorScheme: 'light',
        }}
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col px-4" style={{ height: '100%', minHeight: 0 }}>
          <div className="flex min-h-0 w-full min-w-0 flex-col bg-transparent" style={{ height: '100%' }}>
            <ChatMessageList api={chat} variant="mobile" />
            <ChatInputRowMobile api={chat} />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsPanelOpen(true)}
        className="sm-mobile-chat pointer-events-auto fixed right-6 z-[60] rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-blue-700"
        style={{
          bottom: chatExpanded ? '130px' : '70px',
          transition: 'bottom 0.2s ease',
        }}
        aria-label="새 할 일 추가"
      >
        ＋ 새 할 일
      </button>
    </>
  )

  return (
    <>
    <style>{`
      /* 데스크탑 사이드바: 768px 미만 숨김 */
      .sm-desktop-sidebar { display: none; }
      @media (min-width: 768px) {
        .sm-desktop-sidebar { display: flex !important; }
      }
      /* 모바일 채팅: 768px 이상 숨김 */
      @media (min-width: 768px) {
        .sm-mobile-chat { display: none !important; }
      }
      /* 메인 컬럼 모바일 패딩: 768px 이상 제거 */
      @media (min-width: 768px) {
        .sm-main-col { padding-bottom: 0 !important; }
      }
    `}</style>
    <div
      className="flex w-full min-h-0 flex-1 flex-col md:flex-row md:items-stretch"
      style={{ backgroundColor: '#f3f4f6', colorScheme: 'light' }}
    >
      {mainColumn}
      {desktopSidebar}
      {mobileChatChrome}

      <UploadPanel
        isOpen={isPanelOpen}
        defaultFolderId={activeFolderId}
        folders={folders}
        onClose={() => setIsPanelOpen(false)}
        onCardsCreated={handleCardsCreated}
      />
    </div>
    </>
  )
}
