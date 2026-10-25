import type { Metadata } from "next";
import CursorFootprints from "@/components/site/CursorFootprints";
import "./globals.css";

export const metadata: Metadata = {
  title: "REVOK — Lost & Found",
  description:
    "A community lost and found project helping people reconnect with their belongings.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}<CursorFootprints /></body></html>;
}
