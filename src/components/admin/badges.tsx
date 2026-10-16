import type { UserRole } from "@/types/database";

const base = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold";

export function AccountStatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`${base} ${active ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${active ? "bg-emerald-600" : "bg-red-600"}`} />
      {active ? "Active" : "Disabled"}
    </span>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`${base} border-line bg-surface text-fg`}>{role === "super_admin" ? "Super admin" : "Client"}</span>
  );
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
