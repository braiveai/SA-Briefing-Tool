import './globals.css';

export const metadata = {
  title: 'Creative Brief Builder | Sunny Advertising',
  description: 'Build and manage creative briefs for your campaigns',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
