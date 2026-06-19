import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { WalletProvider } from "@/context/WalletContext";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stellar Raise Interface",
  description: "The Gateway for Users to browse active campaigns and contribute to projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${outfit.variable} antialiased font-sans`}
      >
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
