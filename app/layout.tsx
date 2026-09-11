import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '碎光 · 互动生命',
  description: '慢慢靠近，看看它会如何回应。一个由动作驱动的碎光生命原型。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
