import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
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
      <html lang="de" suppressHydrationWarning>
        <body
          className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans min-h-screen`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <TenantProvider>
              {children}
              <Toaster />
            </TenantProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
