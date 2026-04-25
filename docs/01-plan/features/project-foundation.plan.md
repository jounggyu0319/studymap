# project-foundation Planning Document

> **Summary**: Next.js + Supabase 프로젝트 초기화, Google OAuth 인증, 기본 레이아웃 쉘 구현
>
> **Project**: 스터디맵 (StudyMap)
> **Version**: 0.1.0
> **Author**: jounggyu
> **Date**: 2026-04-26
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 새 프로젝트 시작 시 반복되는 설정 작업(인증, DB 연결, 레이아웃)이 핵심 기능 개발을 지연시킨다 |
| **Solution** | Next.js 14 App Router + Supabase Auth + Google OAuth 조합으로 인증 포함 기본 골격을 한 번에 구축 |
| **Function/UX Effect** | 로그인 → 빈 대시보드 쉘 진입 가능한 상태. 이후 모든 기능이 이 위에 쌓인다 |
| **Core Value** | "일정을 한눈에" 앱의 모든 기능이 의존하는 인증·레이아웃 토대 완성 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 핵심 기능(문서 업로드, 대시보드) 개발 전에 인증과 레이아웃 토대가 반드시 필요 |
| **WHO** | 개발자(jounggyu) — 이후 SKY 대학생 타겟 기능을 이 위에 구현 |
| **RISK** | Supabase Google OAuth 설정 오류 시 인증 전체가 막힘 |
| **SUCCESS** | localhost:3000에서 Google 로그인 → 대시보드 쉘 진입, 로그아웃 동작 확인 |
| **SCOPE** | v1 — 로컬 동작만. Vercel 배포는 다음 피처에서 |

---

## 1. Overview

### 1.1 Purpose

"일정을 한눈에" 앱의 모든 기능이 올라갈 토대를 만든다. 인증 없이 문서 업로드·대시보드 기능을 구현할 수 없으므로 최우선 구현.

### 1.2 Background

- 스택: Next.js 14 App Router + TypeScript + Tailwind CSS + Supabase
- 인증: Supabase Auth의 Google OAuth (소셜 로그인 1개만 지원, v1 범위)
- 타닥타닥 프로젝트에서 이미 Supabase + Stripe 사용 경험 있음

### 1.3 Related Documents

- 브레인스토밍: `project_brainstorm.md`
- 확정 스택: Next.js + Supabase, Vercel 배포

---

## 2. Scope

### 2.1 In Scope

- [ ] Next.js 14 프로젝트 초기화 (TypeScript + Tailwind CSS + App Router)
- [ ] Supabase 클라이언트 설정 (`@supabase/ssr`)
- [ ] Google OAuth 로그인 / 로그아웃
- [ ] 인증 미들웨어 (미인증 시 `/login`으로 리다이렉트)
- [ ] 기본 레이아웃: 헤더 + 폴더 탭 쉘 (빈 상태)
- [ ] 환경 변수 설정 (`.env.local` 템플릿)

### 2.2 Out of Scope

- Vercel 배포 (로컬 개발 완료 후 별도 진행)
- DB 스키마 설계 (문서 업로드 기능에서 진행)
- 이메일/비밀번호 로그인 (Google OAuth만)
- UI 디테일 / Figma 디자인 (다음 피처에서)
- 모바일 반응형 세부 조정

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `/login` 페이지에서 "Google로 로그인" 버튼 클릭 → OAuth 플로우 시작 | High | Pending |
| FR-02 | OAuth 콜백 처리 후 `/dashboard`로 리다이렉트 | High | Pending |
| FR-03 | 미인증 상태에서 `/dashboard` 접근 시 `/login`으로 리다이렉트 | High | Pending |
| FR-04 | 헤더에 로그인 유저 이름/아바타 표시 + 로그아웃 버튼 | Medium | Pending |
| FR-05 | 대시보드 쉘: 폴더 탭 영역 + 빈 콘텐츠 영역 렌더링 | Medium | Pending |
| FR-06 | `.env.local` 환경 변수로 Supabase URL/Key 주입 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 로그인 리다이렉트 < 500ms | 브라우저 Network 탭 |
| Security | Supabase 키 클라이언트 노출 금지 (anon key만 허용) | 코드 리뷰 |
| DX | `npm run dev` 한 번으로 로컬 실행 가능 | 직접 실행 확인 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] `npm run dev` → `localhost:3000` 정상 기동
- [ ] Google 로그인 클릭 → Google 계정 선택 → 대시보드 이동 확인
- [ ] 로그아웃 클릭 → `/login` 이동 확인
- [ ] 미인증 상태 `/dashboard` 직접 접근 → `/login` 리다이렉트 확인
- [ ] 헤더에 로그인 유저 이름 표시 확인
- [ ] TypeScript 에러 0개, ESLint 에러 0개

