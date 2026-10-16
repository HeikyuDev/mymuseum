"use client";

import { DoorOpen, Images, LayoutDashboard, Palette, Settings } from "lucide-react";
import { BottomNav, SidebarNav, type NavItem } from "@/components/ui/PanelNav";

// Icons are functions, so the item list must be created on the client side of
// the boundary instead of being passed down from the server layout.
const STUDIO_ITEMS: readonly NavItem[] = [
  { href: "/studio", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/studio/halls", label: "Halls", icon: DoorOpen, exact: false },
  { href: "/studio/artworks", label: "Artworks", icon: Images, exact: false },
  { href: "/studio/appearance", label: "Appearance", icon: Palette, exact: false },
  { href: "/studio/settings", label: "Settings", icon: Settings, exact: false },
];

export function StudioSidebar() {
  return <SidebarNav items={STUDIO_ITEMS} label="Museum management" />;
}

export function StudioBottomNav() {
  return <BottomNav items={STUDIO_ITEMS} label="Museum management" />;
}
