// frontend/app/signup/page.jsx

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI } from '../../lib/api'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async () => {
    setError('')

    if (!name || !email || !password) {
      setError('Please fill all fields')
      return
    }
    if (!email.includes('@')) {
      setError('Enter a valid email')
      return
    }
    if (password.length < 6) {
      setError('Password must be 6+ characters')
      return
    }

    setLoading(true)
    try {
      await authAPI.signup(name, email, password)
      router.push('/connect-gmail')
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Signup failed. Try again.')
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

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>💀</div>
          <h2 style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 26,
            fontWeight: 900,
            color: '#fff',
            marginBottom: 8
          }}>
            Create Account
          </h2>
          <p style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.35)'
          }}>
            Find your forgotten subscriptions in 2 minutes
          </p>
        </div>

        {/* Form */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 24,
          padding: '32px 28px'
        }}>

          <InputField
            label="Full Name"
            icon="👤"
            placeholder="Raj Kumar"
            value={name}
            onChange={e => setName(e.target.value)}
          />

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
            placeholder="Minimum 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
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

          <PrimaryButton
            onClick={handleSignup}
            loading={loading}
            label="Create Account →"
          />

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              Already have account?{' '}
            </span>
            <span
              onClick={() => router.push('/login')}
              style={{
                fontSize: 12,
                color: '#FF4455',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Sign In
            </span>
          </div>
        </div>

        {/* Trust badges */}
        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
          marginTop: 20
        }}>
          {['🔒 Encrypted', '🛡️ Never sold', '✓ Free forever'].map(t => (
            <span key={t} style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.25)'
            }}>
              {t}
            </span>
          ))}
        </div>

        {/* Back link */}
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

// Reusable input component
function InputField({ label, icon, type = 'text', placeholder, value, onChange }) {
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
        background: focused
          ? 'rgba(255,255,255,0.07)'
          : 'rgba(255,255,255,0.04)',
        border: focused
          ? '1px solid rgba(255,68,85,0.5)'
          : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: '14px 18px',
        transition: 'all 0.2s',
        boxShadow: focused ? '0 0 0 3px rgba(255,68,85,0.1)' : 'none'
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
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

// Reusable primary button
function PrimaryButton({ onClick, loading, label }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        background: loading
          ? 'rgba(255,68,85,0.5)'
          : hovered
          ? 'linear-gradient(135deg, #FF5566, #FF9977)'
          : 'linear-gradient(135deg, #FF4455, #FF8866)',
        border: 'none',
        borderRadius: 14,
        color: '#fff',
        padding: '15px',
        fontSize: 14,
        fontWeight: 800,
        cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: "'Syne', sans-serif",
        boxShadow: hovered && !loading
          ? '0 12px 36px rgba(255,68,85,0.45)'
          : '0 6px 20px rgba(255,68,85,0.3)',
        transform: hovered && !loading ? 'translateY(-2px)' : 'none',
        transition: 'all 0.25s'
      }}
    >
      {loading ? 'Creating account...' : label}
    </button>
  )
}