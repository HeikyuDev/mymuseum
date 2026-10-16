"use client";

import { LayoutDashboard, Landmark, Users } from "lucide-react";
import { BottomNav, SidebarNav, type NavItem } from "@/components/ui/PanelNav";
import { useI18n } from "@/lib/i18n/provider";

// Icons are functions, so the item list must be created on the client side of
// the boundary instead of being passed down from the server layout.
function useAdminItems(): NavItem[] {
  const { t } = useI18n();
  return [
    { href: "/admin", label: t("nav.overview"), icon: LayoutDashboard, exact: true },
    { href: "/admin/clients", label: t("nav.clients"), icon: Users, exact: false },
    { href: "/admin/museums", label: t("nav.museums"), icon: Landmark, exact: false },
  ];
}

export function AdminSidebar() {
  const { t } = useI18n();
  const items = useAdminItems();
  return <SidebarNav items={items} label={t("nav.adminLabel")} />;
}

export function AdminBottomNav() {
  const { t } = useI18n();
  const items = useAdminItems();
  return <BottomNav items={items} label={t("nav.adminLabel")} />;
}
