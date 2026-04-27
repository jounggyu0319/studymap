import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { ExtractionResult, ExtractedItem } from '@/types/upload'
import type { DocumentType } from '@/types/upload'
import type { CardType } from '@/types/card'

export const runtime = 'nodejs'

const MAX_TEXT_LENGTH = 50_000
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const JSON_SCHEMA_BLOCK = `## 출력 JSON 스키마
{
  "subject": "과목명 또는 목표 요약",
  "items": [
    {
      "title": "할 일 제목",
      "type": "시험|퀴즈|과제|팀플|발표|실습|독서|보고서|기타",
      "dueDate": "YYYY-MM-DD 또는 null",
      "weight": 0.0~1.0,
      "weightReason": "근거",
      "subtasks": [ { "title": "세부 단계", "weight": 0.0~1.0 } ]
    }
  ],
  "missingInfo": ["누락 정보"],
  "confidence": 0.0~1.0
}
- 모든 items의 weight 합 = 1.0.
- subtasks weight 정규화 불필요. 단일 항목은 보통 weight 1.
- 【필수】 각 item의 subtasks는 **최소 1개**, 빈 배열 금지.
- **출력 크기:** 불필요한 반복 없이 간결하게. **항목 전체에서 subtasks 합이 40개를 넘기지 말 것** (잘리면 실패함).
- **JSON만** 출력.`

const EXTRACT_PROMPT_SYLLABUS = `당신은 **강의계획서**만 분석합니다. 학생의 시험 준비용 **중간고사·기말고사** 정보**만** 추출합니다.

${JSON_SCHEMA_BLOCK}

## syllabus 전용 규칙 (엄격)
- **추출 허용:** 문서에 명시된 **중간고사·기말고사**(또는 동일한 명칭의 대면/온라인 **시험 일정**)와 그 **시험 범위**만.
- **절대 추출 금지:** 출석·결석·참여, **과제·퀴즈·발표·팀플·보고서·토론·실습 제출**, 수업 진행 방식만 설명한 항목.

## 【필수】 강의계획서 = 서브태스크는 **주차 단위**(단, **무조건 15등분 금지**)
- **주차별**이란: 표현 형식을 주차 한 줄씩 쓴다는 뜻이지, 학기 **전 주차를 기계적으로 전부** 넣으라는 뜻이 **아님**.
- 각 시험 카드의 subtasks에는 **그 시험(중간 또는 기말)을 준비할 때 실제로 복습·정리해야 할 주차만** 넣는다. **해당 시험과 무관한 주·다른 시험 전용 주는 제외**한다.
- **금지:** 「N~M주 통합 복습」처럼 여러 주를 한 줄로 합치기. 예외는 **범위가 문서상 1주뿐**일 때뿐.
- 각 서브태스크 **title** 형식: \`N주차 — {해당 주 강의 주제}\` (주차표에 있으면 반영). 주제가 없으면 \`N주차 복습\`.
- **정규 학기:** 보통 **15·16주** 과정, 문서의 **최대 주차**를 따름.
- **계절학기:** 문서에 찍힌 **1~K주차**를 기준으로 동일 규칙(압축 일정).

## 【필수】 기말 카드 vs 중간 카드 — **섞지 말 것 (AI가 문맥으로 판단)**
- **item.title이 기말고사·Final·기말시험** 등 **기말**이면, 그 카드의 subtasks에서 **반드시 제외:**
  - 주차표/본문에 **중간고사·Midterm·중간시험·중간 범위**가 **그 주의 본질**인 주(시험 당일·중간 정리 주 등).
  - **기말 범위 문구가 「8~15주」처럼 숫자만** 있어도, **8주차 칸이 실제로는 중간고사**면 → 기말 subtasks에 **넣지 말 것**. 숫자 구간을 맹목적으로 따르지 말고 **주차별 활동 내용**을 읽고 **기말 준비에 해당하는 첫 주부터** 끝 주까지만 넣는다.
- **item.title이 중간고사**면 대칭적으로 **기말·Final 대비·기말 범위** 전용 주는 넣지 않는다.
- **사용자 메모**에 「기말만」「Final only」 등이 있으면 **기말 카드만** items에 두고, 그 카드 subtasks는 위 **기말 전용** 규칙을 **엄격히** 적용한다.

## 주차 표의 ‘거를 것’ — **휴리스틱 알고리즘보다 문맥 판단**
- **특강·초청강연·대체·보강·휴강·OT·수업 개요만·시험 설명(범위 안내)만**인 주는, **그 시험의 실질 학습 단원과 무관하면** subtasks에서 **빼거나**, 인접한 본수업 주와 **한 줄로 합치지 말고** 생략해도 됨(문서에 따라 **합리적으로** 선택).
- **과제 설명 주**만 있고 시험 범위 단원이 아니면 기말/중간 **복습 단계**에서는 생략 가능(단, 그 주가 시험 범위 문서에 **명시적으로 포함**되면 포함).

## 시험 범위와 주차 매칭
- 문서에 **기말/중간 범위**가 숫자·단원으로 적혀 있으면 그에 맞추되, 위 **「다른 시험 주 제외」**를 **우선** 적용한다.
- 범위 문구가 없으면: **중간 이후·기말 이전** 경계를 주차표와 시험 주차 표기로 **추론**해, **기말 카드 = 중간이 끝난 뒤의 본격 단원 주들**만 주차별로 나열한다.
- **정말 단서가 없으면** items 비우기 또는 missingInfo — **1~15주 전부**를 기말에 넣지 말 것.
- 사용자 메모에 **「기말만」「중간만」** 등이 있으면 해당 시험 카드만 items.
- **시험 일정이 문서에 없으면** items [] + missingInfo.
- 시험 **dueDate**: 있으면 YYYY-MM-DD, 없으면 null.
- PPT·강·챕터는 해당 **주** 서브태스크 title에 짧게 병기 가능.`

