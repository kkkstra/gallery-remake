"use client";

import { ArrowRight, Calendar, Images } from "lucide-react";
import type { CollectionWithPhotos } from "@/lib/queries";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Reveal } from "./Reveal";
import { ViewLink } from "./ViewLink";
import { usePreferences } from "./PreferencesProvider";

interface CollectionsClientProps {
  collections: CollectionWithPhotos[];
  settings: Record<string, string>;
}

export function CollectionsClient({ collections, settings }: CollectionsClientProps) {
  const { locale, pick } = usePreferences();

  return (
    <div className="min-h-dvh flex flex-col">
      <SiteHeader
        photographerName={settings.photographerName}
        photographerNameEn={settings.photographerNameEn}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-7 sm:px-9 sm:pt-12 space-y-12 sm:space-y-18">
        {collections.length === 0 ? (
          <div className="py-24 text-center text-base text-[var(--fg-muted)]">
            {locale === "en" ? "No curated series yet." : "暂无专题影集。"}
          </div>
        ) : (
          collections.map((col, idx) => {
            const title = pick(col.title, col.titleEn);
            const desc = pick(col.description, col.descriptionEn);
            const previewStrip = col.photos.slice(0, 4);

            return (
              <Reveal key={col.id} delayMs={idx * 70}>
                <section className="grid grid-cols-1 gap-6 sm:gap-10 lg:grid-cols-12 items-start border-b border-[var(--border)] pb-12 sm:pb-18">
                  <div className="lg:col-span-4 space-y-4">
                    <div className="text-sm text-[var(--fg-muted)] flex flex-wrap items-center gap-4">
                      {col.period && (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 opacity-75" />
                          {col.period}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <Images className="h-4 w-4 opacity-75" />
                        {col.photoCount} {locale === "en" ? "Photos" : "幅"}
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--fg)]">
                      <ViewLink href={`/collections/${col.slug}`} className="hover:opacity-80 transition">
                        {title}
                      </ViewLink>
                    </h2>

                    {desc && (
                      <p className="text-[15px] leading-7 text-[var(--fg-muted)]">{desc}</p>
                    )}

                    <div className="pt-2">
                      <ViewLink
                        href={`/collections/${col.slug}`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--fg)] hover:opacity-75 transition"
                      >
                        <span>{locale === "en" ? "View Series" : "进入影集"}</span>
                        <ArrowRight className="h-4 w-4" />
                      </ViewLink>
                    </div>
                  </div>

                  <div className="lg:col-span-8 space-y-2.5">
                    {col.coverUrl && (
                      <ViewLink
                        href={`/collections/${col.slug}`}
                        className="group photo-frame block overflow-hidden bg-[var(--bg-elevated)]"
                      >
                        <img
                          src={col.coverUrl}
                          alt={title}
                          style={{ viewTransitionName: `series-cover-${col.slug}` }}
                          className="w-full max-h-[54vh] object-cover transition duration-700 ease-out group-hover:scale-[1.025]"
                        />
                      </ViewLink>
                    )}
                    {previewStrip.length > 1 && (
                      <div className="grid grid-cols-4 gap-2.5">
                        {previewStrip.map((p) => (
                          <ViewLink
                            key={p.id}
                            href={`/collections/${col.slug}`}
                            className="photo-frame aspect-[3/2] overflow-hidden opacity-80 hover:opacity-100 transition"
                          >
                            <img src={p.url} alt={p.title} className="h-full w-full object-cover" />
                          </ViewLink>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </Reveal>
            );
          })
        )}
      </main>

      <SiteFooter settings={settings} />
    </div>
  );
}
