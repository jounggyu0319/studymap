'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export default function Header({ user }: { user: User }) {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-[#e5e7eb] bg-white px-6">
      <span className="font-bold text-gray-900">스터디맵</span>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">
          {user.user_metadata?.full_name ?? user.email}
        </span>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          로그아웃
        </button>
      </div>
    </header>
  )
}
