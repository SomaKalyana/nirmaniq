import React, { useState } from 'react';
import { ProgressBar, SectionTitle, Badge, CheckButton } from '../components/ui/UI.jsx';
import { C } from '../utils/colors.js';
import styles from './Pages.module.css';

// ── Bank loan checklist data (standalone — not dependent on prereqData) ──
const LOAN_SECTIONS = [
    {
        id: 'l1', title: 'Step 1 — Eligibility & Credit Check', color: '#3D7EFF',
        items: [
            { id: 'l1_1', text: 'Check CIBIL / credit score — minimum 750 recommended', note: 'Check free at cibil.com or your bank\'s app. Score below 700 significantly affects loan amount and interest rate. Fix errors in the report before applying.' },
            { id: 'l1_2', text: 'Calculate loan eligibility — typically 60× monthly net income', note: 'Rule of thumb: banks offer 60–75× net monthly take-home pay. On ₹80k/month, expect ₹48–60L loan. Use bank EMI calculators online.' },
            { id: 'l1_3', text: 'Check existing loan obligations (EMIs should not exceed 50% of income)', note: 'Banks calculate FOIR (Fixed Obligation to Income Ratio). Total EMIs including new loan must be under 50% of income.' },
            { id: 'l1_4', text: 'Decide bank — SBI, HDFC, ICICI, Axis, Bank of Baroda (compare rates)', note: 'SBI and Bank of Baroda generally offer lowest rates for salaried. HDFC and ICICI are faster to process. Compare: processing fee, rate, prepayment penalty.' },
        ],
    },
    {
        id: 'l2', title: 'Step 2 — KYC & Identity Documents', color: '#2DD4A0',
        items: [
            { id: 'l2_1', text: 'Aadhaar card — self-attested copy (all co-applicants)', note: 'Originals for bank verification. All co-owners of the plot must be co-applicants in the loan.' },
            { id: 'l2_2', text: 'PAN card — self-attested copy (all co-applicants)', note: 'Mandatory for any loan above ₹50,000. Without PAN, bank cannot process.' },
            { id: 'l2_3', text: 'Passport-size photographs — 4 each (all applicants)', note: 'Recent photographs, not older than 3 months.' },
            { id: 'l2_4', text: 'Address proof — Aadhaar / Voter ID / Utility bill', note: 'Current residence address matching bank records.' },
        ],
    },
    {
        id: 'l3', title: 'Step 3 — Income & Employment Documents', color: '#F5A623',
        items: [
            { id: 'l3_1', text: 'Salary slips — last 3 months (if salaried)', note: 'Must show employer name, gross salary, deductions, net pay. Stamped and signed by HR.' },
            { id: 'l3_2', text: 'Form 16 — last 2 years (if salaried)', note: 'Issued by employer every April. Shows annual income and TDS. Banks use this to verify annual income.' },
            { id: 'l3_3', text: 'ITR with computation — last 3 years (if self-employed)', note: 'Income Tax Return filed and acknowledged. All 3 years required. Banks average the income across 3 years.' },
            { id: 'l3_4', text: 'P&L statement + Balance Sheet — last 2 years (if self-employed)', note: 'Audited by a CA. Shows business income stability.' },
            { id: 'l3_5', text: 'Employment certificate / appointment letter (if salaried)', note: 'Confirms permanent employment, designation, and date of joining. Contract employees may face difficulty.' },
        ],
    },
    {
        id: 'l4', title: 'Step 4 — Bank Account & Financial Statements', color: '#9B7FFF',
        items: [
            { id: 'l4_1', text: 'Bank statements — all accounts, last 6 months', note: 'Every account — savings, current, salary account. Must show regular salary credits. Download from net banking.' },
            { id: 'l4_2', text: 'Existing loan sanction letters (if any active loans)', note: 'Home loan, car loan, personal loan — any existing liabilities. Bank will factor these into FOIR calculation.' },
            { id: 'l4_3', text: 'Fixed Deposit or investment proof (if any) — optional but helpful', note: 'FD certificates, mutual fund statements, share holdings. Strengthens your case for a larger loan.' },
        ],
    },
    {
        id: 'l5', title: 'Step 5 — Property & Land Documents', color: '#FF5A5A',
        items: [
            { id: 'l5_1', text: 'Original Sale Deed (registered) — submit to bank', note: 'Bank keeps original as security throughout the loan tenure. Get written acknowledgment receipt.' },
            { id: 'l5_2', text: 'Encumbrance Certificate (EC) — minimum 30 years', note: 'From Sub-Registrar. Shows property has no existing mortgage or dispute. Bank insists on 30 years.' },
            { id: 'l5_3', text: 'Pattadar Passbook / Pahani from Meebhoomi', note: 'Revenue record showing land is in your name. Download from meebhoomi.ap.gov.in.' },
            { id: 'l5_4', text: 'Property Tax receipts — latest 3 years', note: 'GVMC Khanapayment receipts. Shows regular payment and establishes ownership history.' },
            { id: 'l5_5', text: 'Layout approval copy (Ratnagiri HB Colony layout)', note: 'Plot is in an approved HB Colony layout. Bank requires this for construction loan.' },
        ],
    },
    {
        id: 'l6', title: 'Step 6 — Building Plan & Approvals', color: '#6699FF',
        items: [
            { id: 'l6_1', text: 'Building Permission Order — PER/1086/0349/2026 (copy)', note: 'Already obtained. Bank requires approved BPO before sanctioning construction loan.' },
            { id: 'l6_2', text: 'APDPMS digitally signed approved plan — all 5 sheets', note: 'Download from portal.apdpms.ap.gov.in. Bank keeps a copy. This is the plan bank uses for technical valuation.' },
            { id: 'l6_3', text: 'Structural Engineer stability certificate', note: 'Signed by licensed structural engineer. Bank\'s technical officer will verify this.' },
            { id: 'l6_4', text: 'Detailed construction cost estimate from engineer', note: 'Bank sanctions up to 75–80% of construction cost. Get this prepared by Abdul Mannan / your engineer.' },
            { id: 'l6_5', text: 'Soil Test Report (copy) — SBC 14.4 t/m²', note: 'Already obtained from Andhra University Civil Dept. Bank may ask for this.' },
        ],
    },
    {
        id: 'l7', title: 'Step 7 — Loan Processing & Sanction', color: '#2DD4A0',
        items: [
            { id: 'l7_1', text: 'Submit loan application to chosen bank', note: 'Apply at branch or online. Pay processing fee (typically 0.5–1% of loan amount, max ₹10,000–15,000).' },
            { id: 'l7_2', text: 'Bank legal team verification of property documents', note: 'Bank\'s empanelled lawyer verifies title documents. Takes 7–10 days. You may be asked for additional documents.' },
            { id: 'l7_3', text: 'Bank technical valuation of property (pre-sanction)', note: 'Bank deputes a technical officer to value the plot + estimate construction cost. Takes 3–5 days.' },
            { id: 'l7_4', text: 'Loan sanction letter received', note: 'Sanction letter shows: approved amount, interest rate, tenure, EMI. Valid for 6 months. Keep original safely.' },
            { id: 'l7_5', text: 'Loan agreement signed + stamp duty paid', note: 'Loan agreement on stamp paper. Stamp duty is 0.1–0.5% of loan amount depending on state.' },
        ],
    },
    {
        id: 'l8', title: 'Step 8 — Disbursement (Stage-wise)', color: '#F5A623',
        items: [
            { id: 'l8_1', text: 'Disbursement 1: Foundation — after foundation + plinth beam completion', note: 'Bank sends technical officer to verify foundation is complete. Takes 2–3 days. Submit disbursement request letter.' },
            { id: 'l8_2', text: 'Disbursement 2: Stilt + Ground floor slab', note: 'Same process — bank officer visit → technical report → disbursement within 5–7 days.' },
            { id: 'l8_3', text: 'Disbursement 3: First floor slab completion', note: 'Keep bank officer\'s contact handy for quick inspection appointments.' },
            { id: 'l8_4', text: 'Disbursement 4: Second floor + terrace slab', note: 'Progress photos help speed up the inspection process.' },
            { id: 'l8_5', text: 'Disbursement 5: Finishing stages — doors, windows, flooring, painting', note: 'Final disbursement usually after near-completion. Bank may do final valuation.' },
            { id: 'l8_6', text: 'Occupancy Certificate — submit copy to bank after OC is received', note: 'Required for loan account closure or to convert to home loan if applicable.' },
        ],
    },
];

