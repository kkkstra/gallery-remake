"use client";

import {
  Aperture,
  ArrowUpRight,
  Award,
  BookOpen,
  Building2,
  Compass,
  Frame,
  Images,
  Layers,
  Mail,
  MapPin,
  Settings,
} from "lucide-react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Reveal } from "./Reveal";
import { ViewLink } from "./ViewLink";
import { usePreferences } from "./PreferencesProvider";

interface AboutClientProps {
  settings: Record<string, string>;
  stats: {
    photoCount: number;
    collectionCount: number;
    locationCount: number;
  };
}

export function AboutClient({ settings, stats }: AboutClientProps) {
  const { locale, pick } = usePreferences();

  const name = pick(settings.photographerName || "林远", settings.photographerNameEn);
  const tagline = pick(settings.tagline || "", settings.taglineEn);
  const bio = pick(settings.bio || "", settings.bioEn);
  const baseLoc = pick(settings.baseLocation || "", settings.baseLocationEn);
  const avatarUrl = settings.avatarUrl || "/samples/avatar.jpg";

  const focusAreas =
    locale === "en"
      ? [
          {
            icon: Compass,
            title: "Landforms & Travel",
            desc: "Long-term series across high-latitude coastlines, alpine valleys, and seasonal transitions.",
          },
          {
            icon: Building2,
            title: "Architecture & Space",
            desc: "Spatial geometry, material contrast, and blue-hour urban light for studios and architects.",
          },
          {
            icon: Aperture,
            title: "Editorial & Commissions",
            desc: "Visual storytelling, brand documentaries, and travel features on assignment.",
          },
          {
            icon: Frame,
            title: "Fine Art Prints",
            desc: "Signed archival pigment prints on museum-grade cotton rag paper upon inquiry.",
          },
        ]
      : [
          {
            icon: Compass,
            title: "自然地貌与行旅",
            desc: "长期跟拍高纬度海岸、冰川河谷与季节更替中的自然光影档案。",
          },
          {
            icon: Building2,
            title: "城市与建筑空间",
            desc: "记录现代建筑几何、材质冷暖秩序，以及蓝调时刻的城市人文切片。",
          },
          {
            icon: Aperture,
            title: "商业纪实与杂志委任",
            desc: "承接建筑事务所、酒店空间、户外与生活方式品牌的专题视觉拍摄。",
          },
          {
            icon: Frame,
            title: "艺术微喷收藏",
            desc: "部分作品提供博物馆级哈内姆勒纯棉艺术纸限量签名微喷定制。",
          },
        ];

  const milestones =
    locale === "en"
      ? [
          { year: "2026", title: "Solo Exhibition — Nocturne & Geometry", place: "Shanghai" },
          { year: "2025", title: "Photobook — Silent Latitudes (1st Ed.)", place: "Self-Published" },
          { year: "2025", title: "Group Show — Northern Light & Form", place: "Daikanyama, Tokyo" },
          { year: "2024", title: "Finalist — Landscape & Travel Awards", place: "London" },
        ]
      : [
          { year: "2026", title: "个人摄影展《暮色与秩序》", place: "上海 · 静安艺术空间" },
          { year: "2025", title: "独立摄影画册《Silent Latitudes》初版印行", place: "限量 300 册" },
          { year: "2025", title: "联展《北方纬度与光》", place: "东京 · 代官山画廊" },
          { year: "2024", title: "年度旅行与自然影像评选入围", place: "风光与纪实组" },
        ];

  return (
    <div className="relative min-h-dvh flex flex-col overflow-x-clip">
      {/* Subtle Ambient Depth Orbs */}
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
                className="h-28 w-28 sm:h-32 sm:w-32 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]"
              />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold text-[var(--fg)]">{name}</h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs text-emerald-500 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {locale === "en" ? "Available for Commissions" : "商业委任与微喷收藏开放中"}
                  </span>
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

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{locale === "en" ? "Cities" : "拍摄城市"}</span>
                </div>
                <div className="text-2xl sm:text-3xl font-semibold text-[var(--fg)]">
                  {stats.locationCount}
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* Main 2-Column Content Grid */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 items-start">
          {/* Left 7 Cols: Statement + 4 Focus Cards */}
          <Reveal delayMs={70} className="lg:col-span-7 space-y-8">
            <section className="space-y-3">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[var(--fg)]">
                <BookOpen className="h-4 w-4 opacity-75" />
                <span>{locale === "en" ? "Statement" : "关于与创作自述"}</span>
              </h2>
              <div className="space-y-3 text-[15px] leading-7 text-[var(--fg-muted)]">
                {bio && <p className="text-[var(--fg)]/90 whitespace-pre-line">{bio}</p>}
                <p>
                  {locale === "en"
                    ? "Rather than staging scenes, I prefer waiting at the threshold of changing weather and twilight—when natural light and artificial city illumination briefly balance each other. Every project is archived and sequenced as a long-term visual monograph."
                    : "相比刻意摆拍，我更习惯在气候转换与昼夜交界的短暂窗口期等待——当峡谷晨雾尚未散去，或城市初灯刚刚接管街道的十五分钟。所有照片均按长期专题整理归档。"}
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[var(--fg)]">
                <Aperture className="h-4 w-4 opacity-75" />
                <span>{locale === "en" ? "Focus & Commissions" : "拍摄方向与合作"}</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {focusAreas.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="surface-card rounded-lg p-5 space-y-2 transition-transform duration-200 hover:-translate-y-0.5"
                    >
                      <div className="flex items-center gap-2.5 text-[var(--fg)] font-medium text-[15px]">
                        <Icon className="h-4 w-4 text-[var(--fg-muted)] shrink-0" />
                        <span>{item.title}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </Reveal>

          {/* Right 5 Cols: Exhibitions & Publications + Contact Channels */}
          <Reveal delayMs={140} className="lg:col-span-5 space-y-8">
            <section className="space-y-4">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[var(--fg)]">
                <Award className="h-4 w-4 opacity-75" />
                <span>{locale === "en" ? "Exhibitions & Publications" : "展览与出版记录"}</span>
              </h2>

              <div className="surface-card divide-y divide-[var(--border)] rounded-lg">
                {milestones.map((m) => (
                  <div key={m.title} className="flex items-baseline justify-between gap-4 px-5 py-3.5 text-sm">
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-medium text-[var(--fg)] truncate">{m.title}</div>
                      <div className="text-xs text-[var(--fg-muted)]">{m.place}</div>
                    </div>
                    <span className="text-xs text-[var(--fg-subtle)] shrink-0">{m.year}</span>
                  </div>
                ))}
              </div>
            </section>

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

              <p className="pt-1 text-xs text-[var(--fg-subtle)]">
                {locale === "en"
                  ? "Prints & licensing inquiries welcome via email."
                  : "商业拍摄与版权合作请通过邮件联系"}
              </p>
            </section>
          </Reveal>
        </div>
      </main>

      <SiteFooter settings={settings} />
    </div>
  );
}
