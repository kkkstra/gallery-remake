import type { Metadata } from "next";
import "./globals.css";
import { PreferencesProvider } from "@/components/PreferencesProvider";

export const metadata: Metadata = {
  title: "林远 · 个人摄影作品集 | Lin Yuan Photography",
  description: "记录自然尺幅、城市暮色与行旅瞬间。",
};

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('gallery-theme-manual');
    var theme = (saved === 'dark' || saved === 'light')
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh selection:bg-zinc-800 selection:text-white">
        <PreferencesProvider>{children}</PreferencesProvider>
      </body>
    </html>
  );
}