export default function BankLoan({ loanItems, toggleLoanItem }) {
    const [openSection, setOpenSection] = useState('l1');

    // Compute totals
    const totalItems = LOAN_SECTIONS.reduce((a, s) => a + s.items.length, 0);
    const doneItems  = loanItems
        ? LOAN_SECTIONS.reduce((a, s) =>
            a + s.items.filter(i => loanItems[i.id]?.done).length, 0)
        : 0;
    const overallPct = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;

    const sectionDone = (s) =>
        loanItems
            ? s.items.filter(i => loanItems[i.id]?.done).length
            : 0;

    const toggle = (itemId) => toggleLoanItem && toggleLoanItem(itemId);

    return (
        <div className={styles.page}>
            {/* Header card */}
            <div className={styles.card} style={{ borderColor: '#6699FF55' }}>
                <div className={styles.rowBetween} style={{ marginBottom: 10 }}>
                    <div>
                        <div className={styles.labelSmall}>Bank construction loan</div>
                        <div className={styles.stageTitle}>🏦 Loan Application Checklist</div>
                    </div>
                    <Badge color="#6699FF">{overallPct}% done</Badge>
                </div>
                <ProgressBar value={overallPct} color="#6699FF" height={6} />
                <div className={styles.rowBetween} style={{ marginTop: 6 }}>
                    <span className={styles.hint}>{doneItems} of {totalItems} items completed</span>
                    <span className={styles.hint}>8 steps</span>
                </div>
            </div>

            {/* Info banner */}
            <div className={styles.infoBox} style={{ borderColor: '#6699FF44', background: '#6699FF0F' }}>
                <strong style={{ color: '#6699FF' }}>Construction loan disburses in stages, not as a lump sum.</strong> Bank sends a technical officer before each disbursement to verify stage completion. Keep this checklist and your bank officer's contact handy throughout construction.
            </div>

            <SectionTitle>Step-by-step loan application</SectionTitle>

            {LOAN_SECTIONS.map((section) => {
                const open    = openSection === section.id;
                const done    = sectionDone(section);
                const total   = section.items.length;
                const secPct  = Math.round((done / total) * 100);

                return (
                    <div key={section.id}
                        className={styles.stageCard}
                        style={{ borderColor: open ? section.color + '77' : 'var(--border)' }}
                    >
                        {/* Section header */}
                        <button
                            className={styles.stageHeader}
                            onClick={() => setOpenSection(open ? null : section.id)}
                        >
                            <div className={styles.stageInfo}>
                                <div className={styles.stageTitle}>{section.title}</div>
                                <div className={styles.stageMeta}>
                                    <span className={styles.hint}>{done}/{total} done</span>
                                    {secPct === 100 && <Badge color={C.green} small>Complete ✓</Badge>}
                                </div>
                            </div>
                            <div className={styles.stageRight}>
                                <span className={styles.mono}
                                    style={{ color: secPct === 100 ? C.green : C.muted, fontSize: 12 }}>
                                    {secPct}%
                                </span>
                                <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
                            </div>
                        </button>

                        {/* Progress bar */}
                        <div className={styles.stageBar}>
                            <ProgressBar value={secPct} color={secPct === 100 ? C.green : section.color} height={3} />
                        </div>

                        {/* Expanded items */}
                        {open && (
                            <div className={styles.stageBody}>
                                {section.items.map((item) => {
                                    const done = loanItems?.[item.id]?.done || false;
                                    return (
                                        <div key={item.id} className={styles.prereqItem}>
                                            <CheckButton
                                                done={done}
                                                onClick={() => toggle(item.id)}
                                                color={C.green}
                                            />
                                            <div className={styles.prereqContent}>
                                                <div className={`${styles.prereqText} ${done ? styles.done : ''}`}>
                                                    {item.text}
                                                </div>
                                                {item.note && (
                                                    <div className={styles.prereqNote2}>💡 {item.note}</div>
                                                )}
                                                {done && loanItems?.[item.id]?.doneDate && (
                                                    <div className={styles.doneDate}>
                                                        ✓ Done {loanItems[item.id].doneDate}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
