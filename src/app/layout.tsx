import type { Metadata } from "next";
import RoutePathTracker from "@/components/site/RoutePathTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "REVOK — Lost & Found",
  description:
    "A community lost and found project helping people reconnect with their belongings.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body><RoutePathTracker>{children}</RoutePathTracker></body></html>;
}
