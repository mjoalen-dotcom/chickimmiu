'use client'

import { useState } from 'react'

const panelStyle: React.CSSProperties = {
  marginBottom: 24,
  border: '1px solid #E8DDD0',
  borderRadius: 8,
  overflow: 'hidden',
  background: '#fff',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  cursor: 'pointer',
  background: '#f5f3ee',
  borderBottom: '1px solid #E8DDD0',
  userSelect: 'none',
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  background: '#C19A5B',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'none',
}

const btnOutline: React.CSSProperties = {
  ...btnStyle,
  background: 'transparent',
  color: '#C19A5B',
  border: '1px solid #C19A5B',
}

export default function OrderToolsPanel() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div style={panelStyle}>
      <div style={headerStyle} onClick={() => setIsOpen(!isOpen)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#1A1F36' }}>
          <span style={{ fontSize: 16 }}>Packing & Reports</span>
        </div>
        <span style={{ fontSize: 18, color: '#888', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
          v
        </span>
      </div>

      {isOpen && (
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: '#6B6560', marginBottom: 12 }}>
            Print packing slips for individual orders, or generate a pickup summary report grouped by shipping method.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <a
              href="/api/order-print?mode=pickup"
              target="_blank"
              rel="noopener noreferrer"
              style={btnStyle}
            >
              Pickup Summary (Pending)
            </a>
            <a
              href="/api/order-print?mode=pickup&status=processing"
              target="_blank"
              rel="noopener noreferrer"
              style={btnOutline}
            >
              Pickup Summary (Processing)
            </a>
            <a
              href="/api/order-print?mode=pickup&status=shipped"
              target="_blank"
              rel="noopener noreferrer"
              style={btnOutline}
            >
              Pickup Summary (Shipped)
            </a>
          </div>

          <div style={{
            padding: 12, background: '#fafaf7', borderRadius: 6,
            border: '1px solid #E8DDD0', fontSize: 12, color: '#6B6560',
          }}>
            <strong style={{ color: '#1A1F36' }}>Print Single Order:</strong>
            <br />
            Open any order &rarr; copy the order ID from the URL &rarr; visit:
            <code style={{ display: 'block', marginTop: 4, padding: '4px 8px', background: '#fff', borderRadius: 4, fontFamily: 'monospace', fontSize: 11 }}>
              /api/order-print?id=ORDER_ID
            </code>
            <br />
            <strong style={{ color: '#1A1F36' }}>Batch Print:</strong>
            <code style={{ display: 'block', marginTop: 4, padding: '4px 8px', background: '#fff', borderRadius: 4, fontFamily: 'monospace', fontSize: 11 }}>
              /api/order-print?ids=1,2,3,4,5
            </code>
          </div>
        </div>
      )}
    </div>
  )
}
