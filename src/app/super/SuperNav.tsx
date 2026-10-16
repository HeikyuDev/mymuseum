"use client";

import { LayoutDashboard, Landmark, Users } from "lucide-react";
import { BottomNav, SidebarNav, type NavItem } from "@/components/admin/AdminNav";

// Icons are functions, so the item list must be created on the client side of
// the boundary instead of being passed down from the server layout.
const SUPER_ITEMS: readonly NavItem[] = [
  { href: "/super", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/super/clients", label: "Clients", icon: Users, exact: false },
  { href: "/super/museums", label: "Museums", icon: Landmark, exact: false },
];

export function SuperSidebar() {
  return <SidebarNav items={SUPER_ITEMS} label="Platform management" />;
}

export function SuperBottomNav() {
  return <BottomNav items={SUPER_ITEMS} label="Platform management" />;
}
