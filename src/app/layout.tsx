import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Alliance System',
  description: 'Plataforma de Gestão Alliance Investimentos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Anti-flash: aplica tema antes do primeiro render.
            Claro é o padrão — o CRM é usado no escritório, com luz do dia. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('crm-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
