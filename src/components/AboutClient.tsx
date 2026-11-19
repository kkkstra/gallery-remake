"use client";

import { useMemo } from "react";
import {
  Aperture,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  Camera,
  Compass,
  Focus,
  Frame,
  Images,
  Layers,
  Mail,
  MapPin,
} from "lucide-react";
import type { Photo } from "@/lib/db/schema";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Reveal } from "./Reveal";
import { ViewLink } from "./ViewLink";
import { usePreferences } from "./PreferencesProvider";

export interface AboutFocusItem {
  icon: string;
  title: string;
  titleEn: string;
  desc: string;
  descEn: string;
}

export interface AboutMilestoneItem {
  year: string;
  title: string;
  titleEn: string;
  place: string;
  placeEn: string;
}

interface AboutClientProps {
  settings: Record<string, string>;
  photos: Photo[];
  stats: {
    photoCount: number;
    collectionCount: number;
    locationCount: number;
  };
}

function FocusIcon({ name }: { name: string }) {
  if (name === "building") return <Building2 className="h-4 w-4 text-[var(--fg-muted)] shrink-0" />;
  if (name === "aperture") return <Aperture className="h-4 w-4 text-[var(--fg-muted)] shrink-0" />;
  if (name === "frame") return <Frame className="h-4 w-4 text-[var(--fg-muted)] shrink-0" />;
  return <Compass className="h-4 w-4 text-[var(--fg-muted)] shrink-0" />;
}

