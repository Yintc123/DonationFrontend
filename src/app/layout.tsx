import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JKODonation",
  description: "捐款項目列表 — 公益團體 / 捐款專案 / 義賣商品",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-dvh flex flex-col bg-surface-page">{children}</body>
    </html>
  );
}
