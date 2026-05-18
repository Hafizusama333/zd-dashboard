import type { Metadata } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";
import "./globals.css";
import { DashboardProvider } from "@/components/DashboardProvider";
import LoadingOverlay from "@/components/LoadingOverlay";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "ZD Maintenance — Command Center",
  description: "Live HousecallPro dashboard for ZD Maintenance",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body>
        <DashboardProvider>
          <Sidebar />
          <main className="main">
            <Topbar />
            {children}
          </main>
          <LoadingOverlay />
        </DashboardProvider>
      </body>
    </html>
  );
}
