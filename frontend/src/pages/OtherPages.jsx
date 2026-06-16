import React, { useState, useRef } from 'react';
import {
    ProgressBar,
    SectionTitle,
    EmptyState,
    Badge,
    CheckButton,
} from '../components/ui/UI.jsx';
import Icon from '../components/ui/Icon.jsx';
import { PREREQ_GROUPS, POST_CONSTRUCTION_GROUPS } from '../data/prereqData.js';
import { C } from '../utils/colors.js';
import { fmtINR } from '../utils/format.js';
import styles from './Pages.module.css';

/* ══════════════════════════════════════════════════════════════════════
   MATERIALS PAGE
══════════════════════════════════════════════════════════════════════ */

const PRE_CONSTRUCTION_PAYMENT_CATEGORIES = [
    'GVMC Fees',
    'BPO Fees',
    'Architect Fees',
    'Structural Consultant Fees',
    'Soil Testing Fees',
    'Survey Fees',
    'Legal & Documentation',
    'Borewell Expenses',
    'Electricity Deposits',
    'Water Connection Fees',
    'Other Pre-Construction Expense',
];

const POST_CONSTRUCTION_PAYMENT_CATEGORIES = [
    'GVMC Fees',
    'BPO Fees',
    'GVMC Occupancy Fees',
    'BPO Final Approval Fees',
    'Lift Approval Fees',
    'Electrical Inspection Fees',
    'Water & Sewerage Deposits',
    'Property Tax Assessment',
    'Registration & Documentation',
    'Handover Expenses',
    'Maintenance Corpus Fund',
    'Other Post-Construction Expense',
];

const PRECON_TABS = [
    { id: 'checklist', label: 'Documents & Approvals', icon: '📋' },
    { id: 'budget',    label: 'Budget',                icon: '💰' },
    { id: 'payments',  label: 'Payments',              icon: '💳' },
    { id: 'log',       label: 'Notes',                 icon: '📝' },
];

