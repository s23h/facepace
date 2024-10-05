import './globals.css'
import { Inter } from 'next/font/google'
import { Instrument_Serif } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400' })

export const metadata = {
  title: 'Face Pace',
  description: 'Decode your aging, hack longevity.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={instrumentSerif.className}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
