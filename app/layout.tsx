import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '워크플로우 | 팀 업무관리',
    template: '%s | 워크플로우',
  },
  description: '팀의 업무를 등록하고 우선순위, 담당자, 마감일과 진행 상태를 한눈에 관리하세요.',
  applicationName: '워크플로우',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    title: '워크플로우 | 팀 업무관리',
    description: '오늘의 업무를 한눈에 확인하고 팀의 진행 상황을 관리하세요.',
  },
  twitter: {
    card: 'summary_large_image',
    title: '워크플로우 | 팀 업무관리',
    description: '오늘의 업무를 한눈에 확인하고 팀의 진행 상황을 관리하세요.',
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
