import type React from "react"
import type { Metadata } from "next"
import { Inter, IBM_Plex_Mono } from 'next/font/google'
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
})

const ibmPlexMono = IBM_Plex_Mono({ 
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Anonn",
  description: "Anonymous Home for Prediction Markets players",
  generator: "v0.app",
  icons: {
    icon: "/icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${ibmPlexMono.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
