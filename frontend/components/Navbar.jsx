// frontend/components/Navbar.jsx

'use client'
import { useRouter, usePathname } from 'next/navigation'

export default function Navbar({ user }) {
  const router = useRouter()
  const pathname = usePathname()

  const navItems = [
    { path: '/dashboard', label: '📊 Dashboard' },
    { path: '/dashboard/insights', label: '🧠 AI Insights' },
    { path: '/dashboard/alerts', label: '🔔 Alerts' },
    { path: '/dashboard/report', label: '📈 Report' },
    { path: '/dashboard/settings', label: '⚙️ Settings' }
  ]

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '22px 0 26px'
    }}>
      {/* Logo */}
      <div>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 18,
          fontWeight: 900
        }}>
          💀{' '}
          <span style={{ color: '#FF4455' }}>Subscription</span>
          Graveyard
        </div>
        {user && (
          <div style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.2)',
            letterSpacing: 3,
            marginTop: 3
          }}>
            WELCOME BACK, {user.name?.toUpperCase()} 👋
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {navItems.map(item => (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            style={{
              background: pathname === item.path
                ? 'rgba(255,68,85,0.12)'
                : 'rgba(255,255,255,0.04)',
              border: pathname === item.path
                ? '1px solid rgba(255,68,85,0.3)'
                : '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              color: pathname === item.path
                ? '#FF4455'
                : 'rgba(255,255,255,0.4)',
              padding: '9px 16px',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'DM Mono',
              fontWeight: pathname === item.path ? 700 : 400,
              transition: 'all 0.2s'
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}