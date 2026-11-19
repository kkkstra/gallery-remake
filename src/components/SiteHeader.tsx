"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Globe, Menu, Moon, Search, Sun, X } from "lucide-react";
import { ViewLink } from "./ViewLink";
import { openCommandPalette } from "./CommandPalette";
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
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const useGlassSurface = scrolled || mobileOpen;
  const isHeroTransparent = overlay && !useGlassSurface;

  const navItems = [
    { href: "/", zh: "精选", en: "Featured" },
    { href: "/gallery", zh: "相册", en: "Gallery" },
    { href: "/collections", zh: "影集", en: "Series" },
    { href: "/map", zh: "地图", en: "Map" },
    { href: "/about", zh: "关于", en: "About" },
  ];

  return (
    <header
      className={`${overlay ? "fixed inset-x-0 top-0" : "sticky top-0"} z-30 pt-[env(safe-area-inset-top)] transition-all duration-300 ${
        useGlassSurface
          ? "header-material text-[var(--fg)]"
          : overlay
          ? "bg-transparent text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.38)]"
          : "bg-transparent text-[var(--fg)]"
      }`}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3.5 sm:px-9 sm:py-4">
        <ViewLink
          href="/"
          className={`text-lg sm:text-xl tracking-[0.16em] font-semibold hover:opacity-80 transition shrink-0 ${
            isHeroTransparent ? "text-white" : "text-[var(--fg)]"
          }`}
        >
          {pick(photographerName, photographerNameEn)}
        </ViewLink>

        <div className="flex items-center gap-2 sm:gap-6 md:gap-8">
          {/* Desktop Horizontal Nav */}
          <nav className="hidden md:flex items-center gap-7 text-base">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <ViewLink
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap pb-1 transition ${
                    isHeroTransparent
                      ? active
                        ? "text-white border-b-2 border-white font-medium"
                        : "text-white/75 hover:text-white"
                      : active
                      ? "text-[var(--fg)] border-b-2 border-[var(--fg)] font-medium"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  {locale === "en" ? item.en : item.zh}
                </ViewLink>
              );
            })}
          </nav>

          {/* Actions + Mobile Menu Button */}
          <div
            className={`flex items-center gap-1 sm:gap-2.5 md:border-l md:pl-4 text-sm ${
              isHeroTransparent ? "md:border-white/25 text-white/90" : "md:border-[var(--border)] text-[var(--fg-muted)]"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openCommandPalette();
              }}
              aria-label={locale === "en" ? "Search (⌘K)" : "搜索 (⌘K)"}
              title={locale === "en" ? "Search (⌘K)" : "搜索 (⌘K)"}
              className={`flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full transition cursor-pointer ${
                isHeroTransparent ? "hover:bg-white/15 hover:text-white" : "hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]"
              }`}
            >
              <Search className="h-[17px] w-[17px]" />
            </button>

            <button
              type="button"
              onClick={toggleLocale}
              className={`inline-flex h-9 sm:h-8 items-center gap-1 px-2 sm:px-1.5 transition cursor-pointer ${
                isHeroTransparent ? "hover:text-white" : "hover:text-[var(--fg)]"
              }`}
              aria-label="切换中英文"
              title="切换语言 / Switch Language"
            >
              <Globe className="h-4 w-4" />
              <span className="text-xs sm:text-sm">{locale === "zh" ? "EN" : "中"}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="切换明暗主题"
              title={theme === "dark" ? "切换为浅色模式" : "切换为深色模式"}
              className={`flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full transition cursor-pointer ${
                isHeroTransparent ? "hover:bg-white/15 hover:text-white" : "hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]"
              }`}
            >
              {theme === "dark" ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "收起菜单" : "展开菜单"}
              aria-expanded={mobileOpen}
              className={`flex md:hidden h-9 w-9 items-center justify-center rounded-full transition cursor-pointer ${
                isHeroTransparent ? "hover:bg-white/15 text-white" : "hover:bg-[var(--bg-subtle)] text-[var(--fg)]"
              }`}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Flush Frosted Glass Navigation Sheet */}
      <div
        className={`grid md:hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          mobileOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
        }`}
      >
        <nav className="overflow-hidden">
          <div className="flex flex-col border-t border-[var(--border)] px-4 py-2">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <ViewLink
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between py-3 text-[15px] transition ${
                    active
                      ? "font-semibold text-[var(--fg)]"
                      : "text-[var(--fg-muted)] active:text-[var(--fg)]"
                  }`}
                >
                  <span>{locale === "en" ? item.en : item.zh}</span>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--fg)]" />}
                </ViewLink>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
