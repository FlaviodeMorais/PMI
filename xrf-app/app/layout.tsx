import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Banco de Ligas Metálicas",
  description: "Dashboard interativo para consulta de composições químicas e normas de ligas metálicas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
