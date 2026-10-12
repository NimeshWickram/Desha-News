import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: { default: 'දේශ News | ඔබේ හඬ. ඔබේ පුවත්.', template: '%s | දේශ News' }, description: 'ශ්‍රී ලංකාවෙන් සහ ලෝකයෙන් පුවත්, කතාබහ සහ නව අදහස්. Desha News සිංහල පුවත් වෙබ් අඩවිය.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="si"><body>{children}</body></html>; }
