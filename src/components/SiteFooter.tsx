"use client";

import { Mail, MapPin, Settings, User } from "lucide-react";
import { ViewLink } from "./ViewLink";
import { usePreferences } from "./PreferencesProvider";

interface SiteFooterProps {
  settings: Record<string, string>;
}

export function SiteFooter({ settings }: SiteFooterProps) {
  const { locale, pick } = usePreferences();

  return (
    <footer className="mx-auto w-full max-w-[1440px] px-4 pt-12 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-9 sm:pt-16 sm:pb-10 mt-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-t border-[var(--border)] pt-5 sm:pt-6 text-xs sm:text-sm text-[var(--fg-muted)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[var(--fg)] font-medium">
            © {new Date().getFullYear()} {pick(settings.photographerName || "林远", settings.photographerNameEn)}
          </span>
          {settings.baseLocation && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 opacity-70" />
              {pick(settings.baseLocation, settings.baseLocationEn)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <ViewLink href="/about" className="inline-flex items-center gap-1.5 hover:text-[var(--fg)] transition">
            <User className="h-3.5 w-3.5" />
            <span>{locale === "en" ? "About" : "关于"}</span>
          </ViewLink>
          {settings.email && (
            <a
              href={`mailto:${settings.email}`}
              className="inline-flex items-center gap-1.5 hover:text-[var(--fg)] transition"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>{settings.email}</span>
            </a>
          )}
          <ViewLink href="/admin" className="inline-flex items-center gap-1 hover:text-[var(--fg)] transition">
            <Settings className="h-3.5 w-3.5" />
            <span>{locale === "en" ? "Admin" : "后台"}</span>
          </ViewLink>
        </div>
      </div>
    </footer>
  );
}
