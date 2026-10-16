"use client";

import { DoorOpen, Images, LayoutDashboard, Palette, Settings } from "lucide-react";
import { BottomNav, SidebarNav, type NavItem } from "@/components/ui/PanelNav";
import { useI18n } from "@/lib/i18n/provider";

// Icons are functions, so the item list must be created on the client side of
// the boundary instead of being passed down from the server layout.
function useStudioItems(): NavItem[] {
  const { t } = useI18n();
  return [
    { href: "/studio", label: t("nav.overview"), icon: LayoutDashboard, exact: true },
    { href: "/studio/halls", label: t("nav.categories"), icon: DoorOpen, exact: false },
    { href: "/studio/artworks", label: t("nav.artworks"), icon: Images, exact: false },
    { href: "/studio/appearance", label: t("nav.appearance"), icon: Palette, exact: false },
    { href: "/studio/settings", label: t("nav.settings"), icon: Settings, exact: false },
  ];
}

export function StudioSidebar() {
  const { t } = useI18n();
  const items = useStudioItems();
  return <SidebarNav items={items} label={t("nav.studioLabel")} />;
}

export function StudioBottomNav() {
  const { t } = useI18n();
  const items = useStudioItems();
  return <BottomNav items={items} label={t("nav.studioLabel")} />;
}
