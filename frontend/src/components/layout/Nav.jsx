import React from 'react';
import Icon from '../ui/Icon.jsx';
import styles from './Nav.module.css';

export const NAV_ITEMS = [
    { id: 'dashboard', icon: 'home',     label: 'Home'      },
    { id: 'summary', icon: 'budget', label: 'Summary' },
    { id: 'preconstruction',  icon: 'download', label: 'Pre-Construction'  },
    { id: 'stages',    icon: 'stages',   label: 'Construction'    },
    { id: 'postconstruction', icon: 'check',    label: 'Post-Construction' },
    { id: 'cashflow',         icon: 'rupee',   label: 'Cash Flow'         },
    { id: 'issues', icon: 'alert', label: 'Issues' },
];

export function BottomNav({ active, onSelect }) {
    return (
        <nav className={styles.bottom}>
            {NAV_ITEMS.map((n) => (
                <button
                    key={n.id}
                    className={`${styles.navBtn} ${active === n.id ? styles.active : ''}`}
                    onClick={() => onSelect(n.id)}
                    aria-label={n.label}
                >
                    <Icon
                        name={n.icon}
                        size={18}
                        color={active === n.id ? 'var(--accent)' : 'var(--hint)'}
                    />
                    <span className={styles.label}>{n.label}</span>
                </button>
            ))}
        </nav>
    );
}

export function SideNav({ active, onSelect }) {
    return (
        <nav className={styles.side}>
            <div className={styles.sideItems}>
                {NAV_ITEMS.map((n) => (
                    <button
                        key={n.id}
                        className={`${styles.sideBtn} ${active === n.id ? styles.sideActive : ''}`}
                        onClick={() => onSelect(n.id)}
                    >
                        <Icon
                            name={n.icon}
                            size={16}
                            color={active === n.id ? 'var(--accent)' : 'var(--muted)'}
                        />
                        <span>{n.label}</span>
                    </button>
                ))}
            </div>
        </nav>
    );
}
