import type { Metadata } from 'next'
import Script from 'next/script'
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
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased">
        {mapsKey && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=places,geometry&v=weekly&loading=async`}
            strategy="afterInteractive"
            async
          />
        )}
        <div className="w-full min-h-screen md:max-w-[430px] md:min-h-[932px] md:mx-auto md:my-0 md:rounded-[40px] md:shadow-2xl md:shadow-black/50 md:border md:border-slate-800 md:overflow-hidden relative bg-slate-900">
          <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[30px] bg-black rounded-b-2xl z-50"></div>
          {children}
        </div>
      </body>
    </html>
  )
}
