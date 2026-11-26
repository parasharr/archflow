import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/app/components/AuthProvider";
import { AuthDialog } from "@/app/components/AuthDialog";
import { DesignProvider } from "@/app/components/DesignProvider";
import { DashboardShell } from "@/app/components/DashboardShell";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ArchFlow AI — System Design Dashboard",
  description:
    "Design scalable software architectures, interactive Mermaid diagrams, and component breakdowns powered by free AI APIs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full dark antialiased`}
    >
      <body className="min-h-full font-sans">
        <TooltipProvider>
          <AuthProvider>
            <DesignProvider>
              <DashboardShell>{children}</DashboardShell>
              <AuthDialog />
            </DesignProvider>
          </AuthProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
