'use client'

interface Step3ConfirmProps {
  onAddMore: () => void
  onClose: () => void
}

export default function Step3Confirm({ onAddMore, onClose }: Step3ConfirmProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-12">
      <div className="text-5xl">✅</div>
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">추가 완료!</h2>
        <p className="text-sm text-gray-500">카드가 대시보드에 추가됐어요.</p>
      </div>
      <div className="w-full space-y-3 pt-4">
        <button
          type="button"
          onClick={onAddMore}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          다른 과제도 추가하기
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
        >
          대시보드로 돌아가기
        </button>
      </div>
    </div>
  )
}
