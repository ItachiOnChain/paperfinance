import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: '0G Paper Trading — Dashboard',
  description: 'Real-time paper trading on 0G Network with on-chain settlement',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-[#060911] text-white`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
