// frontend/components/StatCard.jsx

export default function StatCard({
  label,
  value,
  sub,
  color = '#ffffff',
  bg = 'rgba(255,255,255,0.03)',
  border = 'rgba(255,255,255,0.07)'
}) {
  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 18,
      padding: '20px 22px',
      position: 'relative',
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: 130,
      boxSizing: 'border-box'
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: -20,
        right: -20,
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: `${color}08`,
        pointerEvents: 'none'
      }} />

      <div>
        <div style={{
          fontSize: 9,
          letterSpacing: 2.5,
          color: 'rgba(255,255,255,0.3)',
          fontWeight: 700,
          marginBottom: 12
        }}>
          {label.toUpperCase()}
        </div>

        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 28,
          fontWeight: 900,
          color: color,
          marginBottom: 4,
          lineHeight: 1
        }}>
          {value}
        </div>
      </div>

      <div style={{
        fontSize: 10,
        color: 'rgba(255,255,255,0.25)',
        marginTop: 8,
        lineHeight: 1.4
      }}>
        {sub}
      </div>
    </div>
  )
}