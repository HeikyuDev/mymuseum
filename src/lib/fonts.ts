import { Caveat, Fraunces, Inter, Playfair_Display, Space_Grotesk } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });

/** Class names that expose every font as a CSS variable. Apply once on <html>. */
export const fontVariables = [inter, playfair, spaceGrotesk, fraunces, caveat]
  .map((font) => font.variable)
  .join(" ");
