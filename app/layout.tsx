import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://hengzhang-finance.chenzack.chatgpt.site'),
  title: 'abc · 衡账财务流程管理',
  description: 'abc 公司收付款、审批、应收应付、人员权限与财务报表管理。',
  openGraph: {
    title: 'abc · 衡账财务流程管理',
    description: 'abc 公司收付款、审批、应收应付、人员权限与财务报表管理。',
    images: [{ url: '/og.png', width: 1680, height: 941, alt: '衡账公司财务流程管理' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'abc · 衡账财务流程管理',
    description: 'abc 公司收付款、审批、应收应付、人员权限与财务报表管理。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
