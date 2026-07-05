import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { AppToaster } from "@/components/app-toaster";
import { AppLayout } from "@/components/app-layout";
import { SkipLink } from "@/components/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { QueryProvider } from "@/components/query-provider";

import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Roast My Startup",
  description:
    "Five AI judges review your startup idea, debate it, and deliver a decision.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable} h-full`}
      data-ui-shell-v2=""
    >
      <body className="flex min-h-full flex-col antialiased">
        <SkipLink />
        <QueryProvider>
          <ErrorBoundary>
            <AppLayout>{children}</AppLayout>
          </ErrorBoundary>
        </QueryProvider>
        <AppToaster />
      </body>
    </html>
  );
}