const EXTRACT_PROMPT_ASSIGNMENT = `당신은 학생의 **과제 공지·안내문·시험·퀴즈 공지**를 읽고 **실제로 해야 할 일**만 JSON으로 추출합니다.

${JSON_SCHEMA_BLOCK}
- 단, 정말 쪼갤 단서가 없을 때만 「{제목} 범위 학습·정리」 **한 줄**만 허용.

## 과제·공지 — **한 과제 = 카드 1개** (문제 번호는 서브태스크)
- **Assignment #1**, **Homework 2**, **Problem Set 3**처럼 **하나의 제출물** 안에 **문제 1, 2, 3…** 또는 **1. 2. 3.** 목록이 있으면 → **items에는 카드 1개만** 넣을 것.
- 그 카드의 **title**: \`{과목명} - {과제명}\` 형태 (예: "Mechanics of Materials - Assignment #1", "경제통계학 - 1차 과제").
- **subtasks**: 각 문제를 한 줄씩 — 예: "Problem 1", "Problem 2", "문항 1", "2번" 등 문서 표기에 맞춤. weight는 보통 각 1.
- **금지:** 같은 마감일·같은 과제 묶음인데 문제마다 **별도 item(별도 카드)** 로 쪼개기.
- **예외 — 별도 카드로 분리:** **서로 다른 과제**(Assignment #1 vs #2)이거나 **마감일이 명확히 다름** → item을 나눔.
- 회차만 다르고 각각 마감이 정해진 **주차별 HW** 등은 기존처럼 item 여러 개 가능.

## items에 넣지 말 것 — 정책·행정
- **출석**, 결석·지각, 수업 참석률, F/U 조건만 있는 블록 → item 금지.
- 주차별 **강의 목차만** 있고 시험/과제/퀴즈로 확정되지 않은 루틴 → item 금지.

## 시험·퀴즈 범위 → subtasks 분할
- **전제:** 아래는 **시험/퀴즈 공지에 적힌 범위**가 있을 때만 적용. **강의계획서 PDF 전체**를 올렸다면, 표에 있는 **모든 주차 주제**를 시험 서브태스크로 **복사하지 말 것**(syllabus 유형과 동일: 범위가 문서에 **명시된 경우**만 주차/단원 분할).
- 주차 구간이 **시험 범위로 명시**되어 있으면 그 구간만 **주차마다** 서브태스크 1개.
- 괄호·쉼표로 단원이 나열되면 **단원마다** 1개.
- **금지:** 한 서브태스크에 전 범위를 모두 나열. **금지:** 「기말」「Final」 카드 하나에 수업 1~15주 전체를 서브태스크로 채우기.

## Problem set / homework (회차별)
- **다른 회차·다른 마감**이면 item 분리.
- 같은 회차 안의 문제 번호만 있으면 위 「한 과제 = 카드 1개」 규칙 적용.

## PPT·강·챕터
- 여러 번호를 한 서브태스크로 묶지 말 것. 번호마다 분리.`

