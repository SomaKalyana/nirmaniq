import React, { useMemo, useState } from 'react';
import { Badge, EmptyState, SectionTitle } from '../components/ui/UI.jsx';
import { updateIssue, deleteIssueApi } from '../utils/api.js';
import { C } from '../utils/colors.js';
import styles from './Pages.module.css';

const SEVERITY_COLOR = {
    low: C.green,
    medium: C.amber,
    high: C.red,
    critical: C.red,
};

const STATUS_COLOR = {
    open: C.red,
    in_progress: C.amber,
    resolved: C.green,
    closed: C.green,
};

function issueStageId(issue) {
    return issue.stageId || issue.stage_id || '';
}

function issueStageLabel(issue, stages = []) {
    const explicit = issue.stageLabel || issue.stage_label;
    if (explicit) return explicit;
    const found = stages.find((s) => s.id === issueStageId(issue));
    return found?.label || 'Unmapped stage';
}

function issueAssigned(issue) {
    return issue.assignedTo || issue.assigned_to || '';
}

function issueDue(issue) {
    return issue.dueDate || issue.due_date || '';
}

function toEditForm(issue) {
    return {
        title: issue.title || '',
        description: issue.description || '',
        severity: issue.severity || 'medium',
        status: issue.status || 'open',
        assignedTo: issueAssigned(issue),
        dueDate: issueDue(issue),
        closureNote: issue.closureNote || issue.closure_note || '',
    };
}

function countBy(list, predicate) {
    return list.filter(predicate).length;
}

