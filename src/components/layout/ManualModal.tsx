'use client'

import { useEffect, useState } from 'react'

type ManualModalProps = {
  open: boolean
  onClose: () => void
}

export default function ManualModal({ open, onClose }: ManualModalProps) {
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (open) setDetailOpen(false)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="manual-modal-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-[600px] overflow-y-auto rounded-lg bg-white px-6 py-10 shadow-xl"
        onClick={e => e.stopPropagation()}
        style={{ colorScheme: 'light' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-xl leading-none text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          aria-label="닫기"
        >
          ✕
        </button>

        <h1 id="manual-modal-title" className="pr-10 text-xl font-bold text-gray-900">
          한눈 사용 설명서
        </h1>

        <div className="mt-6 space-y-4 text-sm text-gray-600">
          <h2 className="text-sm font-semibold text-gray-900">[3줄 요약]</h2>
          <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
            <li>
              강의계획서·과제 공지를 업로드하면 할 일 카드가 자동으로 만들어집니다.
            </li>
            <li>
              채팅창에 오늘 한 것을 말하거나 체크박스를 눌러 진척도를 업데이트하세요.
            </li>
            <li>마감일과 남은 양을 기준으로 우선순위가 자동 정렬됩니다.</li>
          </ol>

          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setDetailOpen(v => !v)}
              aria-expanded={detailOpen}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
            >
              <span>[자세한 사용법 — 토글로 접기/펼치기]</span>
              <span className="shrink-0 text-xs font-normal text-gray-500" aria-hidden>
                {detailOpen ? '접기' : '펼치기'}
              </span>
            </button>

            {detailOpen ? (
              <div className="mt-3 space-y-5 pb-2 pl-0 text-sm leading-relaxed text-gray-600">
                <section>
                  <h3 className="font-semibold text-gray-900">1. 할 일 카드 만들기</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>우측 상단 + 새 할 일 버튼 클릭</li>
                    <li>
                      문서 유형 선택: 강의계획서 / 과제·공지 / 목표
                    </li>
                    <li>파일 업로드 → AI가 자동으로 카드와 서브태스크 생성</li>
                    <li>
                      강의계획서는 중간고사·기말고사 카드로 분리되고, 시험 범위 주차별
                      복습 항목이 자동 생성됩니다.
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900">2. 진척도 업데이트</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>
                      채팅 입력: &quot;재료역학 3강 절반 했어&quot; 처럼 자연어로 입력
                    </li>
                    <li>
                      체크박스 클릭: 카드 상세에서 완료한 항목 직접 체크 (다시 클릭하면
                      취소)
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900">3. 서브태스크 추가·삭제</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>추가: 채팅창에 &quot;9주차 과제 추가해&quot; 입력</li>
                    <li>삭제: 채팅창에 &quot;삭제해&quot; 입력 → 확인 버튼으로 최종 삭제</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900">4. 우선순위 확인</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>
                      대시보드 상단 우선순위 섹션에 마감 임박·진척도 낮은 카드 자동 표시
                    </li>
                    <li>D-3 이내 / 이번 주 / 전체 탭으로 필터 가능</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900">5. 메모</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>카드 상세에서 📝 메모 탭 클릭</li>
                    <li>
                      채팅창에 &quot;나중에 다시 보기 메모해&quot; 입력 → 해당 카드 메모에 저장
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900">6. 앱으로 설치하기</h3>
                  <p className="mt-2">
                    한눈은 웹앱이지만 홈 화면이나 독에 추가해 앱처럼 사용할 수 있습니다.
                  </p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="font-semibold text-gray-900">iPhone / iPad (iOS)</p>
                      <p className="mt-1">
                        사파리에서 열기 → 하단 공유 버튼(□↑) → &quot;홈 화면에 추가&quot;
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Android</p>
                      <p className="mt-1">
                        크롬에서 열기 → 우측 상단 ⋮ → &quot;홈 화면에 추가&quot; 또는 &quot;앱
                        설치&quot;
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Mac (macOS)</p>
                      <p className="mt-1">
                        사파리에서 열기 → 상단 메뉴 파일 → &quot;독에 추가&quot;
                      </p>
                      <p className="mt-1">
                        또는 크롬에서 열기 → 주소창 우측 설치 아이콘(⊕) 클릭
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Windows</p>
                      <p className="mt-1">
                        크롬 또는 엣지에서 열기 → 주소창 우측 설치 아이콘(⊕) 클릭 →
                        &quot;설치&quot;
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
