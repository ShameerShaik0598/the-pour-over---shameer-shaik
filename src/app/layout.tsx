import type { Metadata } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = { title: "Carafe · The Pour Over", description: "A calm, unified view of reader relationships." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${fraunces.variable} ${instrument.variable} ${jetbrains.variable}`}><a href="#main" className="skip-link">Skip to content</a>{children}</body></html>;
}
