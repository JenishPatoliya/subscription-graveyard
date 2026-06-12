// frontend/components/LoadingSpinner.jsx

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      background: '#070709'
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid rgba(255,68,85,0.2)',
        borderTop: '3px solid #FF4455',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <p style={{
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        fontFamily: 'DM Mono'
      }}>
        {message}
      </p>
    </div>
  )
}