### 4.2 Quality Criteria

- [ ] `npm run build` 성공
- [ ] 환경 변수 `.env.local.example` 문서화

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Supabase Google OAuth 설정 오류 (Redirect URL 불일치) | High | Medium | Supabase 대시보드에서 `localhost:3000/auth/callback` 허용 설정 확인 |
| Next.js 15 vs 14 API 차이 | Medium | Low | `create-next-app` 시 버전 고정 (`@14` 또는 최신 stable) |
| Supabase 계정 미생성 | High | Medium | 구현 시작 전 supabase.com 계정 + 프로젝트 생성 선행 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| 신규 프로젝트 | 전체 | 없던 것에서 새로 생성 — 기존 코드 없음 |

### 6.2 Current Consumers

신규 프로젝트이므로 기존 소비자 없음.

### 6.3 Verification

- [ ] 신규 프로젝트 — 기존 코드 영향 없음

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Selected |
|-------|-----------------|:--------:|
| **Starter** | 단순 구조 | ☐ |
| **Dynamic** | 기능 기반 모듈, BaaS 연동 | ☑ |
| **Enterprise** | 엄격한 레이어 분리 | ☐ |

→ **Dynamic** 선택: Next.js + Supabase BaaS 조합의 표준 구조

### 7.2 Key Architectural Decisions

| Decision | Selected | Rationale |
|----------|----------|-----------|
| Framework | Next.js 14 App Router | 브레인스토밍 확정 사항 |
| Auth | Supabase Auth + `@supabase/ssr` | 서버 컴포넌트 + 미들웨어 지원 |
| Styling | Tailwind CSS | 브레인스토밍 확정 사항 |
| State Management | React Context (최소) | 인증 상태만 전역 — 과도한 추상화 방지 |
| 폴더 구조 | `src/app/`, `src/components/`, `src/lib/` | Dynamic 레벨 기본 |

### 7.3 폴더 구조 Preview

```
iljeong-hanuneye/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/
│   │   │   └── dashboard/page.tsx
│   │   ├── auth/callback/route.ts
│   │   └── layout.tsx
│   ├── components/
│   │   ├── layout/Header.tsx
│   │   └── layout/FolderTabs.tsx
│   └── lib/
│       └── supabase/
│           ├── client.ts
│           ├── server.ts
│           └── middleware.ts
├── middleware.ts
├── .env.local          (gitignore)
├── .env.local.example
└── CLAUDE.md
```

---

## 8. Convention Prerequisites

### 8.1 Conventions to Define

| Category | Rule |
|----------|------|
| 컴포넌트 파일명 | PascalCase (`Header.tsx`) |
| 페이지 파일 | `page.tsx` (Next.js 규칙) |
| 유틸/훅 | camelCase (`useAuth.ts`) |
| 환경 변수 | `NEXT_PUBLIC_` 접두사는 클라이언트 노출 변수만 |
| 주석 언어 | 한국어 |

### 8.2 Environment Variables Needed

| Variable | Purpose | Scope |
|----------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 | Client |
| `ANTHROPIC_API_KEY` | Claude API (다음 피처 준비) | Server |

---

## 9. 구현 전 선행 작업 (개발자 직접 수행)

> Claude Code가 코드를 짜기 전에 아래 두 가지를 직접 완료해주세요.

### Step 1 — Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) → 로그인 (GitHub 계정 사용 가능)
2. "New project" 클릭 → 프로젝트 이름: `studymap`
3. **Settings → API**에서 `Project URL`과 `anon public` 키 복사해두기
4. **Authentication → Providers → Google** 활성화
   - Google Cloud Console에서 OAuth 앱 생성 필요 (Supabase가 가이드 링크 제공)
   - Redirect URL: `https://<your-project>.supabase.co/auth/v1/callback`

### Step 2 — .env.local 작성

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxx...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 10. Next Steps

1. [ ] Supabase 프로젝트 생성 + Google OAuth 설정 (개발자 직접)
2. [ ] `.env.local` 작성
3. [ ] `/pdca design project-foundation` 실행
4. [ ] `/pdca do project-foundation` 실행 (Next.js 초기화 + 구현)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-26 | Initial draft | jounggyu |
