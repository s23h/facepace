'use client';

import './globals.css'
import { Inter } from 'next/font/google'
import { Instrument_Serif } from 'next/font/google'
import { useEffect } from 'react'

const inter = Inter({ subsets: ['latin'] })
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400' })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVh();
    window.addEventListener('resize', setVh);

    return () => window.removeEventListener('resize', setVh);
  }, []);

  return (
    <html lang="en" className={instrumentSerif.className}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
