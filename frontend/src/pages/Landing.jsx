import React, { useState, useEffect, useCallback } from 'react';
import styles from './Landing.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────

const SLIDES = [
    {
        id: 1,
        tag: 'Dashboard',
        title: 'Your project at a glance',
        desc: 'See overall progress, active stage, budget utilisation and pending tasks the moment you open the app. No spreadsheets. No WhatsApp digging.',
        color: '#3D7EFF',
        visual: {
            type: 'dashboard',
            items: [
                { label: 'Overall Progress', value: '38%', bar: 38, color: '#2DD4A0' },
                { label: 'Budget Spent', value: '₹42L', bar: 30, color: '#F5A623' },
                { label: 'Active Stage', value: 'Columns', bar: 0, color: '#3D7EFF' },
                { label: 'Tasks Done', value: '62/163', bar: 38, color: '#9B7FFF' },
            ],
        },
    },
    {
        id: 2,
        tag: 'Stage Tracking',
        title: '15 stages. 100+ checklists.',
        desc: 'From excavation to handover — every stage has a specific checklist built from structural drawings. Tick off tasks, mark done dates, and hold your builder accountable.',
        color: '#2DD4A0',
        visual: {
            type: 'stages',
            items: [
                { label: '⛏ Excavation & Earthwork', pct: 100, color: '#2DD4A0' },
                { label: '🏗 Foundation & Footings',  pct: 100, color: '#2DD4A0' },
                { label: '🏛 Columns & Plinth Beam',  pct: 72,  color: '#3D7EFF' },
                { label: '🧱 Stilt Slab (Slab 1)',    pct: 0,   color: '#F5A623' },
                { label: '🧱 Ground Floor Slab',       pct: 0,   color: '#F5A623' },
            ],
        },
    },
    {
        id: 3,
        tag: 'Materials',
        title: 'Track every bag, every tonne',
        desc: 'Know exactly how much steel, cement, sand and bricks you need vs what is ordered and received. Catch shortfalls before they stop your construction.',
        color: '#F5A623',
        visual: {
            type: 'materials',
            items: [
                { label: 'Steel 20mm TMT',  req: 9.8,   recv: 5.2,  unit: 'MT',   color: '#FF5A5A' },
                { label: 'OPC 53 Cement',   req: 2288,  recv: 800,  unit: 'bags', color: '#3D7EFF' },
                { label: 'River Sand',       req: 608,   recv: 200,  unit: 'cum',  color: '#2DD4A0' },
                { label: 'Red Bricks',       req: 93270, recv: 45000,unit: 'nos',  color: '#F5A623' },
            ],
        },
    },
    {
        id: 4,
        tag: 'Documents',
        title: '52 approvals. Nothing missed.',
        desc: 'A complete pre-construction checklist — GVMC building permission, APDPMS digitally signed plans, soil test, NOCs, bank loan documents. Your BPO and soil test are pre-filled.',
        color: '#9B7FFF',
        visual: {
            type: 'docs',
            groups: [
                { label: 'Land & Ownership',      done: 6, total: 8,  color: '#3D7EFF' },
                { label: 'Building Permission',    done: 2, total: 8,  color: '#2DD4A0' },
                { label: 'NOCs & Utilities',       done: 0, total: 6,  color: '#9B7FFF' },
                { label: 'Financial & Insurance',  done: 1, total: 5,  color: '#FF5A5A' },
                { label: 'Bank Construction Loan', done: 0, total: 10, color: '#6699FF' },
                { label: 'On-Site Setup',          done: 0, total: 7,  color: '#2DD4A0' },
            ],
        },
    },
    {
        id: 5,
        tag: 'Budget & Payments',
        title: 'Every rupee tracked',
        desc: 'Log payments against 10 budget categories. See which stage is over or under budget. Get an instant picture of total spend vs allocation — always.',
        color: '#FF5A5A',
        visual: {
            type: 'budget',
            items: [
                { label: 'Foundation',        spent: 11.5, alloc: 11.5, color: '#2DD4A0' },
                { label: 'Structure (RCC)',   spent: 18,   alloc: 48,   color: '#3D7EFF' },
                { label: 'Masonry & Plaster', spent: 0,    alloc: 28,   color: '#9B7FFF' },
                { label: 'MEP',               spent: 0,    alloc: 10.6, color: '#F5A623' },
            ],
        },
    },
];

