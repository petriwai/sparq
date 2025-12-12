import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Inoka - The Real Ones',
  description: 'Springfield\'s local rideshare service',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0f172a" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased">
        <div className="w-full min-h-screen md:max-w-[430px] md:min-h-[932px] md:mx-auto md:my-0 md:rounded-[40px] md:shadow-2xl md:shadow-black/50 md:border md:border-slate-800 md:overflow-hidden relative bg-slate-900">
          <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[30px] bg-black rounded-b-2xl z-50"></div>
          {children}
        </div>
      </body>
    </html>
  )
}
