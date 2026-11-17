"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, Moon, Sun } from "lucide-react";
import { usePreferences } from "./PreferencesProvider";

interface SiteHeaderProps {
  photographerName?: string;
  photographerNameEn?: string;
  overlay?: boolean;
}

export function SiteHeader({
  photographerName = "林远",
  photographerNameEn = "Lin Yuan",
  overlay = false,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const { locale, theme, toggleLocale, toggleTheme, pick } = usePreferences();

  const navItems = [
    { href: "/", zh: "精选", en: "Featured" },
    { href: "/gallery", zh: "相册", en: "Gallery" },
    { href: "/collections", zh: "影集", en: "Series" },
    { href: "/about", zh: "关于", en: "About" },
  ];

  return (
    <header
      className={
        overlay
          ? "absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/65 via-black/25 to-transparent text-white"
          : "sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md transition-colors"
      }
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4.5 sm:px-9">
        <Link
          href="/"
          className={`text-xl tracking-[0.16em] font-semibold hover:opacity-80 transition shrink-0 ${
            overlay ? "text-white" : "text-[var(--fg)]"
          }`}
        >
          {pick(photographerName, photographerNameEn)}
        </Link>

        <div className="flex items-center gap-6 sm:gap-8">
          <nav className="flex items-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar text-base">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap pb-1 transition ${
                    overlay
                      ? active
                        ? "text-white border-b-2 border-white font-medium"
                        : "text-white/75 hover:text-white"
                      : active
                      ? "text-[var(--fg)] border-b-2 border-[var(--fg)] font-medium"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  {locale === "en" ? item.en : item.zh}
                </Link>
              );
            })}
          </nav>

          <div
            className={`flex items-center gap-3 border-l pl-5 text-sm ${
              overlay ? "border-white/25 text-white/85" : "border-[var(--border)] text-[var(--fg-muted)]"
            }`}
          >
            <button
              type="button"
              onClick={toggleLocale}
              className={`inline-flex items-center gap-1 px-1.5 py-1 transition ${
                overlay ? "hover:text-white" : "hover:text-[var(--fg)]"
              }`}
              aria-label="切换中英文"
              title="切换语言 / Switch Language"
            >
              <Globe className="h-4 w-4" />
              <span>{locale === "zh" ? "EN" : "中"}</span>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="切换明暗主题"
              title={theme === "dark" ? "切换为浅色模式" : "切换为深色模式"}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                overlay ? "hover:bg-white/15 hover:text-white" : "hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]"
              }`}
            >
              {theme === "dark" ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
