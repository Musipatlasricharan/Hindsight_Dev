import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ledgerwise | Enterprise AP Agent",
  description: "Hindsight-powered Accounts Payable Exception Resolution",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable} antialiased h-full bg-[#f8f9fa]`}>
      <body className="h-full font-sans text-[#202124]">{children}</body>
    </html>
  );
}
