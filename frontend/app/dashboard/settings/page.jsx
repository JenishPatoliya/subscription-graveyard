// frontend/app/dashboard/settings/page.jsx

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI, settingsAPI, gmailAPI } from '../../../lib/api'
import { formatDate } from '../../../lib/utils'
import Navbar from '../../../components/Navbar'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [gmailAccounts, setGmailAccounts] = useState([])
  const [prefs, setPrefs] = useState({
    email_alerts: true,
    days_before: 3,
    weekly_digest: true
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const me = await authAPI.getMe()
        setUser(me.user)

        const data = await settingsAPI.get()
        setGmailAccounts(data.gmailAccounts || [])
        if (data.preferences) setPrefs(data.preferences)
      } catch (err) {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const handleSavePrefs = async () => {
    setSaving(true)
    try {
      await settingsAPI.updatePreferences({
        emailAlerts: prefs.email_alerts,
        daysBefore: prefs.days_before,
        weeklyDigest: prefs.weekly_digest
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async (gmail) => {
    if (!confirm(`Disconnect ${gmail}?`)) return
    try {
      await gmailAPI.disconnect(gmail)
      setGmailAccounts(prev => prev.filter(a => a.gmail_address !== gmail))
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }

  const handleDeleteData = async () => {
    if (!confirm('Delete all your subscription data? This cannot be undone.')) return
    try {
      await settingsAPI.deleteAllData()
      alert('All data deleted successfully')
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const handleLogout = async () => {
    await authAPI.logout()
    router.push('/')
  }

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
          marginBottom: 28
        }}>
          ⚙️ Settings
        </h2>

        {/* Account card */}
        <SettingsCard title="YOUR ACCOUNT">
          <div style={{
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            marginBottom: 20
          }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FF4455, #FF8866)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22
            }}>
              👤
            </div>
            <div>
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 16,
                fontWeight: 800,
                color: '#fff'
              }}>
                {user?.name}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                {user?.email}
              </div>
              <div style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.25)',
                marginTop: 2
              }}>
                Plan: {user?.plan?.toUpperCase()} · 
                Member since {formatDate(user?.created_at)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <GhostButton label="Edit Profile" onClick={() => {}} />
            <DangerButton label="Sign Out" onClick={handleLogout} />
          </div>
        </SettingsCard>

        {/* Gmail accounts */}
        <SettingsCard title="GMAIL CONNECTIONS">
          {gmailAccounts.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              No Gmail connected yet.
            </div>
          ) : (
            gmailAccounts.map((account, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 0',
                borderBottom: i < gmailAccounts.length - 1
                  ? '1px solid rgba(255,255,255,0.05)'
                  : 'none'
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 20 }}>📧</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                      {account.gmail_address}
                      {account.is_primary && (
                        <span style={{
                          background: 'rgba(0,230,118,0.1)',
                          color: '#00E676',
                          fontSize: 9,
                          padding: '2px 8px',
                          borderRadius: 10,
                          marginLeft: 8,
                          letterSpacing: 1
                        }}>
                          PRIMARY
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#00E676', marginTop: 2 }}>
                      ✅ Connected · Read only
                    </div>
                    {account.last_scanned && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                        Last scanned: {formatDate(account.last_scanned)} ·
                        {account.emails_scanned} emails
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <GhostButton
                    label="Rescan"
                    onClick={() => gmailAPI.rescan()}
                    small
                  />
                  <DangerButton
                    label="Disconnect"
                    onClick={() => handleDisconnect(account.gmail_address)}
                    small
                  />
                </div>
              </div>
            ))
          )}
          <div style={{
            marginTop: 14,
            fontSize: 11,
            color: 'rgba(255,255,255,0.2)'
          }}>
            Disconnecting removes our access immediately.
            Your subscription data stays unless you delete it.
          </div>
        </SettingsCard>

        {/* Alert preferences */}
        <SettingsCard title="ALERT PREFERENCES">
          {/* Email alerts toggle */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                Email alerts before renewals
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                Get notified before you're charged
              </div>
            </div>
            <Toggle
              on={prefs.email_alerts}
              onChange={() => setPrefs(p => ({ ...p, email_alerts: !p.email_alerts }))}
            />
          </div>

          {/* Days before selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
              Alert me how many days before?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 3, 5, 7].map(d => (
                <button
                  key={d}
                  onClick={() => setPrefs(p => ({ ...p, days_before: d }))}
                  style={{
                    background: prefs.days_before === d
                      ? 'rgba(255,68,85,0.15)'
                      : 'rgba(255,255,255,0.04)',
                    border: prefs.days_before === d
                      ? '1px solid rgba(255,68,85,0.4)'
                      : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    color: prefs.days_before === d
                      ? '#FF4455'
                      : 'rgba(255,255,255,0.4)',
                    padding: '8px 18px',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "'Syne', sans-serif"
                  }}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          {/* Weekly digest toggle */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                Weekly spending digest
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                Monday email with your spending summary
              </div>
            </div>
            <Toggle
              on={prefs.weekly_digest}
              onChange={() => setPrefs(p => ({ ...p, weekly_digest: !p.weekly_digest }))}
            />
          </div>

          <button
            onClick={handleSavePrefs}
            disabled={saving}
            style={{
              background: saved
                ? 'rgba(0,230,118,0.15)'
                : 'linear-gradient(135deg, #FF4455, #FF8866)',
              border: saved ? '1px solid rgba(0,230,118,0.3)' : 'none',
              borderRadius: 12,
              color: saved ? '#00E676' : '#fff',
              padding: '12px 24px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Syne', sans-serif"
            }}
          >
            {saved ? '✅ Saved!' : saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </SettingsCard>

        {/* Data and privacy */}
        <SettingsCard title="DATA & PRIVACY">
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#00E676', marginBottom: 6 }}>
              WHAT WE STORE
            </div>
            {['Subscription names and amounts', 'Renewal dates from emails', 'Receipt dates'].map(t => (
              <div key={t} style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.5)',
                marginBottom: 4
              }}>
                ✓ {t}
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#FF4455', marginBottom: 6 }}>
              WHAT WE NEVER STORE
            </div>
            {['Email content or body text', 'Personal emails', 'Your email password'].map(t => (
              <div key={t} style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.5)',
                marginBottom: 4
              }}>
                ✗ {t}
              </div>
            ))}
          </div>
          <button
            onClick={handleDeleteData}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,68,85,0.3)',
              borderRadius: 12,
              color: '#FF4455',
              padding: '12px 24px',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'DM Mono'
            }}
          >
            Delete All My Data
          </button>
          <div style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.2)',
            marginTop: 8
          }}>
            This permanently removes all subscription data.
            Your account will remain.
          </div>
        </SettingsCard>
      </div>
    </div>
  )
}

