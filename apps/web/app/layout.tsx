import type { Metadata } from 'next';
import React from 'react';

import './globals.css';
import { AuthProvider } from '../lib/auth-context';

export const metadata: Metadata = {
  title: 'Hotel CRM - Sistema de Gestión para Agencias de Viajes',
  description: 'CRM SaaS con IA integrada para agencias de viajes',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
