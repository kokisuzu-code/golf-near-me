import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ゴルフ場検索',
  description: '近くのゴルフ場を探す',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: 'sans-serif', background: '#f0f4f0' }}>
        {children}
      </body>
    </html>
  )
}
