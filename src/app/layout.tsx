import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { getSiteSettings } from "@/lib/queries";
import {
  resolveFaviconUrl,
  resolveSiteDescription,
  resolveSiteTitle,
} from "@/lib/site-branding";
import { PreferencesProvider } from "@/components/PreferencesProvider";
import { CommandPalette } from "@/components/CommandPalette";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings().catch(() => ({} as Record<string, string>));
  const title = resolveSiteTitle(settings);
  const description = resolveSiteDescription(settings);
  const iconUrl = resolveFaviconUrl(settings);
  const rawSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || settings.siteUrl || "").trim();
  let metadataBase: URL | undefined;
  if (rawSiteUrl) {
    try {
      metadataBase = new URL(rawSiteUrl);
    } catch {
      // ignore invalid URL
    }
  }

  return {
    metadataBase,
    title,
    description,
    icons: {
      icon: [{ url: iconUrl }],
      shortcut: [iconUrl],
      apple: [{ url: iconUrl }],
    },
    openGraph: {
      title,
      description,
      siteName: title,
    },
    alternates: {
      types: {
        "application/rss+xml": "/feed.xml",
      },
    },
  };
}

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
