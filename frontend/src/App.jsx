import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import TopBar from './components/layout/TopBar.jsx';
import { BottomNav, SideNav } from './components/layout/Nav.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Stages from './pages/Stages.jsx';
import Issues from './pages/Issues.jsx';
import Summary from './pages/Summary.jsx';
import ProjectSelect from './pages/ProjectSelect.jsx';
import { Preconstruction, PostConstruction } from './pages/OtherPages.jsx';
import CashFlow from './pages/CashFlow.jsx';
import Login from './pages/Login.jsx';
import Landing from './pages/Landing.jsx';
import RegisterCustomer from './pages/RegisterCustomer.jsx';
import { useAppData } from './hooks/useAppData.js';
import { fetchIssues, fetchBudgetAlerts, ackAlert } from './utils/api.js';
import { pct, fmtDate, fmtTime } from './utils/format.js';
import styles from './App.module.css';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// ── Notification helpers ──────────────────────────────────────────────────────
function makeNotif(message, type = 'info') {
    return {
        id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        message,
        type,
        read: false,
        time: `${fmtDate()} ${fmtTime()}`,
    };
}

// ── Auth views ────────────────────────────────────────────────────────────────
// landing → login / register → project-select → app


// ── URL ↔ tab sync ──────────────────────────────────────────────────────────
const TAB_PATHS = {
    dashboard:  '/',
    stages:     '/stages',
    issues:     '/issues',
    summary:    '/summary',
    preconstruction:    '/preconstruction',
    cashflow:           '/cashflow',
    postconstruction:   '/postconstruction',
    materials:  '/materials',
    budget:     '/budget',
    payments:   '/payments',
    team:       '/team',
    log:        '/log',
    photos:     '/photos',
};
const PATH_TABS = Object.fromEntries(Object.entries(TAB_PATHS).map(([k,v])=>[v,k]));

