import type { Metadata } from 'next';
import './globals.css';

const siteUrl = new URL('https://workflow-team-board.dleorbs10.chatgpt.site');

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: '팜로그 | 스마트팜 통합 관리대장',
    template: '%s | 팜로그',
  },
  description: '사업·농가·장비·구독·입금·A/S와 업무 히스토리를 한곳에서 관리하세요.',
  applicationName: '팜로그',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: siteUrl,
    title: '팜로그 | 스마트팜 통합 관리대장',
    description: '사업·농가·장비·구독·입금·A/S와 전체 처리 이력을 한눈에 확인하세요.',
    images: [
      {
        url: new URL('/og.png', siteUrl),
        width: 1731,
        height: 908,
        alt: '팜로그 — 사업·농가·구독·A/S를 한곳에서',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '팜로그 | 스마트팜 통합 관리대장',
    description: '사업·농가·장비·구독·입금·A/S와 전체 처리 이력을 한눈에 확인하세요.',
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
