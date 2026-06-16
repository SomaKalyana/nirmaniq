import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Badge,
    ProgressBar,
    CheckButton,
    SectionTitle,
    EmptyState,
} from '../components/ui/UI.jsx';
import Icon from '../components/ui/Icon.jsx';
import { C } from '../utils/colors.js';
import { fmtINR, fmtDate, fmtTime } from '../utils/format.js';
import {
    getStageMaterials,
    getStageCostSummary,
    MARKET_RATES,
} from '../utils/stageMaterials.js';
import {
    getAIStageMaterials,
    createIssue, updateIssue, deleteIssueApi,
    reviewPhoto, logAudit,
    loadStageEstimate, saveStageEstimate,
    loadMatActuals, saveMatActual,
} from '../utils/api.js';
import {
    STAGE_BUDGET_MAP,
    STAGE_REQUIRED_PHOTOS,
    STAGE_QUALITY_CHECKS,
} from '../data/stagesData.js';
import styles from './Stages.module.css';

// ── Payment constants ─────────────────────────────────────────────────────────
const PAYMENT_MODES = ['Cash', 'UPI / PhonePe / GPay', 'NEFT / IMPS / RTGS', 'Cheque', 'Bank Transfer', 'DD (Demand Draft)', 'Other'];
const NEEDS_REF = (mode) => mode && mode !== 'Cash';

// ── Tabs ──────────────────────────────────────────────────────────────────────
const DETAIL_TABS = [
    { id: 'activities', label: 'Activities', icon: '✅' },
    { id: 'quality',    label: 'Quality',    icon: '🔍' },
    { id: 'photos',     label: 'Photos',     icon: '📸' },
    { id: 'materials',  label: 'Materials',  icon: '🧱' },
    { id: 'budget',     label: 'Budget',     icon: '💰' },
    { id: 'payments',   label: 'Payments',   icon: '💳' },
    { id: 'log',        label: 'Daily Log',  icon: '📝' },
];