function AppInner() {
    // ── All state BEFORE any early return (Rules of Hooks) ────────────
    const [user, setUser] = useState(() => {
        // Restore session from localStorage JWT
        const token = localStorage.getItem('nirmaniq_token');
        if (!token) return null;
        try {
            // Decode payload (no verify on client — server verifies on each API call)
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.exp * 1000 < Date.now()) {
                localStorage.removeItem('nirmaniq_token');
                return null;
            }
            return { id: payload.sub, name: payload.name, email: payload.email };
        } catch { return null; }
    });
    const [project, setProject] = useState(null);
    const [authView, setAuthView] = useState('landing');
    const navigate  = useNavigate();
    const location  = useLocation();

    // Tab state — initialize from current URL path
    const [tab, setTabState] = useState(
        () => PATH_TABS[window.location.pathname] || 'dashboard'
    );
    const setTab = useCallback((t) => {
        setTabState(t);
        navigate(TAB_PATHS[t] || '/');
    }, [navigate]);
    const [openStage, setOpenStage] = useState(null);
    const [showEditProject, setShowEditProject] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [issues,        setIssues]        = useState([]);
    const [budgetAlerts,  setBudgetAlerts]  = useState([]);
    const [theme, setTheme] = useState(() => {
        if (typeof window === 'undefined') return 'dark';
        return localStorage.getItem('nirmanIQTheme') || 'dark';
    });

    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.body.classList.remove(
            'theme-dark',
            'theme-light',
            'theme-solar',
        );
        document.body.classList.add(`theme-${theme}`);
        localStorage.setItem('nirmanIQTheme', theme);
    }, [theme]);

    // Load issues and budget alerts on mount
    useEffect(() => {
        fetchIssues().then(setIssues).catch(() => {});
        fetchBudgetAlerts().then(alerts => {
            setBudgetAlerts(alerts);
            alerts.forEach(a => addNotif(
                `⚠️ Budget alert: ${a.cat_id} reached ${Math.round(a.threshold)}% of allocation`,
                'warning'
            ));
        }).catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const refreshIssues = useCallback(() => {
        fetchIssues().then(setIssues).catch(() => {});
    }, []);

    const updateProject = useCallback((updates) => {
        setProject(prev => {
            if (!prev) return prev;
            const updated = { ...prev, ...updates };
            fetch('/api/project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
            }).catch(() => {});
            return updated;
        });
    }, []);

    const ackBudgetAlert = useCallback((id) => {
        ackAlert(id);
        setBudgetAlerts(p => p.filter(a => a.id !== id));
    }, []);

    const {
        ready,
        stages,
        mats,
        marketRates,
        budget,
        pays,
        team,
        logs,
        photos,
        computed,
        stageItems,
        stagePct,
        toggleTask,
        updateMat,
        addPayment,
        updatePayment,
        deletePayment,
        addLog,
        addPhoto,
        updateTeamMember,
        addCustomer,
        loanItems,
        updateBudget,
        toggleLoanItem,
    } = useAppData(project);

    // ── Notification actions ──────────────────────────────────────────
    const addNotif = useCallback((message, type = 'info') => {
        setNotifications((prev) => [
            makeNotif(message, type),
            ...prev.slice(0, 49),
        ]);
    }, []);

    const clearNotif = useCallback((id) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const clearAllNotifs = useCallback(() => {
        setNotifications([]);
    }, []);

    const { totalTasks, doneTasks, totalBudget, activeIdx } = computed;
    const overall = pct(doneTasks, totalTasks);
    const activeStageLabel =
        activeIdx >= 0 && Array.isArray(stages) && stages[activeIdx]
            ? stages[activeIdx].label
            : 'General';

    const handleGoToStage = (id) => setOpenStage(id);
    const handleToggleOpen = (id) =>
        setOpenStage((prev) => (prev === id ? null : id));

    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('nirmaniq_token');
        setProject(null);
        setAuthView('landing');
        setTab('dashboard');
        setNotifications([]);
    };

    const handleProjectSelected = (p) => {
        setProject(p);
        setAuthView('app');
        setTab('dashboard');
        addNotif(
            `Project "${p.name || 'Unnamed'}" loaded successfully.`,
            'success',
        );
    };

    // ── Unauthenticated ───────────────────────────────────────────────
    if (!user) {
        return (
            <div className={styles.app}>
                <TopBar theme={theme} onThemeChange={setTheme} />
                <main className={styles.mainFull}>
                    <div className={styles.content}>
                        {authView === 'landing' && (
                            <Landing
                                onLogin={() => setAuthView('login')}
                                onRegister={() => setAuthView('register')}
                            />
                        )}
                        {authView === 'login' && (
                            <Login
                                onLogin={(u) => {
                                    setUser(u);
                                    setAuthView('project-select');
                                    addNotif(
                                        `Welcome back${u.name ? ', ' + u.name.split(' ')[0] : ''}!`,
                                        'success',
                                    );
                                }}
                                onRegister={() => setAuthView('register')}
                                onBack={() => setAuthView('landing')}
                            />
                        )}
                        {authView === 'register' && (
                            <RegisterCustomer
                                onRegistered={(c) => {
                                    addCustomer(c);
                                    setUser(c);
                                    setAuthView('project-select');
                                    addNotif(
                                        `Account created. Welcome, ${c.name?.split(' ')[0] || 'there'}!`,
                                        'success',
                                    );
                                }}
                                onCancel={() => setAuthView('login')}
                            />
                        )}
                    </div>
                </main>
            </div>
        );
    }

    // ── Loading guard — only for authenticated users ─────────────────
    if (!ready || !stages) {
        return (
            <div className={styles.loading}>
                <div className={styles.loadDot} />
                <span>Loading NirmanIQ…</span>
            </div>
        );
    }

    // ── Project selection ─────────────────────────────────────────────
    if (!project || authView === 'project-select') {
        return (
            <div className={styles.app}>
                <TopBar
                    user={user}
                    notifications={notifications}
                    onClearNotif={clearNotif}
                    onClearAllNotif={clearAllNotifs}
                    onLogout={handleLogout}
                    activeTab="dashboard"
                    theme={theme}
                    onThemeChange={setTheme}
                />
                <main className={styles.mainFull}>
                    <div className={styles.content}>
                        <ProjectSelect
                            user={user}
                            onProjectSelected={handleProjectSelected}
                        />
                    </div>
                </main>
            </div>
        );
    }

    // ── Full authenticated app ────────────────────────────────────────
    const pageProps = {
        stages,
        mats,
        budget,
        pays,
        team,
        logs,
        photos,
        computed,
        stageItems,
        stagePct,
    };

    return (
        <div className={styles.app}>
            <TopBar
                user={user}
                project={project}
                progress={overall}
                doneTasks={doneTasks}
                totalTasks={totalTasks}
                theme={theme}
                onThemeChange={setTheme}
                onOpenProject={() => setShowEditProject(true)}
                onLogout={handleLogout}
                notifications={notifications}
                onClearNotif={clearNotif}
                onClearAllNotif={clearAllNotifs}
                activeTab={tab}
            />

            <div className={styles.layout}>
                <SideNav active={tab} onSelect={setTab} />

                <main className={styles.main}>
                    <div className={styles.content}>
                        {tab === 'dashboard' && (
                            <Dashboard
                                {...pageProps}
                                user={user}
                                project={project}
                                onGoToStage={handleGoToStage}
                                onGoTo={setTab}
                                issues={issues}
                                onGoToIssues={() => setTab('issues')}
                            />
                        )}

                        {tab === 'stages' && (
                            <Stages
                                stages={stages.filter((s) => !s.isPrereq)}
                                totalBudget={totalBudget}
                                stageItems={stageItems}
                                stagePct={stagePct}
                                toggleTask={toggleTask}
                                mats={mats}
                                budget={budget}
                                pays={pays}
                                addPayment={addPayment}
                                updatePayment={updatePayment}
                                deletePayment={deletePayment}
                                logs={logs}
                                photos={photos}
                                addLog={addLog}
                                addPhoto={addPhoto}
                                project={project}
                                onProjectUpdate={updateProject}
                                issues={issues}
                                onIssueChange={refreshIssues}
                                marketRates={marketRates}
                                onBudgetEdit={updateBudget}
                                openStageId={openStage}
                            />
                        )}


                        {tab === 'issues' && (
                            <Issues
                                issues={issues}
                                stages={stages.filter((s) => !s.isPrereq)}
                                onIssueChange={refreshIssues}
                                onGoToStage={handleGoToStage}
                                onGoTo={setTab}
                            />
                        )}


                        {tab === 'summary' && (
                            <Summary
                                {...pageProps}
                                user={user}
                                project={project}
                                issues={issues}
                                onGoTo={setTab}
                                onGoToStage={handleGoToStage}
                            />
                        )}

                        {tab === 'preconstruction' && (
                            <Preconstruction
                                stage={stages.find((s) => s.isPrereq)}
                                stagePct={stagePct}
                                toggleTask={toggleTask}
                                budget={budget}
                                pays={pays}
                                addPayment={addPayment}
                                updatePayment={updatePayment}
                                deletePayment={deletePayment}
                                logs={logs}
                                addLog={addLog}
                                onBudgetEdit={updateBudget}
                                openStageId={openStage}
                            />
                        )}
                        {tab === 'cashflow' && (
                            <CashFlow
                                project={project}
                                pays={pays}
                            />
                        )}
                        {tab === 'postconstruction' && (
                            <PostConstruction
                                stage={stages.find((s) => s.id === 's_handover')}
                                stagePct={stagePct}
                                toggleTask={toggleTask}
                                budget={budget}
                                pays={pays}
                                addPayment={addPayment}
                                updatePayment={updatePayment}
                                deletePayment={deletePayment}
                                logs={logs}
                                addLog={addLog}
                                onBudgetEdit={updateBudget}
                                openStageId={openStage}
                            />
                        )}

                    </div>
                </main>
            </div>

            <BottomNav active={tab} onSelect={setTab} />

            {/* Edit project modal */}
            {showEditProject && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalBox}>
                        <ProjectSelect
                            user={user}
                            onProjectSelected={(p) => {
                                handleProjectSelected(p);
                                setShowEditProject(false);
                            }}
                        />
                        <button
                            className={styles.modalClose}
                            onClick={() => setShowEditProject(false)}
                        >
                            ✕ Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
