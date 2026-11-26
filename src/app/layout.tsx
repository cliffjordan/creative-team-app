import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/providers/auth-provider";
import { MotionProvider } from "@/providers/motion-provider";
import { SmoothScrollProvider } from "@/providers/smooth-scroll-provider";
import { SwRegister } from "@/components/pwa/sw-register";

export const metadata: Metadata = {
  title: "Creative Team - Church Event OS",
  description: "Live Rundown Controller, Timeline & Event Evaluation Platform for Church Creative Team",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo-creative-team.png",
    apple: "/logo-creative-team.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#4F46E5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="bg-[#F8FAFC] text-slate-900 min-h-screen antialiased selection:bg-indigo-100 selection:text-indigo-900">
        <SwRegister />
        <MotionProvider>
          <SmoothScrollProvider>
            <AuthProvider>{children}</AuthProvider>
          </SmoothScrollProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
