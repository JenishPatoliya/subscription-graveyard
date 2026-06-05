// frontend/lib/utils.js

// Format number as Indian currency
export const formatCurrency = (amount) => {
  return `₹${Number(amount).toLocaleString('en-IN')}`
}

// Get receipt status info
export const getReceiptStatus = (receiptStatus, daysUntilRenewal) => {

  // Renewing very soon
  if (daysUntilRenewal !== null && daysUntilRenewal <= 5) {
    return {
      label: `Renews in ${daysUntilRenewal} days`,
      color: '#FF4455',
      bg: 'rgba(255,68,85,0.12)',
      border: 'rgba(255,68,85,0.3)',
      emoji: '🔴'
    }
  }

  // No receipt in 90+ days
  if (receiptStatus === 'long_gap') {
    return {
      label: 'No Recent Receipt',
      color: '#FFB800',
      bg: 'rgba(255,184,0,0.12)',
      border: 'rgba(255,184,0,0.3)',
      emoji: '⚠️'
    }
  }

  // Active recently
  return {
    label: 'Recently Active',
    color: '#00E676',
    bg: 'rgba(0,230,118,0.12)',
    border: 'rgba(0,230,118,0.3)',
    emoji: '✅'
  }
}

// Format date nicely
export const formatDate = (dateString) => {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

// Calculate days since a date
export const daysSince = (dateString) => {
  if (!dateString) return null
  const date = new Date(dateString)
  const today = new Date()
  return Math.floor((today - date) / (1000 * 60 * 60 * 24))
}

// Get category color
export const getCategoryColor = (category) => {
  const colors = {
    'Design': '#00C4CC',
    'Music': '#1DB954',
    'Entertainment': '#E50914',
    'AI Tools': '#10A37F',
    'Productivity': '#a78bfa',
    'Security': '#4687FF',
    'Developer Tools': '#F05033',
    'Career': '#0077B5',
    'Other': '#888888'
  }
  return colors[category] || '#888888'
}