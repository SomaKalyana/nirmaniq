import React from 'react';
import {
    StatCard,
    ProgressBar,
    SectionTitle,
    Badge,
} from '../components/ui/UI.jsx';
import { C } from '../utils/colors.js';
import { fmtINR, pct } from '../utils/format.js';
import { computeSlabArea } from '../utils/estimator.js';
import styles from './Pages.module.css';


function n(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function fmtFt(value) {
    const num = n(value, 0);
    if (!num) return '—';
    return `${Number(num.toFixed(2))} ft`;
}

function fmtSqft(value) {
    const num = Math.round(n(value, 0));
    return num ? `${num.toLocaleString('en-IN')} sft` : '—';
}

function floorName(index, hasStilt) {
    const residentialNames = ['Ground', 'First', 'Second', 'Third', 'Fourth', 'Fifth'];
    if (hasStilt && index === 0) return 'Stilt / Parking';
    const idx = hasStilt ? index - 1 : index;
    return residentialNames[idx] ? `${residentialNames[idx]} Floor` : `Floor ${index + 1}`;
}

function getProjectGeometry(project = {}) {
    const length = n(project.plotLength, 60);
    const width = n(project.plotWidth, 35);
    const front = n(project.setbackFront, 0);
    const back = n(project.setbackBack, 0);
    const left = n(project.setbackLeft, 0);
    const right = n(project.setbackRight, 0);
    const facing = String(project.facing || project.direction || '').toLowerCase();
    const eastWest = facing.includes('east') || facing.includes('west');

    const buildLength = eastWest
        ? Math.max(0, length - left - right)
        : Math.max(0, length - front - back);
    const buildWidth = eastWest
        ? Math.max(0, width - front - back)
        : Math.max(0, width - left - right);
    const footprint = Math.round(buildLength * buildWidth);
    const floors = Math.max(1, n(project.totalFloors || project.suggestedFloors, project.hasStilt || project.stilt ? 4 : 3));
    const floorBreakup = Array.from({ length: floors }, (_, idx) => ({
        label: floorName(idx, !!(project.hasStilt || project.stilt)),
        area: footprint,
    }));

    const terraceArea = project.hasTerraceRoom
        ? (n(project.terraceLength) && n(project.terraceWidth)
            ? Math.round(n(project.terraceLength) * n(project.terraceWidth))
            : 216)
        : 0;
    const liftRoomArea = project.hasLiftRoom
        ? (n(project.liftRoomLength) && n(project.liftRoomWidth)
            ? Math.round(n(project.liftRoomLength) * n(project.liftRoomWidth))
            : 216)
        : 0;
    if (terraceArea) floorBreakup.push({ label: 'Terrace Room Slab', area: terraceArea });
    if (liftRoomArea) {
        floorBreakup.push({ label: 'Lift Machine Room Slab 1', area: liftRoomArea });
        floorBreakup.push({ label: 'Lift Machine Room Slab 2', area: liftRoomArea });
    }

    return {
        length,
        width,
        plotArea: Math.round(length * width),
        front,
        back,
        left,
        right,
        buildLength,
        buildWidth,
        footprint,
        floors,
        floorBreakup,
        totalSlab: project.slabArea ? n(project.slabArea) : computeSlabArea(project),
    };
}


function facingKey(project = {}) {
    const f = String(project.facing || project.direction || 'south').toLowerCase();
    if (f.includes('north')) return 'north';
    if (f.includes('east')) return 'east';
    if (f.includes('west')) return 'west';
    return 'south';
}

function roadWidthText(project = {}) {
    const raw = project.roadWidth || project.roadWidthFt || project.roadWidthFeet;
    const val = n(raw, 0);
    if (!val) return 'Road';
    // Existing forms may store road width either in feet or metres; keep neutral if unit is absent.
    return `${val} ${project.roadWidthUnit || 'ft'} road`;
}

function budgetCat(budget = [], ids = []) {
    const list = Array.isArray(budget) ? budget : [];
    return list.filter((b) => ids.includes(b.id)).reduce((acc, b) => ({
        allocated: acc.allocated + n(b.allocated, 0),
        spent: acc.spent + n(b.spent, 0),
    }), { allocated: 0, spent: 0 });
}

function constructionBudgetTotals(budget = [], excludeIds = ['b1', 'b9c']) {
    const list = Array.isArray(budget) ? budget : [];
    return list.filter((b) => b && !excludeIds.includes(b.id)).reduce((acc, b) => ({
        allocated: acc.allocated + n(b.allocated, 0),
        spent: acc.spent + n(b.spent, 0),
    }), { allocated: 0, spent: 0 });
}

function projectQuoteAmount(project = {}, constructionTotals = {}) {
    // Contractor quote must represent construction contract only.
    // Pre-Construction and Post-Construction are owner-side budgets and are tracked separately.
    return n(
        project.builderQuote ||
        project.contractorQuote ||
        project.contractorQuoteAmount ||
        project.totalContractAmount ||
        constructionTotals.allocated,
        0
    );
}

function TrackingCard({ title, name, allocated, spent, color = C.green }) {
    const safeAllocated = n(allocated, 0);
    const safeSpent = n(spent, 0);
    const remaining = safeAllocated - safeSpent;
    const spentPct = safeAllocated > 0 ? Math.round((safeSpent / safeAllocated) * 100) : 0;
    const barColor = spentPct > 90 ? C.red : spentPct > 70 ? C.amber : color;
    return (
        <div className={styles.contractorQuoteCard}>
            <div className={styles.rowBetween}>
                <div>
                    <div className={styles.labelSmall}>{title}</div>
                    <div className={styles.stageTitle}>{name}</div>
                </div>
                <Badge color={barColor}>{spentPct}% spent</Badge>
            </div>
            <div className={styles.quoteGrid}>
                <div><span>Budget / quote</span><strong>{fmtINR(safeAllocated)}</strong></div>
                <div><span>Spent so far</span><strong>{fmtINR(safeSpent)}</strong></div>
                <div><span>Balance</span><strong style={{ color: remaining >= 0 ? C.green : C.red }}>{fmtINR(remaining)}</strong></div>
            </div>
            <ProgressBar value={Math.min(100, spentPct)} color={barColor} height={6} />
        </div>
    );
}

export default function Dashboard({
    stages,
    budget,
    computed,
    stageItems,
    stagePct,
    onGoToStage,
    onGoTo,
    user,
    project,
    issues = [],
    onGoToIssues,
}) {
    const { totalTasks, doneTasks } = computed;
    const overall = pct(doneTasks, totalTasks);

    // Dashboard Active Stage should mirror only the construction stages shown on
    // the Stages page. Pre-construction checklist is shown separately as an alert.
    const constructionStages = (stages || []).filter((s) => s && !s.isPrereq && s.id !== 's0');
    const activeStage = constructionStages.find((s) => stagePct(s) < 100) || constructionStages[constructionStages.length - 1] || null;
    const activeIdx = activeStage ? constructionStages.findIndex((s) => s.id === activeStage.id) : -1;

    const preTotals = budgetCat(budget, ['b1']);
    const postTotals = budgetCat(budget, ['b9c']);
    const constructionTotals = constructionBudgetTotals(budget, ['b1', 'b9c']);
    const quoteAmount = projectQuoteAmount(project || {}, constructionTotals);
    const contractorSpent = constructionTotals.spent;
    const dashboardTotalBudget = n(preTotals.allocated, 0) + n(quoteAmount, 0) + n(postTotals.allocated, 0);
    const dashboardTotalSpent = n(preTotals.spent, 0) + n(contractorSpent, 0) + n(postTotals.spent, 0);

    // ── Project Health Score (BRD Section 10.1) ───────────────────────────
    const totalBudget = dashboardTotalBudget || computed.totalBudget || 1;
    const totalSpent = dashboardTotalSpent || computed.totalSpent || 0;
    const budgetPct = Math.round((totalSpent / totalBudget) * 100);
    const budgetHealth =
        budgetPct > 100 ? 0 : budgetPct > 90 ? 40 : budgetPct > 80 ? 70 : 100;

    const scheduleHealth = overall; // tasks done % as proxy

    const openIssues = issues.filter(
        (i) => i.status === 'open' || i.status === 'in_progress',
    );
    const critIssues = openIssues.filter(
        (i) => i.severity === 'critical',
    ).length;
    const highIssues = openIssues.filter((i) => i.severity === 'high').length;
    const qualityHealth =
        critIssues > 0
            ? 0
            : highIssues > 2
              ? 30
              : highIssues > 0
                ? 60
                : openIssues.length > 5
                  ? 70
                  : 100;

    const healthScore = Math.round(
        budgetHealth * 0.25 +
            scheduleHealth * 0.2 +
            qualityHealth * 0.25 +
            100 * 0.3, // approval + material + comms — assume OK until modules added
    );
    const healthColor =
        healthScore >= 80 ? C.green : healthScore >= 60 ? C.amber : C.red;
    const healthLabel =
        healthScore >= 80
            ? 'Healthy'
            : healthScore >= 60
              ? 'Needs attention'
              : 'At risk';
    const prereqStage = stages[0];
    const prereqPct = stagePct(prereqStage);

    return (
        <div className={styles.page}>
            {/* Project details + site geometry */}
            {project && (() => {
                const g = getProjectGeometry(project);
                const face = facingKey(project);
                const innerW = Math.max(18, Math.min(92, (g.buildWidth / Math.max(g.width, 1)) * 100));
                const innerH = Math.max(18, Math.min(92, (g.buildLength / Math.max(g.length, 1)) * 100));
                return (
                    <div className={styles.homeHeroGrid}>
                        <div className={`${styles.card} ${styles.projectHero}`}>
                            <div className={styles.rowBetween} style={{ alignItems: 'flex-start', gap: 12 }}>
                                <div>
                                    <div className={styles.labelSmall}>Active project</div>
                                    <div className={styles.projectHeroTitle}>{project.name || project.projectName || 'Unnamed Project'}</div>
                                    <div className={styles.projectHeroAddress}>{project.siteAddress || project.locality || 'Address not captured'}</div>
                                </div>
                                {user && (
                                    <div className={styles.ownerBox}>
                                        <div className={styles.labelSmall}>Owner / User</div>
                                        <div className={styles.ownerName}>{project.ownerName || user.name || user.email}</div>
                                        {user.phone && <div className={styles.hint}>{user.phone}</div>}
                                    </div>
                                )}
                            </div>


                            <div className={styles.trackingCardsGrid}>
                                <TrackingCard
                                    title="Pre-construction tracking"
                                    name="Approvals, drawings, GVMC/BPO fees"
                                    allocated={preTotals.allocated}
                                    spent={preTotals.spent}
                                    color={C.accent}
                                />
                                <TrackingCard
                                    title="Contractor quote tracking"
                                    name={project.builderName || 'Construction contract'}
                                    allocated={quoteAmount}
                                    spent={contractorSpent}
                                    color={C.green}
                                />
                                <TrackingCard
                                    title="Post-construction tracking"
                                    name="OC, final approvals and handover"
                                    allocated={postTotals.allocated}
                                    spent={postTotals.spent}
                                    color={C.purple}
                                />
                            </div>


                            <div className={styles.projectKpiGrid}>
                                <StatCard
                                    label="Overall Progress"
                                    value={`${overall}%`}
                                    sub={`${doneTasks} of ${totalTasks} tasks`}
                                    color={C.green}
                                />
                                <StatCard
                                    label="Budget Spent"
                                    value={fmtINR(totalSpent)}
                                    sub={`of ${fmtINR(totalBudget)} total`}
                                    color={C.amber}
                                />
                                <StatCard
                                    label="Active Stage"
                                    value={activeStage ? activeStage.icon : '✅'}
                                    sub={activeStage ? activeStage.label : 'All complete!'}
                                    color={C.accent}
                                />
                                <StatCard
                                    label="Project Health"
                                    value={`${healthScore}%`}
                                    sub={healthLabel}
                                    color={healthColor}
                                />
                                <StatCard
                                    label="Open Issues"
                                    value={openIssues.length}
                                    sub={
                                        critIssues > 0
                                            ? `${critIssues} critical`
                                            : highIssues > 0
                                              ? `${highIssues} high severity`
                                              : 'No critical issues'
                                    }
                                    color={
                                        critIssues > 0
                                            ? C.red
                                            : highIssues > 0
                                              ? C.amber
                                              : C.green
                                    }
                                    onClick={onGoToIssues}
                                />
                            </div>
                        </div>

                        <div className={`${styles.card} ${styles.plotCard}`}>
                            <div className={styles.rowBetween} style={{ marginBottom: 10 }}>
                                <div>
                                    <div className={styles.labelSmall}>Plot diagram</div>
                                    <div className={styles.stageTitle}>Outer plot vs inner slab area</div>
                                </div>
                                <Badge color={C.accent}>{fmtSqft(g.footprint)}</Badge>
                            </div>
                            <div className={`${styles.detailGrid} ${styles.plotDetailGrid}`}>
                                <div className={styles.detailTile}><span>Survey No.</span><strong>{project.surveyNo || '—'}</strong></div>
                                <div className={styles.detailTile}><span>Plot No.</span><strong>{project.plotNo || project.plotNumber || '—'}</strong></div>
                                <div className={styles.detailTile}><span>Facing</span><strong>{project.facing || project.direction || '—'}</strong></div>
                                <div className={styles.detailTile}><span>Road Width</span><strong>{project.roadWidth ? `${project.roadWidth} m` : '—'}</strong></div>
                                <div className={styles.detailTile}><span>Plot Size</span><strong>{fmtFt(g.length)} × {fmtFt(g.width)}</strong></div>
                                <div className={styles.detailTile}><span>Plot Area</span><strong>{fmtSqft(g.plotArea)}</strong></div>
                                <div className={styles.detailTile}><span>Buildable Footprint</span><strong>{fmtSqft(g.footprint)}</strong></div>
                                <div className={styles.detailTile}><span>Total Slab</span><strong>{fmtSqft(g.totalSlab)}</strong></div>
                            </div>
                            <div className={styles.setbackLine}>
                                <span>Setbacks</span>
                                <strong>Front {fmtFt(g.front)}</strong>
                                <strong>Back {fmtFt(g.back)}</strong>
                                <strong>Left {fmtFt(g.left)}</strong>
                                <strong>Right {fmtFt(g.right)}</strong>
                            </div>
                            <div className={`${styles.plotDiagram} ${styles['plotFacing' + face.charAt(0).toUpperCase() + face.slice(1)]}`}>
                                <div className={`${styles.roadStrip} ${styles['road' + face.charAt(0).toUpperCase() + face.slice(1)]}`}>
                                    {roadWidthText(project)} • Front / {project.facing || project.direction || 'South'} facing
                                </div>
                                <div className={styles.plotOuter}>
                                    <div
                                        className={styles.plotInner}
                                        style={{ width: `${innerW}%`, height: `${innerH}%` }}
                                    >
                                        Inner slab<br />after setbacks
                                    </div>
                                    <span className={`${styles.sbLabel} ${styles.sbTop}`}>{face === 'north' ? 'Front' : face === 'south' ? 'Back' : 'Side'} {face === 'north' ? fmtFt(g.front) : face === 'south' ? fmtFt(g.back) : ''}</span>
                                    <span className={`${styles.sbLabel} ${styles.sbBottom}`}>{face === 'south' ? 'Front' : face === 'north' ? 'Back' : 'Side'} {face === 'south' ? fmtFt(g.front) : face === 'north' ? fmtFt(g.back) : ''}</span>
                                    <span className={`${styles.sbLabel} ${styles.sbLeft}`}>{face === 'west' ? 'Front' : face === 'east' ? 'Back' : 'Left'} {face === 'west' ? fmtFt(g.front) : face === 'east' ? fmtFt(g.back) : fmtFt(g.left)}</span>
                                    <span className={`${styles.sbLabel} ${styles.sbRight}`}>{face === 'east' ? 'Front' : face === 'west' ? 'Back' : 'Right'} {face === 'east' ? fmtFt(g.front) : face === 'west' ? fmtFt(g.back) : fmtFt(g.right)}</span>
                                </div>
                            </div>
                            <div className={styles.slabBreakup}>
                                {g.floorBreakup.map((f) => (
                                    <div key={f.label} className={styles.slabRow}>
                                        <span>{f.label}</span>
                                        <strong>{fmtSqft(f.area)}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Pre-construction alert */}
            {prereqPct < 100 && (
                <button
                    className={styles.prereqAlert}
                    onClick={() => {
                        onGoToStage('s0');
                        onGoTo('preconstruction');
                    }}
                >
                    <div>
                        <div className={styles.prereqTitle}>
                            📋 Pre-construction checklist incomplete
                        </div>
                        <div className={styles.prereqSub}>
                            {
                                stageItems(prereqStage).filter((x) => !x.done)
                                    .length
                            }{' '}
                            items pending — must complete before breaking ground
                        </div>
                    </div>
                    <div className={styles.prereqPct}>{prereqPct}% ›</div>
                </button>
            )}

            {(() => {
                const postStage = constructionStages.find((s) => s.id === 's_handover');
                const postPct = postStage ? stagePct(postStage) : 0;
                const pending = postStage ? stageItems(postStage).filter((x) => !x.done).length : 0;
                return postPct < 100 ? (
                    <button
                        className={styles.prereqAlert}
                        onClick={() => {
                            if (postStage) onGoToStage(postStage.id);
                            onGoTo('postconstruction');
                        }}
                    >
                        <div>
                            <div className={styles.prereqTitle}>
                                🏠 Post-construction checklist incomplete
                            </div>
                            <div className={styles.prereqSub}>
                                {pending || 'Some'} items pending — occupancy, final approvals and handover must be closed
                            </div>
                        </div>
                        <div className={styles.prereqPct}>{postPct}% ›</div>
                    </button>
                ) : null;
            })()}

            {/* Progress bar */}
            <div className={styles.card}>
                <div className={styles.rowBetween} style={{ marginBottom: 10 }}>
                    <span className={styles.label}>
                        Overall project progress
                    </span>
                    <span className={styles.mono}>{overall}%</span>
                </div>
                <ProgressBar value={overall} color={C.green} height={10} />
                <div className={styles.rowBetween} style={{ marginTop: 6 }}>
                    <span className={styles.hint}>Start</span>
                    <span className={styles.hint}>20 months estimated</span>
                    <span className={styles.hint}>Handover</span>
                </div>
            </div>

            {/* Active stage */}
            {activeStage && (
                <div
                    className={styles.card}
                    style={{ borderColor: activeStage.color + '55' }}
                >
                    <div
                        className={styles.rowBetween}
                        style={{ marginBottom: 10 }}
                    >
                        <div>
                            <div className={styles.labelSmall}>
                                Active stage
                            </div>
                            <div className={styles.stageTitle}>
                                {activeStage.icon} {activeStage.label}
                            </div>
                        </div>
                        <Badge color={activeStage.color}>
                            {stagePct(activeStage)}%
                        </Badge>
                    </div>
                    <ProgressBar
                        value={stagePct(activeStage)}
                        color={activeStage.color}
                        height={5}
                    />
                    <div className={styles.taskList}>
                        {stageItems(activeStage)
                            .filter((t) => !t.done)
                            .slice(0, 3)
                            .map((t) => (
                                <div key={t.id} className={styles.taskPreview}>
                                    <div className={styles.taskDot} />
                                    <span>{t.text}</span>
                                </div>
                            ))}
                        {stageItems(activeStage).filter((t) => !t.done).length >
                            3 && (
                            <button
                                className={styles.viewMore}
                                onClick={() => {
                                    onGoToStage(activeStage.id);
                                    onGoTo('stages');
                                }}
                            >
                                +
                                {stageItems(activeStage).filter((t) => !t.done)
                                    .length - 3}{' '}
                                more tasks →
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Stage overview */}
            <div className={styles.card}>
                <SectionTitle>All stages</SectionTitle>
                <div className={styles.stageList}>
                    {constructionStages.map((s, i) => {
                        const p = stagePct(s);
                        return (
                            <div
                                key={s.id}
                                className={styles.stageRow}
                                onClick={() => {
                                    onGoToStage(s.id);
                                    onGoTo('stages');
                                }}
                            >
                                <span
                                    className={styles.stageRowLabel}
                                    style={{
                                        color:
                                            p === 100
                                                ? C.green
                                                : i === activeIdx
                                                  ? C.text
                                                  : C.muted,
                                    }}
                                >
                                    {s.icon} {s.label}
                                </span>
                                <span
                                    className={styles.stagePct}
                                    style={{
                                        color: p === 100 ? C.green : C.hint,
                                    }}
                                >
                                    {p}%
                                </span>
                                <div style={{ flex: '0 0 80px' }}>
                                    <ProgressBar
                                        value={p}
                                        color={p === 100 ? C.green : s.color}
                                        height={3}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Budget snapshot */}
            <div className={styles.card}>
                <SectionTitle>Budget snapshot</SectionTitle>
                {budget.map((b) => {
                    const p =
                        b.allocated > 0
                            ? Math.round((b.spent / b.allocated) * 100)
                            : 0;
                    const color = p > 90 ? C.red : p > 70 ? C.amber : C.accent;
                    return (
                        <div key={b.id} className={styles.budRow}>
                            <div
                                className={styles.rowBetween}
                                style={{ marginBottom: 4 }}
                            >
                                <span className={styles.label}>{b.label}</span>
                                <span
                                    className={styles.mono}
                                    style={{ color, fontSize: 11 }}
                                >
                                    {fmtINR(b.spent)} / {fmtINR(b.allocated)}
                                </span>
                            </div>
                            <ProgressBar value={p} color={color} height={3} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
