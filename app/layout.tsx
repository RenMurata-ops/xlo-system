import type { Metadata } from "next";
import "./globals.css";
import MainLayout from "@/components/layout/MainLayout";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "XLO System - Twitter Automation",
  description: "Advanced Twitter automation and management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased font-sans">
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          closeButton
          duration={4000}
        />
        <MainLayout>
          {children}
        </MainLayout>
      </body>
    </html>
  );
}
