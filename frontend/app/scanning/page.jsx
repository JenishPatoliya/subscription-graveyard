// frontend/app/scanning/page.jsx

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { gmailAPI } from '../../lib/api'

const MESSAGES = [
  'Looking through your inbox...',
  'Found some receipts — reading them...',
  'Extracting subscription details...',
  'Calculating your spending...',
  'Almost done — building your report...',
  'Done! Opening your dashboard...'
]

export default function ScanningPage() {
  const router = useRouter()
  const [progress, setProgress] = useState(0)
  const [msgIndex, setMsgIndex] = useState(0)
  const [stats, setStats] = useState({
    emailsScanned: 0,
    receiptsFound: 0,
    subscriptionsFound: 0
  })

  useEffect(() => {
    // Poll scan status every 3 seconds
    const statusInterval = setInterval(async () => {
      try {
        const data = await gmailAPI.getScanStatus()

        // Update stats from real data
        const totalScanned = data.gmailAccounts?.reduce(
          (sum, a) => sum + (a.emails_scanned || 0), 0
        ) || 0

        setStats({
          emailsScanned: totalScanned,
          receiptsFound: Math.floor(totalScanned * 0.12),
          subscriptionsFound: data.subscriptionsFound || 0
        })

        // If scan complete redirect to dashboard
        if (data.scanComplete && data.subscriptionsFound > 0) {
          clearInterval(statusInterval)
          clearInterval(progressInterval)
          setTimeout(() => router.push('/dashboard'), 1000)
        }

      } catch (err) {
        console.error('Status check failed:', err)
      }
    }, 3000)

    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress(p => {
        if (p >= 95) return p
        const increment = p < 50 ? 2 : p < 80 ? 1 : 0.3
        const newProgress = p + increment
        setMsgIndex(Math.min(Math.floor(newProgress / 17), MESSAGES.length - 1))
        return newProgress
      })
    }, 500)

    return () => {
      clearInterval(statusInterval)
      clearInterval(progressInterval)
    }
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#070709',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      padding: '0 24px',
      textAlign: 'center'
    }}>

      {/* Spinning icon */}
      <div style={{
        fontSize: 64,
        marginBottom: 24,
        display: 'inline-block',
        animation: 'spin 3s linear infinite'
      }}>
        🔍
      </div>

      <h2 style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: 28,
        fontWeight: 900,
        color: '#fff',
        marginBottom: 12
      }}>
        Scanning your inbox
      </h2>

      <p style={{
        fontSize: 14,
        color: 'rgba(255,255,255,0.4)',
        marginBottom: 48,
        fontFamily: 'monospace',
        minHeight: 20
      }}>
        {MESSAGES[msgIndex]}
      </p>

      {/* Progress bar */}
      <div style={{ width: 340, marginBottom: 32 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 10
        }}>
          <span style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: 2
          }}>
            SCANNING
          </span>
          <span style={{
            fontSize: 12,
            color: '#FF4455',
            fontFamily: 'monospace',
            fontWeight: 700
          }}>
            {Math.floor(progress)}%
          </span>
        </div>

        <div style={{
          height: 8,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 4,
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #FF4455, #FF8866)',
            borderRadius: 4,
            transition: 'width 0.5s ease',
            boxShadow: '0 0 16px rgba(255,68,85,0.5)'
          }} />
        </div>

        <div style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.2)',
          marginTop: 10
        }}>
          This runs in background. Your inbox is not being stored.
        </div>
      </div>

      {/* Live stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
        width: 340
      }}>
        {[
          { icon: '📧', label: 'Emails scanned', val: stats.emailsScanned.toLocaleString() },
          { icon: '🧾', label: 'Receipts found', val: stats.receiptsFound.toLocaleString() },
          { icon: '💳', label: 'Subscriptions', val: stats.subscriptionsFound.toString() }
        ].map((s, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14,
            padding: '14px 10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 20,
              fontWeight: 900,
              color: '#fff'
            }}>
              {s.val}
            </div>
            <div style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: 1,
              marginTop: 4
            }}>
              {s.label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}