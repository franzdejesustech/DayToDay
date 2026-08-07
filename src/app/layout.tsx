import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DayToDay — Everything you need, daily",
  description: "A calm daily command center for tasks, time, notes, habits, reminders, and reflection.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body>{children}</body></html>;
}
