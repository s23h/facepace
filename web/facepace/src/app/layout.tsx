import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FacePace',
  description: 'Measure your functional age with FacePace',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FacePace',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#000000" id="theme-color-meta" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
