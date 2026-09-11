import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BPO",
  description: "Gestão financeira multi-cliente",
  icons: {
    icon: '/LOGO-LETICIA-FRAZON.png',
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-background text-foreground`}>
        {/* Apenas carrega os filhos. Quem desenha os menus é o layout da equipe! */}
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}