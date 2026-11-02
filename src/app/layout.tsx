import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { SiteProvider } from '@/components/site-context';

const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || 'https://desha-news.vercel.app'),
  title: { default: 'දේශ News | ඔබේ හඬ. ඔබේ පුවත්.', template: '%s | දේශ News' },
  description: 'ශ්‍රී ලංකාවෙන් සහ ලෝකයෙන් පුවත්, කතාබහ සහ නව අදහස්. Desha News bilingual news portal.',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'si_LK',
    alternateLocale: 'en_US',
    siteName: 'Desha News',
    title: 'දේශ News | ඔබේ හඬ. ඔබේ පුවත්.',
    description: 'ශ්‍රී ලංකාවෙන් සහ ලෝකයෙන් පුවත්, කතාබහ සහ නව අදහස්.',
    images: [{ url: '/images/desha-logo.jpeg', width: 600, height: 600, alt: 'Desha News Logo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'දේශ News | ඔබේ හඬ. ඔබේ පුවත්.',
    description: 'ශ්‍රී ලංකාවෙන් සහ ලෝකයෙන් පුවත්, කතාබහ සහ නව අදහස්.',
    images: ['/images/desha-logo.jpeg'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="si" data-scroll-behavior="smooth">
      <head>
        {adsenseClientId && (
          <Script
            id="google-adsense"
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${
              adsenseClientId.startsWith('ca-') ? adsenseClientId : `ca-${adsenseClientId}`
            }`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body>
        <SiteProvider>{children}</SiteProvider>
      </body>
    </html>
  );
}
