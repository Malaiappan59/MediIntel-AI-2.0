import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";
import { AppDataProvider } from "@/components/providers/app-data-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { APP_TAGLINE } from "@/lib/constants";
import { cn } from "@/lib/utils";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "MediIntel",
  description: APP_TAGLINE,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(manrope.variable, sora.variable, "font-sans")}>
        <AuthProvider>
          <AppDataProvider>{children}</AppDataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
