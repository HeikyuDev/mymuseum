import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { resolveMuseumTheme } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyMuseum",
  description: "Create and share your own virtual museum.",
};

// Default (white gallery) theme; museum pages override these variables.
const defaultTheme = resolveMuseumTheme();

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col" style={defaultTheme.cssVars}>
        {children}
      </body>
    </html>
  );
}
