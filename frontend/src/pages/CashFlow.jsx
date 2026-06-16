import React, { useState, useEffect, useCallback } from 'react';
import { C } from '../utils/colors.js';
import { fmtINR } from '../utils/format.js';
import styles from './CashFlow.module.css';

const API = '/api';
const auth = () => {
    const t = localStorage.getItem('nirmaniq_token');
    return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

// ── Constants ──────────────────────────────────────────────────────────────────
const PAYMENT_MODES = ['Cash', 'UPI / PhonePe / GPay', 'NEFT / IMPS / RTGS', 'Cheque', 'Bank Transfer', 'DD', 'Other'];
const NEEDS_REF     = (m) => m && m !== 'Cash';

const MONEY_IN_TYPES = [
    { id: 'own_funds',          label: '🏦 Own Funds',            desc: 'Transfer from personal savings / FD / salary' },
    { id: 'loan_disbursement',  label: '🏛 Loan Disbursement',    desc: 'Stage-wise release from bank / HFC' },
];

const MONEY_OUT_CATS = [
    { id: 'bank_charges',   label: '🏦 Bank Charges & Processing Fees',  hint: 'NEFT charges, processing fees, foreclosure charges' },
    { id: 'emi',            label: '📅 EMI / Loan Repayment',            hint: 'Monthly EMI for home loan or any other loan' },
    { id: 'valuation_fee',  label: '📐 Valuation / Inspection Fee',      hint: 'Bank valuation, technical inspection fee' },
    { id: 'engineer_fee',   label: '🔧 Structural / Civil Engineer Fee', hint: 'Mannan Design Group, structural consultant fees' },
    { id: 'legal_fee',      label: '⚖️ Legal & Documentation',           hint: 'MODT, stamp duty, legal charges, advocate fees' },
    { id: 'insurance',      label: '🛡 Insurance Premium',               hint: 'Property insurance, contractor all-risk insurance' },
    { id: 'tax',            label: '🏛 Property Tax / Government Dues',   hint: 'GVMC property tax, water charges, govt fees' },
    { id: 'other',          label: '📋 Other Expenses',                  hint: 'Any other project-related expense' },
];

const SAVINGS_ACCOUNTS = [
    'Indian Bank Savings Account',
    'SBI Savings Account',
    'HDFC Savings Account',
    'ICICI Savings Account',
    'Axis Bank Savings Account',
    'Kotak Savings Account',
    'Personal Cash / Hand',
    'Fixed Deposit Withdrawal',
    'Other Own Funds',
];

const LOAN_ACCOUNTS = [
    'Indian Bank Home Loan',
    'HDFC Home Loan',
    'SBI Home Loan',
    'LIC Housing Finance',
    'ICICI Home Loan',
    'Axis Bank Home Loan',
    'PNB Home Loan',
    'Bank of Baroda Home Loan',
    'Other Home Loan',
];

// ── Sub-components ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color, note }) {
    return (
        <div className={styles.summaryCard} style={{ borderColor: color ? `color-mix(in srgb, ${color} 30%, transparent)` : undefined }}>
            <div className={styles.summaryLabel}>{label}</div>
            <div className={styles.summaryValue} style={{ color: color || 'var(--text)' }}>{value}</div>
            {sub  && <div className={styles.summarySub}>{sub}</div>}
            {note && <div className={styles.summaryNote}>{note}</div>}
        </div>
    );
}

function EntryRow({ e, type, onEdit, onDelete, catLabel }) {
    const isIn = type === 'in';
    return (
        <div className={`${styles.entryRow} ${isIn ? styles.entryRowIn : styles.entryRowOut}`}>
            <div className={styles.entryDate}>{e.date}</div>
            <div className={styles.entryMid}>
                <div className={styles.entryDesc}>{e.description || e.desc}</div>
                <div className={styles.entryMeta}>
                    {catLabel && <span className={styles.entryBadge}>{catLabel}</span>}
                    {(e.vendor_name || e.source) && <span className={styles.entryVendor}>🏢 {e.vendor_name || e.source}</span>}
                    {e.ref_number && <span className={styles.entryRef}>Ref: {e.ref_number}</span>}
                    {e.loan_account && <span className={styles.entryRef}>{e.loan_account}</span>}
                </div>
            </div>
            <div className={styles.entryRight}>
                <div className={styles.entryAmt} style={{ color: isIn ? C.green : C.red }}>
                    {isIn ? '+' : '−'}{fmtINR(e.amount)}
                </div>
                <div className={styles.entryActions}>
                    <button className={styles.editBtn} onClick={() => onEdit(e)}>Edit</button>
                    <button className={styles.delBtn} onClick={() => onDelete(e.id)}>✕</button>
                </div>
            </div>
        </div>
    );
}

