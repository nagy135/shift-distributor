import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/providers";
import { Navigation } from "@/components/navigation";
import { OnlineHeartbeat } from "@/components/online-heartbeat";
import { ThemeScript } from "@/components/theme-script";
import { AuthProvider } from "@/lib/auth-client";
import { AuthGate } from "@/components/auth-gate";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dienstplan",
  description: "Ärztliche Dienste und Einsatzpläne verwalten",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={inter.className}>
        <QueryProvider>
          <AuthProvider>
            <OnlineHeartbeat />
            <div className="min-h-screen bg-background">
              <header className="border-b">
                <div className="container mx-auto px-4 py-4">
                  <Navigation />
                </div>
              </header>
              <main className="container mx-auto px-4 py-8">
                <AuthGate>{children}</AuthGate>
              </main>
            </div>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
