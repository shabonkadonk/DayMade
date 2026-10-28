import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const geist = localFont({
  src: "../public/fonts/geist.woff2",
  variable: "--font-geist",
  display: "swap",
});
export const metadata: Metadata = {
  title: "DayMade — Your next great day starts here",
  description:
    "Describe your perfect day. DayMade discovers the places, plans your itinerary, and helps arrange the details with Claude and Wajo Fo.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.variable} data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
