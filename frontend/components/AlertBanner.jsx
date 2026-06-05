// frontend/components/AlertBanner.jsx

'use client'
import { useState } from 'react'

export default function AlertBanner({ alerts = [], onReview }) {

  // Only show most urgent alert
  if (!alerts || alerts.length === 0) return null

  const urgent = alerts.find(a => a.daysUntil <= 5)
  if (!urgent) return null

  return (
    <div style={{
      background: 'rgba(255,184,0,0.06)',
      border: '1px solid rgba(255,184,0,0.2)',
      borderRadius: 16,
      padding: '14px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{
          fontSize: 20,
          animation: 'pulse 1.5s infinite'
        }}>⏰</span>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
          <span style={{ color: '#FFB800', fontWeight: 700 }}>
            {urgent.service_name}
          </span>
          {' '}charges you{' '}
          <span style={{ fontWeight: 700 }}>
            ₹{urgent.amount}
          </span>
          {' '}in{' '}
          <span style={{ color: '#FFB800', fontWeight: 700 }}>
            {urgent.daysUntil} days
          </span>
        </div>
      </div>

      <button
        onClick={() => onReview && onReview(urgent)}
        style={{
          background: 'rgba(255,184,0,0.15)',
          border: '1px solid rgba(255,184,0,0.3)',
          borderRadius: 10,
          color: '#FFB800',
          padding: '7px 16px',
          fontSize: 10,
          cursor: 'pointer',
          fontWeight: 800,
          letterSpacing: 1.5,
          fontFamily: 'DM Mono'
        }}
      >
        REVIEW →
      </button>
    </div>
  )
}