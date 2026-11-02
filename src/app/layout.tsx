import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mancebox",
  description: "Reserva tu entrenamiento de cross training",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
