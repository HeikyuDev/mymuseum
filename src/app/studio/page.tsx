import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { ShareCard } from "@/components/studio/ShareCard";
import { cardClass, PageHeader } from "@/components/ui/panel";
import { getOwnMuseum, requireUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { getOwnArtworks, getOwnHalls } from "@/lib/studio/queries";
import { DEFAULT_ACCENT, DEFAULT_THEME_PRESET } from "@/lib/theme";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("nav.overview") };
}

export default async function StudioOverviewPage() {
  await requireUser();
  const museum = await getOwnMuseum();
  // Without a museum the layout renders the onboarding instead of this page.
  if (!museum) return null;

  const t = await getT();
  const [halls, artworks] = await Promise.all([getOwnHalls(), getOwnArtworks()]);
  const assigned = artworks.filter((artwork) => artwork.hall_id).length;
  const styled = museum.theme_preset !== DEFAULT_THEME_PRESET || museum.accent_color !== DEFAULT_ACCENT;

  const steps = [
    { done: halls.length > 0, label: t("ov.step1"), hint: t("ov.step1Hint"), href: "/studio/halls" },
    { done: artworks.length > 0, label: t("ov.step2"), hint: t("ov.step2Hint"), href: "/studio/artworks" },
    { done: styled, label: t("ov.step3"), hint: t("ov.step3Hint"), href: "/studio/appearance" },
    { done: museum.is_published, label: t("ov.step4"), hint: t("ov.step4Hint"), href: null },
  ];
  const completed = steps.filter((step) => step.done).length;

  const stats = [
    { label: t("ov.statCategories"), value: halls.length },
    { label: t("ov.statArtworks"), value: artworks.length },
    { label: t("ov.statUnassigned"), value: artworks.length - assigned },
  ];

  return (
    <>
      <PageHeader title={t("ov.title")} description={t("ov.welcome", { title: museum.title })} />

      <ShareCard slug={museum.slug} published={museum.is_published} />

      <dl className="mb-6 grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className={`${cardClass} p-4`}>
            <dt className="text-sm text-muted">{stat.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section className={`${cardClass} p-5`} aria-labelledby="checklist">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="checklist" className="font-display text-lg font-semibold">
            {t("ov.checklistTitle")}
          </h2>
          <p className="text-sm text-muted">{t("ov.progress", { done: completed, total: steps.length })}</p>
        </div>
        <progress
          value={completed}
          max={steps.length}
          aria-label={t("ov.progress", { done: completed, total: steps.length })}
          className="mt-3 h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-accent [&::-webkit-progress-bar]:bg-surface [&::-webkit-progress-value]:bg-accent"
        />
        <ol className="mt-3 divide-y divide-line">
          {steps.map((step, index) => (
            <li key={step.label} className="flex min-h-14 items-center gap-3 py-2.5">
              {step.done ? (
                <CheckCircle2 aria-label={t("ov.done")} className="size-5 shrink-0 text-emerald-600" />
              ) : (
                <Circle aria-label={t("ov.todo")} className="size-5 shrink-0 text-muted" />
              )}
              <div className="min-w-0">
                <p className={step.done ? "text-muted line-through" : "font-medium"}>
                  {index + 1}. {step.label}
                </p>
                {!step.done ? <p className="text-sm text-muted">{step.hint}</p> : null}
              </div>
              {step.href && !step.done ? (
                <Link href={step.href} className="ml-auto inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-accent-text">
                  {t("ov.go")} <ArrowRight aria-hidden className="size-4" />
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
