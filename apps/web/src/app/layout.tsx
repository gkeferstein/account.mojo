import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { TenantProvider } from "@/providers/TenantProvider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "MOJO Accounts - Dein Account Portal",
  description: "Verwalte dein MOJO Konto, Abonnements und Team-Mitgliedschaften",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "hsl(262 83% 58%)",
          colorBackground: "hsl(0 0% 6%)",
          colorInputBackground: "hsl(0 0% 12%)",
          colorInputText: "hsl(0 0% 98%)",
          borderRadius: "0.75rem",
        },
        elements: {
          card: "bg-card border-border",
          formButtonPrimary: "bg-primary hover:bg-primary/90",
        },
      }}
    >
      <html lang="de" className="dark">
        <body
          className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans min-h-screen bg-noise`}
        >
          <TenantProvider>
            {/* Background gradient orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
              <div className="gradient-orb gradient-orb-1" />
              <div className="gradient-orb gradient-orb-2" />
              <div className="gradient-orb gradient-orb-3" />
              <div className="gradient-orb gradient-orb-4" />
            </div>

            {/* Main content */}
            <div className="relative z-10">
              {children}
            </div>

            <Toaster />
          </TenantProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}