export function Preconstruction({
    stage, stagePct, toggleTask,
    budget = [], pays = [], addPayment, updatePayment, deletePayment,
    logs = [], addLog, onBudgetEdit,
}) {
    const [activeTab, setActiveTab] = React.useState('checklist');

    if (!stage) {
        return (
            <div className={styles.page}>
                <EmptyState icon="📋" message="No pre-construction stage found." />
            </div>
        );
    }

    const pct         = stagePct(stage);
    const doneCt      = (stage.groups || []).flatMap(g => g.items).filter(i => i.done).length;
    const totalItems  = (stage.groups || []).flatMap(g => g.items).length;

    // Pre-construction budget category (b1)
    const preconBudget = budget.find(b => b.id === 'b1') || { label: 'Pre-Construction', allocated: 200000, spent: 0 };
    const preconPays   = pays.filter(p => p.catId === 'b1');
    const preconLogs   = logs.filter(l => !l.stageId || l.stageId === 's0');

    return (
        <div className={styles.page}>
            {/* Page header */}
            <div className={styles.preconHeader}>
                <div className={styles.preconHeaderLeft}>
                    <div className={styles.preconIcon}>📋</div>
                    <div>
                        <div className={styles.preconTitle}>Pre-Construction</div>
                        <div className={styles.preconSub}>
                            {doneCt} of {totalItems} tasks completed
                        </div>
                    </div>
                </div>
                <div className={styles.preconPct} style={{ color: pct === 100 ? C.green : C.accent }}>
                    {pct}%
                </div>
            </div>
            <ProgressBar value={pct} color={pct === 100 ? C.green : C.accent} height={5} />

            {/* Tab bar */}
            <div className={styles.preconTabBar}>
                {PRECON_TABS.map(t => (
                    <button
                        key={t.id}
                        className={`${styles.preconTab} ${activeTab === t.id ? styles.preconTabActive : ''}`}
                        onClick={() => setActiveTab(t.id)}
                    >
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab: Documents & Approvals */}
            {activeTab === 'checklist' && (
                <div>
                    <div className={styles.prereqNote} style={{ marginBottom: 12 }}>
                        Complete all documents and approvals before construction starts.
                        These are outside the builder contract and are your responsibility as the owner.
                    </div>
                    {(stage.groups || []).map((group) => (
                        <div key={group.id} className={styles.group}>
                            <div className={styles.groupTitle}
                                style={{ color: group.color, borderBottomColor: group.color + '44' }}>
                                {group.title}
                            </div>
                            {group.items.map((item) => (
                                <div key={item.id} className={styles.prereqItem}>
                                    <TriStateBtn
                                        state={item.done === true ? true : item.done === false ? false : null}
                                        onClick={() => toggleTask(stage.id, item.id)}
                                    />
                                    <div className={styles.prereqContent}>
                                        <div className={`${styles.prereqText} ${item.done ? styles.done : ''}`}>
                                            {item.text}
                                        </div>
                                        {item.note && (
                                            <div className={styles.prereqNote2}>💡 {item.note}</div>
                                        )}
                                        {item.done === true && item.doneDate && (
                                            <div className={styles.doneDate}>✓ Done {item.doneDate}</div>
                                        )}
                                        {item.done === false && (
                                            <div className={styles.naLabel}>— Not applicable</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {/* Tab: Budget */}
            {activeTab === 'budget' && (
                <PreconBudgetTab
                    budgetCat={preconBudget}
                    pays={preconPays}
                    budget={budget}
                    catId="b1"
                    hint="Pre-construction costs: GVMC plan approval fees, structural engineer fee, legal charges, soil test, property tax clearance, NOCs."
                    onBudgetEdit={onBudgetEdit}
                />
            )}

            {/* Tab: Payments */}
            {activeTab === 'payments' && (
                <PreconPayments
                    pays={preconPays}
                    allPays={pays}
                    budget={budget}
                    addPayment={addPayment}
                    updatePayment={updatePayment}
                    deletePayment={deletePayment}
                    paymentCategoryOptions={PRE_CONSTRUCTION_PAYMENT_CATEGORIES}
                />
            )}

            {/* Tab: Notes */}
            {activeTab === 'log' && (
                <PreconLog logs={preconLogs} addLog={addLog} />
            )}
        </div>
    );
}

// ─── Reusable editable budget tab for Pre/Post construction ───────────────────
function PreconBudgetTab({ budgetCat, pays, budget, catId, hint, onBudgetEdit }) {
    const allocated = budgetCat?.allocated || 0;
    const spent     = budgetCat?.spent || 0;
    const remaining = allocated - spent;
    const pct       = allocated > 0 ? Math.round(spent / allocated * 100) : 0;
    const [editing, setEditing] = React.useState(false);
    const [editVal, setEditVal] = React.useState('');

    // Payment-category wise breakdown of spent (GVMC Fees, BPO Fees, etc.)
    // Budget tab should show where money was actually paid, not internal budget category IDs.
    const catTotals = pays.reduce((acc, p) => {
        const k = p.paymentCategory || p.category || 'Uncategorized Payment';
        acc[k] = (acc[k] || 0) + (Number(p.amount) || 0);
        return acc;
    }, {});

    const handleSave = () => {
        const val = Number(editVal);
        if (val > 0 && onBudgetEdit) onBudgetEdit(catId, val);
        setEditing(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Budget card with edit */}
            <div className={styles.preconBudgetCard}>
                <div className={styles.preconBudgetRow} style={{ alignItems: 'center' }}>
                    <span className={styles.preconBudgetLabel}>Budget allocated</span>
                    {editing ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 13, color: 'var(--muted)' }}>₹</span>
                            <input type="number" autoFocus
                                value={editVal}
                                onChange={e => setEditVal(e.target.value)}
                                style={{ width: 110, textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                            />
                            <button className={styles.saveBtn} style={{ padding: '4px 10px', fontSize: 12 }} onClick={handleSave}>Save</button>
                            <button className={styles.cancelBtn} style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEditing(false)}>✕</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className={styles.preconBudgetAmt} style={{ color: 'var(--accent)' }}>
                                {fmtINR(allocated)}
                            </span>
                            <button
                                title="Edit budget"
                                style={{ background: 'transparent', border: '1px solid var(--border-l)', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--muted)' }}
                                onClick={() => { setEditVal(String(allocated)); setEditing(true); }}>
                                ✏ Edit
                            </button>
                        </div>
                    )}
                </div>
                <div className={styles.preconBudgetRow}>
                    <span className={styles.preconBudgetLabel}>Spent</span>
                    <span className={styles.preconBudgetAmt} style={{ color: 'var(--red)' }}>{fmtINR(spent)}</span>
                </div>
                <div className={styles.preconBudgetRow}>
                    <span className={styles.preconBudgetLabel}>Remaining</span>
                    <span className={styles.preconBudgetAmt} style={{ color: remaining >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {fmtINR(remaining)}
                    </span>
                </div>
                <ProgressBar value={pct} color={pct > 100 ? 'var(--red)' : 'var(--accent)'} height={6} />
            </div>

            {/* Payment-category wise breakdown of spent */}
            {Object.keys(catTotals).length > 0 && (
                <div className={styles.preconBudgetCard}>
                    <div className={styles.preconBudgetLabel} style={{ marginBottom: 8 }}>Spent by payment category</div>
                    {Object.entries(catTotals)
                        .sort((a, b) => Number(b[1]) - Number(a[1]))
                        .map(([paymentCategory, amt]) => {
                            const catPct = spent > 0 ? Math.round((Number(amt) || 0) / spent * 100) : 0;
                            return (
                                <div key={paymentCategory} style={{ marginBottom: 8 }}>
                                    <div className={styles.preconBudgetRow}>
                                        <span style={{ fontSize: 12, color: 'var(--text)' }}>{paymentCategory}</span>
                                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
                                            {fmtINR(amt)} ({catPct}%)
                                        </span>
                                    </div>
                                    <ProgressBar value={catPct} color="var(--blue)" height={3} />
                                </div>
                            );
                        })}
                </div>
            )}

            {hint && <div className={styles.preconBudgetHint}>{hint}</div>}
        </div>
    );
}


// 3-state toggle: null = pending, true = done, false = not applicable
function TriStateBtn({ state, onClick }) {
    const cfg = {
        null:  { bg: 'transparent', border: 'var(--border-l)', symbol: '', title: 'Mark done' },
        true:  { bg: 'var(--green)',  border: 'var(--green)',   symbol: '✓', title: 'Mark N/A' },
        false: { bg: 'var(--hint)',   border: 'var(--hint)',    symbol: 'N/A', title: 'Clear' },
    };
    const key = state === true ? 'true' : state === false ? 'false' : 'null';
    const { bg, border, symbol, title } = cfg[key];
    return (
        <button
            title={title}
            onClick={onClick}
            style={{
                width: 26, height: 26, borderRadius: 6,
                border: `2px solid ${border}`,
                background: bg,
                color: state === null ? 'transparent' : '#fff',
                fontSize: state === false ? 8 : 13,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .12s',
                fontFamily: 'var(--font-sans)',
            }}
        >{symbol}</button>
    );
}


// ─── Shared PaymentForm — used by PaymentsTab, PreconPayments, Payments page ──
const PAYMENT_MODES = ['Cash', 'UPI / PhonePe / GPay', 'NEFT / IMPS / RTGS', 'Cheque', 'Bank Transfer', 'DD (Demand Draft)', 'Other'];
const NEEDS_REF = (mode) => mode && mode !== 'Cash';

function PaymentFormFields({ form, setForm, budget, showBudgetCat = true, placeholder = 'e.g. Contractor payment — Stage 1' }) {
    return (
        <div className={styles.payFormGrid}>
            {/* Row 1: Description (full width) */}
            <div className={styles.fullCol}>
                <div className={styles.fieldLabel}>Description *</div>
                <input
                    value={form.desc || ''}
                    onChange={e => setForm(f => ({ ...f, desc: e.target.value }))}
                    placeholder={placeholder}
                />
            </div>

            {/* Row 2: Vendor Name */}
            <div className={styles.fullCol}>
                <div className={styles.fieldLabel}>Vendor / Payee name</div>
                <input
                    value={form.vendor_name || ''}
                    onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
                    placeholder="e.g. Bheem Enterprises, VSP Steel Depot, Ramesh & Sons"
                />
            </div>

            {/* Row 3: Amount + Date */}
            <div>
                <div className={styles.fieldLabel}>Amount (₹) *</div>
                <input
                    type="number"
                    value={form.amount || ''}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                />
            </div>
            <div>
                <div className={styles.fieldLabel}>Date *</div>
                <input
                    type="date"
                    value={form.date || new Date().toISOString().slice(0,10)}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
            </div>

            {/* Row 4: Payment mode */}
            <div>
                <div className={styles.fieldLabel}>Payment mode</div>
                <select
                    value={form.payment_mode || 'Cash'}
                    onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value, ref_number: e.target.value === 'Cash' ? '' : (f.ref_number || '') }))}
                >
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>

            {/* Reference number — only if not Cash */}
            {NEEDS_REF(form.payment_mode) && (
                <div>
                    <div className={styles.fieldLabel}>Reference / Transaction no.</div>
                    <input
                        value={form.ref_number || ''}
                        onChange={e => setForm(f => ({ ...f, ref_number: e.target.value }))}
                        placeholder="UTR / Cheque no. / Transaction ID"
                    />
                </div>
            )}

            {/* Budget category */}
            {showBudgetCat && budget && budget.length > 0 && (
                <div className={styles.fullCol}>
                    <div className={styles.fieldLabel}>Budget category</div>
                    <select
                        value={form.catId || form.selectedCat || ''}
                        onChange={e => setForm(f => ({ ...f, catId: e.target.value, selectedCat: e.target.value }))}
                    >
                        {budget.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                    </select>
                </div>
            )}
        </div>
    );
}

// Helper: display payment mode + ref as a meta badge
function PayModeBadge({ mode, refNum }) {
    if (!mode || mode === 'Cash') return <span className={styles.payCatBadge} style={{ background: 'color-mix(in srgb, var(--green) 12%, transparent)', color: 'var(--green)' }}>Cash</span>;
    const short = mode.split('/')[0].trim().split(' ')[0];
    return (
        <>
            <span className={styles.payCatBadge} style={{ background: 'color-mix(in srgb, var(--blue) 12%, transparent)', color: 'var(--blue)' }}>{short}</span>
            {refNum && <span className={styles.payCatBadge} style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{refNum}</span>}
        </>
    );
}


function PreconPayments({ pays, budget, addPayment, updatePayment, deletePayment, catId = 'b1', stageId = 's0', placeholder = 'e.g. GVMC plan approval fee', paymentCategoryOptions = PRE_CONSTRUCTION_PAYMENT_CATEGORIES }) {
    const [show, setShow]   = React.useState(false);
    const defaultPaymentCategory = paymentCategoryOptions?.[0] || 'General';
    const [form, setForm]   = React.useState({ desc: '', amount: '', date: new Date().toISOString().slice(0,10), selectedCat: catId, catId: catId, paymentCategory: defaultPaymentCategory, vendor_name: '', payment_mode: 'Cash', ref_number: '', bank_charges: '', bank_charges_desc: '' });
    const [editId, setEditId] = React.useState(null);
    const [editForm, setEditForm] = React.useState({ desc: '', amount: '', date: '', selectedCat: catId, catId: catId, paymentCategory: defaultPaymentCategory, vendor_name: '', payment_mode: 'Cash', ref_number: '', bank_charges: '', bank_charges_desc: '' });
    const sortedPays = [...pays].sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const total = pays.reduce((s, p) => s + (p.amount || 0), 0);
    // Category totals for breakdown
    const catTotals = pays.reduce((acc, p) => {
        const k = p.catId || catId;
        acc[k] = (acc[k] || 0) + (p.amount || 0);
        return acc;
    }, {});

    const handleAdd = () => {
        if (!form.desc || !form.amount) return;
        addPayment({ ...form, amount: Number(form.amount), catId: form.selectedCat || catId, stageId, paymentCategory: form.paymentCategory || defaultPaymentCategory, vendor_name: form.vendor_name || '', payment_mode: form.payment_mode || 'Cash', ref_number: form.ref_number || '', bank_charges: Number(form.bank_charges) || 0, bank_charges_desc: form.bank_charges_desc || '' });
        setForm({ desc: '', amount: '', date: new Date().toISOString().slice(0,10), selectedCat: catId, catId: catId, paymentCategory: defaultPaymentCategory, vendor_name: '', payment_mode: 'Cash', ref_number: '', bank_charges: '', bank_charges_desc: '' });
        setShow(false);
    };


    const startEdit = (p) => {
        setShow(false);
        setEditId(p.id);
        setEditForm({
            desc: p.desc || '',
            amount: p.amount || '',
            date: p.date || new Date().toISOString().slice(0,10),
            selectedCat: p.catId || catId,
            catId: p.catId || catId,
            paymentCategory: p.paymentCategory || defaultPaymentCategory,
            vendor_name: p.vendor_name || '',
            payment_mode: p.payment_mode || 'Cash',
            ref_number: p.ref_number || '',
            bank_charges: p.bank_charges || '',
            bank_charges_desc: p.bank_charges_desc || '',
        });
    };

    const saveEdit = () => {
        if (!editId || !editForm.desc || !editForm.amount) return;
        updatePayment?.(editId, {
            desc: editForm.desc,
            amount: Number(editForm.amount),
            date: editForm.date,
            catId: editForm.selectedCat || catId,
            stageId,
            paymentCategory: editForm.paymentCategory || defaultPaymentCategory,
            vendor_name: editForm.vendor_name || '',
            payment_mode: editForm.payment_mode || 'Cash',
            ref_number: editForm.ref_number || '',
            bank_charges: Number(editForm.bank_charges) || 0,
            bank_charges_desc: editForm.bank_charges_desc || '',
        });
        setEditId(null);
    };

    return (
        <div className={styles.preconTabContent}>
            <div className={styles.preconPayHeader}>
                <div>
                    <div className={styles.preconBudgetLabel}>Total pre-construction payments</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: C.accent, fontFamily: 'var(--font-head)' }}>
                        ₹{total.toLocaleString('en-IN')}
                    </div>
                </div>
                <button className={styles.preconAddBtn} onClick={() => setShow(s => !s)}>
                    + Add payment
                </button>
            </div>

            {show && (
                <div className={styles.preconPayForm}>
                    <PaymentFormFields
                        form={form} setForm={setForm}
                        budget={budget}
                        placeholder={placeholder}
                    />
                    {NEEDS_REF(form.payment_mode) && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                            <div>
                                <div className={styles.fieldLabel}>Bank charges (₹)</div>
                                <input type="number" placeholder="0.000" step="0.001"
                                    value={form.bank_charges || ''}
                                    onChange={e => setForm(f => ({...f, bank_charges: e.target.value}))} />
                            </div>
                            <div>
                                <div className={styles.fieldLabel}>Charge description</div>
                                <input placeholder="e.g. NEFT fee, processing charge"
                                    value={form.bank_charges_desc || ''}
                                    onChange={e => setForm(f => ({...f, bank_charges_desc: e.target.value}))} />
                            </div>
                        </div>
                    )}
                    <div style={{ marginBottom: 8 }}>
                        <div className={styles.fieldLabel}>Payment category</div>
                        <select value={form.paymentCategory} onChange={e => setForm(f => ({...f, paymentCategory: e.target.value}))}>
                            {(paymentCategoryOptions || []).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.payFormActions}>
                        <button className={styles.cancelBtn} onClick={() => setShow(false)}>Cancel</button>
                        <button className={styles.saveBtn} onClick={handleAdd}
                            disabled={!form.desc || !form.amount}>Save payment</button>
                    </div>
                </div>
            )}

            {/* Category breakdown */}
            {Object.keys(catTotals).length > 1 && (
                <div className={styles.preconCatBreakdown}>
                    {Object.entries(catTotals).map(([bid, amt]) => {
                        const cat = (budget || []).find(b => b.id === bid);
                        return (
                            <div key={bid} className={styles.preconCatRow}>
                                <span className={styles.preconCatLabel}>{cat?.label || bid}</span>
                                <span className={styles.preconCatAmt}>₹{Number(amt).toLocaleString('en-IN')}</span>
                            </div>
                        );
                    })}
                </div>
            )}
            {pays.length === 0 && !show ? (
                <EmptyState icon="💳" message="No payments yet." />
            ) : (
                sortedPays.map(p => {
                    const cat = (budget || []).find(b => b.id === p.catId);
                    if (editId === p.id) {
                        return (
                            <div key={p.id} className={styles.preconPayForm}>
                                <PaymentFormFields
                                    form={editForm} setForm={setEditForm}
                                    budget={budget}
                                    placeholder="Edit payment"
                                />
                                <div style={{ marginBottom: 8 }}>
                                    <div className={styles.fieldLabel}>Payment category</div>
                                    <select value={editForm.paymentCategory} onChange={e => setEditForm(f => ({...f, paymentCategory: e.target.value}))}>
                                        {(paymentCategoryOptions || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                                <div className={styles.payFormActions}>
                                    <button className={styles.cancelBtn} onClick={() => setEditId(null)}>Cancel</button>
                                    <button className={styles.saveBtn} onClick={saveEdit} disabled={!editForm.desc || !editForm.amount}>Update payment</button>
                                </div>
                            </div>
                        );
                    }
                    return (
                        <div key={p.id} className={styles.payRow}>
                            <div className={styles.payInfo}>
                                <div className={styles.payDesc}>{p.desc}</div>
                                {p.vendor_name && <div className={styles.payVendor}>🏢 {p.vendor_name}</div>}
                        {(p.bank_charges > 0) && <div style={{fontSize:11,color:'var(--amber)'}}>🏦 Bank charges: {fmtINR(p.bank_charges)}{p.bank_charges_desc ? ` — ${p.bank_charges_desc}` : ''}</div>}
                                <div className={styles.payMeta}>{p.date}
                                    <PayModeBadge mode={p.payment_mode} refNum={p.ref_number} />
                                    {p.paymentCategory && <span className={styles.payCatBadge}>{p.paymentCategory}</span>}
                                    {cat && <span className={styles.payCatBadge}>{cat.label}</span>}
                                </div>
                            </div>
                            <div className={styles.payRight}>
                                <span className={styles.payAmt}>₹{Number(p.amount).toLocaleString('en-IN')}</span>
                                <button className={styles.delBtn} onClick={() => startEdit(p)}>Edit</button>
                                <button className={styles.delBtn} onClick={() => deletePayment(p.id)}>✕</button>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}

function PreconLog({ logs, addLog, stageId = 's0' }) {
    const [text, setText] = React.useState('');
    const handle = () => {
        if (!text.trim()) return;
        addLog(text, stageId === 's0' ? 'Pre-Construction' : 'Post-Construction', stageId);
        setText('');
    };
    return (
        <div className={styles.preconTabContent}>
            <div className={styles.logForm}>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
                    placeholder="Log pre-construction activities…&#10;e.g. Submitted GVMC plan approval. Paid soil test fee. Visited site with engineer." />
                <button className={styles.saveBtn} style={{ width: '100%', marginTop: 8 }}
                    onClick={handle} disabled={!text.trim()}>
                    + Add log entry
                </button>
            </div>
            {logs.length === 0 ? (
                <EmptyState icon="📝" message="No log entries yet." />
            ) : (
                logs.map(l => (
                    <div key={l.id} className={styles.logCard}>
                        <div className={styles.logMeta}>
                            <span style={{ color: C.accent, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{l.date}</span>
                            <span style={{ color: C.hint, fontSize: 11 }}>{l.time}</span>
                        </div>
                        <div className={styles.logText}>{l.text || l.text_content}</div>
                    </div>
                ))
            )}
        </div>
    );
}

export function Materials({ mats, updateMat }) {
    const [cat, setCat] = useState('all');
    const [editId, setEditId] = useState(null);
    const CATS = [
        'all',
        'steel',
        'cement',
        'aggregate',
        'masonry',
        'finishing',
    ];

    if (!Array.isArray(mats) || mats.length === 0) {
        return (
            <div className={styles.page}>
                <SectionTitle>Materials</SectionTitle>
                <EmptyState
                    icon="🧱"
                    message="No material data is available yet."
                />
            </div>
        );
    }

    const filtered = cat === 'all' ? mats : mats.filter((m) => m.cat === cat);

    return (
        <div className={styles.page}>
            {/* Summary pills */}
            <div className={styles.grid3}>
                {[
                    { l: 'Steel', v: '41.8 MT', c: C.red },
                    { l: 'Cement', v: '3,781 bags', c: C.accent },
                    { l: 'Bricks', v: '93,270 nos', c: C.amber },
                ].map((s) => (
                    <div key={s.l} className={styles.pill}>
                        <div className={styles.pillLabel}>{s.l}</div>
                        <div
                            className={styles.pillValue}
                            style={{ color: s.c }}
                        >
                            {s.v}
                        </div>
                    </div>
                ))}
            </div>

            {/* Category filter */}
            <div className={styles.filterRow}>
                {CATS.map((c) => (
                    <button
                        key={c}
                        className={`${styles.filterBtn} ${cat === c ? styles.filterActive : ''}`}
                        onClick={() => setCat(c)}
                    >
                        {c}
                    </button>
                ))}
            </div>

            <SectionTitle>Tap a row to update quantities</SectionTitle>

            {filtered.map((m) => {
                const op =
                    m.required > 0
                        ? Math.min(
                              100,
                              Math.round((m.ordered / m.required) * 100),
                          )
                        : 0;
                const rp =
                    m.required > 0
                        ? Math.min(
                              100,
                              Math.round((m.received / m.required) * 100),
                          )
                        : 0;
                const open = editId === m.id;

                return (
                    <div
                        key={m.id}
                        className={styles.matCard}
                        style={{
                            borderColor: open
                                ? m.color + '66'
                                : 'var(--border)',
                        }}
                    >
                        <button
                            className={styles.matHeader}
                            onClick={() => setEditId(open ? null : m.id)}
                        >
                            <div className={styles.matName}>
                                <div
                                    className={styles.matDot}
                                    style={{ background: m.color }}
                                />
                                <span>{m.name}</span>
                            </div>
                            <span
                                className={styles.mono}
                                style={{ fontSize: 11, color: C.muted }}
                            >
                                {m.required.toLocaleString()} {m.unit}
                            </span>
                        </button>

                        <div className={styles.matBars}>
                            <div>
                                <div className={styles.barLabel}>
                                    <span>Ordered</span>
                                    <span
                                        className={styles.mono}
                                        style={{ color: C.accent }}
                                    >
                                        {m.ordered} {m.unit}
                                    </span>
                                </div>
                                <ProgressBar
                                    value={op}
                                    color={C.accent}
                                    height={4}
                                />
                            </div>
                            <div>
                                <div className={styles.barLabel}>
                                    <span>Received</span>
                                    <span
                                        className={styles.mono}
                                        style={{ color: C.green }}
                                    >
                                        {m.received} {m.unit}
                                    </span>
                                </div>
                                <ProgressBar
                                    value={rp}
                                    color={C.green}
                                    height={4}
                                />
                            </div>
                        </div>

                        {m.supplier && (
                            <div className={styles.supplier}>
                                Supplier: {m.supplier}
                            </div>
                        )}

                        {open && (
                            <div className={styles.matEdit}>
                                <div className={styles.grid2}>
                                    <Field
                                        label={`Ordered (${m.unit})`}
                                        type="number"
                                        value={m.ordered}
                                        onChange={(v) =>
                                            updateMat(m.id, 'ordered', v)
                                        }
                                    />
                                    <Field
                                        label={`Received (${m.unit})`}
                                        type="number"
                                        value={m.received}
                                        onChange={(v) =>
                                            updateMat(m.id, 'received', v)
                                        }
                                    />
                                    <Field
                                        label={`Rate (₹/${m.unit})`}
                                        type="number"
                                        value={m.rate}
                                        onChange={(v) =>
                                            updateMat(m.id, 'rate', v)
                                        }
                                    />
                                    <Field
                                        label="Supplier name"
                                        value={m.supplier}
                                        onChange={(v) =>
                                            updateMat(m.id, 'supplier', v)
                                        }
                                    />
                                </div>
                                {m.rate > 0 && m.received > 0 && (
                                    <div className={styles.matValue}>
                                        Value received:{' '}
                                        {fmtINR(m.rate * m.received)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════
   BUDGET PAGE
══════════════════════════════════════════════════════════════════════ */
export function Budget({ budget }) {
    const totalBudget = budget.reduce((a, b) => a + b.allocated, 0);
    const totalSpent = budget.reduce((a, b) => a + b.spent, 0);
    const overallPct =
        totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    return (
        <div className={styles.page}>
            <div className={styles.grid2}>
                <div className={styles.card}>
                    <div className={styles.labelSmall}>Total budget</div>
                    <div className={styles.bigNum}>{fmtINR(totalBudget)}</div>
                </div>
                <div className={styles.card}>
                    <div className={styles.labelSmall}>Total spent</div>
                    <div
                        className={styles.bigNum}
                        style={{ color: overallPct > 80 ? C.red : C.green }}
                    >
                        {fmtINR(totalSpent)}
                    </div>
                    <div className={styles.hint}>{overallPct}% utilized</div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.labelSmall} style={{ marginBottom: 8 }}>
                    Overall utilization
                </div>
                <ProgressBar
                    value={overallPct}
                    color={
                        overallPct > 90
                            ? C.red
                            : overallPct > 70
                              ? C.amber
                              : C.green
                    }
                    height={12}
                />
                <div className={styles.rowBetween} style={{ marginTop: 6 }}>
                    <span className={styles.hint}>₹0</span>
                    <span className={styles.hint}>{fmtINR(totalBudget)}</span>
                </div>
            </div>

            <SectionTitle>Category breakdown</SectionTitle>
            {budget.map((b) => {
                const p =
                    b.allocated > 0
                        ? Math.round((b.spent / b.allocated) * 100)
                        : 0;
                const rem = b.allocated - b.spent;
                const color = p > 100 ? C.red : p > 80 ? C.amber : C.accent;

                return (
                    <div key={b.id} className={styles.budCard}>
                        <div
                            className={styles.rowBetween}
                            style={{ marginBottom: 8 }}
                        >
                            <div>
                                <div className={styles.label}>{b.label}</div>
                                <div className={styles.hint}>
                                    Allocated: {fmtINR(b.allocated)}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div
                                    className={styles.mono}
                                    style={{ color, fontSize: 13 }}
                                >
                                    {fmtINR(b.spent)}
                                </div>
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: rem >= 0 ? C.green : C.red,
                                    }}
                                >
                                    {fmtINR(Math.abs(rem))}{' '}
                                    {rem >= 0 ? 'remaining' : 'over budget'}
                                </div>
                            </div>
                        </div>
                        <ProgressBar value={p} color={color} height={5} />
                    </div>
                );
            })}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════
   PAYMENTS PAGE
══════════════════════════════════════════════════════════════════════ */
export function Payments({ pays, budget, addPayment, updatePayment, deletePayment }) {
    const [show, setShow] = useState(false);
    const EMPTY_FORM = { desc: '', amount: '', catId: 'b3', date: new Date().toISOString().slice(0,10), vendor_name: '', payment_mode: 'Cash', ref_number: '' };
    const [form, setForm] = useState(EMPTY_FORM);
    const [editId, setEditId] = useState(null);
    const [editForm, setEditForm] = useState(EMPTY_FORM);
    const sortedPays = [...pays].sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const totalPaid = pays.reduce((a, p) => a + p.amount, 0);

    const handleAdd = () => {
        if (!form.desc || !form.amount) return;
        addPayment({ ...form, amount: Number(form.amount) });
        setForm(EMPTY_FORM);
        setShow(false);
    };

    const startEdit = (p) => {
        setShow(false);
        setEditId(p.id);
        setEditForm({ desc: p.desc || '', amount: p.amount || '', catId: p.catId || 'b3', date: p.date || new Date().toISOString().slice(0,10), stageId: p.stageId || '', vendor_name: p.vendor_name || '', payment_mode: p.payment_mode || 'Cash', ref_number: p.ref_number || '' });
    };

    const saveEdit = () => {
        if (!editId || !editForm.desc || !editForm.amount) return;
        updatePayment?.(editId, { ...editForm, amount: Number(editForm.amount) });
        setEditId(null);
    };

    return (
        <div className={styles.page}>
            <div className={styles.grid2}>
                <div className={styles.card}>
                    <div className={styles.labelSmall}>Total payments</div>
                    <div className={styles.bigNum}>{pays.length}</div>
                </div>
                <div className={styles.card}>
                    <div className={styles.labelSmall}>Total paid out</div>
                    <div className={styles.bigNum} style={{ color: C.amber }}>
                        {fmtINR(totalPaid)}
                    </div>
                </div>
            </div>

            <button className={styles.addBtn} onClick={() => setShow(!show)}>
                <Icon name="plus" size={14} color={C.accent} /> Add payment
                record
            </button>

            {show && (
                <div className={styles.formCard}>
                    <SectionTitle>New payment record</SectionTitle>
                    <PaymentFormFields
                        form={form}
                        setForm={setForm}
                        budget={budget}
                        placeholder="e.g. Steel 20mm — 5MT Lot 1"
                    />
                    <div className={styles.formActions}>
                        <button className={styles.cancelBtn} onClick={() => setShow(false)}>Cancel</button>
                        <button className={styles.primaryBtn} onClick={handleAdd} disabled={!form.desc || !form.amount}>
                            Save payment
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════
   TEAM PAGE
══════════════════════════════════════════════════════════════════════ */
const STATUS_COLORS = {
    pending: C.hint,
    hired: C.amber,
    active: C.green,
    completed: C.accent,
};

export function Team({ team, updateTeamMember }) {
    return (
        <div className={styles.page}>
            <div className={styles.infoBox}>
                Hire supervisor and watchman first. Never pay more than 40%
                upfront to any contractor.
            </div>
            {team.map((m, i) => (
                <div key={m.id} className={styles.teamCard}>
                    <div className={styles.teamHeader}>
                        <div>
                            <div className={styles.teamRole}>{m.role}</div>
                            {m.salary > 0 && (
                                <div className={styles.hint}>
                                    ₹{m.salary.toLocaleString()}/month
                                </div>
                            )}
                        </div>
                        <select
                            className={styles.statusSelect}
                            value={m.status}
                            onChange={(e) =>
                                updateTeamMember(i, 'status', e.target.value)
                            }
                            style={{
                                color: STATUS_COLORS[m.status],
                                borderColor: STATUS_COLORS[m.status] + '66',
                                background: STATUS_COLORS[m.status] + '18',
                            }}
                        >
                            {['pending', 'hired', 'active', 'completed'].map(
                                (v) => (
                                    <option key={v} value={v}>
                                        {v}
                                    </option>
                                ),
                            )}
                        </select>
                    </div>
                    <div className={styles.grid2}>
                        <Field
                            label="Name"
                            placeholder="—"
                            value={m.name}
                            onChange={(v) => updateTeamMember(i, 'name', v)}
                        />
                        <Field
                            label="Phone"
                            placeholder="—"
                            value={m.phone}
                            onChange={(v) => updateTeamMember(i, 'phone', v)}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════
   SITE LOG PAGE
══════════════════════════════════════════════════════════════════════ */
export function SiteLog({ logs, addLog, activeStageLabel }) {
    const [text, setText] = useState('');

    const handleAdd = () => {
        addLog(text, activeStageLabel);
        setText('');
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.hint} style={{ marginBottom: 8 }}>
                    Record daily site observations, decisions, and issues
                </div>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={4}
                    placeholder="e.g. Visited site at 6pm. F3 footing pour completed. 3 cube samples collected. Watchman confirmed curing 3× today. Supervisor says column shuttering ready Thursday..."
                    style={{ marginBottom: 10 }}
                />
                <button
                    className={styles.saveBtn}
                    style={{ width: '100%' }}
                    onClick={handleAdd}
                    disabled={!text.trim()}
                >
                    + Add log entry
                </button>
            </div>

            {logs.length === 0 && (
                <EmptyState
                    icon="📓"
                    message="No log entries yet.&#10;Start recording your daily site visits."
                />
            )}

            {logs.map((l) => (
                <div key={l.id} className={styles.logCard}>
                    <div className={styles.logMeta}>
                        <span
                            className={styles.mono}
                            style={{ color: C.accent, fontSize: 11 }}
                        >
                            {l.date}
                        </span>
                        <span className={styles.hint} style={{ fontSize: 11 }}>
                            {l.time}
                        </span>
                        {l.stage && (
                            <Badge color={C.purple} small>
                                {l.stage.split(' ').slice(0, 2).join(' ')}
                            </Badge>
                        )}
                    </div>
                    <div className={styles.logText}>{l.text}</div>
                </div>
            ))}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════
   PHOTOS PAGE
══════════════════════════════════════════════════════════════════════ */
export function Photos({ photos, addPhoto, activeStageLabel }) {
    const fileRef = useRef();

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) =>
            addPhoto(ev.target.result, file.name, activeStageLabel);
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    return (
        <div className={styles.page}>
            <button
                className={styles.uploadBtn}
                onClick={() => fileRef.current?.click()}
            >
                <Icon name="photo" size={16} color={C.green} />
                Upload site photo
            </button>
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                style={{ display: 'none' }}
            />

            {photos.length === 0 && (
                <EmptyState
                    icon="📷"
                    message="No photos yet.&#10;Upload your first site photo above."
                />
            )}

            <div className={styles.photoGrid}>
                {photos.map((p) => (
                    <div key={p.id} className={styles.photoCard}>
                        <img
                            src={p.src}
                            alt={p.name}
                            className={styles.photoImg}
                        />
                        <div className={styles.photoMeta}>
                            <div
                                className={styles.mono}
                                style={{ color: C.accent, fontSize: 10 }}
                            >
                                {p.date}
                            </div>
                            <div
                                className={styles.hint}
                                style={{ fontSize: 10 }}
                            >
                                {p.stageLabel}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════
   SHARED FIELD COMPONENT
══════════════════════════════════════════════════════════════════════ */
function Field({ label, value, onChange, type = 'text', placeholder = '' }) {
    return (
        <div>
            {label && <div className={styles.fieldLabel}>{label}</div>}
            <input
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════
   POST-CONSTRUCTION PAGE
   Tabs: Documents & Approvals (OC checklist) | Budget | Payments | Notes
══════════════════════════════════════════════════════════════════════ */
const POSTCON_TABS = [
    { id: 'checklist', label: 'Documents & Approvals', icon: '📋' },
    { id: 'budget',    label: 'Budget',                icon: '💰' },
    { id: 'payments',  label: 'Payments',              icon: '💳' },
    { id: 'log',       label: 'Notes',                 icon: '📝' },
];

export function PostConstruction({
    stage, stagePct, toggleTask,
    budget = [], pays = [], addPayment, updatePayment, deletePayment,
    logs = [], addLog, onBudgetEdit,
}) {
    const [activeTab, setActiveTab] = React.useState('checklist');

    // Use s_handover stage for budget/payments, or create a virtual one
    const handoverBudget = budget.find(b => b.id === 'b9c') || { label: 'Systems & Handover', allocated: 0, spent: 0 };
    const handoverPays   = pays.filter(p => p.catId === 'b9c' || p.stageId === 's_handover');
    const postconLogs    = logs.filter(l => l.stageId === 's_handover' || l.stageId === 'post_construction');

    // Merge g7 items into a virtual stage for progress tracking
    const allItems    = POST_CONSTRUCTION_GROUPS.flatMap(g => g.items);
    const doneItems   = allItems.filter(i => i.done);
    const pct         = allItems.length > 0 ? Math.round(doneItems.length / allItems.length * 100) : 0;

    // Use s_handover stage tasks for toggleTask if stage is passed,
    // otherwise fall back to using the item id directly
    const handleToggle = (itemId) => {
        if (stage) toggleTask('s_handover', itemId);
        else toggleTask('post_construction', itemId);
    };

    return (
        <div className={styles.page}>
            {/* Page header */}
            <div className={styles.preconHeader}>
                <div className={styles.preconHeaderLeft}>
                    <div className={styles.preconIcon}>🏠</div>
                    <div>
                        <div className={styles.preconTitle}>Post-Construction</div>
                        <div className={styles.preconSub}>
                            Occupancy Certificate &amp; Handover — {doneItems.length} of {allItems.length} completed
                        </div>
                    </div>
                </div>
                <div className={styles.preconPct} style={{ color: pct === 100 ? C.green : C.accent }}>
                    {pct}%
                </div>
            </div>
            <ProgressBar value={pct} color={pct === 100 ? C.green : C.accent} height={5} />

            {/* Tab bar */}
            <div className={styles.preconTabBar}>
                {POSTCON_TABS.map(t => (
                    <button
                        key={t.id}
                        className={`${styles.preconTab} ${activeTab === t.id ? styles.preconTabActive : ''}`}
                        onClick={() => setActiveTab(t.id)}
                    >
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab: Documents & Approvals — OC checklist */}
            {activeTab === 'checklist' && (
                <div>
                    <div className={styles.prereqNote} style={{ marginBottom: 12 }}>
                        Complete all steps to obtain the Occupancy Certificate from GVMC.
                        OC is mandatory for legally occupying and selling the building.
                    </div>
                    {POST_CONSTRUCTION_GROUPS.map((group) => (
                        <div key={group.id} className={styles.group}>
                            <div className={styles.groupTitle}
                                style={{ color: group.color, borderBottomColor: group.color + '44' }}>
                                {group.title}
                            </div>
                            {group.items.map((item) => (
                                <div key={item.id} className={styles.prereqItem}>
                                    <TriStateBtn
                                        state={item.done === true ? true : item.done === false ? false : null}
                                        onClick={() => handleToggle(item.id)}
                                    />
                                    <div className={styles.prereqContent}>
                                        <div className={`${styles.prereqText} ${item.done ? styles.done : ''}`}>
                                            {item.text}
                                        </div>
                                        {item.note && (
                                            <div className={styles.prereqNote2}>💡 {item.note}</div>
                                        )}
                                        {item.done === true && item.doneDate && (
                                            <div className={styles.doneDate}>✓ Done {item.doneDate}</div>
                                        )}
                                        {item.done === false && (
                                            <div className={styles.naLabel}>— Not applicable</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {/* Tab: Budget */}
            {activeTab === 'budget' && (
                <div className={styles.preconTabContent}>
                    <PreconBudgetTab
                        budgetCat={handoverBudget}
                        pays={handoverPays}
                        budget={budget}
                        catId="b9c"
                        hint="Post-construction costs: GVMC OC fee ₹5-15K, APEPDCL permanent connection deposit ₹20-50K, water connection fees, property tax first instalment."
                        onBudgetEdit={onBudgetEdit}
                    />
                </div>
            )}

            {/* Tab: Payments */}
            {activeTab === 'payments' && (
                <PreconPayments
                    pays={handoverPays}
                    allPays={pays}
                    budget={budget}
                    catId="b9c"
                    stageId="s_handover"
                    addPayment={addPayment}
                    updatePayment={updatePayment}
                    deletePayment={deletePayment}
                    placeholder="e.g. GVMC OC application fee"
                    showCategorySelector={true}
                    paymentCategoryOptions={POST_CONSTRUCTION_PAYMENT_CATEGORIES}
                />
            )}

            {/* Tab: Notes */}
            {activeTab === 'log' && (
                <PreconLog logs={postconLogs} addLog={addLog} stageId="post_construction" />
            )}
        </div>
    );
}
