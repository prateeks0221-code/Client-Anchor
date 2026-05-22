import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClientAnchor - Anchor Your Next Opportunity",
  description:
    "AI-powered lead discovery platform. Find businesses, jobs, and partnerships that match your exact criteria.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
    >
      <html lang="en" className="h-full antialiased">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        </head>
        <body className="min-h-full bg-slate-950 text-slate-50 font-sans flex flex-col overflow-x-hidden">
          {children}
          <Toaster
            position="bottom-right"
            theme="dark"
            richColors
            closeButton
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