const EXTRACT_PROMPT_GOAL = `학생이 적은 **자유 목표·기간**을 읽고, 달성을 위한 **단계형 할 일**을 JSON으로 만듭니다.

${JSON_SCHEMA_BLOCK}

## goal 전용 규칙
- 마감일이 텍스트에 없어도 됨 (dueDate null 허용). 기간이 명시되면 가능한 경우 YYYY-MM-DD로 추론.
- **subject:** 목표를 한 줄로 요약 (예: "토익 900", "예나 생일 준비").
- **type:** 주로 **기타** 또는 **실습**.

## 【필수】 카드 1개 원칙 (items)
- 사용자가 **하나의 목표 이름**(예: "예나 생일 준비") 아래에 세부 항목을 나열(쉼표·줄바꿈·불릿·「-」 등)한 경우 → **items에는 카드 1개만**.
- 그 **한 카드**의 **title**은 그 **목표 이름**(또는 문서 제목에 가장 가까운 한 줄).
- 나열된 세부 항목은 **전부 그 카드의 subtasks**에만 넣을 것. **절대** 세부 항목마다 별도 item(별도 카드)을 만들지 말 것.
- **올바른 예:** 입력 "예나 생일 준비 - 장보기, 이벤트 준비, 선물 사기" → items 1개: title=\`예나 생일 준비\`, subtasks 제목은 \`장보기\`, \`이벤트 준비\`, \`선물 사기\`(사용자 표현 유지).
- **틀린 예:** "장보기" 카드 + "이벤트 준비" 카드 + "선물 사기" 카드 3개로 분리 → **금지**.

## 서브태스크: 사용자 나열 우선
- 사용자가 **직접 나열한** 세부 항목이 있으면 → subtasks 제목은 **그 문구를 그대로**(뜻만 같으면 되고, 불필요한 재작성·합치기·AI 임의 확장 금지).
- **논리적 단계 추론·확장**(예: 토익을 LC/RC/모의고사로 쪼개기, 포트폴리오를 기획/디자인/개발으로 나누기)은 **오직** 사용자가 **목표 이름·기간만 적고 세부 항목을 나열하지 않았을 때**만 적용.
- 목표만 있고 단서가 거의 없으면 합리적으로 단계를 **추론**해 subtasks를 채움(기존과 동일).
- **서로 무관한 목표가 문서에 여러 개** 명시된 경우에만 items를 여러 개(각각 다른 title). 일반적으로 1~3개.

- **JSON만** 출력.`

function extractPromptFor(doc: DocumentType): string {
  if (doc === 'syllabus') return EXTRACT_PROMPT_SYLLABUS
  if (doc === 'goal') return EXTRACT_PROMPT_GOAL
  return EXTRACT_PROMPT_ASSIGNMENT
}

