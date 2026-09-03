import type { Metadata } from 'next';
import './globals.css';

function resolveSiteUrl(value: string | undefined) {
  try {
    const url = new URL(value || 'https://evident-minutia-460301-c9.web.app');
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url
      : new URL('https://evident-minutia-460301-c9.web.app');
  } catch {
    return new URL('https://evident-minutia-460301-c9.web.app');
  }
}

const metadataBase = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: '팜로그 | 스마트팜 통합 관리대장',
    template: '%s | 팜로그',
  },
  description:
    '사업·농가·장비·구독·입금·A/S와 업무 히스토리를 한곳에서 관리하세요.',
  applicationName: '팜로그',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: metadataBase,
    title: '팜로그 | 스마트팜 통합 관리대장',
    description:
      '사업·농가·장비·구독·입금·A/S와 전체 처리 이력을 한눈에 확인하세요.',
    images: [
      {
        url: new URL('/og.png', metadataBase),
        width: 1731,
        height: 908,
        alt: '팜로그 — 사업·농가·구독·A/S를 한곳에서',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '팜로그 | 스마트팜 통합 관리대장',
    description:
      '사업·농가·장비·구독·입금·A/S와 전체 처리 이력을 한눈에 확인하세요.',
    images: [new URL('/og.png', metadataBase)],
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
