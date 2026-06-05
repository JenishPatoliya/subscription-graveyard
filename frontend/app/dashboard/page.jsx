// frontend/app/dashboard/page.jsx

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI, subscriptionsAPI, alertsAPI } from '../../lib/api'
import { formatCurrency } from '../../lib/utils'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import AlertBanner from '../../components/AlertBanner'
import SubCard from '../../components/SubCard'
import DetailPanel from '../../components/DetailPanel'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [subscriptions, setSubscriptions] = useState([])
  const [alerts, setAlerts] = useState([])
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({
    serviceName: '',
    amount: '',
    category: 'Other',
    billingDate: ''
  })

  // Load everything on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Check auth
        const meData = await authAPI.getMe()
        setUser(meData.user)

        // Load subscriptions
        const subData = await subscriptionsAPI.getAll()
        setSubscriptions(subData.subscriptions || [])

        // Load alerts
        const alertData = await alertsAPI.getAll()
        setAlerts(alertData.upcoming || [])

      } catch (err) {
        // Not logged in → redirect
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  if (loading) return <LoadingSpinner message="Loading your dashboard..." />

  // Calculate stats
  const totalMonthly = subscriptions.reduce((s, x) => s + Number(x.amount), 0)
  const noRecentReceipt = subscriptions.filter(s => s.receiptStatus === 'long_gap')
  const potentialSavings = noRecentReceipt.reduce((s, x) => s + Number(x.amount), 0)
  const renewingSoon = subscriptions.filter(s => s.daysUntilRenewal !== null && s.daysUntilRenewal <= 7)

  // Filter subscriptions
  const filtered = filter === 'all'
    ? subscriptions
    : filter === 'no-receipt'
    ? subscriptions.filter(s => s.receiptStatus === 'long_gap')
    : subscriptions.filter(s => s.receiptStatus === 'recent')

  // Handle status change from detail panel
  const handleStatusChange = (id, status) => {
    setSubscriptions(prev =>
      prev.map(s => s.id === id ? { ...s, user_marked: status } : s)
    )
  }

  // Add manual subscription
  const handleAddManual = async () => {
    try {
      const data = await subscriptionsAPI.addManual(manualForm)
      setSubscriptions(prev => [...prev, data.subscription])
      setShowManual(false)
      setManualForm({ serviceName: '', amount: '', category: 'Other', billingDate: '' })
    } catch (err) {
      console.error('Failed to add manual:', err)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#070709',
      fontFamily: 'DM Mono'
    }}>
      {/* Background */}
      <div style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0
      }}>
        <div style={{
          position: 'absolute',
          top: '-20%',
          left: '-10%',
          width: 700,
          height: 700,
          background: 'radial-gradient(circle, rgba(255,68,85,0.04) 0%, transparent 65%)'
        }} />
      </div>

      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: 1140,
        margin: '0 auto',
        padding: '0 20px'
      }}>

        <Navbar user={user} />

        {/* Alert banner */}
        <AlertBanner
          alerts={alerts}
          onReview={(sub) => {
            const found = subscriptions.find(s => s.service_name === sub.service_name)
            if (found) setSelected(found)
          }}
        />

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 24
        }}>
          <StatCard
            label="Monthly Spend"
            value={formatCurrency(totalMonthly)}
            sub={`across ${subscriptions.length} subscriptions`}
          />
          <StatCard
            label="Potential Savings"
            value={formatCurrency(potentialSavings)}
            sub="estimate only — verify before cancelling"
            color="#FF4455"
            bg="rgba(255,68,85,0.06)"
            border="rgba(255,68,85,0.18)"
          />
          <StatCard
            label="Renewals This Month"
            value={`${renewingSoon.length}`}
            sub="subscriptions renewing soon"
            color="#FFB800"
            bg="rgba(255,184,0,0.06)"
            border="rgba(255,184,0,0.18)"
          />
          <StatCard
            label="Yearly Projection"
            value={formatCurrency(totalMonthly * 12)}
            sub="if all subscriptions continue"
            color="rgba(255,255,255,0.6)"
          />
        </div>

        {/* Filter tabs + Add manual button */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 20,
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { k: 'all', l: 'All Subscriptions', c: subscriptions.length },
              { k: 'no-receipt', l: '⚠️ No Recent Receipt', c: noRecentReceipt.length },
              { k: 'active', l: '✅ Recently Active', c: subscriptions.filter(s => s.receiptStatus === 'recent').length }
            ].map(t => (
              <button
                key={t.k}
                onClick={() => setFilter(t.k)}
                style={{
                  background: filter === t.k ? 'rgba(255,68,85,0.1)' : 'transparent',
                  border: filter === t.k ? '1px solid rgba(255,68,85,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  color: filter === t.k ? '#FF4455' : 'rgba(255,255,255,0.35)',
                  padding: '9px 18px',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'DM Mono',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  fontWeight: filter === t.k ? 700 : 400,
                  transition: 'all 0.2s'
                }}
              >
                {t.l}
                <span style={{
                  background: filter === t.k ? 'rgba(255,68,85,0.2)' : 'rgba(255,255,255,0.06)',
                  borderRadius: 6,
                  padding: '1px 8px',
                  fontSize: 10,
                  color: filter === t.k ? '#FF4455' : 'rgba(255,255,255,0.3)'
                }}>
                  {t.c}
                </span>
              </button>
            ))}
          </div>

          {/* Add manual button */}
          <button
            onClick={() => setShowManual(!showManual)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              color: 'rgba(255,255,255,0.4)',
              padding: '9px 16px',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'DM Mono'
            }}
          >
            + Add Manual
          </button>
        </div>

        {/* Manual add form */}
        {showManual && (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: '20px',
            marginBottom: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            alignItems: 'end'
          }}>
            {[
              { label: 'Service Name', key: 'serviceName', placeholder: 'Gym Membership' },
              { label: 'Amount ₹', key: 'amount', placeholder: '2000' },
              { label: 'Category', key: 'category', placeholder: 'Health' },
              { label: 'Next Billing Date', key: 'billingDate', type: 'date' }
            ].map(f => (
              <div key={f.key}>
                <div style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.3)',
                  marginBottom: 6,
                  letterSpacing: 1
                }}>
                  {f.label.toUpperCase()}
                </div>
                <input
                  type={f.type || 'text'}
                  placeholder={f.placeholder}
                  value={manualForm[f.key]}
                  onChange={e => setManualForm(prev => ({
                    ...prev,
                    [f.key]: e.target.value
                  }))}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    color: '#fff',
                    padding: '10px 14px',
                    fontSize: 13,
                    fontFamily: 'DM Mono',
                    outline: 'none'
                  }}
                />
              </div>
            ))}
            <button
              onClick={handleAddManual}
              style={{
                background: 'linear-gradient(135deg, #FF4455, #FF8866)',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                padding: '10px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Syne', sans-serif"
              }}
            >
              Add →
            </button>
          </div>
        )}

        {/* Main grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: selected ? '1fr 400px' : 'repeat(3, 1fr)',
          gap: 14,
          paddingBottom: 48,
          transition: 'grid-template-columns 0.3s'
        }}>

          {/* Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: selected ? '1fr' : 'repeat(3, 1fr)',
            gap: 12,
            alignContent: 'start'
          }}>
            {filtered.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.3)',
                padding: 40,
                fontSize: 14
              }}>
                No subscriptions found in this category
              </div>
            ) : (
              filtered.map(sub => (
                <SubCard
                  key={sub.id}
                  sub={sub}
                  selected={selected?.id === sub.id}
                  onClick={() => setSelected(
                    selected?.id === sub.id ? null : sub
                  )}
                />
              ))
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <DetailPanel
              sub={selected}
              onClose={() => setSelected(null)}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}