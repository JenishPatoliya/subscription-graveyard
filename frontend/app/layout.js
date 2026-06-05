// frontend/app/layout.jsx

import './globals.css'

export const metadata = {
  title: 'Subscription Graveyard',
  description: 'Know exactly what you are paying for',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Mono:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}