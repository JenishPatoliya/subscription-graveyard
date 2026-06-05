// frontend/app/connect-gmail/page.jsx

'use client'
import { useState } from 'react'
import { gmailAPI } from '../../lib/api'

export default function ConnectGmailPage() {
  const [connecting, setConnecting] = useState(false)

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const data = await gmailAPI.getAuthUrl()
      window.location.href = data.url
    } catch (err) {
      console.error('Failed to get auth URL:', err)
      setConnecting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#070709',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 460,
        textAlign: 'center'
      }}>

        <div style={{ fontSize: 52, marginBottom: 20 }}>📧</div>

        <h2 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 28,
          fontWeight: 900,
          color: '#fff',
          marginBottom: 12
        }}>
          Connect your Gmail
        </h2>

        <p style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.4)',
          lineHeight: 1.8,
          marginBottom: 36,
          fontFamily: 'monospace'
        }}>
          We need read-only access to find your subscription
          receipts. We never read personal emails.
        </p>

        {/* What we scan */}
        <div style={{
          background: 'rgba(0,230,118,0.05)',
          border: '1px solid rgba(0,230,118,0.15)',
          borderRadius: 16,
          padding: '20px',
          marginBottom: 16,
          textAlign: 'left'
        }}>
          <div style={{
            fontSize: 10,
            letterSpacing: 2,
            color: '#00E676',
            fontWeight: 800,
            marginBottom: 14
          }}>
            WHAT WE LOOK FOR
          </div>
          {[
            'Payment receipts and invoices',
            'Subscription renewal emails',
            'Billing confirmation emails'
          ].map(t => (
            <div key={t} style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              marginBottom: 10,
              fontSize: 13,
              color: 'rgba(255,255,255,0.6)'
            }}>
              <span>✅</span> {t}
            </div>
          ))}
        </div>

        {/* What we never do */}
        <div style={{
          background: 'rgba(255,68,85,0.05)',
          border: '1px solid rgba(255,68,85,0.15)',
          borderRadius: 16,
          padding: '20px',
          marginBottom: 32,
          textAlign: 'left'
        }}>
          <div style={{
            fontSize: 10,
            letterSpacing: 2,
            color: '#FF4455',
            fontWeight: 800,
            marginBottom: 14
          }}>
            WE NEVER DO
          </div>
          {[
            'Read your personal emails',
            'Send emails on your behalf',
            'Store your email password',
            'Access attachments or contacts'
          ].map(t => (
            <div key={t} style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              marginBottom: 10,
              fontSize: 13,
              color: 'rgba(255,255,255,0.6)'
            }}>
              <span>🚫</span> {t}
            </div>
          ))}
        </div>

        {/* Connect button */}
        <button
          onClick={handleConnect}
          disabled={connecting}
          style={{
            width: '100%',
            background: connecting
              ? 'rgba(255,68,85,0.5)'
              : 'linear-gradient(135deg, #FF4455, #FF8866)',
            border: 'none',
            borderRadius: 14,
            color: '#fff',
            padding: '16px',
            fontSize: 15,
            fontWeight: 800,
            cursor: connecting ? 'not-allowed' : 'pointer',
            fontFamily: "'Syne', sans-serif",
            marginBottom: 16
          }}
        >
          {connecting ? '⏳ Connecting...' : '🔗 Connect Gmail with Google'}
        </button>

        <p style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.2)',
          lineHeight: 1.7
        }}>
          Powered by Google OAuth 2.0.
          You approve access on Google's own page.
          Revoke anytime from myaccount.google.com
        </p>
      </div>
    </div>
  )
}