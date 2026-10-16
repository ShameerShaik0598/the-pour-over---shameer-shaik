import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Carafe · The Pour Over", description: "A calm, unified view of reader relationships." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a href="#main" className="skip-link">Skip to content</a>{children}</body></html>;
}