// Reusable components for settings
function SettingsCard({ title, children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 20,
      padding: '24px',
      marginBottom: 16
    }}>
      <div style={{
        fontSize: 10,
        letterSpacing: 2,
        color: 'rgba(255,255,255,0.3)',
        fontWeight: 700,
        marginBottom: 20
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function GhostButton({ label, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      color: 'rgba(255,255,255,0.5)',
      padding: small ? '7px 14px' : '10px 18px',
      fontSize: small ? 11 : 13,
      cursor: 'pointer',
      fontFamily: 'DM Mono'
    }}>
      {label}
    </button>
  )
}

function DangerButton({ label, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      background: 'rgba(255,68,85,0.1)',
      border: '1px solid rgba(255,68,85,0.2)',
      borderRadius: 10,
      color: '#FF4455',
      padding: small ? '7px 14px' : '10px 18px',
      fontSize: small ? 11 : 13,
      cursor: 'pointer',
      fontFamily: 'DM Mono'
    }}>
      {label}
    </button>
  )
}

function Toggle({ on, onChange }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: on ? '#FF4455' : 'rgba(255,255,255,0.1)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.3s',
        border: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0
      }}
    >
      <div style={{
        position: 'absolute',
        top: 2,
        left: on ? 22 : 2,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.3s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }} />
    </div>
  )
}