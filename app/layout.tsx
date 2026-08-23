import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '衡账 · 公司财务流程管理',
  description: '集中管理公司收付款、审批、应收应付与资金报表。',
  openGraph: {
    title: '衡账 · 公司财务流程管理',
    description: '集中管理公司收付款、审批、应收应付与资金报表。',
    images: [{ url: '/og.png', width: 1680, height: 941, alt: '衡账公司财务流程管理' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '衡账 · 公司财务流程管理',
    description: '集中管理公司收付款、审批、应收应付与资金报表。',
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
