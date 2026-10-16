import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { cardClass, PageHeader } from "@/components/ui/panel";
import { getOwnArtworks, getOwnHalls } from "@/lib/studio/queries";
import { getOwnMuseum, requireUser } from "@/lib/auth/session";

export default async function StudioOverviewPage() {
  await requireUser();
  const museum = await getOwnMuseum();
  // Without a museum the layout renders the onboarding instead of this page.
  if (!museum) return null;

  const [halls, artworks] = await Promise.all([getOwnHalls(), getOwnArtworks()]);
  const assigned = artworks.filter((artwork) => artwork.hall_id).length;

  const steps = [
    { done: halls.length > 0, label: "Create a hall", href: "/studio/halls" },
    { done: artworks.length > 0, label: "Upload your first artworks", href: "/studio/artworks" },
    { done: assigned > 0, label: "Place artworks in a hall", href: "/studio/artworks" },
    { done: museum.theme_preset !== "light_modern" || museum.accent_color !== "#c9a227", label: "Choose your look", href: "/studio/appearance" },
    { done: museum.is_published, label: "Publish your museum", href: null },
  ];

  const stats = [
    { label: "Halls", value: halls.length },
    { label: "Artworks", value: artworks.length },
    { label: "Unassigned", value: artworks.length - assigned },
  ];

  return (
    <>
      <PageHeader title="Overview" description={`Welcome back. Here is how ${museum.title} is doing.`} />

      <dl className="mb-6 grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className={`${cardClass} p-4`}>
            <dt className="text-sm text-muted">{stat.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section className={`${cardClass} p-5`} aria-labelledby="checklist">
        <h2 id="checklist" className="font-display text-lg font-semibold">
          Getting started
        </h2>
        <ol className="mt-3 divide-y divide-line">
          {steps.map((step) => (
            <li key={step.label} className="flex min-h-12 items-center gap-3 py-2">
              {step.done ? (
                <CheckCircle2 aria-label="Done" className="size-5 shrink-0 text-emerald-600" />
              ) : (
                <Circle aria-label="To do" className="size-5 shrink-0 text-muted" />
              )}
              <span className={step.done ? "text-muted line-through" : "font-medium"}>{step.label}</span>
              {step.href && !step.done ? (
                <Link href={step.href} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-accent-text">
                  Go <ArrowRight aria-hidden className="size-4" />
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
