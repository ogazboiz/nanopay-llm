import "./globals.css";
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jbm = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbm" });

export const metadata = {
  title: "NanoPay LLM — per-token USDC billing on Arc",
  description:
    "Per-output-token USDC billing for AI inference, settled via Circle Nanopayments on Arc Testnet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jbm.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
