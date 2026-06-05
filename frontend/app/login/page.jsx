// frontend/app/login/page.jsx

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI } from '../../lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError('')
    if (!email || !password) {
      setError('Please fill all fields')
      return
    }

    setLoading(true)
    try {
      const data = await authAPI.login(email, password)

      // Demo mode → go directly to dashboard
      if (data.mode === 'demo') {
        router.push('/dashboard')
        return
      }

      // Real user → check if Gmail connected
      if (data.gmailConnected) {
        router.push('/dashboard')
      } else {
        router.push('/connect-gmail')
      }

    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Try again.')
    } finally {
      setLoading(false)
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
      <div style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>👋</div>
          <h2 style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 26,
            fontWeight: 900,
            color: '#fff',
            marginBottom: 8
          }}>
            Welcome Back
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            Sign in to your graveyard
          </p>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 24,
          padding: '32px 28px'
        }}>

          <InputField
            label="Email"
            icon="📧"
            type="email"
            placeholder="raj@gmail.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <InputField
            label="Password"
            icon="🔒"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />

          {error && (
            <div style={{
              background: 'rgba(255,68,85,0.1)',
              border: '1px solid rgba(255,68,85,0.25)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 12,
              color: '#FF4455',
              marginBottom: 16
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Demo hint */}
          <div style={{
            background: 'rgba(255,184,0,0.06)',
            border: '1px solid rgba(255,184,0,0.15)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 11,
            color: 'rgba(255,184,0,0.8)',
            marginBottom: 16,
            cursor: 'pointer'
          }}
          onClick={() => {
            setEmail('demo@subscriptiongraveyard.com')
            setPassword('demo123')
          }}>
            💡 Try demo: demo@subscriptiongraveyard.com / demo123
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%',
              background: loading
                ? 'rgba(255,68,85,0.5)'
                : 'linear-gradient(135deg, #FF4455, #FF8866)',
              border: 'none',
              borderRadius: 14,
              color: '#fff',
              padding: '15px',
              fontSize: 14,
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Syne', sans-serif"
            }}
          >
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              New here?{' '}
            </span>
            <span
              onClick={() => router.push('/signup')}
              style={{
                fontSize: 12,
                color: '#FF4455',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Create Account
            </span>
          </div>
        </div>

        <div
          onClick={() => router.push('/')}
          style={{
            textAlign: 'center',
            marginTop: 16,
            fontSize: 12,
            color: 'rgba(255,255,255,0.2)',
            cursor: 'pointer'
          }}
        >
          ← Back to home
        </div>
      </div>
    </div>
  )
}

function InputField({ label, icon, type = 'text', placeholder, value, onChange, onKeyDown }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
        marginBottom: 8,
        letterSpacing: 1,
        fontWeight: 700
      }}>
        {label.toUpperCase()}
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: focused ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        border: focused ? '1px solid rgba(255,68,85,0.5)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: '14px 18px',
        transition: 'all 0.2s'
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: 14,
            width: '100%',
            fontFamily: 'DM Mono'
          }}
        />
      </div>
    </div>
  )
}