/** AI에 넣는 오늘 기준 — 연도 없는 dueDate를 '가장 가까운 미래'로 맞춤 */
function buildReferenceDateBlock(): string {
  const now = new Date()
  const y = now.getFullYear()
  const mo = now.getMonth() + 1
  const d = now.getDate()
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const wk = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()]
  return `## 기준일·마감일 규칙 (필수)
- **오늘**: ${y}년 ${mo}월 ${d}일 (${wk}요일), ISO 날짜 \`${iso}\` (서버 로컬 달력 기준).
- 모든 **dueDate**는 반드시 \`YYYY-MM-DD\` 또는 null.
- 문서에 **연도가 없는** 날짜(예: \`Mar 30\`, \`Mar 30th\`, \`3/30\`, \`3월 30일\`)는 **오늘(\`${iso}\`) 이후**에 처음 도래하는 그 월·일로 해석.
  - 올해 해당 월일이 **아직 안 지났으면** 올해.
  - **이미 지났으면** 다음 해 동일 월일.
- 예: 오늘이 \`2026-04-27\`이면 \`Mar 30\` → \`2027-03-30\`. 오늘이 \`2026-02-10\`이면 \`Mar 30\` → \`2026-03-30\`.
- **금지:** 연도 없다고 임의의 과거 연도(예: 2023)를 붙여 D-day가 수백 일 어긋나게 하기.`
}

function parseDocumentType(raw: string | null | undefined): DocumentType | null {
  if (raw === 'syllabus' || raw === 'goal' || raw === 'assignment') return raw
  return null
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse.js')

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer)
  return data.text
}

type AiItem = Omit<ExtractedItem, 'id' | 'hasError' | 'subtasks'> & {
  subtasks: Array<{ title: string; weight: number }>
}

/** 모델 출력에서 JSON 객체 문자열만 안전하게 추출 (앞뒤 설명·코드펜스 제거) */
function extractJsonObjectString(raw: string): string {
  let s = raw.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  if (s.startsWith('{') && s.endsWith('}')) return s
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) return s.slice(start, end + 1)
  return s
}

