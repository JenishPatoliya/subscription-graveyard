// frontend/components/SubCard.jsx

'use client'
import { useState } from 'react'
import { getReceiptStatus, getCategoryColor, formatCurrency, getServiceEmoji } from '../lib/utils'

export default function SubCard({ sub, selected, onClick }) {
  const [hovered, setHovered] = useState(false)

  const status = getReceiptStatus(sub.receiptStatus, sub.daysUntilRenewal)
  const color = getCategoryColor(sub.category)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: selected
          ? 'rgba(255,255,255,0.07)'
          : hovered
          ? 'rgba(255,255,255,0.05)'
          : 'rgba(255,255,255,0.02)',
        border: selected
          ? `1px solid ${status.color}44`
          : hovered
          ? '1px solid rgba(255,255,255,0.1)'
          : '1px solid rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: '22px',
        cursor: 'pointer',
        transition: 'all 0.25s',
        transform: hovered && !selected ? 'translateY(-3px)' : 'none',
        boxShadow: selected
          ? `0 0 28px ${status.color}12`
          : hovered
          ? '0 8px 24px rgba(0,0,0,0.4)'
          : 'none',
        overflow: 'hidden'
      }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: -30,
        right: -30,
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}12, transparent)`,
        opacity: hovered || selected ? 1 : 0,
        transition: 'opacity 0.3s',
        pointerEvents: 'none'
      }} />

      {/* Top row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 18
      }}>
        {/* Icon and name */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: `${color}15`,
            border: `1.5px solid ${color}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
            boxShadow: hovered || selected ? `0 0 16px ${color}20` : 'none',
            transition: 'box-shadow 0.3s'
          }}>
            {getServiceEmoji(sub.service_name)}
          </div>
          <div>
            <div style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 15,
              fontWeight: 800,
              color: '#fff',
              marginBottom: 2
            }}>
              {sub.service_name}
            </div>
            <div style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: 1
            }}>
              {sub.category}
            </div>
          </div>
        </div>

        {/* Amount */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 18,
            fontWeight: 900,
            color: '#fff'
          }}>
            {formatCurrency(sub.amount)}
          </div>
          <div style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.25)'
          }}>
            /month
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>
        {/* Badges row */}
        <div style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div style={{
            background: status.bg,
            border: `1px solid ${status.border}`,
            borderRadius: 20,
            padding: '4px 10px',
            fontSize: 10,
            color: status.color,
            fontWeight: 700,
            whiteSpace: 'nowrap'
          }}>
            {status.emoji} {status.label}
          </div>
          {sub.usage_label && (
            <div style={{
              background: sub.cluster_id === 0 ? 'rgba(0,230,118,0.08)' :
                          sub.cluster_id === 1 ? 'rgba(66,165,245,0.08)' :
                          sub.cluster_id === 2 ? 'rgba(255,184,0,0.08)' :
                          'rgba(255,68,85,0.08)',
              border: `1px solid ${
                sub.cluster_id === 0 ? 'rgba(0,230,118,0.25)' :
                sub.cluster_id === 1 ? 'rgba(66,165,245,0.25)' :
                sub.cluster_id === 2 ? 'rgba(255,184,0,0.25)' :
                'rgba(255,68,85,0.25)'
              }`,
              borderRadius: 20,
              padding: '4px 10px',
              fontSize: 9,
              color: sub.cluster_id === 0 ? '#00E676' :
                     sub.cluster_id === 1 ? '#42A5F5' :
                     sub.cluster_id === 2 ? '#FFB800' : '#FF4455',
              fontWeight: 600,
              letterSpacing: 0.5,
              whiteSpace: 'nowrap'
            }}>
              🧠 {sub.usage_label}
            </div>
          )}
        </div>

        {/* Receipt date */}
        <div style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.25)'
        }}>
          Last receipt: {sub.last_receipt_date
            ? new Date(sub.last_receipt_date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })
            : 'Not found'}
        </div>
      </div>
    </div>
  )
}