const FLOW_STEPS = [
    {
        num: '01', icon: '📝', color: '#3D7EFF',
        title: 'Register',
        desc: 'Create your account and register your project — plot size, direction, floors, builder details.',
    },
    {
        num: '02', icon: '📋', color: '#9B7FFF',
        title: 'Pre-Construction',
        desc: 'Complete the 52-item government approval checklist. Your BPO and soil test are pre-filled. Clear pending NOCs, bank documents.',
    },
    {
        num: '03', icon: '🏗', color: '#2DD4A0',
        title: 'Track Stages',
        desc: 'As construction progresses, tick off tasks stage by stage. Columns poured? Curing done? Mark it. Hold your builder accountable.',
    },
    {
        num: '04', icon: '🧱', color: '#F5A623',
        title: 'Monitor Materials',
        desc: 'Log every steel delivery, cement batch, brick load. Compare ordered vs received vs required. Catch theft or shortfalls early.',
    },
    {
        num: '05', icon: '💰', color: '#FF5A5A',
        title: 'Control Budget',
        desc: 'Record every payment as it happens. See budget utilisation per category. Never lose track of where the money went.',
    },
    {
        num: '06', icon: '🔑', color: '#3D7EFF',
        title: 'Handover',
        desc: 'Final snag checklist, OC application, permanent connections. Move in with full documentation and peace of mind.',
    },
];

const LOAN_OVERVIEW = [
    { step: '1', title: 'Eligibility Check', desc: 'CIBIL score ≥750, FOIR <50%, choose bank', color: '#3D7EFF' },
    { step: '2', title: 'KYC Documents',     desc: 'Aadhaar, PAN, photos — all applicants',    color: '#2DD4A0' },
    { step: '3', title: 'Income Proof',      desc: 'Salary slips / ITR 3 years, Form 16',      color: '#F5A623' },
    { step: '4', title: 'Bank Statements',   desc: 'All accounts, last 6 months',              color: '#9B7FFF' },
    { step: '5', title: 'Property Docs',     desc: 'Sale deed, EC 30 years, Pahani, tax receipts', color: '#FF5A5A' },
    { step: '6', title: 'Building Approvals',desc: 'BPO, signed plan, structural certificate', color: '#6699FF' },
    { step: '7', title: 'Loan Processing',   desc: 'Application → legal check → valuation → sanction', color: '#3D7EFF' },
    { step: '8', title: 'Stage Disbursement',desc: 'Bank pays in 5 stages after site verification', color: '#2DD4A0' },
];

