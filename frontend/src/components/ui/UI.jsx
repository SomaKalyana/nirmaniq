import React from 'react'
import { C } from '../../utils/colors.js'
import styles from './UI.module.css'

export const Badge = ({ children, color = C.accent, small = false }) => (
  <span
    className={styles.badge}
    style={{
      background: color + '22',
      color,
      fontSize: small ? 9 : 10,
      padding: small ? '1px 6px' : '2px 8px',
    }}
  >
    {children}
  </span>
)

export const ProgressBar = ({ value = 0, color = C.accent, height = 4, bg = C.border }) => (
  <div className={styles.barTrack} style={{ height, background: bg, borderRadius: height }}>
    <div
      className={styles.barFill}
      style={{
        height: '100%',
        width: `${Math.min(100, Math.max(0, value))}%`,
        background: color,
        borderRadius: height,
      }}
    />
  </div>
)

export const StatCard = ({ label, value, sub, color = C.text, onClick }) => (
  <div className={styles.statCard} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
    <div className={styles.statLabel}>{label}</div>
    <div className={styles.statValue} style={{ color }}>{value}</div>
    {sub && <div className={styles.statSub}>{sub}</div>}
  </div>
)

export const SectionTitle = ({ children }) => (
  <div className={styles.sectionTitle}>{children}</div>
)

export const EmptyState = ({ icon = '📭', message }) => (
  <div className={styles.empty}>
    <span className={styles.emptyIcon}>{icon}</span>
    <p>{message}</p>
  </div>
)

export const CheckButton = ({ done, onClick, color = C.green }) => (
  <button
    className={styles.checkBtn}
    onClick={onClick}
    style={{
      border: done ? 'none' : `1.5px solid ${C.borderL}`,
      background: done ? color : 'transparent',
    }}
    aria-label={done ? 'Mark undone' : 'Mark done'}
  >
    {done && (
      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    )}
  </button>
)

export const Divider = () => <div className={styles.divider} />