// ── Phase grouping ────────────────────────────────────────────────────────────
const PHASE_ORDER = [
    'preparation',
    'foundation',
    'structure',
    'masonry',
    'mep',
    'finishing',
    'systems',
    'handover',
];
const PHASE_LABELS = {
    preparation: 'Preparation',
    foundation:  'Foundation',
    structure:   'Structure',
    masonry:     'Masonry & Plaster',
    mep:         'MEP',
    finishing:   'Finishing',
    systems:     'Systems',
    handover:    'Handover',
};
const PHASE_COLORS = {
    preparation: '#26A641',
    foundation:  '#388BFD',
    structure:   '#E6A817',
    masonry:     '#F85149',
    mep:         '#D29922',
    finishing:   '#3FB950',
    systems:     '#8957E5',
    handover:    '#2DD4A0',
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN STAGES COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Stages({
    stages,
    totalBudget,
    stageItems,
    stagePct,
    toggleTask,
    mats,
    budget,
    pays,
    addPayment,
    updatePayment,
    deletePayment,
    logs,
    photos,
    addLog,
    addPhoto,
    project,
    onProjectUpdate,
    issues = [],
    onIssueChange,
    marketRates = null,
    onBudgetEdit,
    openStageId = null,
}) {
    const [selectedId, setSelectedId] = useState(null);
    const [activeTab, setActiveTab] = useState('activities');
    const [expandPhase, setExpandPhase] = useState({
        preparation: true,
        foundation: true,
        structure: true,
        masonry: true,
        mep: true,
        finishing: true,
        systems: true,
        handover: true,
        other: true,
    });

    useEffect(() => {
        if (openStageId && Array.isArray(stages) && stages.some((s) => s.id === openStageId)) {
            setSelectedId(openStageId);
            setActiveTab('activities');
            const target = stages.find((s) => s.id === openStageId);
            if (target?.phase) {
                setExpandPhase((p) => ({ ...p, [target.phase]: true }));
            }
        }
    }, [openStageId, stages]);

    const selectedStage = stages.find((s) => s.id === selectedId);
    const overallDone = stages.reduce(
        (a, s) => a + stageItems(s).filter((t) => t.done).length,
        0,
    );
    const overallTotal = stages.reduce((a, s) => a + stageItems(s).length, 0);
    const overallPct = overallTotal
        ? Math.round((overallDone / overallTotal) * 100)
        : 0;

    const normalizedStages = Array.isArray(stages) ? stages.filter(Boolean) : [];
    const knownPhases = new Set(PHASE_ORDER);
    const grouped = [
        ...PHASE_ORDER.map((phase) => ({
            phase,
            stages: normalizedStages.filter((s) => s.phase === phase),
        })),
        {
            phase: 'other',
            stages: normalizedStages.filter((s) => !knownPhases.has(s.phase)),
        },
    ].filter((g) => g.stages.length > 0);

    const handleSelectStage = (id) => {
        setSelectedId((prev) => (prev === id ? null : id));
        setActiveTab('activities');
    };

    return (
        <div className={styles.wrap}>
            {/* Overall progress */}
            <div className={styles.overallCard}>
                <div className={styles.overallLeft}>
                    <div className={styles.overallLabel}>
                        Construction Progress
                    </div>
                    <div className={styles.overallPct}>{overallPct}%</div>
                    <div className={styles.overallSub}>
                        {overallDone} of {overallTotal} tasks
                    </div>
                </div>
                <div className={styles.overallRight}>
                    <ProgressBar
                        value={overallPct}
                        color={C.accent}
                        height={8}
                    />
                    <div className={styles.overallStages}>
                        {stages.length} stages ·{' '}
                        {stages.filter((s) => stagePct(s) === 100).length}{' '}
                        complete
                    </div>
                </div>
            </div>

            {/* Tree + detail */}
            <div className={styles.layout}>
                {/* Stage tree */}
                <div className={styles.tree}>
                    <div className={styles.treeHeader}>
                        <Icon name="stages" size={14} color={C.muted} />
                        <span>Stages</span>
                    </div>

                    {grouped.map(({ phase, stages: ps }) => {
                        const phTotal = ps.reduce(
                            (a, s) => a + stageItems(s).length,
                            0,
                        );
                        const phDone = ps.reduce(
                            (a, s) =>
                                a + stageItems(s).filter((t) => t.done).length,
                            0,
                        );
                        const phPct = phTotal
                            ? Math.round((phDone / phTotal) * 100)
                            : 0;
                        const open = expandPhase[phase];

                        return (
                            <div key={phase} className={styles.phaseGroup}>
                                <button
                                    className={styles.phaseHeader}
                                    onClick={() =>
                                        setExpandPhase((p) => ({
                                            ...p,
                                            [phase]: !p[phase],
                                        }))
                                    }
                                >
                                    <div
                                        className={styles.phaseDot}
                                        style={{
                                            background: PHASE_COLORS[phase] || C.muted,
                                        }}
                                    />
                                    <span className={styles.phaseLabel}>
                                        {PHASE_LABELS[phase] || 'Other'}
                                    </span>
                                    <span
                                        className={styles.phasePct}
                                        style={{
                                            color:
                                                phPct === 100
                                                    ? C.green
                                                    : C.hint,
                                        }}
                                    >
                                        {phPct}%
                                    </span>
                                    <span className={styles.phaseChevron}>
                                        {open ? '▾' : '▸'}
                                    </span>
                                </button>

                                {open && (
                                    <div className={styles.stageNodes}>
                                        <div className={styles.treeLine} />
                                        <div className={styles.stageNodeList}>
                                            {ps.map((s) => {
                                                const p = stagePct(s);
                                                const active =
                                                    selectedId === s.id;
                                                const isNext =
                                                    !active &&
                                                    stageItems(s).some(
                                                        (t) => !t.done,
                                                    ) &&
                                                    stages.findIndex((x) =>
                                                        stageItems(x).some(
                                                            (t) => !t.done,
                                                        ),
                                                    ) ===
                                                        stages.findIndex(
                                                            (x) =>
                                                                x.id === s.id,
                                                        );
                                                return (
                                                    <button
                                                        key={s.id}
                                                        className={`${styles.stageNode} ${active ? styles.stageNodeActive : ''} ${isNext ? styles.stageNodeNext : ''}`}
                                                        style={
                                                            active
                                                                ? {
                                                                      borderLeftColor:
                                                                          s.color,
                                                                  }
                                                                : {}
                                                        }
                                                        onClick={() =>
                                                            handleSelectStage(
                                                                s.id,
                                                            )
                                                        }
                                                    >
                                                        <div
                                                            className={
                                                                styles.nodeConnector
                                                            }
                                                        />
                                                        <div
                                                            className={
                                                                styles.nodeIcon
                                                            }
                                                        >
                                                            {s.icon}
                                                        </div>
                                                        <div
                                                            className={
                                                                styles.nodeInfo
                                                            }
                                                        >
                                                            <div
                                                                className={
                                                                    styles.nodeLabel
                                                                }
                                                            >
                                                                {s.label}
                                                            </div>
                                                            <div
                                                                className={
                                                                    styles.nodeMeta
                                                                }
                                                            >
                                                                <div
                                                                    className={
                                                                        styles.nodePctBar
                                                                    }
                                                                    style={{
                                                                        width: `${p}%`,
                                                                        background:
                                                                            p ===
                                                                            100
                                                                                ? C.green
                                                                                : s.color,
                                                                    }}
                                                                />
                                                                <span
                                                                    className={
                                                                        styles.nodePct
                                                                    }
                                                                    style={{
                                                                        color:
                                                                            p ===
                                                                            100
                                                                                ? C.green
                                                                                : C.hint,
                                                                    }}
                                                                >
                                                                    {p}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {isNext && (
                                                            <div
                                                                className={
                                                                    styles.nodeNextBadge
                                                                }
                                                            >
                                                                Active
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Detail panel */}
                <div className={styles.detail}>
                    {!selectedStage ? (
                        <div className={styles.detailEmpty}>
                            <div className={styles.detailEmptyIcon}>🏗</div>
                            <div className={styles.detailEmptyTitle}>
                                Select a stage
                            </div>
                            <div className={styles.detailEmptySub}>
                                Click any stage in the tree to view activities,
                                materials with AI cost estimates, budget,
                                payments, daily logs and photos.
                            </div>
                        </div>
                    ) : (
                        <StageDetail
                            stage={selectedStage}
                            stageItems={stageItems}
                            stagePct={stagePct}
                            toggleTask={toggleTask}
                            totalBudget={totalBudget}
                            budget={budget}
                            pays={pays}
                            addPayment={addPayment}
                            updatePayment={updatePayment}
                            deletePayment={deletePayment}
                            logs={logs}
                            photos={photos}
                            addLog={addLog}
                            addPhoto={addPhoto}
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                            project={project}
                            onProjectUpdate={onProjectUpdate}
                            issues={issues}
                            onIssueChange={onIssueChange}
                            marketRates={marketRates}
                            onBudgetEdit={onBudgetEdit}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE DETAIL PANEL
// ─────────────────────────────────────────────────────────────────────────────
function StageDetail({
    stage,
    stageItems,
    stagePct,
    toggleTask,
    totalBudget,
    budget,
    pays,
    addPayment,
    updatePayment,
    deletePayment,
    logs,
    photos,
    addLog,
    addPhoto,
    activeTab,
    onTabChange,
    project,
    onProjectUpdate,
    issues,
    onIssueChange,
    marketRates = null,
    onBudgetEdit,
    openStageId = null,
}) {
    const items = stageItems(stage);
    const p = stagePct(stage);
    const doneCt = items.filter((t) => t.done).length;
    const budgetInfo = STAGE_BUDGET_MAP[stage.id];

    // Shared estimated cost — loaded from DB on mount, updated live by MaterialsTab
    const [stageEstimatedCost, setStageEstimatedCost] = useState(0);

    // Load saved estimate from DB when stage changes, so BudgetTab shows correct value
    // even before the user visits Materials tab
    useEffect(() => {
        setStageEstimatedCost(0); // reset first
        loadStageEstimate(stage.id)
            .then(est => {
                if (est && est.estimatedCost > 0) {
                    setStageEstimatedCost(est.estimatedCost);
                } else {
                    // Compute local estimate as default
                    const { totalCost } = getStageMaterials(stage.id, project || {});
                    if (totalCost > 0) setStageEstimatedCost(totalCost);
                }
            })
            .catch(() => {
                // Network error — use local calculation as fallback
                const { totalCost } = getStageMaterials(stage.id, project || {});
                if (totalCost > 0) setStageEstimatedCost(totalCost);
            });
    }, [stage.id, project]); // eslint-disable-line

    const stageBudgetCat = budget.find((b) => b.id === budgetInfo?.catId);
    const stageAlloc = stageBudgetCat?.allocated || 0;
    const stageSpent = stageBudgetCat?.spent || 0;
    const stagePctBudget =
        stageAlloc > 0 ? Math.round((stageSpent / stageAlloc) * 100) : 0;
    const stagePays = [...pays.filter((py) => py.catId === budgetInfo?.catId)].sort((a,b) => (b.date||'').localeCompare(a.date||''));

    const stageLogs = logs.filter((l) =>
        l.stageId
            ? l.stageId === stage.id
            : l.stage &&
              stage.label &&
              l.stage.split(' ').slice(0, 2).join(' ') ===
                  stage.label.split(' ').slice(0, 2).join(' '),
    );
    const stagePhotos = photos.filter((ph) =>
        ph.stageId
            ? ph.stageId === stage.id
            : ph.stageLabel &&
              stage.label &&
              ph.stageLabel.split(' ').slice(0, 2).join(' ') ===
                  stage.label.split(' ').slice(0, 2).join(' '),
    );

    return (
        <div className={styles.detailWrap}>
            {/* Header */}
            <div
                className={styles.detailHeader}
                style={{ borderTopColor: stage.color }}
            >
                <div className={styles.detailHeaderLeft}>
                    <div className={styles.detailIcon}>{stage.icon}</div>
                    <div>
                        <div className={styles.detailTitle}>{stage.label}</div>
                        <div className={styles.detailMeta}>
                            <Badge color={stage.color} small>
                                {stage.phase}
                            </Badge>
                            <span className={styles.detailMetaItem}>
                                {stage.durationWks} weeks
                            </span>
                            <span className={styles.detailMetaItem}>
                                {fmtINR((totalBudget * stage.budgetPct) / 100)}{' '}
                                budget
                            </span>
                        </div>
                    </div>
                </div>
                <div className={styles.detailHeaderRight}>
                    <div
                        className={styles.detailPct}
                        style={{ color: p === 100 ? C.green : C.accent }}
                    >
                        {p}%
                    </div>
                    <div className={styles.detailPctSub}>
                        {doneCt}/{items.length} tasks
                    </div>
                </div>
            </div>

            <div className={styles.detailProgress}>
                <ProgressBar
                    value={p}
                    color={p === 100 ? C.green : stage.color}
                    height={5}
                />
            </div>

            {/* Tabs */}
            <div className={styles.detailTabs}>
                {DETAIL_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        className={`${styles.detailTab} ${activeTab === tab.id ? styles.detailTabActive : ''}`}
                        style={
                            activeTab === tab.id
                                ? {
                                      borderBottomColor: stage.color,
                                      color: stage.color,
                                  }
                                : {}
                        }
                        onClick={() => onTabChange(tab.id)}
                    >
                        <span className={styles.detailTabIcon}>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className={styles.detailContent}>
                {/* ── Quality tab badge on header ── */}
                {activeTab === 'quality' && (
                    <QualityTab
                        stage={stage}
                        issues={issues.filter(
                            (i) =>
                                i.stage_id === stage.id ||
                                i.stageId === stage.id,
                        )}
                        onIssueChange={onIssueChange}
                        qualityChecks={stage.qualityChecks || STAGE_QUALITY_CHECKS[stage.id] || []}
                    />
                )}
                {activeTab === 'photos' && (
                    <PhotosTab
                        stage={stage}
                        stagePhotos={photos.filter((ph) =>
                            ph.stageId
                                ? ph.stageId === stage.id
                                : ph.stageLabel &&
                                  stage.label &&
                                  ph.stageLabel
                                      .split(' ')
                                      .slice(0, 2)
                                      .join(' ') ===
                                      stage.label
                                          .split(' ')
                                          .slice(0, 2)
                                          .join(' '),
                        )}
                        addPhoto={addPhoto}
                        project={project}
                        requiredPhotoDefs={stage.requiredPhotos || STAGE_REQUIRED_PHOTOS[stage.id] || []}
                    />
                )}
                {activeTab === 'activities' && (
                    <ActivitiesTab
                        stage={stage}
                        items={items}
                        doneCt={doneCt}
                        toggleTask={toggleTask}
                        project={project}
                        onProjectUpdate={onProjectUpdate}
                    />
                )}
                {activeTab === 'materials' && (
                    <MaterialsTab
                        stage={stage}
                        project={project}
                        stageColor={stage.color}
                        onEstimateChange={setStageEstimatedCost}
                        marketRates={marketRates}
                    />
                )}
                {activeTab === 'budget' && (
                    <BudgetTab
                        stage={stage}
                        stageBudgetCat={stageBudgetCat}
                        stageAlloc={stageAlloc}
                        stageSpent={stageSpent}
                        stagePctBudget={stagePctBudget}
                        totalBudget={totalBudget}
                        stagePays={stagePays}
                        displayItems={[]}
                        effectiveTotal={stageEstimatedCost}
                        onBudgetEdit={onBudgetEdit}
                    />
                )}
                {activeTab === 'payments' && (
                    <PaymentsTab
                        stage={stage}
                        stagePays={stagePays}
                        stageBudgetCat={stageBudgetCat}
                        budget={budget}
                        addPayment={addPayment}
                        updatePayment={updatePayment}
                        deletePayment={deletePayment}
                    />
                )}
                {activeTab === 'log' && (
                    <LogTab
                        stage={stage}
                        stageLogs={stageLogs}
                        addLog={addLog}
                        project={project}
                    />
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: ACTIVITIES
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// BORE DEPTH INPUT — shown in borewell stage Activities tab
// Saves boreDepth to project so MaterialsTab uses actual depth for estimates
// ─────────────────────────────────────────────────────────────────────────────
function BoreDepthInput({ project, onUpdate }) {
    const saved   = project?.boreDepth || '';
    const [val, setVal] = useState(String(saved));
    const [saved_, setSaved_] = useState(false);

    const handleSave = () => {
        if (!val || isNaN(Number(val))) return;
        if (onUpdate) onUpdate({ boreDepth: Number(val) });
        setSaved_(true);
        setTimeout(() => setSaved_(false), 2000);
    };

    return (
        <div className={styles.boreDepthCard}>
            <div className={styles.boreDepthTitle}>
                💧 Actual bore depth
            </div>
            <div className={styles.boreDepthHint}>
                Enter the actual depth drilled. This updates the Materials tab quantities
                (drilling footage, casing pipe, cable length) to match your actual bore.
            </div>
            <div className={styles.boreDepthRow}>
                <input
                    type="number"
                    min="100"
                    max="600"
                    step="10"
                    value={val}
                    onChange={e => setVal(e.target.value)}
                    placeholder="e.g. 320"
                    className={styles.boreDepthInput}
                />
                <span className={styles.boreDepthUnit}>ft</span>
                <button
                    className={styles.boreDepthSave}
                    onClick={handleSave}
                    disabled={!val || isNaN(Number(val))}
                >
                    {saved_ ? '✓ Saved' : 'Save depth'}
                </button>
            </div>
            {saved && (
                <div className={styles.boreDepthSaved}>
                    Current: {saved} ft depth recorded — materials estimated accordingly
                </div>
            )}
        </div>
    );
}

function ActivitiesTab({ stage, items, doneCt, toggleTask, project, onProjectUpdate }) {
    return (
        <div className={styles.tabContent}>
            {stage.id === 's_borewell' && (
                <BoreDepthInput project={project} onUpdate={onProjectUpdate} />
            )}
            <div className={styles.taskCountRow}>
                <span>
                    {doneCt} of {items.length} tasks completed
                </span>
                {doneCt === items.length && (
                    <span className={styles.completedBadge}>
                        ✓ Stage complete
                    </span>
                )}
            </div>
            {items.map((t) => (
                <div
                    key={t.id}
                    className={`${styles.taskRow} ${t.done ? styles.taskRowDone : ''}`}
                >
                    <CheckButton
                        done={t.done}
                        onClick={() => toggleTask(stage.id, t.id)}
                        color={C.green}
                    />
                    <div className={styles.taskBody}>
                        <div
                            className={`${styles.taskText} ${t.done ? styles.taskDone : ''}`}
                        >
                            {t.text}
                        </div>
                        {t.done && t.doneDate && (
                            <div className={styles.taskDate}>
                                ✓ Done {t.doneDate}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: MATERIALS  — the main feature
// Computes quantities locally via getStageMaterials(), then calls AI to enrich.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// AI CONFIRM MODAL — shown before any AI API call to warn about costs
// ─────────────────────────────────────────────────────────────────────────────
function AIConfirmModal({ title, description, estimatedCost, onConfirm, onCancel }) {
    return (
        <div className={styles.aiModalOverlay} onClick={onCancel}>
            <div className={styles.aiModal} onClick={e => e.stopPropagation()}>
                <div className={styles.aiModalIcon}>🤖</div>
                <div className={styles.aiModalTitle}>{title}</div>
                <div className={styles.aiModalDesc}>{description}</div>
                <div className={styles.aiModalCost}>
                    <span className={styles.aiModalCostLabel}>Estimated API cost</span>
                    <span className={styles.aiModalCostVal}>{estimatedCost || '~₹3–12'}</span>
                </div>
                <div className={styles.aiModalNote}>
                    This will send your project data and uploaded drawings to Claude AI
                    (Anthropic). Each call is charged to your API key. You can review
                    and re-run at any time.
                </div>
                <div className={styles.aiModalActions}>
                    <button className={styles.aiModalCancel} onClick={onCancel}>Cancel</button>
                    <button className={styles.aiModalConfirm} onClick={onConfirm}>
                        ✓ Yes, run AI analysis
                    </button>
                </div>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// TAB: MATERIALS — estimated vs actual tracking
// ─────────────────────────────────────────────────────────────────────────────
function MaterialsTab({ stage, project, stageColor, onEstimateChange, marketRates }) {
    const { items: localItems, totalCost: localTotal } = getStageMaterials(stage.id, project || {}, marketRates);
    const [aiItems,    setAiItems]    = useState(null);
    const [aiTotal,    setAiTotal]    = useState(0);
    const [aiNotes,    setAiNotes]    = useState('');
    const [aiMarket,   setAiMarket]   = useState('');
    const [aiLoading,  setAiLoading]  = useState(false);
    const [aiError,    setAiError]    = useState('');
    const [aiSource,   setAiSource]   = useState('local');
    const [aiDocBased, setAiDocBased] = useState(false);
    const [aiLabour,   setAiLabour]   = useState(0);
    const [aiMaterial, setAiMaterial] = useState(0);
    const [rateOverrides, setRateOverrides] = useState({});
    const [showAIConfirm, setShowAIConfirm] = useState(false);

    // Estimated (saved from AI/local)
    const [savedEstimate, setSavedEstimate] = useState(null);
    // Actuals keyed by item id
    const [actuals, setActuals] = useState({});
    // UI: editing actuals
    const [editActual, setEditActual]   = useState(null); // item id being edited
    const [actualForm, setActualForm]   = useState({ qty:'', rate:'', notes:'' });
    const [savingActual, setSavingActual] = useState(false);

    useEffect(() => {
        setAiItems(null); setAiTotal(0); setAiNotes(''); setAiError('');
        setAiSource('local'); setAiDocBased(false); setAiLabour(0); setAiMaterial(0);
        setRateOverrides({});
        // Load saved estimate and actuals for this stage
        loadStageEstimate(stage.id).then(e => { if (e) setSavedEstimate(e); }).catch(() => {});
        loadMatActuals(stage.id).then(setActuals).catch(() => {});
    }, [stage.id]);

    const fetchAI = useCallback(async () => {
        setAiLoading(true); setAiError('');
        try {
            const result = await getAIStageMaterials(stage.id, stage.label, project || {}, localItems);
            if (result.items && result.items.length > 0) {
                setAiItems(result.items); setAiTotal(result.totalCost || 0);
                setAiNotes(result.notes || ''); setAiMarket(result.marketContext || '');
                setAiDocBased(!!(result.documentBased || (result.usedDocuments?.length > 0)));
                setAiLabour(result.labourCost || 0); setAiMaterial(result.materialCost || 0);
                setAiSource('ai');
            } else { setAiError('AI returned no items. Showing local estimates.'); }
        } catch (e) { setAiError(`AI unavailable: ${e.message}. Showing local estimates.`); }
        finally { setAiLoading(false); }
    }, [stage.id, stage.label, project, localItems]);

    const displayItems = aiSource === 'ai' && aiItems ? aiItems : localItems;
    const displayTotal = aiSource === 'ai' && aiItems ? aiTotal : localTotal;

    // Save estimate as the "official" estimate for this stage
    const handleSaveEstimate = async () => {
        const items = displayItems.map(i => ({
            id: i.id, name: i.name, unit: i.unit,
            qty: i.qty, rate: rateOverrides[i.id] !== undefined ? rateOverrides[i.id] : i.rate,
            amount: i.qty * (rateOverrides[i.id] !== undefined ? rateOverrides[i.id] : i.rate),
            spec: i.spec || '', category: i.category || '',
        }));
        await saveStageEstimate(stage.id, effectiveTotal, items, aiSource);
        setSavedEstimate({ stageId: stage.id, estimatedCost: effectiveTotal, items, source: aiSource, savedAt: new Date().toISOString() });
    };

    // Effective display with rate overrides
    const effectiveItems = displayItems.map(i => {
        const r = rateOverrides[i.id] !== undefined ? rateOverrides[i.id] : i.rate;
        return { ...i, rate: r, amount: i.qty * r };
    });
    const effectiveTotal = effectiveItems.reduce((s,i) => s + (i.amount||0), 0);

    // Notify parent (StageDetail) whenever the estimated total changes so BudgetTab stays in sync
    useEffect(() => {
        if (onEstimateChange && effectiveTotal > 0) onEstimateChange(effectiveTotal);
    }, [effectiveTotal, onEstimateChange]);

    // Category totals for breakdown
    const byCat = {};
    effectiveItems.forEach(i => {
        const k = i.category || 'misc';
        byCat[k] = (byCat[k] || 0) + (i.amount || 0);
    });
    const catEntries = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
    const CAT_COLORS = { steel:'#F85149', cement:'#E6A817', aggregate:'#3FB950', masonry:'#8957E5', labour:'#388BFD', shuttering:'#D29922', civil:'#F85149', systems:'#388BFD', electrical:'#D29922', plumbing:'#3FB950', misc:'#8B949E', tiles:'#8957E5', paint:'#E6A817', curing:'#3FB950', chemical:'#D29922' };

    const openActualEdit = (item) => {
        const existing = actuals[item.id] || {};
        setActualForm({ qty: existing.actualQty || '', rate: existing.actualRate !== undefined ? existing.actualRate : item.rate, notes: existing.notes || '' });
        setEditActual(item.id);
    };

    const handleSaveActual = async (item) => {
        setSavingActual(true);
        const qty  = Number(actualForm.qty)  || 0;
        const rate = Number(actualForm.rate) || 0;
        const amt  = qty * rate;
        const data = { itemName: item.name, unit: item.unit, actualQty: qty, actualRate: rate, actualAmt: amt, notes: actualForm.notes };
        await saveMatActual(stage.id, item.id, data);
        setActuals(prev => ({ ...prev, [item.id]: { actualQty: qty, actualRate: rate, actualAmt: amt, notes: actualForm.notes } }));
        setEditActual(null);
        setSavingActual(false);
    };

    // Summary: total actual cost
    const totalActual = Object.values(actuals).reduce((s, a) => s + (a.actualAmt || 0), 0);
    const estimatedForVariance = savedEstimate?.estimatedCost || effectiveTotal;
    const variance = totalActual > 0 ? totalActual - estimatedForVariance : null;
    const varPct   = estimatedForVariance > 0 && variance !== null ? (variance / estimatedForVariance * 100) : null;
    const varColor = varPct === null ? C.muted : Math.abs(varPct) <= 5 ? C.green : Math.abs(varPct) <= 10 ? C.amber : C.red;

    if (localItems.length === 0) {
        return (
            <div className={styles.tabContent}>
                <div className={styles.matEmptyWrap}>
                    <div className={styles.matEmptyIcon}>🧱</div>
                    <div className={styles.matEmptyTitle}>No standard materials for this stage</div>
                    <div className={styles.matEmptySub}>Use the AI estimate to generate a bill of materials from your uploaded drawings.</div>
                    <button className={styles.aiBtnLarge} onClick={fetchAI} disabled={aiLoading}>
                        {aiLoading ? <><span className={styles.aiSpinner}/> Analysing drawings…</> : '🤖 Get AI estimate'}
                    </button>
                    {aiError && <div className={styles.aiError}>{aiError}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.tabContent}>

            {/* ── Summary banner: Estimated vs Actual ── */}
            <div className={styles.evaSummary}>
                <div className={styles.evaStat}>
                    <div className={styles.evaLabel}>Estimated cost</div>
                    <div className={styles.evaVal} style={{ color: C.accent }}>
                        {fmtINR(savedEstimate ? savedEstimate.estimatedCost : effectiveTotal)}
                    </div>
                    <div className={styles.evaSub}>{savedEstimate ? `Saved · ${savedEstimate.source}` : 'Not locked yet'}</div>
                </div>
                <div className={styles.evaDivider} />
                <div className={styles.evaStat}>
                    <div className={styles.evaLabel}>Actual cost</div>
                    <div className={styles.evaVal} style={{ color: totalActual > 0 ? C.text : C.hint }}>
                        {totalActual > 0 ? fmtINR(totalActual) : '—'}
                    </div>
                    <div className={styles.evaSub}>{Object.keys(actuals).length} items recorded</div>
                </div>
                <div className={styles.evaDivider} />
                <div className={styles.evaStat}>
                    <div className={styles.evaLabel}>Variance</div>
                    <div className={styles.evaVal} style={{ color: varColor }}>
                        {variance === null ? '—' : `${variance > 0 ? '+' : ''}${fmtINR(Math.abs(variance))}`}
                    </div>
                    <div className={styles.evaSub} style={{ color: varColor }}>
                        {varPct === null ? 'Enter actuals below' : `${varPct > 0 ? '+' : ''}${varPct.toFixed(1)}%`}
                    </div>
                </div>
                <button className={styles.evaLockBtn}
                    title={savedEstimate ? 'Re-lock current estimate' : 'Lock current estimate as baseline'}
                    onClick={handleSaveEstimate}>
                    {savedEstimate ? '🔄 Re-lock' : '🔒 Lock estimate'}
                </button>
            </div>

            {/* ── Source toggle + AI refresh ── */}
            <div className={styles.matTopBar}>
                <div className={styles.matSourceToggle}>
                    <button className={`${styles.sourceBtn} ${aiSource === 'local' ? styles.sourceBtnActive : ''}`}
                        onClick={() => setAiSource('local')}>📐 Engineering</button>
                    <button className={`${styles.sourceBtn} ${aiSource === 'ai' && aiItems ? styles.sourceBtnActive : ''}`}
                        onClick={() => aiItems ? setAiSource('ai') : setShowAIConfirm(true)}
                        style={aiItems ? {} : { borderStyle: 'dashed' }}>
                        {aiLoading ? <><span className={styles.aiSpinner}/> Fetching…</> : aiItems ? '🤖 AI estimate' : '🤖 Get AI estimate'}
                    </button>
                </div>
                {aiSource === 'ai' && aiItems && (
                    <button className={styles.aiRefreshBtn} onClick={() => setShowAIConfirm(true)} disabled={aiLoading}>↺ Refresh AI</button>
                )}
            </div>

            {aiError && <div className={styles.aiError}>{aiError}</div>}

            {/* AI notes */}
            {aiSource === 'ai' && aiItems && (
                <div className={styles.aiNotesCard}>
                    {aiDocBased && <div className={styles.aiDocBadge}>📐 Quantities derived from your uploaded structural drawings</div>}
                    {aiNotes  && <div className={styles.aiNotesText}>💡 {aiNotes}</div>}
                    {aiMarket && <div className={styles.aiMarketText}>📊 {aiMarket}</div>}
                    {aiLabour > 0 && aiMaterial > 0 && (
                        <div className={styles.aiCostSplit}>
                            <span>Materials: <strong>{fmtINR(aiMaterial)}</strong></span>
                            <span>Labour: <strong>{fmtINR(aiLabour)}</strong></span>
                        </div>
                    )}
                </div>
            )}

            {/* ── Cost banner ── */}
            <div className={styles.costBanner}>
                <div className={styles.costBannerLeft}>
                    <div className={styles.costBannerLabel}>Estimated stage cost</div>
                    <div className={styles.costBannerAmt} style={{ color: C.accent }}>{fmtINR(effectiveTotal)}</div>
                </div>
                <div className={styles.costBannerCats}>
                    {catEntries.slice(0,5).map(([k,v]) => (
                        <div key={k} className={styles.costCatPill}>
                            <div className={styles.costCatDot} style={{ background: CAT_COLORS[k]||C.muted }}/>
                            <span>{k}</span>
                            <span className={styles.costCatAmt}>{fmtINR(v)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Item table: Estimated vs Actual ── */}
            <div className={styles.evaTable}>
                {/* Header */}
                <div className={styles.evaTableHead}>
                    <div className={styles.evaColItem}>Material / Item</div>
                    <div className={styles.evaColEst}>Estimated</div>
                    <div className={styles.evaColAct}>Actual</div>
                    <div className={styles.evaColVar}>Variance</div>
                    <div className={styles.evaColAct}> </div>
                </div>

                {effectiveItems.map(item => {
                    const act  = actuals[item.id];
                    const estAmt = item.amount || 0;
                    const actAmt = act?.actualAmt || 0;
                    const diff   = act ? actAmt - estAmt : null;
                    const diffPct = estAmt > 0 && diff !== null ? (diff/estAmt*100) : null;
                    const rowColor = diffPct === null ? 'transparent' : Math.abs(diffPct) <= 5 ? 'rgba(63,185,80,.04)' : Math.abs(diffPct) <= 10 ? 'rgba(210,153,34,.06)' : 'rgba(248,81,73,.06)';
                    const dColor   = diffPct === null ? C.hint : Math.abs(diffPct) <= 5 ? C.green : Math.abs(diffPct) <= 10 ? C.amber : C.red;
                    const isEditing = editActual === item.id;

                    return (
                        <div key={item.id}>
                            <div className={styles.evaRow} style={{ background: rowColor }}>
                                {/* Item info */}
                                <div className={styles.evaColItem}>
                                    <div className={styles.matCatDot} style={{ background: CAT_COLORS[item.category||'misc']||C.muted }}/>
                                    <div>
                                        <div className={styles.evaItemName}>{item.name}</div>
                                        {item.spec && <div className={styles.evaItemSpec}>{item.spec}</div>}
                                    </div>
                                </div>
                                {/* Estimated */}
                                <div className={styles.evaColEst}>
                                    <div className={styles.evaQty}>{item.qty.toLocaleString()} <span className={styles.evaUnit}>{item.unit}</span></div>
                                    <div className={styles.evaRate}>@ ₹{(rateOverrides[item.id] ?? item.rate).toLocaleString()}
                                        <input className={styles.rateInput + (rateOverrides[item.id] !== undefined ? ' ' + styles.rateOverridden : '')}
                                            type="number" value={rateOverrides[item.id] ?? item.rate}
                                            onChange={e => setRateOverrides(p => ({ ...p, [item.id]: Number(e.target.value) }))}
                                            title="Edit rate" />
                                    </div>
                                    <div className={styles.evaAmt}>{fmtINR(estAmt)}</div>
                                </div>
                                {/* Actual */}
                                <div className={styles.evaColAct}>
                                    {act ? (<>
                                        <div className={styles.evaQty} style={{ color: C.text }}>{act.actualQty.toLocaleString()} <span className={styles.evaUnit}>{item.unit}</span></div>
                                        <div className={styles.evaRate}>@ ₹{act.actualRate.toLocaleString()}</div>
                                        <div className={styles.evaAmt} style={{ color: C.text }}>{fmtINR(actAmt)}</div>
                                    </>) : (
                                        <span className={styles.evaEmpty}>—</span>
                                    )}
                                </div>
                                {/* Variance */}
                                <div className={styles.evaColVar} style={{ color: dColor }}>
                                    {diff !== null ? (<>
                                        <div className={styles.evaVarAmt}>{diff > 0 ? '+' : ''}{fmtINR(Math.abs(diff))}</div>
                                        <div className={styles.evaVarPct}>{diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%</div>
                                    </>) : <span style={{ color: C.hint }}>—</span>}
                                </div>
                                {/* Edit button */}
                                <div className={styles.evaColAct}>
                                    <button className={styles.evaEditBtn}
                                        onClick={() => isEditing ? setEditActual(null) : openActualEdit(item)}>
                                        {isEditing ? '✕' : act ? '✏' : '+ Actual'}
                                    </button>
                                </div>
                            </div>

                            {/* Inline actual entry form */}
                            {isEditing && (
                                <div className={styles.evaActualForm}>
                                    <div className={styles.evaActualFormTitle}>Record actual for: {item.name}</div>
                                    <div className={styles.evaActualFormGrid}>
                                        <div>
                                            <div className={styles.fieldLabel}>Actual qty ({item.unit})</div>
                                            <input type="number" value={actualForm.qty}
                                                onChange={e => setActualForm(f => ({ ...f, qty: e.target.value }))}
                                                placeholder={`est. ${item.qty}`} />
                                        </div>
                                        <div>
                                            <div className={styles.fieldLabel}>Actual rate (₹/{item.unit})</div>
                                            <input type="number" value={actualForm.rate}
                                                onChange={e => setActualForm(f => ({ ...f, rate: e.target.value }))} />
                                        </div>
                                        <div>
                                            <div className={styles.fieldLabel}>Total: {fmtINR((Number(actualForm.qty)||0)*(Number(actualForm.rate)||0))}</div>
                                            <input placeholder="Notes (supplier, invoice no.)" value={actualForm.notes}
                                                onChange={e => setActualForm(f => ({ ...f, notes: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className={styles.payFormActions}>
                                        <button className={styles.cancelBtn} onClick={() => setEditActual(null)}>Cancel</button>
                                        <button className={styles.saveBtn} onClick={() => handleSaveActual(item)} disabled={savingActual}>
                                            {savingActual ? 'Saving…' : 'Save actual'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {showAIConfirm && (
                <AIConfirmModal
                    title={`AI material estimate — ${stage.label}`}
                    description={`Claude AI will read your uploaded structural drawings and generate a detailed Bill of Materials for the ${stage.label} stage with Vizag market rates.`}
                    estimatedCost="~₹4–15"
                    onConfirm={() => { setShowAIConfirm(false); fetchAI(); }}
                    onCancel={() => setShowAIConfirm(false)}
                />
            )}
            <div className={styles.rateNote}>
                Rates are editable above. Click <strong>+ Actual</strong> against any item to record what was
                actually delivered and the price paid. Variance turns green (&lt;5%), amber (5–10%),
                or red (&gt;10%) automatically.
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: BUDGET — estimated vs actual budget tracking
// ─────────────────────────────────────────────────────────────────────────────
function BudgetTab({
    stage, stageBudgetCat, stageAlloc, stageSpent,
    stagePctBudget, totalBudget, stagePays,
    displayItems, effectiveTotal, onBudgetEdit,
}) {
    const [editing,  setEditing]  = useState(false);
    const [editVal,  setEditVal]  = useState('');

    const contractAmt = stage.contractAmount || 0;
    const remaining  = stageAlloc - stageSpent;
    const color      = stagePctBudget > 100 ? C.red : stagePctBudget > 80 ? C.amber : C.green;
    const stageShare = totalBudget > 0 ? Math.round((stageAlloc / totalBudget) * 100) : 0;

    // Variance: estimated (from materials) vs actual (payments)
    const estCost   = effectiveTotal || stageAlloc;
    const variance  = stageSpent > 0 ? stageSpent - estCost : null;
    const varPct    = estCost > 0 && variance !== null ? (variance / estCost * 100) : null;
    const varColor  = varPct === null ? C.hint : Math.abs(varPct) <= 5 ? C.green : Math.abs(varPct) <= 10 ? C.amber : C.red;

    const handleSave = () => {
        const val = Number(editVal);
        if (val > 0 && onBudgetEdit) onBudgetEdit(stageBudgetCat?.id, val);
        setEditing(false);
    };

    return (
        <div className={styles.tabContent}>

            {/* Estimated vs Actual summary */}
            <div className={styles.evaSummary}>
                <div className={styles.evaStat}>
                    <div className={styles.evaLabel}>Budget allocated</div>
                    {editing ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, color: 'var(--muted)' }}>₹</span>
                            <input
                                type="number"
                                autoFocus
                                value={editVal}
                                onChange={e => setEditVal(e.target.value)}
                                style={{ width: 120, fontFamily: 'var(--font-mono)', textAlign: 'right' }}
                                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                            />
                            <button className={styles.saveBtn} style={{ padding: '4px 10px', fontSize: 12 }} onClick={handleSave}>Save</button>
                            <button className={styles.cancelBtn} style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEditing(false)}>✕</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                            <div className={styles.evaVal} style={{ color: C.accent }}>{fmtINR(stageAlloc)}</div>
                            <button
                                title="Edit budget allocation"
                                style={{ background: 'transparent', border: '1px solid var(--border-l)', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--muted)' }}
                                onClick={() => { setEditVal(String(stageAlloc)); setEditing(true); }}
                            >
                                ✏ Edit
                            </button>
                        </div>
                    )}
                    <div className={styles.evaSub}>{stageShare}% of project</div>
                    {contractAmt > 0 && stageAlloc !== contractAmt && (
                        <div className={styles.evaSub} style={{ marginTop: 4 }}>Original contract value: {fmtINR(contractAmt)}</div>
                    )}
                </div>
                <div className={styles.evaDivider} />
                <div className={styles.evaStat}>
                    <div className={styles.evaLabel}>AI/Est. cost</div>
                    <div className={styles.evaVal} style={{ color: C.blue }}>{fmtINR(estCost)}</div>
                    <div className={styles.evaSub}>From materials tab</div>
                </div>
                <div className={styles.evaDivider} />
                <div className={styles.evaStat}>
                    <div className={styles.evaLabel}>Actual paid</div>
                    <div className={styles.evaVal} style={{ color: color }}>{fmtINR(stageSpent)}</div>
                    <div className={styles.evaSub}>{stagePctBudget}% of allocation</div>
                </div>
                <div className={styles.evaDivider} />
                <div className={styles.evaStat}>
                    <div className={styles.evaLabel}>Variance (paid vs est.)</div>
                    <div className={styles.evaVal} style={{ color: varColor }}>
                        {variance === null ? '—' : `${variance > 0 ? '+' : ''}${fmtINR(Math.abs(variance))}`}
                    </div>
                    <div className={styles.evaSub} style={{ color: varColor }}>
                        {varPct !== null ? `${varPct > 0 ? '+' : ''}${varPct.toFixed(1)}%` : 'No payments yet'}
                    </div>
                </div>
            </div>

            {/* Contract payment info */}
            {stage.contractAmount > 0 && (
                <div className={styles.contractPayCard}>
                    <div className={styles.contractPayLabel}>Contract amount (Schedule 4)</div>
                    <div className={styles.contractPayAmt}>₹{(stage.contractAmount/100000).toFixed(1)}L</div>
                    {stage.paymentRule && <div className={styles.contractPayRule}>📋 {stage.paymentRule}</div>}
                </div>
            )}

            {/* Spend progress */}
            <div className={styles.budgetCard} style={{ borderColor: stage.color + '44' }}>
                <div className={styles.budgetCardTitle}>{stageBudgetCat?.label || 'Budget Category'}</div>
                <ProgressBar value={stagePctBudget} color={color} height={8} />
                <div className={styles.budgetSpendRow}>
                    <span style={{ color: C.muted, fontSize: 12 }}>₹0</span>
                    <span style={{ color, fontSize: 12, fontWeight: 600 }}>{fmtINR(stageSpent)} spent</span>
                    <span style={{ color: C.muted, fontSize: 12 }}>{fmtINR(stageAlloc)} allocated</span>
                </div>
                {remaining < 0 && (
                    <div className={styles.overBudgetBanner}>
                        ⚠ Over budget by {fmtINR(Math.abs(remaining))} — review payments and contingency
                    </div>
                )}
            </div>

            {/* Three-way comparison table */}
            <div className={styles.budgetCompare}>
                <div className={styles.budgetCompareTitle}>Stage cost breakdown</div>
                <table className={styles.compareTable}>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Allocated</th>
                            <th>Estimated</th>
                            <th>Actual paid</th>
                            <th>Variance</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{stageBudgetCat?.label}</td>
                            <td style={{ color: C.accent }}>{fmtINR(stageAlloc)}</td>
                            <td style={{ color: C.blue }}>{fmtINR(estCost)}</td>
                            <td style={{ color: color }}>{fmtINR(stageSpent)}</td>
                            <td style={{ color: varColor }}>
                                {variance !== null ? `${variance > 0 ? '+' : ''}${fmtINR(Math.abs(variance))}` : '—'}
                            </td>
                        </tr>
                        <tr style={{ borderTop: `1px solid var(--border)` }}>
                            <td style={{ fontWeight: 600 }}>Remaining budget</td>
                            <td colSpan={3}></td>
                            <td style={{ color: remaining >= 0 ? C.green : C.red, fontWeight: 600 }}>
                                {remaining >= 0 ? fmtINR(remaining) : `−${fmtINR(Math.abs(remaining))}`}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Recent payments */}
            {stagePays.length > 0 && (
                <>
                    <div className={styles.sectionLabel}>Payments against this stage</div>
                    {stagePays.slice(0, 5).map(pay => (
                        <div key={pay.id} className={styles.miniPayRow}>
                            <div>
                                <div className={styles.miniPayDesc}>{pay.desc}</div>
                                <div className={styles.miniPayDate}>{pay.date}</div>
                            </div>
                            <div className={styles.miniPayAmt}>{fmtINR(pay.amount)}</div>
                        </div>
                    ))}
                    {stagePays.length > 5 && (
                        <div className={styles.miniPayMore}>+{stagePays.length - 5} more — see Payments tab</div>
                    )}
                </>
            )}
        </div>
    );
}


function PaymentsTab({
    stage,
    stagePays,
    stageBudgetCat,
    budget,
    addPayment,
    updatePayment,
    deletePayment,
}) {
    const [show, setShow] = useState(false);
    const emptyForm = () => ({
        desc: '', amount: '',
        catId: stageBudgetCat?.id || 'b3',
        date: new Date().toISOString().slice(0, 10),
        stageId: stage.id,
        vendor_name: '', payment_mode: 'Cash', ref_number: '', bank_charges: '', bank_charges_desc: '',
    });
    const [form, setForm] = useState(emptyForm);
    const [editId, setEditId] = useState(null);
    const [editForm, setEditForm] = useState(emptyForm);
    const handleAdd = () => {
        if (!form.desc || !form.amount) return;
        addPayment({ ...form, amount: Number(form.amount), stageId: stage.id, vendor_name: form.vendor_name || '', payment_mode: form.payment_mode || 'Cash', ref_number: form.ref_number || '', bank_charges: Number(form.bank_charges)||0, bank_charges_desc: form.bank_charges_desc||'' });
        setForm(emptyForm());
        setShow(false);
    };


    const startEdit = (pay) => {
        setShow(false);
        setEditId(pay.id);
        setEditForm({
            desc: pay.desc || '',
            amount: pay.amount || '',
            catId: pay.catId || stageBudgetCat?.id || 'b3',
            date: pay.date || new Date().toISOString().slice(0, 10),
            stageId: pay.stageId || stage.id,
            vendor_name: pay.vendor_name || '',
            payment_mode: pay.payment_mode || 'Cash',
            ref_number: pay.ref_number || '',
            bank_charges: pay.bank_charges || '',
            bank_charges_desc: pay.bank_charges_desc || '',
        });
    };

    const saveEdit = () => {
        if (!editId || !editForm.desc || !editForm.amount) return;
        updatePayment?.(editId, { ...editForm, amount: Number(editForm.amount), stageId: stage.id, bank_charges: Number(editForm.bank_charges)||0, bank_charges_desc: editForm.bank_charges_desc||'' });
        setEditId(null);
    };
    return (
        <div className={styles.tabContent}>
            <div className={styles.payHeader}>
                <div className={styles.payTotal}>
                    {stagePays.length} payment
                    {stagePays.length !== 1 ? 's' : ''} ·{' '}
                    <strong>
                        {fmtINR(stagePays.reduce((a, p) => a + p.amount, 0))}
                    </strong>{' '}
                    paid
                </div>
                <button
                    className={styles.addPayBtn}
                    onClick={() => setShow(!show)}
                >
                    + Add payment
                </button>
            </div>
            {show && (
                <div className={styles.payForm}>
                    <div className={styles.payFormTitle}>
                        Record payment for {stage.label}
                    </div>
                    <div className={styles.payFormGrid}>
                        <div className={styles.fullCol}>
                            <div className={styles.fieldLabel}>Description *</div>
                            <input placeholder="e.g. Foundation labour — 1st tranche"
                                value={form.desc} onChange={e => setForm(f => ({...f, desc: e.target.value}))} />
                        </div>
                        <div className={styles.fullCol}>
                            <div className={styles.fieldLabel}>Vendor / Payee name</div>
                            <input placeholder="e.g. Bheem Enterprises, VSP Steel Depot"
                                value={form.vendor_name || ''} onChange={e => setForm(f => ({...f, vendor_name: e.target.value}))} />
                        </div>
                        <div>
                            <div className={styles.fieldLabel}>Amount (₹) *</div>
                            <input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} />
                        </div>
                        <div>
                            <div className={styles.fieldLabel}>Date *</div>
                            <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} />
                        </div>
                        <div>
                            <div className={styles.fieldLabel}>Payment mode</div>
                            <select value={form.payment_mode || 'Cash'}
                                onChange={e => setForm(f => ({...f, payment_mode: e.target.value, ref_number: e.target.value === 'Cash' ? '' : f.ref_number}))}>
                                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        {NEEDS_REF(form.payment_mode) && (
                            <div>
                                <div className={styles.fieldLabel}>Reference / Transaction no.</div>
                                <input placeholder="UTR / Cheque no. / Transaction ID"
                                    value={form.ref_number || ''} onChange={e => setForm(f => ({...f, ref_number: e.target.value}))} />
                            </div>
                        )}
                        {NEEDS_REF(form.payment_mode) && (
                            <div>
                                <div className={styles.fieldLabel}>Bank charges / Processing fee (₹)</div>
                                <input type="number" placeholder="0.000" step="0.001"
                                    value={form.bank_charges || ''} onChange={e => setForm(f => ({...f, bank_charges: e.target.value}))} />
                            </div>
                        )}
                        {NEEDS_REF(form.payment_mode) && (
                            <div>
                                <div className={styles.fieldLabel}>Charge description</div>
                                <input placeholder="e.g. NEFT fee, processing charge"
                                    value={form.bank_charges_desc || ''} onChange={e => setForm(f => ({...f, bank_charges_desc: e.target.value}))} />
                            </div>
                        )}
                        <div className={styles.fullCol}>
                            <div className={styles.fieldLabel}>Budget category</div>
                            <select value={form.catId} onChange={e => setForm(f => ({...f, catId: e.target.value}))}>
                                {budget.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className={styles.payFormActions}>
                        <button
                            className={styles.cancelBtn}
                            onClick={() => setShow(false)}
                        >
                            Cancel
                        </button>
                        <button className={styles.saveBtn} onClick={handleAdd}>
                            Save payment
                        </button>
                    </div>
                </div>
            )}
            {stagePays.length === 0 && !show && (
                <div className={styles.emptyTab}>
                    <span>💳</span>
                    <span>No payments for this stage yet.</span>
                </div>
            )}
            {stagePays.map((pay) => editId === pay.id ? (
                <div key={pay.id} className={styles.payForm}>
                    <div className={styles.payFormTitle}>Edit payment for {stage.label}</div>
                    <div className={styles.payFormGrid}>
                        <div className={styles.fullCol}>
                            <div className={styles.fieldLabel}>Description *</div>
                            <input value={editForm.desc} onChange={e => setEditForm(f => ({...f, desc: e.target.value}))} />
                        </div>
                        <div className={styles.fullCol}>
                            <div className={styles.fieldLabel}>Vendor / Payee name</div>
                            <input placeholder="e.g. Bheem Enterprises"
                                value={editForm.vendor_name || ''} onChange={e => setEditForm(f => ({...f, vendor_name: e.target.value}))} />
                        </div>
                        <div>
                            <div className={styles.fieldLabel}>Amount (₹) *</div>
                            <input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({...f, amount: e.target.value}))} />
                        </div>
                        <div>
                            <div className={styles.fieldLabel}>Date *</div>
                            <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({...f, date: e.target.value}))} />
                        </div>
                        <div>
                            <div className={styles.fieldLabel}>Payment mode</div>
                            <select value={editForm.payment_mode || 'Cash'}
                                onChange={e => setEditForm(f => ({...f, payment_mode: e.target.value, ref_number: e.target.value === 'Cash' ? '' : f.ref_number}))}>
                                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        {NEEDS_REF(editForm.payment_mode) && (
                            <div>
                                <div className={styles.fieldLabel}>Reference / Transaction no.</div>
                                <input placeholder="UTR / Cheque no."
                                    value={editForm.ref_number || ''} onChange={e => setEditForm(f => ({...f, ref_number: e.target.value}))} />
                            </div>
                        )}
                        {NEEDS_REF(editForm.payment_mode) && (
                            <div>
                                <div className={styles.fieldLabel}>Bank charges (₹)</div>
                                <input type="number" placeholder="0.000" step="0.001"
                                    value={editForm.bank_charges || ''} onChange={e => setEditForm(f => ({...f, bank_charges: e.target.value}))} />
                            </div>
                        )}
                        {NEEDS_REF(editForm.payment_mode) && (
                            <div>
                                <div className={styles.fieldLabel}>Charge description</div>
                                <input placeholder="e.g. NEFT fee"
                                    value={editForm.bank_charges_desc || ''} onChange={e => setEditForm(f => ({...f, bank_charges_desc: e.target.value}))} />
                            </div>
                        )}
                        <div className={styles.fullCol}>
                            <div className={styles.fieldLabel}>Budget category</div>
                            <select value={editForm.catId} onChange={e => setEditForm(f => ({...f, catId: e.target.value}))}>
                                {budget.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className={styles.payFormActions}>
                        <button className={styles.cancelBtn} onClick={() => setEditId(null)}>Cancel</button>
                        <button className={styles.saveBtn} onClick={saveEdit} disabled={!editForm.desc || !editForm.amount}>Update payment</button>
                    </div>
                </div>
            ) : (
                <div key={pay.id} className={styles.payRow}>
                    <div className={styles.payInfo}>
                        <div className={styles.payDesc}>{pay.desc}</div>
                        {pay.vendor_name && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>🏢 {pay.vendor_name}</div>}
                        {(pay.bank_charges > 0) && <div style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 2 }}>🏦 Bank charges: {fmtINR(pay.bank_charges)}{pay.bank_charges_desc ? ` — ${pay.bank_charges_desc}` : ''}</div>}
                        <div className={styles.payMeta}>
                            {pay.date} · {budget.find(b => b.id === pay.catId)?.label}
                            {pay.payment_mode && pay.payment_mode !== 'Cash' && (
                                <span style={{ marginLeft: 6, fontSize: 10, background: 'color-mix(in srgb, var(--blue) 12%, transparent)', color: 'var(--blue)', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>
                                    {pay.payment_mode.split('/')[0].trim().split(' ')[0]}
                                </span>
                            )}
                            {pay.payment_mode === 'Cash' && (
                                <span style={{ marginLeft: 6, fontSize: 10, background: 'color-mix(in srgb, var(--green) 12%, transparent)', color: 'var(--green)', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>Cash</span>
                            )}
                            {pay.ref_number && <span style={{ marginLeft: 4, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--hint)' }}>{pay.ref_number}</span>}
                        </div>
                    </div>
                    <div className={styles.payRight}>
                        <span className={styles.payAmt}>{fmtINR(pay.amount)}</span>
                        <button className={styles.delBtn} onClick={() => startEdit(pay)} title="Edit">Edit</button>
                        <button className={styles.delBtn} onClick={() => deletePayment(pay.id)} title="Delete">
                            <Icon name="trash" size={13} color={C.hint} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: DAILY LOG — with AI issue detection + solution
// ─────────────────────────────────────────────────────────────────────────────

// Keywords that suggest a problem in a log entry
const ISSUE_KEYWORDS = [
    'crack','cracking','leak','leaking','seepage','delay','delayed','not done',
    'wrong','incorrect','fail','failed','missing','absent','stopped','issue',
    'problem','defect','honeycomb','segregat','collapse','cave','break',
    'broken','short','damage','flood','water','reject','poor','bad',
    'accident','injury','dispute','fight','stolen','theft','shortage',
    'not started','not completed','behind schedule','hold','hold up',
    'can\'t','cannot','unable','refused','no show','didn\'t come',
];

function detectIssue(text) {
    const lower = text.toLowerCase();
    return ISSUE_KEYWORDS.some(kw => lower.includes(kw));
}

function LogTab({ stage, stageLogs, addLog, project }) {
    const [text,      setText]      = useState('');
    const [solutions, setSolutions] = useState({}); // logId → {loading, result, error, visible}

    const handleAdd = () => {
        if (!text.trim()) return;
        addLog(text, stage.label, stage.id);
        setText('');
    };

    const getSolution = async (log) => {
        const lid = log.id;
        setSolutions(prev => ({ ...prev, [lid]: { loading: true, result: null, error: '', visible: true } }));

        const prompt = `You are a senior structural engineer and construction site expert in Visakhapatnam, India.

A site supervisor has logged the following issue during the "${stage.label}" stage of construction:

"${log.text}"

Project context:
- Plot: ${project?.plotLength || 60}×${project?.plotWidth || 35} ft, ${project?.floorConfig || 'S+G+2'}
- Contractor: Bheem Enterprises
- City: Visakhapatnam, AP

Provide a clear, actionable solution for this issue. Respond ONLY with valid JSON:
{
  "severity": "low|medium|high|critical",
  "rootCause": "what likely caused this issue",
  "immediateAction": "what to do right now today",
  "stepByStep": ["step 1", "step 2", "step 3"],
  "isCode": "relevant IS code or standard if applicable",
  "contractorInstruction": "exact instruction to give the contractor",
  "preventionTip": "how to avoid this in future",
  "estimatedDelay": "0 days|1-2 days|3-7 days|>1 week — if any"
}`;

        try {
            const r = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 1000,
                    messages: [{ role: 'user', content: prompt }],
                }),
            });
            const data = await r.json();
            const raw  = data.content?.[0]?.text || '';
            const clean = raw.replace(/```json|```/g, '').trim();
            const result = JSON.parse(clean);
            setSolutions(prev => ({ ...prev, [lid]: { loading: false, result, error: '', visible: true } }));
        } catch (err) {
            setSolutions(prev => ({ ...prev, [lid]: { loading: false, result: null, error: 'AI analysis failed. Check backend is running and API key is set.', visible: true } }));
        }
    };

    const toggleSolution = (lid) => {
        setSolutions(prev => ({
            ...prev,
            [lid]: { ...(prev[lid] || {}), visible: !(prev[lid]?.visible) }
        }));
    };

    const SEV_COLOR = { low: C.blue, medium: C.amber, high: '#F5A623', critical: C.red };

    return (
        <div className={styles.tabContent}>
            <div className={styles.logForm}>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    placeholder={`Log today's progress for ${stage.label}…\ne.g. Pour completed at 4pm. 3 cube samples taken. Curing started.\nOr log any issues: "Crack appeared in column C3 after shuttering removed"`}
                />
                <button
                    className={styles.saveBtn}
                    style={{ width: '100%', marginTop: 8 }}
                    onClick={handleAdd}
                    disabled={!text.trim()}
                >
                    + Add log entry
                </button>
            </div>

            {stageLogs.length === 0 ? (
                <div className={styles.emptyTab}>
                    <span>📝</span>
                    <span>No log entries for this stage yet. Log daily progress or any issues observed.</span>
                </div>
            ) : (
                stageLogs.map((l) => {
                    const isIssue = detectIssue(l.text || l.text_content || '');
                    const sol     = solutions[l.id] || {};
                    return (
                        <div key={l.id} className={`${styles.logCard} ${isIssue ? styles.logCardIssue : ''}`}>
                            {/* Header */}
                            <div className={styles.logMeta}>
                                <span style={{ color: C.accent, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                                    {l.date}
                                </span>
                                <span style={{ color: C.hint, fontSize: 11 }}>{l.time}</span>
                                {isIssue && (
                                    <span className={styles.logIssueBadge}>⚠ Issue detected</span>
                                )}
                            </div>

                            {/* Entry text */}
                            <div className={styles.logText}>{l.text || l.text_content}</div>

                            {/* Solution button — only for issue entries */}
                            {isIssue && (
                                <div className={styles.logSolutionBar}>
                                    <button
                                        className={styles.logSolutionBtn}
                                        onClick={() => sol.result || sol.loading ? toggleSolution(l.id) : getSolution(l)}
                                        disabled={sol.loading}
                                    >
                                        {sol.loading
                                            ? <><span className={styles.spinner} style={{width:12,height:12,borderTopColor:'#0D1117'}}/>  Analysing…</>
                                            : sol.result && sol.visible
                                                ? '▲ Hide solution'
                                                : sol.result
                                                    ? '▼ Show solution'
                                                    : '🤖 Get AI solution'}
                                    </button>
                                </div>
                            )}

                            {/* Solution panel */}
                            {sol.visible && (
                                <div className={styles.logSolutionPanel}>
                                    {sol.loading && (
                                        <div className={styles.logSolutionLoading}>
                                            <span className={styles.spinner}/>
                                            Claude is analysing this issue…
                                        </div>
                                    )}
                                    {sol.error && (
                                        <div className={styles.logSolutionError}>⚠ {sol.error}</div>
                                    )}
                                    {sol.result && !sol.loading && (() => {
                                        const r = sol.result;
                                        const sevColor = SEV_COLOR[r.severity] || C.amber;
                                        return (
                                            <div className={styles.logSolutionContent}>
                                                {/* Severity + delay */}
                                                <div className={styles.logSolHeader}>
                                                    <span className={styles.logSolSev}
                                                        style={{ background: sevColor+'18', color: sevColor, border: `1px solid ${sevColor}44` }}>
                                                        {r.severity?.toUpperCase()} SEVERITY
                                                    </span>
                                                    {r.estimatedDelay && r.estimatedDelay !== '0 days' && (
                                                        <span className={styles.logSolDelay}>
                                                            ⏱ Delay: {r.estimatedDelay}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Root cause */}
                                                <div className={styles.logSolSection}>
                                                    <div className={styles.logSolLabel}>Root cause</div>
                                                    <div className={styles.logSolText}>{r.rootCause}</div>
                                                </div>

                                                {/* Immediate action */}
                                                <div className={styles.logSolSection} style={{ background: 'rgba(248,81,73,.04)', borderLeft: `3px solid ${C.red}` }}>
                                                    <div className={styles.logSolLabel} style={{ color: C.red }}>Immediate action</div>
                                                    <div className={styles.logSolText} style={{ fontWeight: 600 }}>{r.immediateAction}</div>
                                                </div>

                                                {/* Step by step */}
                                                {r.stepByStep?.length > 0 && (
                                                    <div className={styles.logSolSection}>
                                                        <div className={styles.logSolLabel}>Steps to resolve</div>
                                                        <ol className={styles.logSolSteps}>
                                                            {r.stepByStep.map((s, i) => (
                                                                <li key={i}>{s}</li>
                                                            ))}
                                                        </ol>
                                                    </div>
                                                )}

                                                {/* Contractor instruction */}
                                                <div className={styles.logSolSection} style={{ background: 'rgba(56,139,253,.04)', borderLeft: `3px solid ${C.blue}` }}>
                                                    <div className={styles.logSolLabel} style={{ color: C.blue }}>Tell your contractor</div>
                                                    <div className={styles.logSolText} style={{ fontStyle: 'italic' }}>"{r.contractorInstruction}"</div>
                                                </div>

                                                {/* IS code + prevention */}
                                                <div className={styles.logSolFooter}>
                                                    {r.isCode && (
                                                        <span className={styles.logSolCode}>📐 {r.isCode}</span>
                                                    )}
                                                    {r.preventionTip && (
                                                        <span className={styles.logSolPrevention}>💡 {r.preventionTip}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: QUALITY — issue tracker + quality checks
// ─────────────────────────────────────────────────────────────────────────────
const SEVERITY_COLOR = {
    low: C.blue,
    medium: C.amber,
    high: '#F5A623',
    critical: C.red,
};
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const STATUS_COLOR = {
    open: C.red,
    in_progress: C.amber,
    resolved: C.green,
    closed: C.muted,
};

function QualityTab({ stage, issues, onIssueChange, qualityChecks }) {
    const [showForm, setShowForm] = useState(false);
    const [editIssue, setEditIssue] = useState(null);
    const [form, setForm] = useState({
        title: '',
        description: '',
        severity: 'medium',
        assignedTo: '',
        dueDate: '',
    });
    const [saving, setSaving] = useState(false);

    const openIssues = issues.filter(
        (i) => i.status === 'open' || i.status === 'in_progress',
    );
    const closedIssues = issues.filter(
        (i) => i.status === 'resolved' || i.status === 'closed',
    );
    const sorted = [...openIssues].sort(
        (a, b) =>
            (SEVERITY_ORDER[a.severity] || 3) -
            (SEVERITY_ORDER[b.severity] || 3),
    );

    const handleSave = async () => {
        if (!form.title.trim()) return;
        setSaving(true);
        try {
            const issue = {
                ...form,
                stageId: stage.id,
                stageLabel: stage.label,
            };
            if (editIssue) {
                await updateIssue(editIssue.id, { ...editIssue, ...issue });
            } else {
                await createIssue(issue);
            }
            onIssueChange();
            setShowForm(false);
            setEditIssue(null);
            setForm({
                title: '',
                description: '',
                severity: 'medium',
                assignedTo: '',
                dueDate: '',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleClose = async (iss) => {
        await updateIssue(iss.id, {
            ...iss,
            stageId: stage.id,
            status: 'closed',
        });
        onIssueChange();
    };

    const handleDelete = async (id) => {
        await deleteIssueApi(id);
        onIssueChange();
    };

    return (
        <div className={styles.tabContent}>
            {/* Quality checks */}
            {qualityChecks.length > 0 && (
                <div className={styles.qualityChecksCard}>
                    <div className={styles.qualityChecksTitle}>
                        Quality verification checklist
                    </div>
                    {qualityChecks.map((qc) => (
                        <div key={qc.id} className={styles.qualityCheckRow}>
                            <div
                                className={styles.severityDot}
                                style={{
                                    background: SEVERITY_COLOR[qc.severity],
                                }}
                            />
                            <span className={styles.qualityCheckText}>
                                {qc.check}
                            </span>
                            <span
                                className={styles.severityTag}
                                style={{
                                    color: SEVERITY_COLOR[qc.severity],
                                    background:
                                        SEVERITY_COLOR[qc.severity] + '18',
                                }}
                            >
                                {qc.severity}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Issue summary */}
            <div className={styles.issueHeader}>
                <div>
                    <span className={styles.issueCount}>
                        {openIssues.length} open
                    </span>
                    {closedIssues.length > 0 && (
                        <span className={styles.issueClosed}>
                            {' '}
                            · {closedIssues.length} closed
                        </span>
                    )}
                </div>
                <button
                    className={styles.addIssueBtn}
                    onClick={() => {
                        setShowForm(!showForm);
                        setEditIssue(null);
                        setForm({
                            title: '',
                            description: '',
                            severity: 'medium',
                            assignedTo: '',
                            dueDate: '',
                        });
                    }}
                >
                    + Log issue
                </button>
            </div>

            {/* Issue form */}
            {showForm && (
                <div className={styles.issueForm}>
                    <div className={styles.issueFormTitle}>
                        {editIssue ? 'Edit issue' : 'Log quality issue'}
                    </div>
                    <div className={styles.issueFormGrid}>
                        <div className={styles.fullCol}>
                            <div className={styles.fieldLabel}>
                                Issue title *
                            </div>
                            <input
                                value={form.title}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        title: e.target.value,
                                    }))
                                }
                                placeholder="e.g. Cover blocks missing on column C3"
                            />
                        </div>
                        <div className={styles.fullCol}>
                            <div className={styles.fieldLabel}>Description</div>
                            <textarea
                                rows={2}
                                value={form.description}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        description: e.target.value,
                                    }))
                                }
                                placeholder="What was observed, where exactly, IS code reference if applicable"
                            />
                        </div>
                        <div>
                            <div className={styles.fieldLabel}>Severity</div>
                            <select
                                value={form.severity}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        severity: e.target.value,
                                    }))
                                }
                            >
                                <option value="low">Low — cosmetic</option>
                                <option value="medium">
                                    Medium — needs attention
                                </option>
                                <option value="high">
                                    High — must fix before next stage
                                </option>
                                <option value="critical">
                                    Critical — stop work
                                </option>
                            </select>
                        </div>
                        <div>
                            <div className={styles.fieldLabel}>Assigned to</div>
                            <input
                                value={form.assignedTo}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        assignedTo: e.target.value,
                                    }))
                                }
                                placeholder="Contractor / Supervisor name"
                            />
                        </div>
                        <div>
                            <div className={styles.fieldLabel}>Due date</div>
                            <input
                                type="date"
                                value={form.dueDate}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        dueDate: e.target.value,
                                    }))
                                }
                            />
                        </div>
                    </div>
                    <div className={styles.issueFormActions}>
                        <button
                            className={styles.cancelBtn}
                            onClick={() => setShowForm(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className={styles.saveBtn}
                            onClick={handleSave}
                            disabled={saving || !form.title.trim()}
                        >
                            {saving
                                ? 'Saving…'
                                : editIssue
                                  ? 'Update issue'
                                  : 'Log issue'}
                        </button>
                    </div>
                </div>
            )}

            {sorted.length === 0 && !showForm && (
                <div className={styles.emptyTab}>
                    <span>✅</span>
                    <span>
                        No open quality issues for this stage. Use the checklist
                        above and "Log issue" to record any problems found.
                    </span>
                </div>
            )}

            {/* Open/in-progress issues */}
            {sorted.map((iss) => (
                <IssueCard
                    key={iss.id}
                    issue={iss}
                    onClose={handleClose}
                    onDelete={handleDelete}
                    onEdit={(i) => {
                        setEditIssue(i);
                        setForm({
                            title: i.title,
                            description: i.description || '',
                            severity: i.severity,
                            assignedTo: i.assigned_to || '',
                            dueDate: i.due_date || '',
                        });
                        setShowForm(true);
                    }}
                />
            ))}

            {/* Closed issues (collapsed) */}
            {closedIssues.length > 0 && (
                <details className={styles.closedIssues}>
                    <summary className={styles.closedIssuesSummary}>
                        ✓ {closedIssues.length} closed issues
                    </summary>
                    {closedIssues.map((iss) => (
                        <IssueCard
                            key={iss.id}
                            issue={iss}
                            closed
                            onDelete={handleDelete}
                        />
                    ))}
                </details>
            )}
        </div>
    );
}

function IssueCard({ issue, onClose, onDelete, onEdit, closed }) {
    const sevColor = SEVERITY_COLOR[issue.severity] || C.muted;
    const staColor = STATUS_COLOR[issue.status] || C.muted;
    return (
        <div
            className={styles.issueCard}
            style={{
                borderLeft: `3px solid ${sevColor}`,
                opacity: closed ? 0.7 : 1,
            }}
        >
            <div className={styles.issueCardTop}>
                <div>
                    <span
                        className={styles.issueSev}
                        style={{ color: sevColor, background: sevColor + '18' }}
                    >
                        {issue.severity}
                    </span>
                    {issue.ai_detected ? (
                        <span className={styles.issueAiBadge}>
                            🤖 AI detected
                        </span>
                    ) : null}
                </div>
                <div className={styles.issueCardActions}>
                    <span
                        className={styles.issueStat}
                        style={{ color: staColor }}
                    >
                        {issue.status?.replace('_', ' ')}
                    </span>
                    {!closed && onEdit && (
                        <button
                            className={styles.issueActionBtn}
                            onClick={() => onEdit(issue)}
                        >
                            Edit
                        </button>
                    )}
                    {!closed && onClose && (
                        <button
                            className={styles.issueActionBtn}
                            onClick={() => onClose(issue)}
                        >
                            ✓ Close
                        </button>
                    )}
                    {onDelete && (
                        <button
                            className={styles.issueActionBtn}
                            style={{ color: C.red }}
                            onClick={() => onDelete(issue.id)}
                        >
                            Delete
                        </button>
                    )}
                </div>
            </div>
            <div className={styles.issueTitle}>{issue.title}</div>
            {issue.description && (
                <div className={styles.issueDesc}>{issue.description}</div>
            )}
            <div className={styles.issueMeta}>
                {issue.assigned_to && (
                    <span>Assigned: {issue.assigned_to}</span>
                )}
                {issue.due_date && <span>Due: {issue.due_date}</span>}
                {issue.created_at && (
                    <span>{issue.created_at.slice(0, 10)}</span>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PHOTOS — required photo checklist + AI review
// ─────────────────────────────────────────────────────────────────────────────
function PhotosTab({
    stage,
    stagePhotos,
    addPhoto,
    project,
    requiredPhotoDefs,
}) {
    const fileRef = useRef();
    const [reviewing, setReviewing] = useState(null); // photoId being reviewed
    const [reviews, setReviews] = useState({}); // photoId → review result
    const [reviewErr, setReviewErr] = useState('');
    const [reqPhotos, setReqPhotos] = useState(
        requiredPhotoDefs.map((d) => ({
            ...d,
            uploaded: false,
            photoSrc: null,
        })),
    );
    const [activeReq, setActiveReq] = useState(null); // which slot to fill

    // Match uploaded photos to required slots
    useEffect(() => {
        setReqPhotos((prev) =>
            prev.map((rp) => {
                const match = stagePhotos.find((p) => p.reqPhotoId === rp.id);
                return match
                    ? {
                          ...rp,
                          uploaded: true,
                          photoSrc: match.src,
                          photoId: match.id,
                      }
                    : rp;
            }),
        );
    }, [stagePhotos]);

    const mandatoryPending = reqPhotos.filter(
        (r) => r.mandatory && !r.uploaded,
    ).length;

    const handleFile = (e, reqId) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const src = ev.target.result;
            addPhoto(src, file.name, stage.label, stage.id, reqId);
            // Trigger AI review
            setReviewing(reqId);
            setReviewErr('');
            try {
                const req = reqPhotos.find((r) => r.id === reqId);
                const result = await reviewPhoto(
                    src,
                    stage.id,
                    stage.label,
                    req?.description || '',
                );
                setReviews((prev) => ({ ...prev, [reqId]: result }));
            } catch (err) {
                setReviewErr(`AI review failed: ${err.message}`);
            } finally {
                setReviewing(null);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleFreeUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const src = ev.target.result;
            addPhoto(src, file.name, stage.label, stage.id);
            setReviewing('free');
            try {
                const result = await reviewPhoto(
                    src,
                    stage.id,
                    stage.label,
                    '',
                );
                setReviews((prev) => ({ ...prev, free: result }));
            } catch {
            } finally {
                setReviewing(null);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    return (
        <div className={styles.tabContent}>
            {/* Mandatory photo progress */}
            {requiredPhotoDefs.length > 0 && (
                <div className={styles.reqPhotoProgress}>
                    <div className={styles.reqPhotoProgressLabel}>
                        Required photos:{' '}
                        {reqPhotos.filter((r) => r.uploaded).length} /{' '}
                        {reqPhotos.length} uploaded
                        {mandatoryPending > 0 && (
                            <span className={styles.reqPendingBadge}>
                                {mandatoryPending} mandatory pending
                            </span>
                        )}
                    </div>
                    <ProgressBar
                        value={Math.round(
                            (reqPhotos.filter((r) => r.uploaded).length /
                                reqPhotos.length) *
                                100,
                        )}
                        color={mandatoryPending === 0 ? C.green : C.amber}
                        height={5}
                    />
                </div>
            )}

            {/* Required photo slots */}
            {reqPhotos.length > 0 && (
                <div className={styles.reqPhotoGrid}>
                    {reqPhotos.map((rp) => {
                        const review = reviews[rp.id];
                        const isReviewing = reviewing === rp.id;
                        return (
                            <div
                                key={rp.id}
                                className={`${styles.reqPhotoSlot} ${rp.uploaded ? styles.reqPhotoUploaded : ''} ${rp.mandatory && !rp.uploaded ? styles.reqPhotoMissing : ''}`}
                            >
                                <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    ref={(el) => {
                                        if (el) el._reqId = rp.id;
                                    }}
                                    id={`reqfile_${rp.id}`}
                                    onChange={(e) => handleFile(e, rp.id)}
                                />
                                {rp.uploaded && rp.photoSrc ? (
                                    <img
                                        src={rp.photoSrc}
                                        alt={rp.label}
                                        className={styles.reqPhotoThumb}
                                    />
                                ) : (
                                    <div className={styles.reqPhotoPlaceholder}>
                                        📷
                                    </div>
                                )}
                                <div className={styles.reqPhotoInfo}>
                                    <div className={styles.reqPhotoLabel}>
                                        {rp.mandatory && !rp.uploaded && (
                                            <span
                                                className={styles.reqMandatory}
                                            >
                                                *{' '}
                                            </span>
                                        )}
                                        {rp.label}
                                    </div>
                                    <div className={styles.reqPhotoDesc}>
                                        {rp.description}
                                    </div>

                                    {/* AI review result */}
                                    {isReviewing && (
                                        <div className={styles.aiReviewSpinner}>
                                            🤖 AI reviewing…
                                        </div>
                                    )}
                                    {review && !isReviewing && (
                                        <div
                                            className={`${styles.aiReviewResult} ${review.workQuality === 'good' ? styles.aiReviewGood : review.workQuality === 'poor' ? styles.aiReviewBad : styles.aiReviewOk}`}
                                        >
                                            <div
                                                className={
                                                    styles.aiReviewQuality
                                                }
                                            >
                                                {review.workQuality === 'good'
                                                    ? '✅'
                                                    : review.workQuality ===
                                                        'poor'
                                                      ? '⚠️'
                                                      : 'ℹ️'}{' '}
                                                {review.workQuality}
                                                <span
                                                    className={
                                                        styles.aiConfidence
                                                    }
                                                >
                                                    {Math.round(
                                                        (review.aiConfidence ||
                                                            0) * 100,
                                                    )}
                                                    % confidence
                                                </span>
                                            </div>
                                            {review.reviewNotes && (
                                                <div
                                                    className={
                                                        styles.aiReviewNote
                                                    }
                                                >
                                                    {review.reviewNotes}
                                                </div>
                                            )}
                                            {review.issues?.length > 0 && (
                                                <div
                                                    className={
                                                        styles.aiIssuesList
                                                    }
                                                >
                                                    {review.issues.map(
                                                        (iss, i) => (
                                                            <div
                                                                key={i}
                                                                className={
                                                                    styles.aiIssueItem
                                                                }
                                                                style={{
                                                                    borderLeft: `2px solid ${SEVERITY_COLOR[iss.severity] || C.amber}`,
                                                                }}
                                                            >
                                                                <span
                                                                    style={{
                                                                        color: SEVERITY_COLOR[
                                                                            iss
                                                                                .severity
                                                                        ],
                                                                    }}
                                                                >
                                                                    {
                                                                        iss.severity
                                                                    }
                                                                </span>{' '}
                                                                — {iss.title}
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <label
                                    htmlFor={`reqfile_${rp.id}`}
                                    className={`${styles.reqPhotoUploadBtn} ${rp.uploaded ? styles.reqPhotoReplace : ''}`}
                                >
                                    {rp.uploaded ? '↺ Replace' : '↑ Upload'}
                                </label>
                            </div>
                        );
                    })}
                </div>
            )}

            {reviewErr && (
                <div className={styles.aiReviewError}>{reviewErr}</div>
            )}

            {/* Free-form additional photos */}
            <div className={styles.photoUploadRow}>
                <button
                    className={styles.uploadBtn}
                    onClick={() => fileRef.current?.click()}
                >
                    <Icon name="photo" size={15} color={C.green} />
                    Upload additional photo
                </button>
                <span className={styles.photoHint}>
                    Any other site photos for this stage
                </span>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFreeUpload}
                    style={{ display: 'none' }}
                />
            </div>
            {reviewing === 'free' && (
                <div
                    className={styles.aiReviewSpinner}
                    style={{ padding: '8px 0' }}
                >
                    🤖 AI reviewing photo…
                </div>
            )}
            {reviews.free && reviewing !== 'free' && (
                <div
                    className={`${styles.aiReviewResult} ${reviews.free.workQuality === 'good' ? styles.aiReviewGood : styles.aiReviewOk}`}
                >
                    <div className={styles.aiReviewQuality}>
                        AI review: {reviews.free.workQuality}
                    </div>
                    {reviews.free.reviewNotes && (
                        <div className={styles.aiReviewNote}>
                            {reviews.free.reviewNotes}
                        </div>
                    )}
                </div>
            )}

            {/* All stage photos */}
            {stagePhotos.length > 0 && (
                <div className={styles.photoGrid}>
                    {stagePhotos.map((ph) => (
                        <div key={ph.id} className={styles.photoCard}>
                            <img
                                src={ph.src}
                                alt={ph.name}
                                className={styles.photoImg}
                            />
                            <div className={styles.photoMeta}>
                                <div
                                    style={{
                                        color: C.accent,
                                        fontSize: 10,
                                        fontFamily: 'var(--font-mono)',
                                    }}
                                >
                                    {ph.date}
                                </div>
                                <div
                                    style={{ color: C.hint, fontSize: 10 }}
                                    className="truncate"
                                >
                                    {ph.name}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {stagePhotos.length === 0 && requiredPhotoDefs.length === 0 && (
                <div className={styles.emptyTab}>
                    <span>📸</span>
                    <span>No photos for this stage yet.</span>
                </div>
            )}
        </div>
    );
}
