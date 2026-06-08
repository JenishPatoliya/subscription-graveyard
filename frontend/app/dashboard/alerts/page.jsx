// frontend/app/dashboard/alerts/page.jsx

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI, alertsAPI } from '../../../lib/api'
import { formatCurrency, formatDate } from '../../../lib/utils'
import Navbar from '../../../components/Navbar'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function AlertsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const me = await authAPI.getMe()
        setUser(me.user)

        const data = await alertsAPI.getAll()
        setUpcoming(data.upcoming || [])
        setRecent(data.recent || [])
      } catch (err) {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  if (loading) return <LoadingSpinner />

  const getDaysColor = (days) => {
    if (days <= 3) return { color: '#FF4455', bg: 'rgba(255,68,85,0.1)', border: 'rgba(255,68,85,0.25)' }
    if (days <= 7) return { color: '#FFB800', bg: 'rgba(255,184,0,0.1)', border: 'rgba(255,184,0,0.25)' }
    return { color: '#00E676', bg: 'rgba(0,230,118,0.1)', border: 'rgba(0,230,118,0.25)' }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#070709' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 20px 48px' }}>
        <Navbar user={user} />

        <h2 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 22,
          fontWeight: 900,
          color: '#fff',
          marginBottom: 6
        }}>
          🔔 Renewal Alerts
        </h2>
        <p style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.3)',
          marginBottom: 28
        }}>
          Extracted from your Gmail receipts. Actual charge dates may vary.
        </p>

        {/* Upcoming */}
        <div style={{
          fontSize: 10,
          letterSpacing: 2,
          color: 'rgba(255,255,255,0.3)',
          fontWeight: 700,
          marginBottom: 14
        }}>
          UPCOMING CHARGES
        </div>

        {upcoming.length === 0 ? (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16,
            padding: 24,
            textAlign: 'center',
            color: 'rgba(255,255,255,0.3)',
            marginBottom: 32
          }}>
            No upcoming renewals in next 30 days
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginBottom: 32
          }}>
            {upcoming.map((sub, i) => {
              const colors = getDaysColor(sub.daysUntil)
              return (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 16,
                  padding: '18px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: `${colors.color}15`,
                      border: `1px solid ${colors.color}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20
                    }}>
                      💳
                    </div>
                    <div>
                      <div style={{
                        fontFamily: "'Syne', sans-serif",
                        fontSize: 15,
                        fontWeight: 800,
                        color: '#fff'
                      }}>
                        {sub.service_name}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.35)',
                        marginTop: 2
                      }}>
                        Renews {formatDate(sub.next_renewal_date)} ·
                        {formatCurrency(sub.amount)} will be charged
                      </div>
                    </div>
                  </div>
                  <div style={{
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 20,
                    padding: '4px 12px',
                    fontSize: 10,
                    color: colors.color,
                    fontWeight: 800,
                    letterSpacing: 1
                  }}>
                    {sub.daysUntil} DAYS
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Recent */}
        <div style={{
          fontSize: 10,
          letterSpacing: 2,
          color: 'rgba(255,255,255,0.3)',
          fontWeight: 700,
          marginBottom: 14
        }}>
          RECENTLY CHARGED
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          {recent.map((r, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 14,
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              opacity: 0.7
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 18 }}>🧾</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                    {r.subscriptions?.service_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                    {formatDate(r.receipt_date)}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.6)'
                }}>
                  {formatCurrency(r.amount)}
                </div>
                <div style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.2)',
                  letterSpacing: 1
                }}>
                  CHARGED
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 24,
          fontSize: 11,
          color: 'rgba(255,255,255,0.2)',
          textAlign: 'center'
        }}>
          Renewal dates extracted from Gmail receipt emails only.
        </div>
      </div>
    </div>
  )
}