import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "스터디맵",
  description: "할 일을 자동으로 정리해드립니다",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <a
          href="https://open.kakao.com/o/sQ8zznsi"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-4 right-4 z-[100] text-xs text-gray-400 transition-colors hover:text-gray-600"
        >
          🐛 오류 제보
        </a>
      </body>
    </html>
  );
}