export function AboutClient({ settings, photos, stats }: AboutClientProps) {
  const { locale, pick, categoryLabel } = usePreferences();

  const name = pick(settings.photographerName || "林远", settings.photographerNameEn);
  const tagline = pick(settings.tagline || "", settings.taglineEn);
  const bio = pick(settings.bio || "", settings.bioEn);
  const baseLoc = pick(settings.baseLocation || "", settings.baseLocationEn);
  const avatarUrl = settings.avatarUrl || "/samples/avatar.jpg";
  const availableBadge = pick(settings.aboutAvailableText || "", settings.aboutAvailableTextEn);
  const contactNote = pick(settings.aboutContactNote || "", settings.aboutContactNoteEn);
  const showShootingStats = settings.showShootingStats !== "false";

  const focusAreas = useMemo<AboutFocusItem[]>(() => {
    try {
      const parsed = JSON.parse(settings.aboutFocusJson || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [settings.aboutFocusJson]);

  const milestones = useMemo<AboutMilestoneItem[]>(() => {
    try {
      const parsed = JSON.parse(settings.aboutMilestonesJson || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [settings.aboutMilestonesJson]);

  // Compute real shooting habit insights from portfolio works
  const insights = useMemo(() => {
    const focalBuckets = [
      { key: "wide", zh: "≤ 28mm 广角", en: "≤ 28mm Wide", count: 0 },
      { key: "reportage", zh: "35 – 45mm 纪实", en: "35 – 45mm Std-Wide", count: 0 },
      { key: "standard", zh: "50 – 65mm 标准", en: "50 – 65mm Standard", count: 0 },
      { key: "tele", zh: "≥ 70mm 中长焦", en: "≥ 70mm Telephoto", count: 0 },
    ];
    const camMap = new Map<string, number>();
    const catMap = new Map<string, number>();

    for (const p of photos) {
      if (p.focalMm) {
        if (p.focalMm <= 28) focalBuckets[0].count += 1;
        else if (p.focalMm <= 45) focalBuckets[1].count += 1;
        else if (p.focalMm <= 65) focalBuckets[2].count += 1;
        else focalBuckets[3].count += 1;
      }
      if (p.camera) camMap.set(p.camera, (camMap.get(p.camera) || 0) + 1);
      if (p.category) catMap.set(p.category, (catMap.get(p.category) || 0) + 1);
    }

    const maxFocal = Math.max(...focalBuckets.map((b) => b.count), 1);
    const cameras = Array.from(camMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const maxCam = Math.max(...cameras.map((c) => c[1]), 1);
    const categories = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
    const total = Math.max(photos.length, 1);

    return { focalBuckets, maxFocal, cameras, maxCam, categories, total };
  }, [photos]);

  return (
    <div className="relative min-h-dvh flex flex-col overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/4 -z-10 h-96 w-96 rounded-full bg-indigo-500/[0.035] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-72 right-1/5 -z-10 h-96 w-96 rounded-full bg-teal-500/[0.025] blur-3xl"
      />

      <SiteHeader
        photographerName={settings.photographerName}
        photographerNameEn={settings.photographerNameEn}
      />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 sm:px-9 sm:pt-14 space-y-8 sm:space-y-12">
        {/* Top Hero Profile Card */}
        <Reveal>
          <section className="surface-card flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8 rounded-xl p-5 sm:p-9">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <img
                src={avatarUrl}
                alt={name}
                className="h-24 w-24 sm:h-32 sm:w-32 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]"
              />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--fg)]">{name}</h1>
                  {availableBadge && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs text-emerald-500 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {availableBadge}
                    </span>
                  )}
                </div>
                {tagline && <p className="text-[15px] text-[var(--fg-muted)]">{tagline}</p>}
                {baseLoc && (
                  <p className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)]">
                    <MapPin className="h-4 w-4 opacity-75" />
                    <span>{baseLoc}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 sm:gap-6 border-t lg:border-t-0 lg:border-l border-[var(--border)] pt-5 lg:pt-0 lg:pl-8 shrink-0">
              <ViewLink href="/gallery" className="group space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-muted)] group-hover:text-[var(--fg)] transition">
                  <Images className="h-3.5 w-3.5" />
                  <span>{locale === "en" ? "Works" : "收录作品"}</span>
                </div>
                <div className="text-2xl sm:text-3xl font-semibold text-[var(--fg)]">
                  {stats.photoCount}
                </div>
              </ViewLink>

              <ViewLink href="/collections" className="group space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-muted)] group-hover:text-[var(--fg)] transition">
                  <Layers className="h-3.5 w-3.5" />
                  <span>{locale === "en" ? "Series" : "专题影集"}</span>
                </div>
                <div className="text-2xl sm:text-3xl font-semibold text-[var(--fg)]">
                  {stats.collectionCount}
                </div>
              </ViewLink>

              <ViewLink href="/map" className="group space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-muted)] group-hover:text-[var(--fg)] transition">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{locale === "en" ? "Locations" : "拍摄地点"}</span>
                </div>
                <div className="text-2xl sm:text-3xl font-semibold text-[var(--fg)]">
                  {stats.locationCount}
                </div>
              </ViewLink>
            </div>
          </section>
        </Reveal>

        {/* Main 2-Column Content Grid */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 items-start">
          {/* Left 7 Cols: Statement + Focus Cards */}
          <Reveal delayMs={60} className="lg:col-span-7 space-y-8">
            {bio && (
              <section className="space-y-3">
                <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[var(--fg)]">
                  <BookOpen className="h-4 w-4 opacity-75" />
                  <span>{locale === "en" ? "Statement" : "关于与创作自述"}</span>
                </h2>
                <div className="text-[15px] leading-7 text-[var(--fg-muted)] whitespace-pre-line">
                  {bio}
                </div>
              </section>
            )}

            {focusAreas.length > 0 && (
              <section className="space-y-4">
                <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[var(--fg)]">
                  <Aperture className="h-4 w-4 opacity-75" />
                  <span>{locale === "en" ? "Focus & Commissions" : "拍摄方向与合作"}</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {focusAreas.map((item, idx) => (
                    <div
                      key={`${item.title}-${idx}`}
                      className="surface-card rounded-lg p-5 space-y-2 transition-transform duration-200 hover:-translate-y-0.5"
                    >
                      <div className="flex items-center gap-2.5 text-[var(--fg)] font-medium text-[15px]">
                        <FocusIcon name={item.icon} />
                        <span>{pick(item.title, item.titleEn)}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
                        {pick(item.desc, item.descEn)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </Reveal>

          {/* Right 5 Cols: Exhibitions & Publications + Contact Channels */}
          <Reveal delayMs={120} className="lg:col-span-5 space-y-8">
            {milestones.length > 0 && (
              <section className="space-y-4">
                <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[var(--fg)]">
                  <Award className="h-4 w-4 opacity-75" />
                  <span>{locale === "en" ? "Exhibitions & Publications" : "展览与出版记录"}</span>
                </h2>

                <div className="surface-card divide-y divide-[var(--border)] rounded-lg">
                  {milestones.map((m, idx) => (
                    <div key={`${m.title}-${idx}`} className="flex items-baseline justify-between gap-4 px-5 py-3.5 text-sm">
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-medium text-[var(--fg)] truncate">
                          {pick(m.title, m.titleEn)}
                        </div>
                        <div className="text-xs text-[var(--fg-muted)]">
                          {pick(m.place, m.placeEn)}
                        </div>
                      </div>
                      <span className="text-xs text-[var(--fg-subtle)] shrink-0">{m.year}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-4">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[var(--fg)]">
                <Mail className="h-4 w-4 opacity-75" />
                <span>{locale === "en" ? "Contact & Social" : "联系方式"}</span>
              </h2>

              <div className="surface-card divide-y divide-[var(--border)] rounded-lg">
                {settings.email && (
                  <a
                    href={`mailto:${settings.email}`}
                    className="flex items-center justify-between px-5 py-3.5 text-sm text-[var(--fg)] hover:bg-[var(--bg-subtle)] transition"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-[var(--fg-muted)]" />
                      <span>{settings.email}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-[var(--fg-muted)]" />
                  </a>
                )}

                {settings.instagram && (
                  <a
                    href={settings.instagram}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between px-5 py-3.5 text-sm text-[var(--fg)] hover:bg-[var(--bg-subtle)] transition"
                  >
                    <span>Instagram</span>
                    <ArrowUpRight className="h-4 w-4 text-[var(--fg-muted)]" />
                  </a>
                )}

                {settings.xiaohongshu && (
                  <a
                    href={settings.xiaohongshu}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between px-5 py-3.5 text-sm text-[var(--fg)] hover:bg-[var(--bg-subtle)] transition"
                  >
                    <span>{locale === "en" ? "Xiaohongshu" : "小红书"}</span>
                    <ArrowUpRight className="h-4 w-4 text-[var(--fg-muted)]" />
                  </a>
                )}
              </div>

              {contactNote && (
                <p className="pt-1 text-xs text-[var(--fg-subtle)]">{contactNote}</p>
              )}
            </section>
          </Reveal>
        </div>

        {/* Shooting Habit Insights (Configurable via Admin `showShootingStats`) */}
        {showShootingStats && photos.length > 0 && (
          <Reveal delayMs={160}>
            <section className="space-y-4 pt-2">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[var(--fg)]">
                <BarChart3 className="h-4 w-4 opacity-75" />
                <span>{locale === "en" ? "Shooting Insights" : "拍摄习惯统计"}</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                {/* 1. Focal Length Distribution */}
                <div className="surface-card rounded-lg p-5 space-y-3.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--fg-muted)]">
                    <Focus className="h-3.5 w-3.5" />
                    <span>{locale === "en" ? "Focal Length Preference" : "常用焦段分布"}</span>
                  </div>
                  <div className="space-y-2.5">
                    {insights.focalBuckets.map((b) => (
                      <div key={b.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--fg)]">{locale === "en" ? b.en : b.zh}</span>
                          <span className="text-[var(--fg-muted)]">{b.count}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                          <div
                            style={{ width: `${Math.round((b.count / insights.maxFocal) * 100)}%` }}
                            className="h-full rounded-full bg-[var(--fg)]/75 transition-all duration-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Camera Body Usage */}
                <div className="surface-card rounded-lg p-5 space-y-3.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--fg-muted)]">
                    <Camera className="h-3.5 w-3.5" />
                    <span>{locale === "en" ? "Camera Bodies" : "机身使用率"}</span>
                  </div>
                  <div className="space-y-2.5">
                    {insights.cameras.map(([cam, count]) => (
                      <ViewLink
                        key={cam}
                        href={`/gallery?camera=${encodeURIComponent(cam)}`}
                        className="group block space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate text-[var(--fg)] group-hover:underline underline-offset-4">
                            {cam}
                          </span>
                          <span className="shrink-0 text-[var(--fg-muted)]">{count}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                          <div
                            style={{ width: `${Math.round((count / insights.maxCam) * 100)}%` }}
                            className="h-full rounded-full bg-[var(--fg)]/75 group-hover:bg-[var(--fg)] transition-all duration-500"
                          />
                        </div>
                      </ViewLink>
                    ))}
                  </div>
                </div>

                {/* 3. Subject Mix */}
                <div className="surface-card rounded-lg p-5 space-y-3.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--fg-muted)]">
                    <Aperture className="h-3.5 w-3.5" />
                    <span>{locale === "en" ? "Subject Mix" : "题材构成"}</span>
                  </div>
                  <div className="space-y-2.5">
                    {insights.categories.map(([cat, count]) => {
                      const pct = Math.round((count / insights.total) * 100);
                      return (
                        <ViewLink
                          key={cat}
                          href={`/gallery?category=${encodeURIComponent(cat)}`}
                          className="group block space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[var(--fg)] group-hover:underline underline-offset-4">
                              {categoryLabel(cat)}
                            </span>
                            <span className="text-[var(--fg-muted)]">
                              {pct}% ({count})
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                            <div
                              style={{ width: `${pct}%` }}
                              className="h-full rounded-full bg-[var(--fg)]/75 group-hover:bg-[var(--fg)] transition-all duration-500"
                            />
                          </div>
                        </ViewLink>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          </Reveal>
        )}
      </main>

      <SiteFooter settings={settings} />
    </div>
  );
}