export default function Issues({ issues = [], stages = [], onIssueChange, onGoToStage, onGoTo }) {
    const [selected, setSelected] = useState(null);
    const [form, setForm] = useState(null);
    const [statusFilter, setStatusFilter] = useState('open');
    const [stageFilter, setStageFilter] = useState('all');
    const [saving, setSaving] = useState(false);

    const openIssues = useMemo(
        () => issues.filter((i) => i.status === 'open' || i.status === 'in_progress'),
        [issues],
    );
    const closedIssues = useMemo(
        () => issues.filter((i) => i.status === 'closed' || i.status === 'resolved'),
        [issues],
    );

    const visibleIssues = useMemo(() => {
        return issues
            .filter((i) => {
                if (statusFilter === 'open') return i.status === 'open' || i.status === 'in_progress';
                if (statusFilter === 'closed') return i.status === 'closed' || i.status === 'resolved';
                return true;
            })
            .filter((i) => stageFilter === 'all' || issueStageId(i) === stageFilter);
    }, [issues, statusFilter, stageFilter]);

    const stageOptions = useMemo(() => {
        const ids = new Set(issues.map(issueStageId).filter(Boolean));
        return stages.filter((s) => ids.has(s.id));
    }, [issues, stages]);

    const openDetails = (issue) => {
        setSelected(issue);
        setForm(toEditForm(issue));
    };

    const closeModal = () => {
        setSelected(null);
        setForm(null);
    };

    const saveIssue = async (extra = {}) => {
        if (!selected || !form?.title?.trim()) return;
        setSaving(true);
        try {
            const payload = {
                ...selected,
                ...form,
                ...extra,
                stageId: issueStageId(selected),
                stageLabel: issueStageLabel(selected, stages),
            };
            await updateIssue(selected.id, payload);
            await onIssueChange?.();
            closeModal();
        } finally {
            setSaving(false);
        }
    };

    const deleteIssue = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            await deleteIssueApi(selected.id);
            await onIssueChange?.();
            closeModal();
        } finally {
            setSaving(false);
        }
    };

    const goToStage = (issue) => {
        const id = issueStageId(issue);
        if (id) onGoToStage?.(id);
        onGoTo?.('stages');
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.rowBetween} style={{ alignItems: 'flex-start', gap: 12 }}>
                    <div>
                        <div className={styles.labelSmall}>Project issue register</div>
                        <h2 className={styles.pageTitle} style={{ marginTop: 6 }}>All Stage Issues</h2>
                        <p className={styles.hint}>Track quality/site issues across every construction stage. Click any issue to update, close or delete it.</p>
                    </div>
                    <div className={styles.issueSummaryStrip}>
                        <div><span>Open</span><strong style={{ color: C.red }}>{openIssues.length}</strong></div>
                        <div><span>High/Critical</span><strong style={{ color: C.amber }}>{countBy(openIssues, i => i.severity === 'high' || i.severity === 'critical')}</strong></div>
                        <div><span>Closed</span><strong style={{ color: C.green }}>{closedIssues.length}</strong></div>
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.issueToolbar}>
                    <div>
                        <SectionTitle>Issues by stage</SectionTitle>
                        <div className={styles.hint}>{visibleIssues.length} issue{visibleIssues.length === 1 ? '' : 's'} shown</div>
                    </div>
                    <div className={styles.issueFilters}>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="open">Open / In progress</option>
                            <option value="closed">Closed / Resolved</option>
                            <option value="all">All statuses</option>
                        </select>
                        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                            <option value="all">All stages</option>
                            {stageOptions.map((s) => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {visibleIssues.length === 0 ? (
                    <EmptyState icon="✅" message="No issues found for the selected filter." />
                ) : (
                    <div className={styles.issueRegisterList}>
                        {visibleIssues.map((issue) => {
                            const sevColor = SEVERITY_COLOR[issue.severity] || C.muted;
                            const staColor = STATUS_COLOR[issue.status] || C.muted;
                            return (
                                <button key={issue.id} className={styles.issueRegisterRow} onClick={() => openDetails(issue)}>
                                    <div className={styles.issueRegisterMain}>
                                        <div className={styles.rowBetween} style={{ gap: 10 }}>
                                            <strong>{issue.title || 'Untitled issue'}</strong>
                                            <div className={styles.issueBadgeGroup}>
                                                <Badge color={sevColor}>{issue.severity || 'medium'}</Badge>
                                                <Badge color={staColor}>{(issue.status || 'open').replace('_', ' ')}</Badge>
                                            </div>
                                        </div>
                                        {issue.description && <p>{issue.description}</p>}
                                        <div className={styles.issueRegisterMeta}>
                                            <span>Stage: {issueStageLabel(issue, stages)}</span>
                                            {issueAssigned(issue) && <span>Assigned: {issueAssigned(issue)}</span>}
                                            {issueDue(issue) && <span>Due: {issueDue(issue)}</span>}
                                            {issue.created_at && <span>Created: {String(issue.created_at).slice(0, 10)}</span>}
                                        </div>
                                    </div>
                                    <span className={styles.issueOpenHint}>View / update ›</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {selected && form && (
                <div className={styles.issueModalOverlay}>
                    <div className={styles.issueModalBox}>
                        <div className={styles.rowBetween} style={{ alignItems: 'flex-start', gap: 10 }}>
                            <div>
                                <div className={styles.labelSmall}>Issue details</div>
                                <h3 className={styles.modalTitle}>{issueStageLabel(selected, stages)}</h3>
                            </div>
                            <button className={styles.closeBtn} onClick={closeModal}>✕</button>
                        </div>

                        <div className={styles.issueFormGridLarge}>
                            <label>
                                Title
                                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                            </label>
                            <label>
                                Status
                                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                    <option value="open">Open</option>
                                    <option value="in_progress">In progress</option>
                                    <option value="resolved">Resolved</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </label>
                            <label>
                                Severity
                                <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </label>
                            <label>
                                Assigned to
                                <input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
                            </label>
                            <label>
                                Due date
                                <input type="date" value={form.dueDate || ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                            </label>
                            <label className={styles.fullSpan}>
                                Description
                                <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </label>
                            <label className={styles.fullSpan}>
                                Closure / update note
                                <textarea rows={3} value={form.closureNote} onChange={(e) => setForm({ ...form, closureNote: e.target.value })} placeholder="Add latest action taken, root cause, closure evidence, etc." />
                            </label>
                        </div>

                        <div className={styles.issueModalActions}>
                            <button className={styles.secondaryBtn} onClick={() => goToStage(selected)}>Open stage</button>
                            <button className={styles.secondaryBtn} style={{ color: C.red }} onClick={deleteIssue} disabled={saving}>Delete</button>
                            <button className={styles.secondaryBtn} onClick={() => saveIssue({ status: 'closed' })} disabled={saving}>Close case</button>
                            <button className={styles.primaryBtn} onClick={() => saveIssue()} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
