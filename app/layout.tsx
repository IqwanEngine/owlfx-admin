/* Powered by IqwanEngine */

import React from 'react';
import '@/index.css';

export const metadata = {
  title: 'OWL ALGO DATABASE | Engineered by IqwanEngine',
  description: 'Secured Administrative Dashboard - www.owlfx.my',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#050505] text-[#E2E8F0] antialiased selection:bg-[#BF953F]/30 selection:text-[#F3C677]">
        {children}
      </body>
    </html>
  );
}
