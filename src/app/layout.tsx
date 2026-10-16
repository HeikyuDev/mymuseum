import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { getLocale, getT } from "@/lib/i18n/server";
import { resolveMuseumTheme } from "@/lib/theme";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: { default: t("common.appName"), template: "%s | MyMuseum" }, description: t("home.metaDescription") };
}

// Default (white gallery) theme; museum pages override these variables.
const defaultTheme = resolveMuseumTheme();

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col" style={defaultTheme.cssVars}>
        {children}
      </body>
    </html>
  );
}
