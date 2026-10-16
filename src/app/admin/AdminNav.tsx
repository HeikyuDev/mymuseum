"use client";

import { LayoutDashboard, Landmark, Users } from "lucide-react";
import { BottomNav, SidebarNav, type NavItem } from "@/components/ui/PanelNav";

// Icons are functions, so the item list must be created on the client side of
// the boundary instead of being passed down from the server layout.
const ADMIN_ITEMS: readonly NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/clients", label: "Clients", icon: Users, exact: false },
  { href: "/admin/museums", label: "Museums", icon: Landmark, exact: false },
];

export function AdminSidebar() {
  return <SidebarNav items={ADMIN_ITEMS} label="Platform management" />;
}

export function AdminBottomNav() {
  return <BottomNav items={ADMIN_ITEMS} label="Platform management" />;
}
