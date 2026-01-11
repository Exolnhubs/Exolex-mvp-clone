import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import FloatingNolex from "@/components/FloatingNolex";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExoLex - الحماية القانونية في متناولك",
  description: "منصة ExoLex للخدمات القانونية - استشارات، قضايا، مكتبة قانونية",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-gray-50">
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'IBM Plex Sans Arabic, sans-serif',
            },
          }}
        />
        {children}
        <FloatingNolex />
      </body>
    </html>
  );
}
