import type { Metadata } from 'next';
import './globals.css';

const siteUrl = new URL('https://workflow-team-board.dleorbs10.chatgpt.site');

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: '사업 워크로그 | 사업별 업무·히스토리 관리',
    template: '%s | 사업 워크로그',
  },
  description: '사업별로 메일·카톡·구두 수신 내용과 업무 처리 히스토리를 한곳에서 관리하세요.',
  applicationName: '사업 워크로그',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: siteUrl,
    title: '사업 워크로그 | 사업별 업무·히스토리 관리',
    description: '사업별 수신 내용, 최신 처리 결과와 전체 업무 히스토리를 한눈에 확인하세요.',
    images: [
      {
        url: new URL('/og.png', siteUrl),
        width: 1731,
        height: 909,
        alt: '사업 워크로그 — 업무와 처리 기록을 한눈에',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '사업 워크로그 | 사업별 업무·히스토리 관리',
    description: '사업별 수신 내용, 최신 처리 결과와 전체 업무 히스토리를 한눈에 확인하세요.',
    images: [new URL('/og.png', siteUrl)],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