const FEATURES_DEEP = [
    {
        icon: '📋', color: '#3D7EFF',
        title: 'Pre-Construction Checklist',
        bullets: [
            '52 items across 7 groups — land, permissions, NOCs, finance, site setup',
            'Your BPO (PER/1086/0349/2026) and Soil Test pre-filled as done',
            'Guidance note on every item — where to get it, what to watch for',
            'Key portals: APDPMS, GVMC, Meebhoomi, APEPDCL',
        ],
    },
    {
        icon: '🏗', color: '#2DD4A0',
        title: 'Stage-Wise Construction Tracking',
        bullets: [
            '15 stages from excavation to handover — 100+ specific tasks',
            'Tasks drawn from actual structural drawings and IS codes',
            'Check off tasks, see done dates, track active stage automatically',
            'Foundation depth, cube test reminders, curing checklists built in',
        ],
    },
    {
        icon: '🧱', color: '#F5A623',
        title: 'Material Quantity Tracker',
        bullets: [
            'Quantities calculated from your structural drawings — 41.8 MT steel, 3,781 bags cement',
            'Track ordered vs received per material with dual progress bars',
            'Log supplier name and rate per delivery',
            'Instant value-received calculation per material',
        ],
    },
    {
        icon: '💰', color: '#FF5A5A',
        title: 'Budget & Payment Log',
        bullets: [
            '10 pre-configured budget categories matching construction phases',
            'Add payments — auto-deducts from category allocation',
            'Visual progress bars show over-budget categories in red',
            'Delete any payment and budget auto-corrects',
        ],
    },
    {
        icon: '👷', color: '#9B7FFF',
        title: 'Site Team Management',
        bullets: [
            'Track supervisor, watchman, RCC contractor, mason, plumber, electrician',
            'Record name, phone, monthly cost, hire status',
            'Status workflow: Pending → Hired → Active → Completed',
            'Reminder: never pay >40% upfront to any contractor',
        ],
    },
    {
        icon: '📸', color: '#acbbff',
        title: 'Site Log & Photo Diary',
        bullets: [
            'Daily site log with date, time, and active stage auto-tagged',
            'Upload site photos — tagged to stage and date automatically',
            'Searchable record for disputes with builder or bank inspections',
            'Last 100 log entries and 50 photos stored locally',
        ],
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE VISUAL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SlideVisual({ visual, color }) {
    if (visual.type === 'dashboard') return (
        <div className={styles.vizDashboard}>
            {visual.items.map((item, i) => (
                <div key={i} className={styles.vizStatCard}>
                    <div className={styles.vizStatLabel}>{item.label}</div>
                    <div className={styles.vizStatValue} style={{ color: item.color }}>{item.value}</div>
                    {item.bar > 0 && (
                        <div className={styles.vizBarTrack}>
                            <div className={styles.vizBarFill} style={{ width: `${item.bar}%`, background: item.color }} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

    if (visual.type === 'stages') return (
        <div className={styles.vizStages}>
            {visual.items.map((item, i) => (
                <div key={i} className={styles.vizStageRow}>
                    <div className={styles.vizStageLabel}>{item.label}</div>
                    <div className={styles.vizStageRight}>
                        <span className={styles.vizStagePct} style={{ color: item.pct === 100 ? '#2DD4A0' : '#7A8499' }}>{item.pct}%</span>
                        <div className={styles.vizBarTrack} style={{ width: 60 }}>
                            <div className={styles.vizBarFill} style={{ width: `${item.pct}%`, background: item.pct === 100 ? '#2DD4A0' : item.color }} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    if (visual.type === 'materials') return (
        <div className={styles.vizMaterials}>
            {visual.items.map((item, i) => (
                <div key={i} className={styles.vizMatRow}>
                    <div className={styles.vizMatTop}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 7, height: 7, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                            <span className={styles.vizMatLabel}>{item.label}</span>
                        </div>
                        <span className={styles.vizMatReq}>{item.req.toLocaleString()} {item.unit}</span>
                    </div>
                    <div className={styles.vizBarTrack}>
                        <div className={styles.vizBarFill} style={{ width: `${Math.round(item.recv / item.req * 100)}%`, background: item.color }} />
                    </div>
                    <div className={styles.vizMatSub}>
                        <span style={{ color: '#7A8499' }}>Received: {item.recv.toLocaleString()}</span>
                    </div>
                </div>
            ))}
        </div>
    );

    if (visual.type === 'docs') return (
        <div className={styles.vizDocs}>
            {visual.groups.map((g, i) => (
                <div key={i} className={styles.vizDocRow}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: g.color, flexShrink: 0 }} />
                    <span className={styles.vizDocLabel}>{g.label}</span>
                    <span className={styles.vizDocCount} style={{ color: g.done === g.total ? '#2DD4A0' : '#7A8499' }}>{g.done}/{g.total}</span>
                    <div className={styles.vizBarTrack} style={{ width: 50 }}>
                        <div className={styles.vizBarFill} style={{ width: `${Math.round(g.done / g.total * 100)}%`, background: g.color }} />
                    </div>
                </div>
            ))}
        </div>
    );

    if (visual.type === 'budget') return (
        <div className={styles.vizBudget}>
            {visual.items.map((item, i) => {
                const pct = Math.round(item.spent / item.alloc * 100);
                return (
                    <div key={i} className={styles.vizBudRow}>
                        <div className={styles.vizBudTop}>
                            <span className={styles.vizBudLabel}>{item.label}</span>
                            <span className={styles.vizBudAmt} style={{ color: item.color }}>₹{item.spent}L / ₹{item.alloc}L</span>
                        </div>
                        <div className={styles.vizBarTrack}>
                            <div className={styles.vizBarFill} style={{ width: `${pct}%`, background: item.color }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LANDING COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function Landing({ onLogin, onRegister }) {
    const [activeSlide,     setActiveSlide]     = useState(0);
    const [showLoanModal,   setShowLoanModal]   = useState(false);
    const [expandedFeature, setExpandedFeature] = useState(null);

    // Auto-advance slideshow
    useEffect(() => {
        const t = setInterval(() => setActiveSlide(s => (s + 1) % SLIDES.length), 4000);
        return () => clearInterval(t);
    }, []);

    const prevSlide = useCallback(() => setActiveSlide(s => (s - 1 + SLIDES.length) % SLIDES.length), []);
    const nextSlide = useCallback(() => setActiveSlide(s => (s + 1) % SLIDES.length), []);

    const slide = SLIDES[activeSlide];

    return (
        <div className={styles.landing}>

            {/* ── HERO ─────────────────────────────────────────────── */}
            <section className={styles.hero}>
                <div className={styles.heroLeft}>
                    <div className={styles.heroBadge}>🏗 Construction Tracker for Investors</div>
                    <h1 className={styles.heroTitle}>
                        Track your build.<br />
                        <span className={styles.heroAccent}>Own the outcome.</span>
                    </h1>
                    <p className={styles.heroDesc}>
                        NirmanIQ gives plot owners and investors complete visibility into their construction project — without depending on the builder for updates. Stage-by-stage checklists, material tracking, budget control, government approvals and daily site logs, all in one place.
                    </p>
                    <div className={styles.heroActions}>
                        <button className={styles.btnPrimary} onClick={onRegister}>Get started free →</button>
                        <button className={styles.btnSecondary} onClick={onLogin}>Sign in</button>
                    </div>
                    <div className={styles.heroStats}>
                        <div className={styles.heroStat}><span className={styles.heroStatNum}>15</span><span className={styles.heroStatLbl}>stages</span></div>
                        <div className={styles.heroStatDiv} />
                        <div className={styles.heroStat}><span className={styles.heroStatNum}>100+</span><span className={styles.heroStatLbl}>checklists</span></div>
                        <div className={styles.heroStatDiv} />
                        <div className={styles.heroStat}><span className={styles.heroStatNum}>52</span><span className={styles.heroStatLbl}>approvals</span></div>
                        <div className={styles.heroStatDiv} />
                        <div className={styles.heroStat}><span className={styles.heroStatNum}>₹0</span><span className={styles.heroStatLbl}>to use</span></div>
                    </div>
                </div>

                {/* Animated mockup */}
                <div className={styles.heroRight}>
                    <div className={styles.phoneMock}>
                        <div className={styles.phoneScreen}>
                            <div className={styles.phoneBar} style={{ background: slide.color + '22', borderBottom: `0.5px solid ${slide.color}33` }}>
                                <span className={styles.phoneBarTitle}>NirmanIQ</span>
                                <span className={styles.phoneBarTag} style={{ color: slide.color, background: slide.color + '22' }}>{slide.tag}</span>
                            </div>
                            <div className={styles.phoneContent}>
                                <SlideVisual visual={slide.visual} color={slide.color} />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── SLIDESHOW ────────────────────────────────────────── */}
            <section className={styles.slideSection}>
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTag}>Platform Overview</div>
                    <h2 className={styles.sectionTitle}>Everything you need to track a construction project</h2>
                </div>

                <div className={styles.slideCard} style={{ borderColor: slide.color + '44' }}>
                    <div className={styles.slideLeft}>
                        <div className={styles.slideTag} style={{ color: slide.color, background: slide.color + '18' }}>{slide.tag}</div>
                        <h3 className={styles.slideTitle}>{slide.title}</h3>
                        <p className={styles.slideDesc}>{slide.desc}</p>
                        <div className={styles.slideDots}>
                            {SLIDES.map((s, i) => (
                                <button
                                    key={s.id}
                                    className={`${styles.slideDot} ${i === activeSlide ? styles.slideDotActive : ''}`}
                                    style={i === activeSlide ? { background: slide.color } : {}}
                                    onClick={() => setActiveSlide(i)}
                                />
                            ))}
                        </div>
                    </div>
                    <div className={styles.slideRight}>
                        <div className={styles.slideViz} style={{ borderColor: slide.color + '33' }}>
                            <SlideVisual visual={slide.visual} color={slide.color} />
                        </div>
                        <div className={styles.slideNav}>
                            <button className={styles.slideNavBtn} onClick={prevSlide}>‹</button>
                            <span className={styles.slideNavCount}>{activeSlide + 1} / {SLIDES.length}</span>
                            <button className={styles.slideNavBtn} onClick={nextSlide}>›</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── HOW IT WORKS FLOW ────────────────────────────────── */}
            <section className={styles.flowSection}>
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTag}>How It Works</div>
                    <h2 className={styles.sectionTitle}>From plot approval to moving in — tracked every step</h2>
                    <p className={styles.sectionSub}>NirmanIQ follows the exact sequence of a residential construction project. You always know what stage you are in, what is pending, and what comes next.</p>
                </div>

                <div className={styles.flowGrid}>
                    {FLOW_STEPS.map((step, i) => (
                        <div key={step.num} className={styles.flowCard}>
                            {/* Connector line */}
                            {i < FLOW_STEPS.length - 1 && <div className={styles.flowConnector} />}
                            <div className={styles.flowNum} style={{ color: step.color, borderColor: step.color + '44', background: step.color + '12' }}>
                                {step.num}
                            </div>
                            <div className={styles.flowIcon}>{step.icon}</div>
                            <div className={styles.flowTitle}>{step.title}</div>
                            <div className={styles.flowDesc}>{step.desc}</div>
                        </div>
                    ))}
                </div>

                {/* Flow arrow diagram */}
                <div className={styles.flowDiagram}>
                    {FLOW_STEPS.map((step, i) => (
                        <React.Fragment key={step.num}>
                            <div className={styles.flowDiagStep} style={{ borderColor: step.color + '55', background: step.color + '0E' }}>
                                <span style={{ fontSize: 16 }}>{step.icon}</span>
                                <span className={styles.flowDiagLabel} style={{ color: step.color }}>{step.title}</span>
                            </div>
                            {i < FLOW_STEPS.length - 1 && (
                                <div className={styles.flowDiagArrow}>→</div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </section>

            {/* ── FEATURE DEEP DIVES ───────────────────────────────── */}
            <section className={styles.featSection}>
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTag}>Features</div>
                    <h2 className={styles.sectionTitle}>Built specifically for residential construction in India</h2>
                </div>

                <div className={styles.featGrid}>
                    {FEATURES_DEEP.map((f, i) => (
                        <div
                            key={f.title}
                            className={`${styles.featCard} ${expandedFeature === i ? styles.featCardOpen : ''}`}
                            style={{ borderColor: expandedFeature === i ? f.color + '55' : 'var(--border)' }}
                        >
                            <button className={styles.featHeader} onClick={() => setExpandedFeature(expandedFeature === i ? null : i)}>
                                <div className={styles.featIconWrap} style={{ background: f.color + '18', color: f.color }}>
                                    {f.icon}
                                </div>
                                <div className={styles.featTitleWrap}>
                                    <div className={styles.featTitle}>{f.title}</div>
                                </div>
                                <div className={styles.featChevron} style={{ color: f.color }}>{expandedFeature === i ? '▲' : '▼'}</div>
                            </button>
                            {expandedFeature === i && (
                                <ul className={styles.featList}>
                                    {f.bullets.map((b, j) => (
                                        <li key={j} className={styles.featBullet}>
                                            <span className={styles.featBulletDot} style={{ background: f.color }} />
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* ── BANK LOAN SECTION ────────────────────────────────── */}
            <section className={styles.loanSection}>
                <div className={styles.loanCard}>
                    <div className={styles.loanLeft}>
                        <div className={styles.sectionTag} style={{ color: '#6699FF', background: '#6699FF18', border: '0.5px solid #6699FF33' }}>
                            🏦 Bank Construction Loan
                        </div>
                        <h2 className={styles.loanTitle}>Planning to finance your construction?</h2>
                        <p className={styles.loanDesc}>
                            A construction loan disburses in stages — not as a lump sum. Banks send a technical officer before every disbursement to verify stage completion. NirmanIQ's loan checklist walks you through all 8 steps from eligibility to final disbursement.
                        </p>
                        <div className={styles.loanHighlights}>
                            <div className={styles.loanHL}><span className={styles.loanHLNum}>8</span><span className={styles.loanHLLbl}>steps to sanction</span></div>
                            <div className={styles.loanHL}><span className={styles.loanHLNum}>44</span><span className={styles.loanHLLbl}>checklist items</span></div>
                            <div className={styles.loanHL}><span className={styles.loanHLNum}>5</span><span className={styles.loanHLLbl}>disbursement stages</span></div>
                        </div>
                        <button className={styles.btnLoan} onClick={() => setShowLoanModal(true)}>
                            View loan checklist →
                        </button>
                    </div>
                    <div className={styles.loanRight}>
                        <div className={styles.loanSteps}>
                            {LOAN_OVERVIEW.map((s, i) => (
                                <div key={s.step} className={styles.loanStep}>
                                    <div className={styles.loanStepNum} style={{ background: s.color + '22', color: s.color, borderColor: s.color + '44' }}>
                                        {s.step}
                                    </div>
                                    <div className={styles.loanStepInfo}>
                                        <div className={styles.loanStepTitle}>{s.title}</div>
                                        <div className={styles.loanStepDesc}>{s.desc}</div>
                                    </div>
                                    {i < LOAN_OVERVIEW.length - 1 && (
                                        <div className={styles.loanStepLine} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FINAL CTA ────────────────────────────────────────── */}
            <section className={styles.ctaSection}>
                <div className={styles.ctaCard}>
                    <div className={styles.ctaGlow} />
                    <h2 className={styles.ctaTitle}>Ready to track your project?</h2>
                    <p className={styles.ctaDesc}>
                        Built for the Vizag and AP market. Uses real GVMC, APDPMS and AP SCS 2025 requirements. Free to use — your data stays on your device.
                    </p>
                    <div className={styles.ctaActions}>
                        <button className={styles.btnPrimary} style={{ fontSize: 15, padding: '14px 32px' }} onClick={onRegister}>
                            Register your project
                        </button>
                        <button className={styles.btnSecondary} onClick={onLogin}>
                            Already have an account
                        </button>
                    </div>
                </div>
            </section>

            {/* ── BANK LOAN MODAL ──────────────────────────────────── */}
            {showLoanModal && (
                <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowLoanModal(false)}>
                    <div className={styles.modalBox}>
                        <div className={styles.modalHeader}>
                            <div>
                                <div className={styles.modalTitle}>🏦 Bank Construction Loan Checklist</div>
                                <div className={styles.modalSub}>8 steps · 44 items · Stage-wise disbursement</div>
                            </div>
                            <button className={styles.modalClose} onClick={() => setShowLoanModal(false)}>✕</button>
                        </div>
                        <div className={styles.modalBody}>
                            {LOAN_OVERVIEW.map((s) => (
                                <div key={s.step} className={styles.modalStep}>
                                    <div className={styles.modalStepNum} style={{ background: s.color + '20', color: s.color }}>
                                        {s.step}
                                    </div>
                                    <div>
                                        <div className={styles.modalStepTitle}>{s.title}</div>
                                        <div className={styles.modalStepDesc}>{s.desc}</div>
                                    </div>
                                </div>
                            ))}
                            <div className={styles.modalInfo}>
                                💡 The full interactive checklist with item-level guidance is available after you register and select your project.
                            </div>
                            <div className={styles.modalActions}>
                                <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={() => { setShowLoanModal(false); onRegister(); }}>
                                    Register to access full checklist →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