// ── Money IN Form ──────────────────────────────────────────────────────────────
function MoneyInForm({ onSave, onCancel, initial }) {
    const [form, setForm] = useState(initial || {
        date: new Date().toISOString().slice(0, 10),
        type: 'loan_disbursement',
        source: 'Indian Bank Savings Account',
        amount: '',
        description: '',
        ref_number: '',
        payment_mode: 'NEFT / IMPS / RTGS',
    });
    const F = (k, v) => setForm(f => ({ ...f, [k]: v }));

    return (
        <div className={styles.formCard}>
            <div className={styles.formTitle}>💰 Money IN — Record a deposit</div>
            <div className={styles.formGrid}>
                {/* Type toggle */}
                <div className={styles.fullCol}>
                    <div className={styles.fieldLabel}>Deposit type</div>
                    <div className={styles.typeToggle}>
                        {MONEY_IN_TYPES.map(t => (
                            <button key={t.id}
                                className={`${styles.typeBtn} ${form.type === t.id ? styles.typeBtnActive : ''}`}
                                onClick={() => { F('type', t.id); F('source', t.id === 'loan_disbursement' ? 'Indian Bank Home Loan' : 'Indian Bank Savings Account'); }}>
                                {t.label}
                                <span className={styles.typeBtnHint}>{t.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Source / Loan account */}
                <div>
                    <div className={styles.fieldLabel}>
                        {form.type === 'loan_disbursement' ? 'Loan account' : 'Bank / source account'}
                    </div>
                    {form.type === 'loan_disbursement' ? (
                        <select value={form.source} onChange={e => F('source', e.target.value)}>
                            {LOAN_ACCOUNTS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    ) : (
                        <select value={form.source} onChange={e => F('source', e.target.value)}>
                            {SAVINGS_ACCOUNTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    )}
                </div>

                {/* Amount + Date */}
                <div>
                    <div className={styles.fieldLabel}>Amount received (₹) *</div>
                    <input type="number" step="0.001" value={form.amount} onChange={e => F('amount', e.target.value)}
                        placeholder="0.000" />
                </div>
                <div>
                    <div className={styles.fieldLabel}>Date *</div>
                    <input type="date" value={form.date} onChange={e => F('date', e.target.value)} />
                </div>

                {/* Payment mode + Ref */}
                <div>
                    <div className={styles.fieldLabel}>Mode</div>
                    <select value={form.payment_mode} onChange={e => F('payment_mode', e.target.value)}>
                        {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <div className={styles.fieldLabel}>Reference / UTR no.</div>
                    <input value={form.ref_number} onChange={e => F('ref_number', e.target.value)}
                        placeholder="UTR / Cheque no. / Loan ref" />
                </div>

                {/* Description */}
                <div className={styles.fullCol}>
                    <div className={styles.fieldLabel}>Notes</div>
                    <input value={form.description} onChange={e => F('description', e.target.value)}
                        placeholder={form.type === 'loan_disbursement'
                            ? 'e.g. Stage 1 disbursement — Foundation milestone (₹21,38,660)'
                            : 'e.g. Transfer from SBI savings for site expenses'} />
                </div>
            </div>
            <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
                <button className={styles.saveBtn} disabled={!form.amount || !form.date}
                    onClick={() => onSave(form)}>Save deposit</button>
            </div>
        </div>
    );
}

// ── Money OUT Form ─────────────────────────────────────────────────────────────
function MoneyOutForm({ onSave, onCancel, initial }) {
    const [form, setForm] = useState(initial || {
        date: new Date().toISOString().slice(0, 10),
        category: 'bank_charges',
        description: '',
        amount: '',
        vendor_name: '',
        payment_mode: 'Cash',
        ref_number: '',
        loan_account: '',
    });
    const F = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const cat = MONEY_OUT_CATS.find(c => c.id === form.category);

    return (
        <div className={styles.formCard}>
            <div className={styles.formTitle}>💸 Money OUT — Record an expense</div>
            <div className={styles.formGrid}>
                {/* Category */}
                <div className={styles.fullCol}>
                    <div className={styles.fieldLabel}>Expense category *</div>
                    <select value={form.category} onChange={e => F('category', e.target.value)}>
                        {MONEY_OUT_CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    {cat && <div className={styles.catHint}>💡 {cat.hint}</div>}
                </div>

                {/* Loan account — only for EMI */}
                {form.category === 'emi' && (
                    <div className={styles.fullCol}>
                        <div className={styles.fieldLabel}>Loan account</div>
                        <select value={form.loan_account} onChange={e => F('loan_account', e.target.value)}>
                            <option value="">Select loan account</option>
                            {LOAN_ACCOUNTS.map(l => <option key={l}>{l}</option>)}
                        </select>
                    </div>
                )}

                {/* Description */}
                <div className={styles.fullCol}>
                    <div className={styles.fieldLabel}>Description *</div>
                    <input value={form.description} onChange={e => F('description', e.target.value)}
                        placeholder={cat?.hint || 'Describe this expense'} />
                </div>

                {/* Vendor */}
                <div className={styles.fullCol}>
                    <div className={styles.fieldLabel}>Paid to (vendor / bank / institution)</div>
                    <input value={form.vendor_name} onChange={e => F('vendor_name', e.target.value)}
                        placeholder="e.g. HDFC Bank, SBI, Mannan Design Group, Advocate Raju" />
                </div>

                {/* Amount + Date */}
                <div>
                    <div className={styles.fieldLabel}>Amount (₹) *</div>
                    <input type="number" step="0.001" value={form.amount} onChange={e => F('amount', e.target.value)}
                        placeholder="0.000" />
                </div>
                <div>
                    <div className={styles.fieldLabel}>Date *</div>
                    <input type="date" value={form.date} onChange={e => F('date', e.target.value)} />
                </div>

                {/* Mode + Ref */}
                <div>
                    <div className={styles.fieldLabel}>Payment mode</div>
                    <select value={form.payment_mode} onChange={e => F('payment_mode', e.target.value)}>
                        {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                    </select>
                </div>
                {NEEDS_REF(form.payment_mode) && (
                    <div>
                        <div className={styles.fieldLabel}>Reference / Transaction no.</div>
                        <input value={form.ref_number} onChange={e => F('ref_number', e.target.value)}
                            placeholder="UTR / Cheque no." />
                    </div>
                )}
            </div>
            <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
                <button className={styles.saveBtn} disabled={!form.amount || !form.date || !form.description}
                    onClick={() => onSave(form)}>Save expense</button>
            </div>
        </div>
    );
}

// ── Main CashFlow page ─────────────────────────────────────────────────────────
export default function CashFlow({ project, pays = [] }) {
    const [moneyIn,  setMoneyIn]  = useState([]);
    const [moneyOut, setMoneyOut] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [view,     setView]     = useState('overview'); // 'overview'|'in'|'out'|'ledger'
    const [form,     setForm]     = useState(null); // null | { mode:'in'|'out', edit: obj|null }

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [cfR, moR] = await Promise.all([
                fetch(`${API}/cash-flow`, { headers: auth() }),
                fetch(`${API}/money-out`, { headers: auth() }),
            ]);
            if (cfR.ok) setMoneyIn((await cfR.json()).entries || []);
            if (moR.ok) setMoneyOut((await moR.json()).entries || []);
        } catch { /* backend offline */ }
        setLoading(false);
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    // ── Computed ────────────────────────────────────────────────────────────
    const totalIn          = moneyIn.reduce((s, e) => s + e.amount, 0);
    const ownIn            = moneyIn.filter(e => e.type === 'own_funds').reduce((s, e) => s + e.amount, 0);
    const loanIn           = moneyIn.filter(e => e.type === 'loan_disbursement').reduce((s, e) => s + e.amount, 0);
    const totalMiscOut     = moneyOut.reduce((s, e) => s + e.amount, 0);
    const totalConstructionOut = pays.reduce((s, p) => s + (p.amount || 0), 0);
    const totalOut         = totalMiscOut + totalConstructionOut;
    const balance          = totalIn - totalOut;

    const loanSanctioned   = project?.loanAmount  || 0;
    const loanPending      = loanSanctioned - loanIn;
    const totalBudget      = project?.totalBudget || 0;

    // EMI total
    const emiTotal = moneyOut.filter(e => e.category === 'emi').reduce((s, e) => s + e.amount, 0);

    // ── Actions ─────────────────────────────────────────────────────────────
    const saveIn = async (f) => {
        const body = { ...f, amount: Number(f.amount) };
        const url  = body.id ? `${API}/cash-flow/${body.id}` : `${API}/cash-flow`;
        const r = await fetch(url, { method: body.id ? 'PUT' : 'POST', headers: auth(), body: JSON.stringify(body) });
        if (r.ok) { await loadAll(); setForm(null); }
    };

    const saveOut = async (f) => {
        const body = { ...f, amount: Number(f.amount) };
        const url  = body.id ? `${API}/money-out/${body.id}` : `${API}/money-out`;
        const r = await fetch(url, { method: body.id ? 'PUT' : 'POST', headers: auth(), body: JSON.stringify(body) });
        if (r.ok) { await loadAll(); setForm(null); }
    };

    const deleteIn  = async (id) => { if (!confirm('Delete?')) return; await fetch(`${API}/cash-flow/${id}`, { method: 'DELETE', headers: auth() }); await loadAll(); };
    const deleteOut = async (id) => { if (!confirm('Delete?')) return; await fetch(`${API}/money-out/${id}`, { method: 'DELETE', headers: auth() }); await loadAll(); };

    // Combined ledger sorted by date descending
    const ledgerRaw = [
        ...moneyIn.map(e => ({ ...e, _type: 'in',  _label: e.type === 'loan_disbursement' ? '🏛 Loan disbursement' : '🏦 Own funds' })),
        ...moneyOut.map(e => ({ ...e, _type: 'out', _label: MONEY_OUT_CATS.find(c => c.id === e.category)?.label || e.category })),
        ...pays.map(p => ({ ...p, description: p.desc || p.description, date: p.date, _type: 'out', _label: '🏗 Construction payment' })),
    ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Compute running balance: start from oldest, accumulate, then show newest first
    const ledger = (() => {
        const asc = [...ledgerRaw].reverse(); // oldest first
        let running = 0;
        const withBalance = asc.map(e => {
            running += e._type === 'in' ? Number(e.amount) : -Number(e.amount);
            return { ...e, _runningBalance: running };
        });
        return withBalance.reverse(); // back to newest first
    })();

    return (
        <div className={styles.page}>
            {/* ── Header summary ── */}
            <div className={styles.summaryGrid}>
                <SummaryCard label="Cash balance" value={fmtINR(balance)}
                    color={balance >= 0 ? C.green : C.red}
                    sub={`In: ${fmtINR(totalIn)}  |  Out: ${fmtINR(totalOut)}`} />
                <SummaryCard label="Money IN" value={fmtINR(totalIn)} color={C.green}
                    sub={`Own: ${fmtINR(ownIn)}  |  Loan: ${fmtINR(loanIn)}`} />
                <SummaryCard label="Money OUT" value={fmtINR(totalOut)} color={C.red}
                    sub={`Construction: ${fmtINR(totalConstructionOut)}  |  Other: ${fmtINR(totalMiscOut)}`} />
                <SummaryCard label="Loan pending" value={fmtINR(loanPending)} color={C.amber}
                    sub={`Sanctioned: ${fmtINR(loanSanctioned)}`}
                    note={loanPending > 0 ? 'Not yet disbursed' : '✓ Fully disbursed'} />
            </div>

            {emiTotal > 0 && (
                <div className={styles.emiAlert}>
                    📅 Total EMI paid: <strong>{fmtINR(emiTotal)}</strong> — tracked under Money OUT
                </div>
            )}

            {/* ── Action buttons ── */}
            {!form && (
                <div className={styles.actionRow}>
                    <button className={styles.btnIn}  onClick={() => setForm({ mode: 'in', edit: null })}>+ Money IN</button>
                    <button className={styles.btnOut} onClick={() => setForm({ mode: 'out', edit: null })}>+ Money OUT</button>
                    <div className={styles.viewTabs}>
                        {[['overview','Overview'],['ledger','Full Ledger'],['in','Money IN'],['out','Money OUT']].map(([v,l]) => (
                            <button key={v} className={`${styles.viewTab} ${view===v?styles.viewTabActive:''}`}
                                onClick={() => setView(v)}>{l}</button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Forms ── */}
            {form?.mode === 'in'  && <MoneyInForm  onSave={saveIn}  onCancel={() => setForm(null)} initial={form.edit} />}
            {form?.mode === 'out' && <MoneyOutForm onSave={saveOut} onCancel={() => setForm(null)} initial={form.edit} />}

            {/* ── Content ── */}
            {loading ? <div className={styles.empty}>Loading…</div> : (
                <>
                {/* Overview */}
                {view === 'overview' && (
                    <div className={styles.overviewGrid}>
                        <div className={styles.overviewSection}>
                            <div className={styles.sectionHead} style={{ color: C.green }}>💰 Money IN ({moneyIn.length})</div>
                            {moneyIn.length === 0 ? <div className={styles.empty}>No deposits recorded. Start by adding the ₹21,38,660 loan released so far.</div> :
                                moneyIn.slice(0,5).map(e => (
                                    <EntryRow key={e.id} e={e} type="in"
                                        catLabel={e.type === 'loan_disbursement' ? '🏛 Loan' : '🏦 Own funds'}
                                        onEdit={ed => setForm({ mode:'in', edit: ed })}
                                        onDelete={deleteIn} />
                                ))}
                        </div>
                        <div className={styles.overviewSection}>
                            <div className={styles.sectionHead} style={{ color: C.red }}>💸 Money OUT — Other ({moneyOut.length})</div>
                            {moneyOut.length === 0 ? <div className={styles.empty}>No bank charges, EMI or fees recorded yet.</div> :
                                moneyOut.slice(0,5).map(e => (
                                    <EntryRow key={e.id} e={e} type="out"
                                        catLabel={MONEY_OUT_CATS.find(c => c.id === e.category)?.label}
                                        onEdit={ed => setForm({ mode:'out', edit: ed })}
                                        onDelete={deleteOut} />
                                ))}
                        </div>
                    </div>
                )}

                {/* Full ledger */}
                {view === 'ledger' && (
                    <div>
                        <div className={styles.sectionHead}>📒 Full Ledger — all transactions by date</div>
                        {/* Ledger header */}
                        <div className={styles.ledgerHeader}>
                            <span className={styles.ledgerHDate}>Date</span>
                            <span className={styles.ledgerHDesc}>Description</span>
                            <span className={styles.ledgerHAmt}>Amount</span>
                            <span className={styles.ledgerHBal}>Balance</span>
                        </div>
                        {ledger.map((e, i) => (
                            <div key={e.id || i} className={`${styles.ledgerRow} ${e._type==='in' ? styles.ledgerRowIn : styles.ledgerRowOut}`}>
                                <div className={styles.ledgerDate}>{e.date}</div>
                                <div className={styles.ledgerMid}>
                                    <div className={styles.entryDesc}>{e.description || e.desc}</div>
                                    <div className={styles.entryMeta}>
                                        <span className={styles.entryBadge}>{e._label}</span>
                                        {(e.vendor_name||e.source) && <span className={styles.entryVendor}>🏢 {e.vendor_name||e.source}</span>}
                                    </div>
                                </div>
                                <div className={styles.ledgerAmt} style={{ color: e._type==='in' ? C.green : C.red }}>
                                    {e._type==='in' ? '+' : '−'}{fmtINR(e.amount)}
                                </div>
                                <div className={styles.ledgerBal}
                                    style={{ color: e._runningBalance >= 0 ? C.green : C.red }}>
                                    {fmtINR(e._runningBalance)}
                                </div>
                            </div>
                        ))}
                        <div className={styles.reconcile}>
                            <div className={styles.reconcileRow}><span>Total IN</span><span style={{color:C.green}}>+{fmtINR(totalIn)}</span></div>
                            <div className={styles.reconcileRow}><span>Construction payments</span><span style={{color:C.red}}>−{fmtINR(totalConstructionOut)}</span></div>
                            <div className={styles.reconcileRow}><span>Other expenses (fees/EMI/charges)</span><span style={{color:C.red}}>−{fmtINR(totalMiscOut)}</span></div>
                            <div className={styles.reconcileTotal}><span>Balance</span><span style={{color: balance>=0 ? C.green : C.red}}>{fmtINR(balance)}</span></div>
                        </div>
                    </div>
                )}

                {/* Money IN list */}
                {view === 'in' && (
                    <div>
                        <div className={styles.sectionHead}>💰 Money IN — All deposits</div>
                        {moneyIn.length === 0 ? <div className={styles.empty}>No deposits yet.</div> :
                            moneyIn.map(e => (
                                <EntryRow key={e.id} e={e} type="in"
                                    catLabel={e.type==='loan_disbursement' ? '🏛 Loan' : '🏦 Own funds'}
                                    onEdit={ed => setForm({ mode:'in', edit: ed })}
                                    onDelete={deleteIn} />
                            ))}
                    </div>
                )}

                {/* Money OUT list */}
                {view === 'out' && (
                    <div>
                        <div className={styles.sectionHead}>💸 Money OUT — Bank charges, EMI, Fees</div>
                        {moneyOut.length === 0 ? <div className={styles.empty}>No expenses yet. Record bank charges, EMI, valuation fees here.</div> :
                            moneyOut.map(e => (
                                <EntryRow key={e.id} e={e} type="out"
                                    catLabel={MONEY_OUT_CATS.find(c => c.id === e.category)?.label}
                                    onEdit={ed => setForm({ mode:'out', edit: ed })}
                                    onDelete={deleteOut} />
                            ))}
                    </div>
                )}
                </>
            )}
        </div>
    );
}
