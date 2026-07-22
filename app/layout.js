import './globals.css';
import { Inter } from 'next/font/google';
import { DYNAXIS_METADATA } from '@/lib/dynaxis/product';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata = {
  title: DYNAXIS_METADATA.titleDefault,
  description: DYNAXIS_METADATA.description,
  icons: {
    icon: '/banner.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
