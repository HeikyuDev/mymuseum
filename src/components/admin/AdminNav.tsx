"use client";

import { DoorOpen, Images, LayoutDashboard, Palette, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact: boolean };

const ADMIN_ITEMS: readonly NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/halls", label: "Halls", icon: DoorOpen, exact: false },
  { href: "/admin/artworks", label: "Artworks", icon: Images, exact: false },
  { href: "/admin/appearance", label: "Appearance", icon: Palette, exact: false },
  { href: "/admin/settings", label: "Settings", icon: Settings, exact: false },
];

type NavProps = { items?: readonly NavItem[]; label?: string };

function useActive() {
  const pathname = usePathname();
  return (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SidebarNav({ items = ADMIN_ITEMS, label = "Museum management" }: NavProps) {
  const isActive = useActive();
  return (
    <nav aria-label={label} className="hidden w-56 shrink-0 md:block">
      <ul className="sticky top-20 flex flex-col gap-1">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-11 items-center gap-3 rounded-theme px-3 text-sm font-medium text-muted transition hover:bg-surface hover:text-fg aria-[current=page]:bg-surface aria-[current=page]:font-semibold aria-[current=page]:text-fg"
              >
                <item.icon aria-hidden className="size-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function BottomNav({ items = ADMIN_ITEMS, label = "Museum management" }: NavProps) {
  const isActive = useActive();
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted aria-[current=page]:text-accent-text"
              >
                <item.icon aria-hidden className="size-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
