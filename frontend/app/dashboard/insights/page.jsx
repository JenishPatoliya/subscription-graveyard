// frontend/app/dashboard/insights/page.jsx

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI, insightsAPI } from '../../../lib/api'
import Navbar from '../../../components/Navbar'
import styles from './insights.module.css'

export default function InsightsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const meData = await authAPI.getMe()
        setUser(meData.user)

        const insightsData = await insightsAPI.get()
        setData(insightsData)
      } catch (err) {
        if (err.response?.status === 401) {
          router.push('/login')
        } else {
          setError('Failed to load AI insights. Make sure the backend is running.')
        }
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  // ─── Score color helper ───
  const getScoreColor = (score) => {
    if (score >= 70) return '#00E676'
    if (score >= 40) return '#FFB800'
    return '#FF4455'
  }

  // ─── SVG circle dash calc ───
  const getCircleDash = (score) => {
    const circumference = 2 * Math.PI * 48
    const offset = circumference - (score / 100) * circumference
    return { circumference, offset }
  }

  // ─── Anomaly type labels ───
  const anomalyTypeLabel = (type) => {
    const map = {
      price_hike: '📈 Price Hike',
      double_charge: '⚠️ Double Charge',
      unusual_timing: '⏰ Unusual Timing',
      amount_spike: '💰 Amount Spike',
    }
    return map[type] || type
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.background}>
          <div className={styles.glow1} />
        </div>
        <div className={styles.content}>
          <Navbar user={user} />
          <div className={styles.loadingContainer}>
            <div className={styles.spinner} />
            <div className={styles.loadingText}>RUNNING 5 ML MODELS...</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
              Isolation Forest · XGBoost · K-Means · TF-IDF + RF · Groq LLM
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.background}>
          <div className={styles.glow1} />
        </div>
        <div className={styles.content}>
          <Navbar user={user} />
          <div className={styles.emptyState}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div>{error}</div>
          </div>
        </div>
      </div>
    )
  }

  const { insights, anomalies, predictions, clusters, classifierMetrics } = data || {}
  const scoreColor = getScoreColor(insights?.healthScore || 0)
  const { circumference, offset } = getCircleDash(insights?.healthScore || 0)

  return (
    <div className={styles.container}>
      {/* Background */}
      <div className={styles.background}>
        <div className={styles.glow1} />
        <div className={styles.glow2} />
      </div>

      <div className={styles.content}>
        <Navbar user={user} />

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>🧠 AI Insights</div>
          <div className={styles.headerSub}>
            POWERED BY 5 ML MODELS — ISOLATION FOREST · XGBOOST · K-MEANS · TF-IDF + RF · GROQ LLM
          </div>
        </div>

        {/* ═══════ SECTION 1: Health Score + Summary ═══════ */}
        <div className={styles.healthSection}>
          {/* Score Circle */}
          <div className={styles.scoreCircleContainer}>
            <div className={styles.scoreCircle}>
              <svg className={styles.scoreCircleSvg} viewBox="0 0 120 120">
                <circle className={styles.scoreCircleTrack} cx="60" cy="60" r="48" />
                <circle
                  className={styles.scoreCircleProgress}
                  cx="60" cy="60" r="48"
                  stroke={scoreColor}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                />
              </svg>
              <div className={styles.scoreValue} style={{ color: scoreColor }}>
                {insights?.healthScore || 0}
              </div>
            </div>
            <div className={styles.scoreLabel}>HEALTH SCORE</div>
            <div className={styles.riskBadge} style={{
              background: insights?.riskLevel === 'low' ? 'rgba(0,230,118,0.1)' :
                          insights?.riskLevel === 'high' ? 'rgba(255,68,85,0.1)' : 'rgba(255,184,0,0.1)',
              color: insights?.riskLevel === 'low' ? '#00E676' :
                     insights?.riskLevel === 'high' ? '#FF4455' : '#FFB800',
              marginTop: 8
            }}>
              {insights?.riskLevel || 'medium'} risk
            </div>
          </div>

          {/* Summary + Recommendations */}
          <div className={styles.summaryCard}>
            <div className={styles.summaryText}>
              {insights?.summary || 'No insights available yet.'}
            </div>

            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 10 }}>
              RECOMMENDATIONS
            </div>
            <div className={styles.recommendations}>
              {(insights?.recommendations || []).map((rec, i) => (
                <div key={i} className={styles.recCard}>
                  <div className={styles.recIcon}>
                    {i === 0 ? '💡' : i === 1 ? '🎯' : '📊'}
                  </div>
                  <div className={styles.recText}>{rec}</div>
                </div>
              ))}
            </div>

            {insights?.estimatedMonthlySavings > 0 && (
              <div className={styles.savingsBadge}>
                <div className={styles.savingsAmount}>
                  ₹{Math.round(insights.estimatedMonthlySavings).toLocaleString('en-IN')}
                </div>
                <div className={styles.savingsLabel}>estimated monthly savings</div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════ SECTION 2: Spending Prediction ═══════ */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionTitle}>📈 Spending Prediction</div>
          <div className={styles.sectionSub}>
            MODEL: {predictions?.model?.toUpperCase() || 'XGBOOST'} · CONFIDENCE: {Math.round((predictions?.confidence || 0) * 100)}%
          </div>

          <div className={styles.twoColGrid}>
            {/* Prediction Cards */}
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {(predictions?.next3Months || []).map((amount, i) => {
                  const months = ['Next Month', '+2 Months', '+3 Months']
                  return (
                    <div key={i} style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 16,
                      padding: 18,
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: 1.5, marginBottom: 6 }}>
                        {months[i]}
                      </div>
                      <div style={{
                        fontFamily: "'Syne', sans-serif",
                        fontSize: 20, fontWeight: 900, color: '#fff'
                      }}>
                        ₹{Math.round(amount).toLocaleString('en-IN')}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Trend Badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: predictions?.trend === 'increasing' ? 'rgba(255,68,85,0.08)' :
                            predictions?.trend === 'decreasing' ? 'rgba(0,230,118,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${
                  predictions?.trend === 'increasing' ? 'rgba(255,68,85,0.2)' :
                  predictions?.trend === 'decreasing' ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.08)'
                }`,
                borderRadius: 12,
                padding: '6px 14px',
                fontSize: 11,
                color: predictions?.trend === 'increasing' ? '#FF4455' :
                       predictions?.trend === 'decreasing' ? '#00E676' : 'rgba(255,255,255,0.4)'
              }}>
                {predictions?.trend === 'increasing' ? '📈' : predictions?.trend === 'decreasing' ? '📉' : '➡️'}
                Spending trend: {predictions?.trend || 'stable'}
              </div>

              {/* Metrics */}
              {predictions?.metrics?.mae > 0 && (
                <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                    MAE: <span style={{ color: 'rgba(255,255,255,0.5)' }}>₹{Math.round(predictions.metrics.mae)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                    RMSE: <span style={{ color: 'rgba(255,255,255,0.5)' }}>₹{Math.round(predictions.metrics.rmse)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                    R²: <span style={{ color: 'rgba(255,255,255,0.5)' }}>{predictions.metrics.r2}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Feature Importance */}
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 12 }}>
                FEATURE IMPORTANCE (WHAT DRIVES SPENDING)
              </div>
              {Object.entries(predictions?.featureImportance || {})
                .sort(([,a], [,b]) => b - a)
                .slice(0, 8)
                .map(([name, value]) => {
                  const maxVal = Math.max(...Object.values(predictions?.featureImportance || { x: 1 }))
                  const pct = maxVal > 0 ? (value / maxVal) * 100 : 0
                  return (
                    <div key={name} className={styles.featureBar}>
                      <div className={styles.featureLabel}>{name.replace(/_/g, ' ')}</div>
                      <div className={styles.featureBarTrack}>
                        <div className={styles.featureBarFill} style={{ width: `${pct}%` }} />
                      </div>
                      <div className={styles.featureValue}>{(value * 100).toFixed(1)}%</div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>

        {/* ═══════ SECTION 3: Anomaly Detection ═══════ */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionTitle}>🔴 Anomaly Detection</div>
          <div className={styles.sectionSub}>
            MODEL: ISOLATION FOREST · {anomalies?.length || 0} ANOMALIES DETECTED
          </div>

          {(!anomalies || anomalies.length === 0) ? (
            <div style={{
              textAlign: 'center',
              padding: '30px 0',
              color: 'rgba(255,255,255,0.25)',
              fontSize: 12
            }}>
              ✅ No billing anomalies detected — all charges look normal
            </div>
          ) : (
            anomalies.map((anomaly, i) => (
              <div key={i} className={styles.anomalyCard}>
                <div className={styles.anomalyInfo}>
                  <div className={styles.anomalyIcon} style={{
                    background: anomaly.severity === 'high' ? 'rgba(255,68,85,0.12)' : 'rgba(255,184,0,0.12)'
                  }}>
                    {anomaly.type === 'price_hike' ? '📈' :
                     anomaly.type === 'double_charge' ? '⚠️' :
                     anomaly.type === 'unusual_timing' ? '⏰' : '💰'}
                  </div>
                  <div>
                    <div className={styles.anomalyName}>{anomaly.serviceName}</div>
                    <div className={styles.anomalyType}>{anomalyTypeLabel(anomaly.type)}</div>
                  </div>
                </div>
                <div className={styles.anomalyAmounts}>
                  <div className={styles.anomalyExpected}>₹{anomaly.expectedAmount}</div>
                  <div className={styles.anomalyActual}>₹{anomaly.actualAmount}</div>
                </div>
                <div className={styles.severityBadge} style={{
                  background: anomaly.severity === 'high' ? 'rgba(255,68,85,0.12)' : 'rgba(255,184,0,0.12)',
                  color: anomaly.severity === 'high' ? '#FF4455' : '#FFB800'
                }}>
                  {anomaly.severity}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ═══════ SECTION 4: Subscription Clusters ═══════ */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionTitle}>🎯 Subscription Clusters</div>
          <div className={styles.sectionSub}>
            MODEL: K-MEANS CLUSTERING · K={clusters?.optimalK || 4}
          </div>

          {/* Cluster Summary */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {(clusters?.clusterSummary || []).map((cs, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${cs.color}30`,
                borderRadius: 14,
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: cs.color
                }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: cs.color }}>
                    {cs.emoji} {cs.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                    {cs.count} subscription{cs.count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Individual items grouped by cluster */}
          {[0, 1, 2, 3].map(clusterId => {
            const items = (clusters?.clusters || []).filter(c => c.clusterId === clusterId)
            if (items.length === 0) return null
            const label = items[0]?.clusterLabel || 'Unknown'
            const color = items[0]?.clusterColor || '#888'
            return (
              <div key={clusterId} className={styles.clusterGroup}>
                <div className={styles.clusterLabel} style={{ color }}>
                  <div className={styles.clusterDot} style={{ background: color }} />
                  {label}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {items.map((item, j) => (
                    <div key={j} className={styles.clusterChip}>
                      <div className={styles.clusterDot} style={{ background: color }} />
                      {item.serviceName}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* ═══════ SECTION 5: Email Classifier Performance ═══════ */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionTitle}>📋 Email Classifier Performance</div>
          <div className={styles.sectionSub}>
            MODEL: TF-IDF + RANDOM FOREST · {classifierMetrics?.totalSamples || 0} TRAINING SAMPLES
          </div>

          {/* Metrics */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                {Math.round((classifierMetrics?.accuracy || 0) * 100)}%
              </div>
              <div className={styles.metricLabel}>ACCURACY</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                {Math.round((classifierMetrics?.precision || 0) * 100)}%
              </div>
              <div className={styles.metricLabel}>PRECISION</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                {Math.round((classifierMetrics?.recall || 0) * 100)}%
              </div>
              <div className={styles.metricLabel}>RECALL</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue} style={{ color: '#7C4DFF' }}>
                {Math.round((classifierMetrics?.f1Score || 0) * 100)}%
              </div>
              <div className={styles.metricLabel}>F1 SCORE</div>
            </div>
          </div>

          <div className={styles.twoColGrid}>
            {/* Confusion Matrix */}
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 12 }}>
                CONFUSION MATRIX
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div className={styles.confusionMatrix}>
                  {(classifierMetrics?.confusionMatrix || [[0,0],[0,0]]).flat().map((val, i) => {
                    const isCorrect = i === 0 || i === 3
                    return (
                      <div key={i} className={styles.confusionCell} style={{
                        background: isCorrect ? 'rgba(0,230,118,0.08)' : 'rgba(255,68,85,0.08)',
                        border: `1px solid ${isCorrect ? 'rgba(0,230,118,0.15)' : 'rgba(255,68,85,0.15)'}`,
                      }}>
                        {val}
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', lineHeight: 1.8, marginTop: 4 }}>
                  <div>↑ Predicted: Not Sub | Sub →</div>
                  <div style={{ marginTop: 8 }}>TN / FP</div>
                  <div>FN / TP</div>
                </div>
              </div>
            </div>

            {/* Top TF-IDF Features */}
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 12 }}>
                TOP TF-IDF FEATURES
              </div>
              {(classifierMetrics?.topFeatures || []).slice(0, 10).map((feat, i) => {
                const maxImp = (classifierMetrics?.topFeatures?.[0]?.importance) || 1
                const pct = (feat.importance / maxImp) * 100
                return (
                  <div key={i} className={styles.featureBar}>
                    <div className={styles.featureLabel}>{feat.word}</div>
                    <div className={styles.featureBarTrack}>
                      <div className={styles.featureBarFill} style={{
                        width: `${pct}%`,
                        background: 'linear-gradient(90deg, #00E676, #42A5F5)'
                      }} />
                    </div>
                    <div className={styles.featureValue}>{(feat.importance * 100).toFixed(1)}%</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          padding: '20px 0',
          fontSize: 10,
          color: 'rgba(255,255,255,0.15)',
          letterSpacing: 2
        }}>
          POWERED BY SCIKIT-LEARN · XGBOOST · GROQ (LLAMA 3.1)
        </div>
      </div>
    </div>
  )
}
