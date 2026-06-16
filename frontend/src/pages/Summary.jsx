import React, { useMemo } from 'react';
import { Badge, ProgressBar, SectionTitle, StatCard } from '../components/ui/UI.jsx';
import { C } from '../utils/colors.js';
import { fmtINR, pct } from '../utils/format.js';
import styles from './Pages.module.css';

function n(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function budgetCat(budget = [], ids = []) {
    return (budget || [])
        .filter((b) => b && ids.includes(b.id))
        .reduce((acc, b) => ({
            allocated: acc.allocated + n(b.allocated, 0),
            spent: acc.spent + n(b.spent, 0),
        }), { allocated: 0, spent: 0 });
}

function constructionBudgetTotals(budget = [], excludeIds = ['b1', 'b9c']) {
    return (budget || [])
        .filter((b) => b && !excludeIds.includes(b.id))
        .reduce((acc, b) => ({
            allocated: acc.allocated + n(b.allocated, 0),
            spent: acc.spent + n(b.spent, 0),
        }), { allocated: 0, spent: 0 });
}

function projectQuoteAmount(project = {}, constructionTotals = {}) {
    return n(
        project.builderQuote ||
        project.contractorQuote ||
        project.contractorQuoteAmount ||
        project.totalContractAmount ||
        constructionTotals.allocated,
        0,
    );
}

function issueStageLabel(issue, stages = []) {
    const explicit = issue.stageLabel || issue.stage_label;
    if (explicit) return explicit;
    const id = issue.stageId || issue.stage_id;
    return stages.find((s) => s.id === id)?.label || 'Unmapped stage';
}

function BudgetRow({ title, allocated, spent, color = C.green }) {
    const remaining = n(allocated) - n(spent);
    const spentPct = n(allocated) > 0 ? Math.round((n(spent) / n(allocated)) * 100) : 0;
    const barColor = spentPct > 100 ? C.red : spentPct > 85 ? C.amber : color;
    return (
        <div className={styles.summaryBudgetRow}>
            <div>
                <strong>{title}</strong>
                <span>{spentPct}% spent</span>
            </div>
            <div><span>Budget</span><strong>{fmtINR(allocated)}</strong></div>
            <div><span>Spent</span><strong>{fmtINR(spent)}</strong></div>
            <div><span>Balance</span><strong style={{ color: remaining >= 0 ? C.green : C.red }}>{fmtINR(remaining)}</strong></div>
            <ProgressBar value={Math.min(100, Math.max(0, spentPct))} color={barColor} height={6} />
        </div>
    );
}

export default function Summary({
    stages = [],
    budget = [],
    computed = {},
    stageItems,
    stagePct,
    issues = [],
    project = {},
    onGoTo,
    onGoToStage,
}) {
    const { totalTasks = 0, doneTasks = 0 } = computed || {};
    const constructionStages = (stages || []).filter((s) => s && !s.isPrereq && s.id !== 's0');
    const overall = pct(doneTasks, totalTasks);
    const activeStage = constructionStages.find((s) => stagePct?.(s) < 100) || constructionStages[constructionStages.length - 1] || null;

    const preTotals = budgetCat(budget, ['b1']);
    const postTotals = budgetCat(budget, ['b9c']);
    const constructionTotals = constructionBudgetTotals(budget, ['b1', 'b9c']);
    const contractorQuote = projectQuoteAmount(project || {}, constructionTotals);
    const totalBudget = preTotals.allocated + contractorQuote + postTotals.allocated;
    const totalSpent = preTotals.spent + constructionTotals.spent + postTotals.spent;
    const budgetPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    const openIssues = useMemo(() => issues.filter((i) => i.status === 'open' || i.status === 'in_progress'), [issues]);
    const closedIssues = useMemo(() => issues.filter((i) => i.status === 'closed' || i.status === 'resolved'), [issues]);
    const criticalIssues = openIssues.filter((i) => i.severity === 'critical').length;
    const highIssues = openIssues.filter((i) => i.severity === 'high').length;
    const healthScore = criticalIssues > 0 ? 50 : highIssues > 0 ? 72 : budgetPct > 100 ? 68 : 86;
    const healthColor = healthScore >= 80 ? C.green : healthScore >= 60 ? C.amber : C.red;

    const preStage = stages.find((s) => s.isPrereq || s.id === 's0');
    const postStage = stages.find((s) => s.id === 's_handover');

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.rowBetween} style={{ alignItems: 'flex-start', gap: 12 }}>
                    <div>
                        <div className={styles.labelSmall}>Project summary</div>
                        <h2 className={styles.pageTitle} style={{ marginTop: 6 }}>{project?.name || project?.projectName || 'Active Project'}</h2>
                        <p className={styles.hint}>Overall progress, budget movement, active stage and issue position in one place.</p>
                    </div>
                    <Badge color={healthColor}>{healthScore >= 80 ? 'Healthy' : healthScore >= 60 ? 'Needs attention' : 'At risk'}</Badge>
                </div>
            </div>

            <div className={styles.summaryKpiGrid}>
                <StatCard label="Overall Progress" value={`${overall}%`} sub={`${doneTasks} of ${totalTasks} tasks`} color={C.green} />
                <StatCard label="Budget Spent" value={fmtINR(totalSpent)} sub={`of ${fmtINR(totalBudget)} total`} color={budgetPct > 100 ? C.red : C.amber} />
                <StatCard label="Active Stage" value={activeStage?.icon || '✅'} sub={activeStage?.label || 'All complete'} color={C.accent} />
                <StatCard label="Open Issues" value={openIssues.length} sub={criticalIssues ? `${criticalIssues} critical` : highIssues ? `${highIssues} high severity` : 'No critical issues'} color={criticalIssues ? C.red : highIssues ? C.amber : C.green} onClick={() => onGoTo?.('issues')} />
            </div>

            <div className={styles.card}>
                <SectionTitle>Budget summary</SectionTitle>
                <div className={styles.summaryBudgetList}>
                    <BudgetRow title="Pre-Construction" allocated={preTotals.allocated} spent={preTotals.spent} color={C.accent} />
                    <BudgetRow title="Construction / Contractor quote" allocated={contractorQuote} spent={constructionTotals.spent} color={C.green} />
                    <BudgetRow title="Post-Construction" allocated={postTotals.allocated} spent={postTotals.spent} color={C.purple} />
                    <BudgetRow title="Total project" allocated={totalBudget} spent={totalSpent} color={C.amber} />
                </div>
            </div>

            <div className={styles.summaryTwoCol}>
                <div className={styles.card}>
                    <SectionTitle>Checklist position</SectionTitle>
                    <div className={styles.summaryChecklistRows}>
                        {preStage && (
                            <button onClick={() => onGoTo?.('preconstruction')}>
                                <span>Pre-Construction</span>
                                <strong>{stagePct?.(preStage) || 0}%</strong>
                            </button>
                        )}
                        <button onClick={() => onGoTo?.('stages')}>
                            <span>Construction stages</span>
                            <strong>{overall}%</strong>
                        </button>
                        {postStage && (
                            <button onClick={() => onGoTo?.('postconstruction')}>
                                <span>Post-Construction</span>
                                <strong>{stagePct?.(postStage) || 0}%</strong>
                            </button>
                        )}
                    </div>
                </div>

                <div className={styles.card}>
                    <SectionTitle>Issue summary</SectionTitle>
                    <div className={styles.summaryIssueStats}>
                        <div><span>Open</span><strong style={{ color: C.red }}>{openIssues.length}</strong></div>
                        <div><span>High / critical</span><strong style={{ color: C.amber }}>{highIssues + criticalIssues}</strong></div>
                        <div><span>Closed</span><strong style={{ color: C.green }}>{closedIssues.length}</strong></div>
                    </div>
                    {openIssues.length > 0 ? (
                        <div className={styles.summaryIssueList}>
                            {openIssues.slice(0, 4).map((issue) => (
                                <button key={issue.id} onClick={() => onGoTo?.('issues')}>
                                    <strong>{issue.title || 'Untitled issue'}</strong>
                                    <span>{issueStageLabel(issue, stages)} · {issue.severity || 'medium'}</span>
                                </button>
                            ))}
                        </div>
                    ) : <p className={styles.hint}>No open issues.</p>}
                </div>
            </div>
        </div>
    );
}
