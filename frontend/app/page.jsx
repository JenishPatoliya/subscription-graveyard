// frontend/app/page.jsx

'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LandingPage() {
  const router = useRouter()
  const [hoveredBtn, setHoveredBtn] = useState(null)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#070709',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 24px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>

      {/* Background glows */}
      <div style={{
        position: 'fixed',
        top: '-20%',
        left: '-10%',
        width: 700,
        height: 700,
        background: 'radial-gradient(circle, rgba(255,68,85,0.06) 0%, transparent 65%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'fixed',
        bottom: '-10%',
        right: '-10%',
        width: 600,
        height: 600,
        background: 'radial-gradient(circle, rgba(70,135,255,0.04) 0%, transparent 65%)',
        pointerEvents: 'none'
      }} />

      <div style={{
        position: 'relative',
        maxWidth: 560,
        animation: 'fadeUp 0.5s ease'
      }}>

        {/* Badge */}
        <div style={{
          display: 'inline-block',
          background: 'rgba(255,68,85,0.1)',
          border: '1px solid rgba(255,68,85,0.25)',
          borderRadius: 20,
          padding: '5px 16px',
          fontSize: 10,
          color: '#FF4455',
          letterSpacing: 3,
          fontWeight: 800,
          marginBottom: 28
        }}>
          💀 SUBSCRIPTION GRAVEYARD
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 48,
          fontWeight: 900,
          lineHeight: 1.1,
          marginBottom: 20,
          color: '#fff'
        }}>
          Know exactly what<br />
          <span style={{
            background: 'linear-gradient(135deg, #FF4455, #FF8866)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            you're paying for
          </span>
        </h1>

        {/* Subtext */}
        <p style={{
          fontSize: 15,
          color: 'rgba(255,255,255,0.4)',
          lineHeight: 1.8,
          marginBottom: 40,
          fontFamily: 'monospace'
        }}>
          Connect Gmail. We find every subscription receipt
          automatically. See your complete spending picture
          in 2 minutes. Free.
        </p>

        {/* Buttons */}
        <div style={{
          display: 'flex',
          gap: 12,
          marginBottom: 56,
          justifyContent: 'center'
        }}>
          <button
            onClick={() => router.push('/signup')}
            onMouseEnter={() => setHoveredBtn('start')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              background: hoveredBtn === 'start'
                ? 'linear-gradient(135deg, #FF5566, #FF9977)'
                : 'linear-gradient(135deg, #FF4455, #FF8866)',
              border: 'none',
              borderRadius: 14,
              color: '#fff',
              padding: '15px 32px',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: "'Syne', sans-serif",
              boxShadow: hoveredBtn === 'start'
                ? '0 12px 36px rgba(255,68,85,0.45)'
                : '0 6px 20px rgba(255,68,85,0.3)',
              transform: hoveredBtn === 'start' ? 'translateY(-2px)' : 'none',
              transition: 'all 0.25s'
            }}
          >
            Get Started Free →
          </button>

          <button
            onClick={() => router.push('/login')}
            onMouseEnter={() => setHoveredBtn('login')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              background: hoveredBtn === 'login'
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14,
              color: hoveredBtn === 'login'
                ? '#fff'
                : 'rgba(255,255,255,0.5)',
              padding: '15px 28px',
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: "'Syne', sans-serif",
              transition: 'all 0.25s'
            }}
          >
            Sign In
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 48
        }}>
          {[
            { n: '₹2,800', l: 'found on average' },
            { n: '6+', l: 'subscriptions detected' },
            { n: '2 min', l: 'to scan inbox' }
          ].map(s => (
            <div key={s.l} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16,
              padding: '18px'
            }}>
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 26,
                fontWeight: 900,
                color: '#fff',
                marginBottom: 6
              }}>
                {s.n}
              </div>
              <div style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.3)',
                letterSpacing: 1
              }}>
                {s.l.toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 20,
          padding: '28px',
          textAlign: 'left'
        }}>
          <div style={{
            fontSize: 10,
            letterSpacing: 2.5,
            color: 'rgba(255,255,255,0.3)',
            fontWeight: 800,
            marginBottom: 24,
            textAlign: 'center'
          }}>
            HOW IT WORKS
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}>
            {[
              { icon: '👤', title: 'Create your account', desc: 'Email and password. 30 seconds.' },
              { icon: '📧', title: 'Connect your Gmail', desc: 'One click. Read-only access. We never see your password.' },
              { icon: '🔍', title: 'We scan your receipts', desc: 'AI reads every billing email and extracts subscription data.' },
              { icon: '📊', title: 'See your full picture', desc: 'Every subscription, every amount, every renewal date.' }
            ].map((s, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start'
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'rgba(255,68,85,0.1)',
                  border: '1px solid rgba(255,68,85,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0
                }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#fff',
                    marginBottom: 4
                  }}>
                    {s.title}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.35)',
                    lineHeight: 1.6
                  }}>
                    {s.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust bar */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            marginTop: 24,
            paddingTop: 20,
            display: 'flex',
            gap: 20,
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            {[
              '🔒 Read-only Gmail access',
              '✓ Never read personal emails',
              '✓ Disconnect anytime'
            ].map(t => (
              <span key={t} style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.3)'
              }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}