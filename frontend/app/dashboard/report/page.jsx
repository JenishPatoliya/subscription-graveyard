// frontend/app/dashboard/report/page.jsx

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI, reportAPI } from '../../../lib/api'
import { formatCurrency, formatDate } from '../../../lib/utils'
import Navbar from '../../../components/Navbar'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function ReportPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const me = await authAPI.getMe()
        setUser(me.user)

        const data = await reportAPI.get()
        setReport(data)
      } catch (err) {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  if (loading) return <LoadingSpinner />

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
          📈 Spending Report
        </h2>
        <p style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.3)',
          marginBottom: 28
        }}>
          Based on receipts found in your Gmail
        </p>

        {/* Summary cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 28
        }}>
          {[
            {
              label: 'Monthly Spend',
              value: formatCurrency(report?.totalMonthly || 0),
              sub: 'current subscriptions'
            },
            {
              label: 'Yearly Projection',
              value: formatCurrency(report?.totalYearly || 0),
              sub: 'if all continue'
            },
            {
              label: 'Potential Savings',
              value: formatCurrency(report?.potentialSavings || 0),
              sub: 'estimate — verify first',
              color: '#FF4455',
              bg: 'rgba(255,68,85,0.06)',
              border: 'rgba(255,68,85,0.18)'
            }
          ].map(c => (
            <div key={c.label} style={{
              background: c.bg || 'rgba(255,255,255,0.03)',
              border: `1px solid ${c.border || 'rgba(255,255,255,0.07)'}`,
              borderRadius: 18,
              padding: '20px 22px'
            }}>
              <div style={{
                fontSize: 9,
                letterSpacing: 2.5,
                color: 'rgba(255,255,255,0.3)',
                fontWeight: 700,
                marginBottom: 10
              }}>
                {c.label.toUpperCase()}
              </div>
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 28,
                fontWeight: 900,
                color: c.color || '#fff',
                marginBottom: 4
              }}>
                {c.value}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                {c.sub}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* By category */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20,
            padding: '24px'
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: 2,
              color: 'rgba(255,255,255,0.3)',
              fontWeight: 700,
              marginBottom: 20
            }}>
              BY CATEGORY
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}>
              {(report?.byCategory || []).map((cat, i) => (
                <div key={i}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6
                  }}>
                    <span style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.7)'
                    }}>
                      {cat.name}
                    </span>
                    <span style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#fff'
                    }}>
                      {formatCurrency(cat.amount)}
                      <span style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.3)',
                        marginLeft: 6
                      }}>
                        {cat.percentage}%
                      </span>
                    </span>
                  </div>
                  <div style={{
                    height: 4,
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${cat.percentage}%`,
                      background: 'linear-gradient(90deg, #FF4455, #FF8866)',
                      borderRadius: 2
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top by cost */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20,
            padding: '24px'
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: 2,
              color: 'rgba(255,255,255,0.3)',
              fontWeight: 700,
              marginBottom: 20
            }}>
              TOP BY COST
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              {(report?.topSubscriptions || []).map((sub, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: i < (report.topSubscriptions.length - 1)
                    ? '1px solid rgba(255,255,255,0.04)'
                    : 'none'
                }}>
                  <div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#fff'
                    }}>
                      {sub.name}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.3)'
                    }}>
                      {formatCurrency(sub.yearly)}/year
                    </div>
                  </div>
                  <div style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#fff'
                  }}>
                    {formatCurrency(sub.monthly)}/mo
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* No recent receipt */}
        {report?.noRecentReceipt?.length > 0 && (
          <div style={{
            background: 'rgba(255,184,0,0.05)',
            border: '1px solid rgba(255,184,0,0.15)',
            borderRadius: 20,
            padding: '24px',
            marginTop: 16
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: 2,
              color: '#FFB800',
              fontWeight: 800,
              marginBottom: 16
            }}>
              ⚠️ NO RECENT RECEIPT — REVIEW THESE
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginBottom: 16
            }}>
              {report.noRecentReceipt.map((sub, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 12
                }}>
                  <div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#fff'
                    }}>
                      {sub.name}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.3)'
                    }}>
                      Last receipt: {formatDate(sub.lastReceipt)}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: 15,
                    fontWeight: 800,
                    color: '#FFB800'
                  }}>
                    {formatCurrency(sub.amount)}/mo
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.3)',
              textAlign: 'center'
            }}>
              ⚠️ Potential savings estimate: {formatCurrency(report.potentialSavings)}/month
              <br />
              Verify each subscription before cancelling.
              Based on receipt gap analysis only.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}