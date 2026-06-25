import type { Metadata } from 'next';
import '../styles.css';

export const metadata: Metadata = {
  title: 'Deadlock Build Simulator',
  description: 'Deadlock MOBA build simulator',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
