import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // 멱등성: 이미 시딩됐으면 스킵
  const { data: existing } = await supabase
    .from('cards')
    .select('id')
    .eq('user_id', user.id)
    .eq('subject', '한눈 가이드')
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ seeded: false })
  }

  const today = new Date()
  const daysLater = (n: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + n)
    return d.toISOString().split('T')[0]
  }

  const cardDefs = [
    {
      title: '카드 열고 서브태스크 체크해봐',
      due_date: daysLater(1),
      subtasks: [
        '이 카드를 클릭해봐 → 오른쪽에 상세 보기가 열려',
        '서브태스크 체크박스 클릭 → 완료 처리돼',
        '다시 클릭하면 취소, 채팅창에 \'1번 완료\'라고 입력해도 돼',
        '서브태스크 전부 완료하면 카드가 ✅ 완료 폴더로 자동 이동해',
      ],
    },
    {
      title: '메모 남기고 설정도 둘러봐',
      due_date: daysLater(5),
      subtasks: [
        '채팅창 상단 \'메모\' 버튼 눌러봐 (모바일은 카드 하단)',
        '채팅창에 내용 입력하면 메모로 저장돼',
        '우상단 ⚙️ → 설명서 · 피드백 · 로그아웃',
      ],
    },
    {
      title: '색깔이랑 파일 업로드 알아봐',
      due_date: daysLater(10),
      subtasks: [
        '왼쪽 막대 빨강 = D-3 이내 / 노랑 = D-7 이내 / 초록 = 여유',
        '우상단 + 버튼으로 파일 올리면 AI가 할 일 자동 생성',
        '강의계획서 · 과제 공지 · 문제집 모두 가능해',
      ],
    },
    {
      title: '다 익혔으면 이 카드 삭제해봐',
      due_date: daysLater(14),
      subtasks: [
        'PC: 카드에 마우스 올리면 ✕ 버튼이 나타나',
        '모바일: 카드 클릭 → 하단 \'카드 삭제\' 버튼',
        '✕ 또는 하단 버튼으로 튜토리얼 카드 전부 지워봐',
      ],
    },
  ]

  let created = 0
  for (const def of cardDefs) {
    const { data: card, error: cardErr } = await supabase
      .from('cards')
      .insert({
        user_id: user.id,
        folder_id: null,
        subject: '한눈 가이드',
        title: def.title,
        type: 'goal',
        due_date: def.due_date,
        weight: 1,
      })
      .select()
      .single()

    if (cardErr || !card) continue

    await supabase.from('subtasks').insert(
      def.subtasks.map((title, i) => ({
        card_id: card.id,
        title,
        weight: 1,
        order_index: i,
        progress: 0,
        is_done: false,
      }))
    )
    created += 1
  }

  return NextResponse.json({ seeded: created > 0 })
}
