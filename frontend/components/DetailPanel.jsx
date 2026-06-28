// frontend/components/DetailPanel.jsx

'use client'
import { useState, useEffect } from 'react'
import { subscriptionsAPI } from '../lib/api'
import { formatCurrency, formatDate, getCategoryColor, getServiceEmoji } from '../lib/utils'

export default function DetailPanel({ sub, onClose, onStatusChange }) {
  const [tab, setTab] = useState('overview')
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)

  const color = getCategoryColor(sub.category)

  // Load receipts when panel opens
  useEffect(() => {
    const loadReceipts = async () => {
      setLoading(true)
      try {
        const data = await subscriptionsAPI.getOne(sub.id)
        setReceipts(data.receipts || [])
      } catch (err) {
        console.error('Failed to load receipts:', err)
      } finally {
        setLoading(false)
      }
    }
    loadReceipts()
  }, [sub.id])

  const handleMarkStatus = async (status) => {
    setUpdating(true)
    try {
      await subscriptionsAPI.updateStatus(sub.id, status)
      onStatusChange && onStatusChange(sub.id, status)
    } catch (err) {
      console.error('Update failed:', err)
    } finally {
      setUpdating(false)
    }
  }

  const daysSinceLastReceipt = sub.daysSinceLastReceipt

  return (
    <div style={{
      background: 'rgba(10,10,14,0.99)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 24,
      overflow: 'hidden',
      position: 'sticky',
      top: 20,
      boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      animation: 'slideIn 0.3s ease'
    }}>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${color}15, transparent)`,
        padding: '26px 26px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              background: `${color}18`,
              border: `2px solid ${color}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26
            }}>
              {getServiceEmoji(sub.service_name)}
            </div>
            <div>
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 20,
                fontWeight: 900,
                color: '#fff'
              }}>
                {sub.service_name}
              </div>
              <div style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.3)',
                letterSpacing: 1.5,
                marginTop: 3
              }}>
                {sub.category} · {sub.total_receipts} RECEIPTS FOUND
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: 'rgba(255,255,255,0.5)',
              width: 34,
              height: 34,
              cursor: 'pointer',
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Total spent */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '18px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{
              fontSize: 9,
              letterSpacing: 2.5,
              color: 'rgba(255,255,255,0.4)',
              fontWeight: 800,
              marginBottom: 6
            }}>
              TOTAL DETECTED SPEND
            </div>
            <div style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 36,
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1
            }}>
              {formatCurrency(sub.total_spent)}
            </div>
            <div style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.3)',
              marginTop: 4
            }}>
              based on {sub.total_receipts} receipts found in Gmail
            </div>
          </div>
          <span style={{ fontSize: 36 }}>🧾</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '0 26px'
      }}>
        {['Overview', 'Receipts'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t.toLowerCase())}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: tab === t.toLowerCase()
                ? '#fff'
                : 'rgba(255,255,255,0.3)',
              padding: '14px 16px',
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: tab === t.toLowerCase() ? 700 : 400,
              borderBottom: tab === t.toLowerCase()
                ? `2px solid ${color}`
                : '2px solid transparent',
              textTransform: 'uppercase',
              fontFamily: 'DM Mono',
              transition: 'all 0.2s'
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        padding: '24px 26px',
        maxHeight: 420,
        overflowY: 'auto'
      }}>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div>
            {/* Info grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginBottom: 20
            }}>
              {[
                { l: 'Monthly Charge', v: formatCurrency(sub.amount) },
                { l: 'Yearly Estimate', v: formatCurrency(sub.amount * 12) },
                { l: 'First Receipt', v: formatDate(sub.first_receipt_date) },
                { l: 'Last Receipt', v: formatDate(sub.last_receipt_date) }
              ].map(item => (
                <div key={item.l} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: '14px 16px'
                }}>
                  <div style={{
                    fontSize: 9,
                    letterSpacing: 2,
                    color: 'rgba(255,255,255,0.3)',
                    marginBottom: 6,
                    fontWeight: 700
                  }}>
                    {item.l.toUpperCase()}
                  </div>
                  <div style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#fff'
                  }}>
                    {item.v}
                  </div>
                </div>
              ))}
            </div>

            {/* Receipt gap warning */}
            {daysSinceLastReceipt > 90 && (
              <div style={{
                background: 'rgba(255,184,0,0.07)',
                border: '1px solid rgba(255,184,0,0.2)',
                borderRadius: 14,
                padding: '16px',
                marginBottom: 16
              }}>
                <div style={{
                  fontSize: 10,
                  color: '#FFB800',
                  letterSpacing: 2,
                  fontWeight: 800,
                  marginBottom: 8
                }}>
                  ⚠️ NO RECEIPT DETECTED SINCE {formatDate(sub.last_receipt_date).toUpperCase()}
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.7
                }}>
                  That was {daysSinceLastReceipt} days ago.
                  This may mean the subscription was cancelled,
                  paused, or the receipt went to spam.
                </div>
                <div style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.25)',
                  marginTop: 8
                }}>
                  Based on Gmail receipt gap only.
                  Log into {sub.service_name} to verify.
                </div>
              </div>
            )}

            {/* Single receipt warning */}
            {sub.first_receipt_date && sub.last_receipt_date &&
             sub.first_receipt_date === sub.last_receipt_date &&
             sub.total_receipts <= 1 && (
              <div style={{
                background: 'rgba(124,77,255,0.07)',
                border: '1px solid rgba(124,77,255,0.2)',
                borderRadius: 14,
                padding: '16px',
                marginBottom: 16
              }}>
                <div style={{
                  fontSize: 10,
                  color: '#7C4DFF',
                  letterSpacing: 2,
                  fontWeight: 800,
                  marginBottom: 8
                }}>
                  🔍 ONLY 1 RECEIPT FOUND
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.7
                }}>
                  We found only one receipt email for {sub.service_name}.
                  This could be a one-time purchase, a free trial,
                  or the subscription may no longer be active.
                </div>
                <div style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.25)',
                  marginTop: 8
                }}>
                  Check your {sub.service_name} account to verify if
                  this is still an active subscription.
                </div>
              </div>
            )}

            {/* Renewal info — only show as "upcoming" if date is in the future */}
            {sub.next_renewal_date && (() => {
              const renewalDate = new Date(sub.next_renewal_date)
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const isFuture = renewalDate >= today

              return isFuture ? (
                <div style={{
                  background: 'rgba(255,184,0,0.06)',
                  border: '1px solid rgba(255,184,0,0.18)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: 20 }}>⏰</span>
                  <div>
                    <div style={{
                      fontSize: 10,
                      color: '#FFB800',
                      letterSpacing: 2,
                      fontWeight: 800
                    }}>
                      UPCOMING CHARGE
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.7)',
                      marginTop: 2
                    }}>
                      {formatCurrency(sub.amount)} on {formatDate(sub.next_renewal_date)}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(255,68,85,0.06)',
                  border: '1px solid rgba(255,68,85,0.18)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: 20 }}>📅</span>
                  <div>
                    <div style={{
                      fontSize: 10,
                      color: '#FF4455',
                      letterSpacing: 2,
                      fontWeight: 800
                    }}>
                      RENEWAL DATE PASSED
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.7)',
                      marginTop: 2
                    }}>
                      Last known renewal was {formatDate(sub.next_renewal_date)}.
                      Check if still active.
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* RECEIPTS TAB */}
        {tab === 'receipts' && (
          <div>
            <div style={{
              fontSize: 10,
              letterSpacing: 2,
              color: 'rgba(255,255,255,0.3)',
              fontWeight: 700,
              marginBottom: 16
            }}>
              RECEIPTS FOUND IN YOUR GMAIL
            </div>

            {loading ? (
              <div style={{
                textAlign: 'center',
                color: 'rgba(255,255,255,0.3)',
                padding: 20
              }}>
                Loading receipts...
              </div>
            ) : receipts.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: 'rgba(255,255,255,0.3)',
                padding: 20
              }}>
                No receipts found
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginBottom: 16
              }}>
                {receipts.map((receipt, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#fff'
                      }}>
                        {formatDate(receipt.receipt_date)}
                      </div>
                      <div style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.3)',
                        marginTop: 2
                      }}>
                        Receipt email detected ✓
                      </div>
                    </div>
                    <div style={{
                      fontFamily: "'Syne', sans-serif",
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#fff'
                    }}>
                      {formatCurrency(receipt.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.2)',
              lineHeight: 1.7,
              textAlign: 'center'
            }}>
              All data sourced from your Gmail receipts only.
              <br />
              Showing last {receipts.length} of {sub.total_receipts} receipts found.
            </div>
          </div>
        )}


      </div>
    </div>
  )
}