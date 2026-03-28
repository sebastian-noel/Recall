import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recall — AI Memory Assistant",
  description: "Your personal memory assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-recall-50 text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
