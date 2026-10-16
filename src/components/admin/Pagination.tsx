import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { btnSecondary } from "@/components/ui/panel";
import { buildQuery, pageCount } from "@/lib/admin/params";

type Props = {
  basePath: string;
  page: number;
  total: number;
  /** Current filters, preserved in the links. */
  query: Record<string, string | number | undefined>;
  noun: string;
};

export function Pagination({ basePath, page, total, query, noun }: Props) {
  const pages = pageCount(total);
  const href = (target: number) => `${basePath}${buildQuery({ ...query, page: target })}`;
  const disabled = "pointer-events-none opacity-50";

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        {total} {noun}
        {total === 1 ? "" : "s"} · Page {Math.min(page, pages)} of {pages}
      </p>
      <div className="flex gap-2">
        <Link
          href={href(page - 1)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={`${btnSecondary} !min-h-9 ${page <= 1 ? disabled : ""}`}
        >
          <ChevronLeft aria-hidden className="size-4" />
          Previous
        </Link>
        <Link
          href={href(page + 1)}
          aria-disabled={page >= pages}
          tabIndex={page >= pages ? -1 : undefined}
          className={`${btnSecondary} !min-h-9 ${page >= pages ? disabled : ""}`}
        >
          Next
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      </div>
    </nav>
  );
}
