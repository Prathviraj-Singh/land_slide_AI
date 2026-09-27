import React from 'react';
import '../styles/globals.css';

// TODO: Define metadata and root layout for LandslideShield AI
export const metadata = {
  title: 'LandslideShield AI',
  description: 'AI-Powered Landslide Early Warning & Risk Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
