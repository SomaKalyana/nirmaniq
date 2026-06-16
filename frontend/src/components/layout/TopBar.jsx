import React, { useState, useRef, useEffect } from 'react';
import { ProgressBar } from '../ui/UI.jsx';
import { C } from '../../utils/colors.js';
import styles from './TopBar.module.css';

// ── Screen-specific help content ─────────────────────────────────────────────
const HELP_CONTENT = {
    dashboard: {
        title: 'Dashboard',
        tips: [
            'Overview of your entire project progress in one place.',
            'Click any stage bar to jump directly to that stage checklist.',
            'The active stage card shows your top pending tasks for today.',
            'Budget snapshot shows spend vs allocated per category.',
            'Pre-construction alert disappears once all 52 items are checked off.',
        ],
    },
    stages: {
        title: 'Stage Checklist',
        tips: [
            'Tick off tasks as your builder completes each item.',
            'Tasks are drawn from IS codes and your structural drawings.',
            'Dates are recorded automatically when you tick a task.',
            'Click a completed stage header to review what was done.',
            'Use this as a payment gate — only pay when tasks are complete.',
        ],
    },
    documents: {
        title: 'Pre-Construction Documents',
        tips: [
            'Complete all 52 items before breaking ground.',
            'Your BPO (PER/1086/0349/2026) and Soil Test are pre-ticked.',
            'Each item has a guidance note — tap the item to read it.',
            'Bank loan documents (Group E) are needed before disbursement.',
            'Post-construction OC items (Group G) come after building is complete.',
        ],
    },
    materials: {
        title: 'Material Tracker',
        tips: [
            'Quantities are estimated from your plot dimensions and floor config.',
            'Tap any material row to update ordered and received quantities.',
            'Log the supplier name and rate for each material.',
            'Blue bar = ordered. Green bar = received on site.',
            'If ordered exceeds required, check for wastage.',
        ],
    },
    budget: {
        title: 'Budget Tracker',
        tips: [
            'Budget categories are auto-populated from your total project budget.',
            'Each payment you log in the Payments screen deducts from the category.',
            'Red bars mean a category is over 90% utilised — review before spending more.',
            'Contingency (8%) is reserved — only use it for genuine surprises.',
            'Builder quote vs total budget gap = finishing + systems budget.',
        ],
    },
    payments: {
        title: 'Payment Log',
        tips: [
            'Log every payment as it happens — never from memory.',
            'Choose the correct budget category to keep tracking accurate.',
            'Never pay more than 40% of any stage amount upfront.',
            'Delete a payment to automatically restore the budget allocation.',
            'Total paid should never exceed what stages are actually complete.',
        ],
    },
    team: {
        title: 'Site Team',
        tips: [
            'Hire supervisor and watchman before any other role.',
            'Update status to Active when someone starts work on site.',
            'Keep phone numbers current — your first call in any emergency.',
            'A live-in watchman with family is the best site security.',
            'Supervisor should have your approved plan and soil test on Day 1.',
        ],
    },
    log: {
        title: 'Site Log',
        tips: [
            'Write one entry after every site visit — takes 2 minutes.',
            'Note: what was done, any issue, materials received, curing status.',
            'Entries are tagged with the active stage automatically.',
            'This log is your evidence in any builder dispute.',
            'Aim for at least 5 entries per week during active construction.',
        ],
    },
    photos: {
        title: 'Photo Diary',
        tips: [
            'Upload photos before and after every concrete pour.',
            "Photograph steel reinforcement before shuttering — it's invisible later.",
            'Cover block placement photos protect you from future disputes.',
            'Photos are tagged to the current active stage and date.',
            '50 most recent photos are stored locally on your device.',
        ],
    },
};

// ── Notification type badge colors ────────────────────────────────────────────
const NOTIF_COLORS = {
    info: C.blue,
    warning: C.amber,
    success: C.green,
    alert: C.red,
};

// ── Avatar initials ───────────────────────────────────────────────────────────
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name) {
    const colors = [
        '#E6A817',
        '#388BFD',
        '#3FB950',
        '#8957E5',
        '#F85149',
        '#D29922',
    ];
    if (!name) return colors[0];
    const idx = name.charCodeAt(0) % colors.length;
    return colors[idx];
}