function addClientIds(result: Omit<ExtractionResult, 'items'> & { items: AiItem[] }): ExtractionResult {
  return {
    ...result,
    items: result.items.map(item => {
      const raw = Array.isArray(item.subtasks) ? item.subtasks : []
      const subList =
        raw.length > 0
          ? raw
          : [{ title: `${item.title} — 범위 학습·정리`, weight: 1 }]
      return {
        ...item,
        id: crypto.randomUUID(),
        hasError: !item.title,
        subtasks: subList.map(st => ({
          ...st,
          id: crypto.randomUUID(),
        })),
      }
    }),
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let text = ''
  let documentType: DocumentType | null = null

  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const rawDt = formData.get('documentType')
    documentType = parseDocumentType(typeof rawDt === 'string' ? rawDt : null)
    const file = formData.get('file') as File | null
    const pastedRaw = formData.get('text')
    const pastedText = typeof pastedRaw === 'string' ? pastedRaw : ''

    let pdfText = ''
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'PDF 파일은 10MB 이하만 가능합니다.' }, { status: 400 })
      }
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'hwp') {
        return NextResponse.json({ error: 'HWP 파일은 지원하지 않습니다. PDF로 저장하거나 텍스트를 붙여넣어 주세요.' }, { status: 400 })
      }
      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        pdfText = await extractTextFromPDF(buffer)
        if (!pdfText.trim()) {
          return NextResponse.json({ error: 'PDF에서 텍스트를 읽을 수 없어요. 텍스트를 직접 붙여넣어 주세요.' }, { status: 400 })
        }
      } catch (e) {
        console.error('[/api/extract] pdf parse error:', e)
        return NextResponse.json({ error: 'PDF에서 텍스트를 읽을 수 없어요. 텍스트를 직접 붙여넣어 주세요.' }, { status: 400 })
      }
    }

    const memo = pastedText.trim()
    if (pdfText && memo) {
      text = `${pdfText}\n\n---\n\n## 사용자 추가 메모 (PDF와 함께 제출)\n${memo}`
    } else {
      text = pdfText || memo
    }
  } else if (contentType.includes('application/json')) {
    try {
      const body = await request.json() as { text?: string; documentType?: string }
      documentType = parseDocumentType(body.documentType)
      text = typeof body.text === 'string' ? body.text : ''
    } catch {
      return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 })
    }
  }

  if (documentType === null) {
    return NextResponse.json({ error: '문서 유형을 선택해 주세요.' }, { status: 400 })
  }

  if (!text.trim()) {
    return NextResponse.json({ error: '텍스트 또는 파일을 입력해주세요.' }, { status: 400 })
  }

  if (text.length > MAX_TEXT_LENGTH) {
    text = text.slice(0, MAX_TEXT_LENGTH)
  }

  const extractPrompt = extractPromptFor(documentType)
  const userPayload = `${extractPrompt}\n\n${buildReferenceDateBlock()}\n\n---\n\n${text}`

  try {
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      console.error('[/api/extract] ANTHROPIC_API_KEY missing')
      return NextResponse.json({ error: '서버에 AI 설정이 없어요. 관리자에게 문의해 주세요.' }, { status: 500 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: userPayload,
        },
      ],
    })

    if (message.stop_reason === 'max_tokens') {
      console.warn('[/api/extract] response truncated (max_tokens)')
    }

    const textBlock = message.content.find(b => b.type === 'text')
    const raw = textBlock?.type === 'text' ? textBlock.text : ''
    if (!raw.trim()) {
      return NextResponse.json({ error: 'AI가 빈 응답을 반환했어요. 다시 시도해 주세요.' }, { status: 500 })
    }

    const jsonStr = extractJsonObjectString(raw)
    let parsed: {
      subject?: string
      items?: Array<{
        title: string
        type: CardType
        dueDate: string | null
        weight: number
        weightReason: string
        subtasks: Array<{ title: string; weight: number }>
      }>
      missingInfo?: string[]
      confidence?: number
    }
    try {
      parsed = JSON.parse(jsonStr) as typeof parsed
    } catch (parseErr) {
      console.error('[/api/extract] JSON.parse error:', parseErr, 'snippet:', jsonStr.slice(0, 400))
      return NextResponse.json(
        {
          error:
            message.stop_reason === 'max_tokens'
              ? '응답이 너무 길어 잘렸어요. 문서를 나누어 올리거나, 텍스트 일부만 붙여 넣어 다시 시도해 주세요.'
              : 'AI 응답 형식을 해석하지 못했어요. 잠시 후 다시 시도해 주세요.',
        },
        { status: 500 },
      )
    }

    if (!Array.isArray(parsed.items)) {
      return NextResponse.json({ error: 'AI 응답 형식이 올바르지 않아요.' }, { status: 500 })
    }

    const normalized = {
      subject: typeof parsed.subject === 'string' ? parsed.subject : '과목',
      items: parsed.items,
      missingInfo: Array.isArray(parsed.missingInfo) ? parsed.missingInfo : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    }

    const result = addClientIds(normalized)

    return NextResponse.json({ ...result, documentType })
  } catch (e) {
    console.error('[/api/extract] error:', e)
    let msg = 'AI 분석에 실패했어요. 잠시 후 다시 시도해주세요.'
    if (e instanceof Error) {
      const m = e.message.toLowerCase()
      if (m.includes('429') || m.includes('rate_limit')) {
        msg = '요청 한도에 걸렸어요. 잠시 후 다시 시도해 주세요.'
      } else if (m.includes('401') || m.includes('api key') || m.includes('authentication')) {
        msg = 'AI 인증에 실패했어요. 환경 설정을 확인해 주세요.'
      } else if (m.includes('overloaded') || m.includes('529')) {
        msg = 'AI 서버가 바빠요. 잠시 후 다시 시도해 주세요.'
      }
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
