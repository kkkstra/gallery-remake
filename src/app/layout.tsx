import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { getSiteSettings } from "@/lib/queries";
import { PreferencesProvider } from "@/components/PreferencesProvider";
import { CommandPalette } from "@/components/CommandPalette";

export const metadata: Metadata = {
  title: "林远 · 个人摄影作品集 | Lin Yuan Photography",
  description: "记录自然尺幅、城市暮色与行旅瞬间。",
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings().catch(() => ({} as Record<string, string>));
  const copyrightGuard = settings.copyrightGuard === "true";

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh selection:bg-zinc-800 selection:text-white">
        <PreferencesProvider copyrightGuard={copyrightGuard}>
          {children}
          <CommandPalette />
        </PreferencesProvider>
      </body>
    </html>
  );
}