// ── Click-outside hook ────────────────────────────────────────────────────────
function useClickOutside(ref, handler) {
    useEffect(() => {
        const listener = (e) => {
            if (ref.current && !ref.current.contains(e.target)) handler();
        };
        document.addEventListener('mousedown', listener);
        return () => document.removeEventListener('mousedown', listener);
    }, [ref, handler]);
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TopBar({
    user,
    project,
    progress,
    doneTasks,
    totalTasks,
    theme,
    onThemeChange,
    onOpenProject,
    onLogout,
    notifications = [],
    onClearNotif,
    onClearAllNotif,
    activeTab = 'dashboard',
}) {
    const [showNotif, setShowNotif] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showUser, setShowUser] = useState(false);
    const [showTheme, setShowTheme] = useState(false);

    const notifRef = useRef(null);
    const helpRef = useRef(null);
    const userRef = useRef(null);
    const themeRef = useRef(null);

    useClickOutside(notifRef, () => setShowNotif(false));
    useClickOutside(helpRef, () => setShowHelp(false));
    useClickOutside(userRef, () => setShowUser(false));
    useClickOutside(themeRef, () => setShowTheme(false));

    const isLoggedIn = !!user;
    const hasProject = !!project;

    const THEME_OPTIONS = [
        { id: 'dark', label: 'Dark' },
        { id: 'light', label: 'White' },
        { id: 'solar', label: 'Solar' },
    ];
    const unreadCount = notifications.filter((n) => !n.read).length;
    const helpContent = HELP_CONTENT[activeTab] || HELP_CONTENT.dashboard;

    return (
        <header className={styles.topbar}>
            {/* ── Brand ── */}
            <div className={styles.brand}>
                <div className={styles.logoMark}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect
                            x="2"
                            y="14"
                            width="4"
                            height="8"
                            rx="1"
                            fill="var(--accent)"
                        />
                        <rect
                            x="8"
                            y="10"
                            width="4"
                            height="12"
                            rx="1"
                            fill="var(--accent)"
                            opacity=".75"
                        />
                        <rect
                            x="14"
                            y="6"
                            width="4"
                            height="16"
                            rx="1"
                            fill="var(--accent)"
                            opacity=".5"
                        />
                        <rect
                            x="20"
                            y="2"
                            width="2"
                            height="20"
                            rx="1"
                            fill="var(--accent)"
                            opacity=".25"
                        />
                    </svg>
                </div>
                <div>
                    <div className={styles.logoText}>NirmanIQ</div>
                    <div className={styles.logoCaption}>Track your build</div>
                </div>
            </div>

            {isLoggedIn && hasProject && (
                <div className={styles.projectCenter}>
                    <div className={styles.projectTitle}>
                        {project.name || project.dimensions || 'Project'}
                        <span className={styles.projectMeta}>
                            {' '}
                            &middot; {progress}%
                        </span>
                    </div>
                    <div className={styles.progressWrap}>
                        <div className={styles.progressTrack}>
                            <ProgressBar
                                value={progress}
                                color={C.accent}
                                height={4}
                            />
                        </div>
                        <span className={styles.progressLabel}>
                            {doneTasks}/{totalTasks} tasks
                        </span>
                    </div>
                </div>
            )}

            {/* ── Right actions ── */}
            {isLoggedIn && (
                <div className={styles.actions}>
                    {/* Theme */}
                    <div className={styles.popAnchor} ref={themeRef}>
                        <button
                            className={`${styles.iconBtn} ${showTheme ? styles.iconBtnActive : ''}`}
                            onClick={() => {
                                setShowTheme((v) => !v);
                                setShowNotif(false);
                                setShowHelp(false);
                                setShowUser(false);
                            }}
                            aria-label="Theme"
                            title="Theme"
                        >
                            <ThemeIcon />
                        </button>

                        {showTheme && (
                            <div
                                className={`${styles.popup} ${styles.themePopup} slide-down`}
                            >
                                <div className={styles.popupHeader}>
                                    <span className={styles.popupTitle}>
                                        Theme
                                    </span>
                                    <button
                                        className={styles.popupClose}
                                        onClick={() => setShowTheme(false)}
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className={styles.themeList}>
                                    {THEME_OPTIONS.map((option) => (
                                        <button
                                            key={option.id}
                                            className={`${styles.themeOption} ${theme === option.id ? styles.themeActive : ''}`}
                                            onClick={() => {
                                                onThemeChange(option.id);
                                                setShowTheme(false);
                                            }}
                                        >
                                            <span>{option.label}</span>
                                            {theme === option.id && (
                                                <span
                                                    className={
                                                        styles.themeCheck
                                                    }
                                                >
                                                    ✓
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Help */}
                    <div className={styles.popAnchor} ref={helpRef}>
                        <button
                            className={`${styles.iconBtn} ${showHelp ? styles.iconBtnActive : ''}`}
                            onClick={() => {
                                setShowHelp((v) => !v);
                                setShowNotif(false);
                                setShowUser(false);
                            }}
                            aria-label="Help"
                            title="Help"
                        >
                            <HelpIcon />
                        </button>

                        {showHelp && (
                            <div
                                className={`${styles.popup} ${styles.helpPopup} slide-down`}
                            >
                                <div className={styles.popupHeader}>
                                    <span className={styles.popupTitle}>
                                        Help — {helpContent.title}
                                    </span>
                                    <button
                                        className={styles.popupClose}
                                        onClick={() => setShowHelp(false)}
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className={styles.helpBody}>
                                    {helpContent.tips.map((tip, i) => (
                                        <div key={i} className={styles.helpTip}>
                                            <div className={styles.helpNum}>
                                                {i + 1}
                                            </div>
                                            <div className={styles.helpText}>
                                                {tip}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.helpFooter}>
                                    Showing help for the{' '}
                                    <strong>{helpContent.title}</strong> screen.
                                    Navigate to a different screen for
                                    context-specific help.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Notifications */}
                    <div className={styles.popAnchor} ref={notifRef}>
                        <button
                            className={`${styles.iconBtn} ${showNotif ? styles.iconBtnActive : ''}`}
                            onClick={() => {
                                setShowNotif((v) => !v);
                                setShowHelp(false);
                                setShowUser(false);
                            }}
                            aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
                            title="Notifications"
                        >
                            <BellIcon />
                            {unreadCount > 0 && (
                                <span className={styles.notifBadge}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotif && (
                            <div
                                className={`${styles.popup} ${styles.notifPopup} slide-down`}
                            >
                                <div className={styles.popupHeader}>
                                    <span className={styles.popupTitle}>
                                        Notifications
                                        {unreadCount > 0 && (
                                            <span className={styles.unreadChip}>
                                                {unreadCount} new
                                            </span>
                                        )}
                                    </span>
                                    {notifications.length > 0 && (
                                        <button
                                            className={styles.clearAllBtn}
                                            onClick={onClearAllNotif}
                                        >
                                            Clear all
                                        </button>
                                    )}
                                </div>
                                <div className={styles.notifList}>
                                    {notifications.length === 0 ? (
                                        <div className={styles.notifEmpty}>
                                            <div
                                                className={
                                                    styles.notifEmptyIcon
                                                }
                                            >
                                                🔔
                                            </div>
                                            <div>No notifications yet</div>
                                        </div>
                                    ) : (
                                        notifications.map((n) => (
                                            <div
                                                key={n.id}
                                                className={`${styles.notifItem} ${n.read ? styles.notifRead : ''}`}
                                            >
                                                <div
                                                    className={styles.notifDot}
                                                    style={{
                                                        background:
                                                            NOTIF_COLORS[
                                                                n.type
                                                            ] || C.blue,
                                                    }}
                                                />
                                                <div
                                                    className={styles.notifBody}
                                                >
                                                    <div
                                                        className={
                                                            styles.notifMsg
                                                        }
                                                    >
                                                        {n.message}
                                                    </div>
                                                    <div
                                                        className={
                                                            styles.notifTime
                                                        }
                                                    >
                                                        {n.time}
                                                    </div>
                                                </div>
                                                {onClearNotif && (
                                                    <button
                                                        className={
                                                            styles.notifDismiss
                                                        }
                                                        onClick={() =>
                                                            onClearNotif(n.id)
                                                        }
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* User avatar */}
                    <div className={styles.popAnchor} ref={userRef}>
                        <button
                            className={`${styles.avatarBtn} ${showUser ? styles.avatarActive : ''}`}
                            onClick={() => {
                                setShowUser((v) => !v);
                                setShowNotif(false);
                                setShowHelp(false);
                            }}
                            aria-label="User menu"
                        >
                            <div
                                className={styles.avatar}
                                style={{
                                    background: getAvatarColor(
                                        user?.name || user?.email,
                                    ),
                                }}
                            >
                                {getInitials(user?.name || user?.email || '?')}
                            </div>
                            <div className={styles.avatarInfo}>
                                <div className={styles.avatarName}>
                                    {user?.name?.split(' ')[0] ||
                                        user?.email?.split('@')[0] ||
                                        'User'}
                                </div>
                                {hasProject && (
                                    <div className={styles.avatarRole}>
                                        Project owner
                                    </div>
                                )}
                            </div>
                            <ChevronIcon />
                        </button>

                        {showUser && (
                            <div
                                className={`${styles.popup} ${styles.userPopup} slide-down`}
                            >
                                {/* User profile */}
                                <div className={styles.userHeader}>
                                    <div
                                        className={styles.avatarLg}
                                        style={{
                                            background: getAvatarColor(
                                                user?.name || user?.email,
                                            ),
                                        }}
                                    >
                                        {getInitials(
                                            user?.name || user?.email || '?',
                                        )}
                                    </div>
                                    <div>
                                        <div className={styles.userFullName}>
                                            {user?.name || '—'}
                                        </div>
                                        <div className={styles.userEmail}>
                                            {user?.email || '—'}
                                        </div>
                                    </div>
                                </div>
                                {hasProject && (
                                    <div className={styles.userProject}>
                                        <div
                                            className={styles.userProjectLabel}
                                        >
                                            Active project
                                        </div>
                                        <div className={styles.userProjectName}>
                                            {project?.name || '—'}
                                        </div>
                                    </div>
                                )}
                                <div className={styles.userMenuItems}>
                                    {hasProject && onOpenProject && (
                                        <button
                                            className={styles.userMenuItem}
                                            onClick={() => {
                                                onOpenProject();
                                                setShowUser(false);
                                            }}
                                        >
                                            <span>⇄</span> Switch / edit project
                                        </button>
                                    )}
                                    <button
                                        className={styles.userMenuItemDanger}
                                        onClick={onLogout}
                                    >
                                        <span>→</span> Sign out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}

// ── Small SVG icons ───────────────────────────────────────────────────────────
function BellIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    );
}

function HelpIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" />
        </svg>
    );
}

function ChevronIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );
}

function ThemeIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
    );
}
