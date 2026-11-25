import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwRegister from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "出門精算師 ReadyGo",
  description: "化妝及出門分段計時器：語音報時、螢幕常亮、緊急壓縮，唔再遲到。",
  manifest: "/manifest.json",
  applicationName: "ReadyGo",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ReadyGo" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-HK">
      <body className="antialiased">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
