import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getStorage, setStorage, saveProject } from '../utils/api.js';
import {
    estimateMaterials,
    estimateBudget,
    computeSlabArea,
    suggestFloors,
} from '../utils/estimator.js';
import { fmtINR } from '../utils/format.js';
import styles from './ProjectReg.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — defined at module level so they are stable references
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
    { id: 'plan', icon: '📋', label: 'Upload Plan' },
    { id: 'identity', icon: '🏷', label: 'Identity' },
    { id: 'plot', icon: '📐', label: 'Plot & Site' },
    { id: 'construction', icon: '🏗', label: 'Construction' },
    { id: 'budget', icon: '💰', label: 'Budget' },
    { id: 'documents', icon: '📄', label: 'Documents' },
    { id: 'review', icon: '✅', label: 'Review' },
];

const DIRECTIONS = [
    'North',
    'South',
    'East',
    'West',
    'North-East',
    'North-West',
    'South-East',
    'South-West',
];
const FLOOR_TYPES = ['G only', 'G+1', 'G+2', 'G+3', 'S+G+1', 'S+G+2', 'S+G+3'];

// multi: true  → stores an array of file objects
// multi: false → stores a single file object (legacy)
const DOC_SLOTS = [
    {
        id: 'structuralDrawings',
        label: 'Structural Drawings',
        icon: '🏗',
        accept: '.pdf,.jpg,.jpeg,.png',
        note: 'Foundation plan, column schedule, beam layout, slab reinforcement details — upload all sheets',
        multi: true,
        color: '#388BFD',
    },
    {
        id: 'soilTestReport',
        label: 'Soil Test Report',
        icon: '🧪',
        accept: '.pdf,.jpg,.jpeg,.png',
        note: 'SBC value, depth of foundation, soil classification (Andhra University lab report)',
        multi: false,
        color: '#D29922',
    },
    {
        id: 'elevationDrawing',
        label: 'Elevation Drawings',
        icon: '🏢',
        accept: '.pdf,.jpg,.jpeg,.png',
        note: 'Front, side and rear elevations — upload all views',
        multi: true,
        color: '#3FB950',
    },
    {
        id: 'slabDesign',
        label: 'Slab Design Documents',
        icon: '📐',
        accept: '.pdf,.jpg,.jpeg,.png',
        note: 'Slab reinforcement schedule, mix design — upload all slab drawings',
        multi: true,
        color: '#8957E5',
    },
    {
        id: 'builderContract',
        label: 'Builder Contract / Quote',
        icon: '📝',
        accept: '.pdf,.jpg,.jpeg,.png',
        note: 'Signed agreement, quotation, or rate schedule from builder — all pages',
        multi: true,
        color: '#F85149',
    },
];

// IDs that support multiple files
const MULTI_DOC_IDS = new Set(DOC_SLOTS.filter(s => s.multi).map(s => s.id));

function formatNumber(value, decimals = 1) {
    return Number(value).toFixed(decimals);
}

function ftToMeters(ft) {
    return Number(ft) * 0.3048;
}

function ftToYards(ft) {
    return Number(ft) * 0.3333333333;
}

function metresToFeet(m) {
    return Number(m) / 0.3048;
}

function formatLengthUnits(value) {
    if (value === '' || value === null || value === undefined) return '?';
    return `${value} ft / ${formatNumber(ftToMeters(value))} m / ${formatNumber(ftToYards(value))} yd`;
}

function formatPlotDimensionsUnits(lengthFt, widthFt) {
    if (!lengthFt || !widthFt) return '';
    return `${lengthFt} \u00D7 ${widthFt} ft / ${formatNumber(ftToMeters(lengthFt))} \u00D7 ${formatNumber(ftToMeters(widthFt))} m / ${formatNumber(ftToYards(lengthFt))} \u00D7 ${formatNumber(ftToYards(widthFt))} yd`;
}

function formatAreaUnits(lengthFt, widthFt) {
    const l = Number(lengthFt);
    const w = Number(widthFt);
    if (!l || !w) return '';
    const sqft = l * w;
    const sqm = sqft * 0.092903;
    const sqyd = sqft / 9;
    return `${Number(sqft).toFixed(0)} sqft · ${formatNumber(sqm)} sqm · ${formatNumber(sqyd)} sqyd`;
}

function formatRoadWidthUnits(m) {
    if (m === '' || m === null || m === undefined) return '?';
    return `${m} m / ${formatNumber(metresToFeet(m))} ft`;
}

function numberToWordsIndian(value) {
    const num = Math.round(Number(value) || 0);
    if (num === 0) return 'Zero rupees';
    const units = [
        '',
        'One',
        'Two',
        'Three',
        'Four',
        'Five',
        'Six',
        'Seven',
        'Eight',
        'Nine',
        'Ten',
        'Eleven',
        'Twelve',
        'Thirteen',
        'Fourteen',
        'Fifteen',
        'Sixteen',
        'Seventeen',
        'Eighteen',
        'Nineteen',
    ];
    const tens = [
        '',
        '',
        'Twenty',
        'Thirty',
        'Forty',
        'Fifty',
        'Sixty',
        'Seventy',
        'Eighty',
        'Ninety',
    ];
    const inWords = (n) => {
        if (n < 20) return units[n];
        if (n < 100)
            return `${tens[Math.floor(n / 10)]}${n % 10 ? ' ' + units[n % 10] : ''}`;
        if (n < 1000)
            return `${units[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + inWords(n % 100) : ''}`;
        return '';
    };
    const parts = [];
    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const hundred = num % 1000;
    if (crore) parts.push(`${inWords(crore)} Crore`);
    if (lakh) parts.push(`${inWords(lakh)} Lakh`);
    if (thousand) parts.push(`${inWords(thousand)} Thousand`);
    if (hundred) parts.push(inWords(hundred));
    return `${parts.join(' ')} Rupees`;
}

function getPlotSizing(lengthFt, widthFt) {
    const lengthNum = Number(lengthFt);
    const widthNum = Number(widthFt);
    if (!lengthNum || !widthNum) return { width: 320, height: 220 };
    const maxSide = 360;
    const minSide = 180;
    const scale = maxSide / Math.max(lengthNum, widthNum);
    return {
        width: Math.min(maxSide, Math.max(minSide, widthNum * scale)),
        height: Math.min(maxSide, Math.max(minSide, lengthNum * scale)),
    };
}

function getRoadPosition(plotFacing) {
    if (!plotFacing) return 'bottom';
    const dir = plotFacing.toLowerCase();
    if (dir.includes('north')) return 'top';
    if (dir.includes('south')) return 'bottom';
    if (dir.includes('east')) return 'right';
    if (dir.includes('west')) return 'left';
    return 'bottom';
}

function getRoadStyle(position, innerWidth, innerHeight) {
    const gap = 18;
    const base = {
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--border)',
        color: 'var(--hint)',
        borderRadius: '4px',
    };
    if (position === 'top') {
        return {
            ...base,
            top: 0,
            left: `calc(50% - ${innerWidth / 2}px)`,
            width: `${innerWidth}px`,
            height: 18,
            borderRadius: '0 0 4px 4px',
        };
    }
    if (position === 'bottom') {
        return {
            ...base,
            top: `calc(20px + ${innerHeight}px + ${gap}px)`,
            left: `calc(50% - ${innerWidth / 2}px)`,
            width: `${innerWidth}px`,
            height: 18,
            borderRadius: '4px 4px 0 0',
        };
    }
    if (position === 'left') {
        return {
            ...base,
            top: 20,
            left: `calc(50% - ${innerWidth / 2}px - 18px - ${gap}px)`,
            width: 18,
            height: `${innerHeight}px`,
            borderRadius: '0 4px 4px 0',
        };
    }
    return {
        ...base,
        top: 20,
        left: `calc(50% + ${innerWidth / 2}px + ${gap}px)`,
        width: 18,
        height: `${innerHeight}px`,
        borderRadius: '4px 0 0 4px',
    };
}

const INIT = {
    projectName: '',
    ownerName: '',
    siteAddress: '',
    approvalNumber: '',
    locality: '',
    city: 'Visakhapatnam',
    surveyNo: '',
    plotLength: '',
    plotWidth: '',
    plotArea: '',
    facing: 'South',
    roadWidth: '',
    floorConfig: 'S+G+2',
    hasStilt: true,
    totalFloors: 4,
    floorHeight: '10.5',
    hasLift: false,
    hasLiftRoom: false,
    hasTerraceRoom: false,
    terraceLength: '',
    terraceWidth: '',
    liftRoomLength: '',
    liftRoomWidth: '',
    setbackFront: '0',
    setbackBack: '0',
    setbackLeft: '0',
    setbackRight: '0',
    slabArea: '',
    boreWellDepth: '350',
    builderName: '',
    startDate: '',
    durationMonths: '20',
    totalBudget: '',
    builderQuote: '',
    loanAmount: '',
    selfFunds: '',
    ratePerSft: '2100',
    docs: {},
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED FIELD COMPONENTS — defined OUTSIDE main component to keep stable refs
// This is the fix for the focus-loss bug. When components are defined inside
// the render function, React sees them as new component types on every render
// and unmounts + remounts them, causing the input to lose focus after every keystroke.
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, id, required, hint, error, children }) {
    return (
        <div className={styles.field}>
            <label htmlFor={id} className={styles.fieldLabel}>
                {label}
                {required && <span className={styles.req}> *</span>}
            </label>
            {children}
            {hint && <div className={styles.fieldHint}>{hint}</div>}
            {error && <div className={styles.fieldError}>{error}</div>}
        </div>
    );
}

function TextInput({
    id,
    type = 'text',
    placeholder = '',
    value,
    onChange,
    readOnly,
    hasError,
}) {
    return (
        <input
            id={id}
            type={type}
            value={value ?? ''}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            readOnly={readOnly}
            className={[
                hasError ? styles.inputError : '',
                readOnly ? styles.readOnly : '',
            ].join(' ')}
        />
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// FEET-INCHES INPUT
// Accepts: "60", "3'3"", "3-3", "3.25", "3 3"
// Stores as decimal feet string (e.g. "3.25") for all calculations.
// ─────────────────────────────────────────────────────────────────────────────
function parseFtIn(raw) {
    if (!raw && raw !== 0) return '';
    const s = String(raw).trim();
    // Match patterns: 3'3", 3'3, 3-3, 3 3, 3.25, 60
    const ftInMatch = s.match(/^(\d+(?:\.\d+)?)[\s\'\'\-]+(\d+(?:\.\d+)?)[""]?$/);
    if (ftInMatch) {
        const ft = parseFloat(ftInMatch[1]);
        const inn = parseFloat(ftInMatch[2]);
        return String(+(ft + inn / 12).toFixed(4)).replace(/\.?0+$/, '') || '';
    }
    // Just feet (decimal or integer)
    const num = parseFloat(s);
    return isNaN(num) ? '' : String(num);
}

function decimalToFtIn(decStr) {
    const dec = parseFloat(decStr);
    if (!dec && dec !== 0) return { ft: '', inn: '' };
    const ft = Math.floor(dec);
    const inn = Math.round((dec - ft) * 12);
    if (inn === 0) return { ft: String(ft), inn: '' };
    if (inn === 12) return { ft: String(ft + 1), inn: '' };
    return { ft: String(ft), inn: String(inn) };
}

function FtInInput({ id, value, onChange, placeholder = "e.g. 60 or 3′3″", hasError }) {
    const { ft, inn } = decimalToFtIn(value);
    const [ftVal, setFtVal] = React.useState(ft);
    const [inVal, setInVal] = React.useState(inn);
    const [rawMode, setRawMode] = React.useState(false);
    const [rawVal, setRawVal] = React.useState(value || '');

    // Sync when parent value changes externally (e.g. AI pre-fill)
    React.useEffect(() => {
        const { ft: f2, inn: i2 } = decimalToFtIn(value);
        setFtVal(f2);
        setInVal(i2);
        setRawVal(value || '');
    }, [value]);

    const commit = (newFt, newIn) => {
        const ftNum = parseFloat(newFt) || 0;
        const inNum = parseFloat(newIn) || 0;
        const dec = ftNum + inNum / 12;
        const result = dec > 0 ? String(+(dec.toFixed(4)).replace(/\.?0+$/, '')) : '';
        onChange(result);
    };

    // Detect if user types apostrophe/quote — switch to raw parse mode
    const handleFtKey = (e) => {
        const v = e.target.value;
        if (v.includes("'") || v.includes('"') || v.includes('-') || /\d\s+\d/.test(v)) {
            const parsed = parseFtIn(v);
            if (parsed) { onChange(parsed); }
            return;
        }
        setFtVal(v);
        commit(v, inVal);
    };

    const decVal = value ? `= ${value} ft` : '';

    return (
        <div className={styles.ftInWrap}>
            <div className={styles.ftInRow}>
                <input
                    id={id}
                    type="number"
                    min="0"
                    step="1"
                    className={[styles.ftInput, hasError ? styles.inputError : ''].join(' ')}
                    value={ftVal}
                    placeholder="ft"
                    onChange={(e) => { setFtVal(e.target.value); commit(e.target.value, inVal); }}
                    onBlur={(e) => {
                        const parsed = parseFtIn(e.target.value);
                        if (parsed) { const {ft:f2,inn:i2}=decimalToFtIn(parsed); setFtVal(f2); setInVal(i2); onChange(parsed); }
                    }}
                />
                <span className={styles.ftInUnit}>′</span>
                <input
                    type="number"
                    min="0"
                    max="11"
                    step="1"
                    className={styles.inInput}
                    value={inVal}
                    placeholder="in"
                    onChange={(e) => { setInVal(e.target.value); commit(ftVal, e.target.value); }}
                />
                <span className={styles.ftInUnit}>″</span>
            </div>
            {inVal && Number(inVal) > 0 && (
                <div className={styles.ftInDecimal}>{value} ft decimal</div>
            )}
        </div>
    );
}

function SelectInput({ id, options, value, onChange }) {
    return (
        <select
            id={id}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
        >
            {options.map((o) => (
                <option key={o.value ?? o} value={o.value ?? o}>
                    {o.label ?? o}
                </option>
            ))}
        </select>
    );
}

function ToggleBtn({ value, onChange, yes = '✓ Yes', no = 'No' }) {
    return (
        <button
            type="button"
            className={`${styles.toggleBtn} ${value ? styles.toggleOn : ''}`}
            onClick={() => onChange(!value)}
        >
            {value ? yes : no}
        </button>
    );
}

function ReviewBlock({ title, color, items }) {
    return (
        <div
            className={styles.reviewBlock}
            style={{ borderColor: color + '44' }}
        >
            <div className={styles.reviewBlockTitle} style={{ color }}>
                {title}
            </div>
            {items
                .filter(
                    ([, v]) =>
                        v !== '' &&
                        v !== undefined &&
                        v !== null &&
                        v !== false,
                )
                .map(([k, v]) => (
                    <div key={k} className={styles.reviewRow}>
                        <span className={styles.reviewKey}>{k}</span>
                        <span className={styles.reviewVal}>{String(v)}</span>
                    </div>
                ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAN UPLOAD — Step 0
// Asks for the approved plan first, then uses Claude AI to extract project data
// ─────────────────────────────────────────────────────────────────────────────

function PlanUploadStep({ form, onFormUpdate, onFile, fileRefs, onPreview }) {
    const [extracting, setExtracting] = useState(false);
    const [extracted, setExtracted] = useState(false);
    const [extractMsg, setExtractMsg] = useState('');
    const [extractError, setExtractError] = useState('');
    const [extractedRawText, setExtractedRawText] = useState('');
    const [extractedFields, setExtractedFields] = useState({});
    const [manualMappings, setManualMappings] = useState({});
    const planUploaded = !!form.docs.approvedPlan;

    const handlePlanFile = useCallback(
        (file) => {
            if (!file) return;
            onFile('approvedPlan', file, async (docObj) => {
                // Try AI vision analysis after upload
                const result = await runDocumentAnalysis(
                    { approvedPlan: docObj },
                    onFormUpdate,
                    setExtracting,
                    setExtracted,
                    setExtractMsg,
                    setExtractError,
                    setExtractedRawText,
                );
                if (result) {
                    setExtractedFields(result.fields || {});
                    setManualMappings(result.fields || {});
                    setExtractedRawText(result.text || '');
                }
            });
        },
        [onFile, onFormUpdate],
    );

    return (
        <div className={styles.stepSection}>
            <div className={styles.stepHeading}>
                <div className={styles.stepNum}>📋</div>
                <div>
                    <div className={styles.stepTitle}>
                        Upload Approved Building Plan
                    </div>
                    <div className={styles.stepSub}>
                        Upload your GVMC / APDPMS approved plan — the app will
                        automatically extract plot dimensions, floors, approval
                        number and address
                    </div>
                </div>
            </div>

            {/* Upload zone */}
            <div
                className={`${styles.planUploadZone} ${planUploaded ? styles.planUploaded : ''}`}
                onClick={() => fileRefs.current.approvedPlan?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    handlePlanFile(e.dataTransfer.files[0]);
                }}
            >
                <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    ref={(el) => (fileRefs.current.approvedPlan = el)}
                    onChange={(e) => handlePlanFile(e.target.files[0])}
                    style={{ display: 'none' }}
                />
                {!planUploaded ? (
                    <>
                        <div className={styles.planUploadIcon}>📋</div>
                        <div className={styles.planUploadTitle}>
                            Drop your approved plan here
                        </div>
                        <div className={styles.planUploadSub}>
                            PDF, JPG or PNG · Click to browse
                        </div>
                        <div className={styles.planUploadNote}>
                            GVMC / APDPMS approved plan — the document that
                            shows your building permission order, plot
                            dimensions, floor configuration and address
                        </div>
                    </>
                ) : (
                    <>
                        <div className={styles.planUploadDone}>✓</div>
                        <div
                            className={styles.planUploadTitle}
                            style={{ color: 'var(--green)' }}
                        >
                            {form.docs.approvedPlan.name}
                        </div>
                        <div className={styles.planUploadSub}>
                            {(form.docs.approvedPlan.size / 1024).toFixed(0)} KB
                            · Uploaded {form.docs.approvedPlan.uploaded}
                        </div>
                        <button
                            type="button"
                            className={styles.planReplaceBtn}
                            onClick={(e) => {
                                e.stopPropagation();
                                fileRefs.current.approvedPlan?.click();
                            }}
                        >
                            Replace file
                        </button>
                    </>
                )}
            </div>

            {/* Extraction status */}
            {extracting && (
                <div className={styles.extractingBox}>
                    <div className={styles.extractingSpinner} />
                    <div>
                        <div className={styles.extractingTitle}>
                            Reading your plan…
                        </div>
                        <div className={styles.extractingMsg}>
                            {extractMsg ||
                                'Extracting project details from the document'}
                        </div>
                    </div>
                </div>
            )}

            {extracted && !extracting && (
                <div className={styles.extractedBox}>
                    <div className={styles.extractedIcon}>✓</div>
                    <div>
                        <div className={styles.extractedTitle}>
                            Details extracted successfully
                        </div>
                        <div className={styles.extractedMsg}>
                            Review and edit the pre-filled information in the
                            next steps
                        </div>
                    </div>
                </div>
            )}

            {extractError && !extracting && (
                <div className={styles.extractErrorBox}>
                    <div className={styles.extractErrorTitle}>
                        Extraction failed
                    </div>
                    <div className={styles.extractErrorMsg}>{extractError}</div>
                </div>
            )}

            {extractedRawText && !extracting && (
                <div className={styles.extractRawTextBox}>
                    <div className={styles.extractRawTextTitle}>
                        Raw extracted text
                    </div>
                    <pre className={styles.extractRawTextContent}>
                        {extractedRawText}
                    </pre>
                </div>
            )}

            {/* What gets extracted preview */}
            {!planUploaded && (
                <div className={styles.extractPreviewCard}>
                    <div className={styles.extractPreviewTitle}>
                        What will be auto-extracted
                    </div>
                    <div className={styles.extractPreviewGrid}>
                        {[
                            { icon: '📍', label: 'Site address & plot number' },
                            {
                                icon: '📐',
                                label: 'Plot dimensions (length \u00D7 width)',
                            },
                            {
                                icon: '🏛',
                                label: 'Floor configuration (G+2, S+G+2 etc.)',
                            },
                            {
                                icon: '📋',
                                label: 'Approval number (BPO reference)',
                            },
                            { icon: '🧭', label: 'Plot facing direction' },
                            {
                                icon: '🏢',
                                label: 'Building height and setbacks',
                            },
                        ].map((i) => (
                            <div
                                key={i.label}
                                className={styles.extractPreviewItem}
                            >
                                <span>{i.icon}</span>
                                <span>{i.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className={styles.extractPreviewNote}>
                        All extracted values are editable. If extraction misses
                        anything, you can fill it in manually in the following
                        steps.
                    </div>
                </div>
            )}

            {/* Extracted fields preview */}
            {extracted && !extracting && (
                <div className={styles.extractedFields}>
                    <div className={styles.extractedFieldsTitle}>
                        Pre-filled from your plan — review in next steps
                    </div>
                    <div className={styles.extractedFieldsGrid}>
                        {[
                            ['Approval number', form.approvalNumber],
                            [
                                'Plot dimensions',
                                form.plotLength && form.plotWidth
                                    ? `${form.plotLength} \u00D7 ${form.plotWidth} ft`
                                    : '',
                            ],
                            ['Facing', form.facing],
                            ['Floor config', form.floorConfig],
                            ['Address', form.siteAddress],
                            ['Owner', form.ownerName],
                        ]
                            .filter(([, v]) => v)
                            .map(([k, v]) => (
                                <div
                                    key={k}
                                    className={styles.extractedFieldItem}
                                >
                                    <div className={styles.extractedFieldKey}>
                                        {k}
                                    </div>
                                    <div className={styles.extractedFieldVal}>
                                        {v}
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {Object.keys(extractedFields).length > 0 && !extracting && (
                <div className={styles.mappingPanel}>
                    <div className={styles.mappingPanelTitle}>
                        Manual mapping
                    </div>
                    <div className={styles.mappingPanelNote}>
                        Edit the automated values below if the extracted text
                        does not match your plan layout, then apply the mapping
                        to populate the registration form.
                    </div>
                    <div className={styles.mappingGrid}>
                        {[
                            ['Building approval number', 'approvalNumber'],
                            ['Site address', 'siteAddress'],
                            ['Locality / Colony', 'locality'],
                            ['City / District', 'city'],
                            ['Plot length (ft)', 'plotLength'],
                            ['Plot width (ft)', 'plotWidth'],
                            ['Facing direction', 'facing'],
                            ['Road width (m)', 'roadWidth'],
                            ['Floor configuration', 'floorConfig'],
                            ['Builder / contractor name', 'builderName'],
                            ['Project name', 'projectName'],
                            ['Owner name', 'ownerName'],
                        ].map(([label, key]) => (
                            <Field key={key} label={label} id={`map-${key}`}>
                                <TextInput
                                    id={`map-${key}`}
                                    value={manualMappings[key] ?? ''}
                                    onChange={(v) =>
                                        setManualMappings((m) => ({
                                            ...m,
                                            [key]: v,
                                        }))
                                    }
                                />
                            </Field>
                        ))}
                    </div>
                    <div className={styles.mappingActions}>
                        <button
                            type="button"
                            className={styles.btnPrimary}
                            onClick={() => {
                                onFormUpdate(manualMappings);
                                setExtractedFields(manualMappings);
                            }}
                        >
                            Apply mapping
                        </button>
                        <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={() => setManualMappings(extractedFields)}
                        >
                            Reset to extracted
                        </button>
                    </div>
                </div>
            )}

            {/* Skip option */}
            <div className={styles.planSkipNote}>
                Don't have the digital plan handy?{' '}
                <span className={styles.planSkipLink}>
                    Skip this step — you can upload it later and fill in details
                    manually.
                </span>
            </div>
        </div>
    );
}

// AI extraction using Claude API
async function runDocumentAnalysis(
    docs, // { approvedPlan, structuralDrawings, ... }
    onFormUpdate,
    setExtracting,
    setExtracted,
    setExtractMsg,
    setExtractError,
    setExtractedRawText,
) {
    setExtracting(true);
    setExtractError('');
    setExtractedRawText('');
    setExtractMsg('Sending documents to AI for analysis…');
    let success = false;
    let returnVal = null;

    try {
        // Filter to only docs that are ready (have base64 data)
        const readyDocs = {};
        for (const [id, doc] of Object.entries(docs)) {
            if (doc && doc.data) readyDocs[id] = doc;
        }
        if (Object.keys(readyDocs).length === 0) {
            throw new Error('No documents with data to analyze');
        }

        setExtractMsg('Claude is reading your plans and drawings…');
        const result = await analyzeDocuments(readyDocs);

        if (!result.success) {
            throw new Error('Analysis returned failure');
        }

        // ── Map projectFields → form ─────────────────────────────────
        const pf = result.projectFields || {};
        const updates = {};

        const fieldMap = {
            projectName: pf.projectName,
            ownerName: pf.ownerName,
            approvalNumber: pf.approvalNumber,
            siteAddress: pf.siteAddress,
            locality: pf.locality,
            city: pf.city || 'Visakhapatnam',
            plotLength: pf.plotLength,
            plotWidth: pf.plotWidth,
            facing: pf.facing,
            roadWidth: pf.roadWidth,
            builderName: pf.builderName,
            floorHeight: pf.floorHeight,
            // Soil test data
            sbcValue: pf.sbcValue,
            fodDepth: pf.fodDepth,
        };
        Object.entries(fieldMap).forEach(([key, val]) => {
            if (val !== null && val !== undefined && String(val).trim()) {
                updates[key] = String(val).trim();
            }
        });

        // Floor config
        if (pf.floorConfig) {
            updates.floorConfig = pf.floorConfig;
            updates.hasStilt =
                pf.hasStilt === true ||
                pf.hasStilt === 'true' ||
                /stilt|S\+/i.test(pf.floorConfig);
            updates.totalFloors = pf.totalFloors
                ? Number(pf.totalFloors)
                : updates.hasStilt
                  ? 4
                  : 3;
        }
        // lift detection removed — ignore pf.hasLift

        onFormUpdate(updates);

        // ── Show material schedule summary as raw text ────────────────
        if (result.materialSchedule) {
            const ms = result.materialSchedule;
            const lines = [
                `📊 Material schedule extracted from drawings`,
                ``,
                `STEEL:`,
                ...(ms.steel || []).map(
                    (s) =>
                        `  ${s.dia} TMT (${s.grade}): ${s.qty_mt} MT — ${s.use}`,
                ),
                ``,
                `CONCRETE:`,
                ...(ms.concrete || []).map(
                    (c) => `  ${c.grade}: ${c.volume_cum} cum — ${c.use}`,
                ),
                ``,
                `CEMENT: OPC 53 = ${ms.cement_bags?.opc53 || 0} bags, PPC = ${ms.cement_bags?.ppc || 0} bags`,
                `SAND: ${ms.sand_cum || 0} cum | AGG 20mm: ${ms.aggregate_20mm_cum || 0} cum`,
                `BRICKS: ${(ms.bricks?.total_nos || 0).toLocaleString()} nos`,
                ``,
                result.materialSchedule.notes
                    ? `Notes: ${result.materialSchedule.notes}`
                    : '',
            ].filter((l) => l !== undefined);
            setExtractedRawText(lines.join('\n'));
        }

        // ── Cost estimate: store in form for budget step ──────────────
        if (result.costEstimate) {
            const ce = result.costEstimate;
            if (ce.total)
                onFormUpdate({
                    totalBudget: String(ce.total),
                    builderQuote: String(ce.total),
                    ratePerSft: String(Math.round(ce.rate_per_sft || 2100)),
                });
        }

        setExtracted(true);
        success = true;
        returnVal = result;
        setExtractMsg(
            `Analysis complete. ${result.docsAnalyzed?.join(', ')} read successfully. Review pre-filled values below.`,
        );
    } catch (err) {
        console.warn('Document analysis failed:', err);
        setExtracted(false);
        setExtractError(
            `AI analysis failed: ${err.message}. ` +
                'You can fill the details manually, or check that the backend is running (cd backend && uvicorn app.main:app --port 5174).',
        );
        setExtractMsg('');
    } finally {
        setExtracting(false);
        if (!success) setExtractMsg('');
    }
    return returnVal;
}



// ─────────────────────────────────────────────────────────────────────────────
// DOCS STEP — tabbed multi-document uploader (Step 5)
// ─────────────────────────────────────────────────────────────────────────────
function DocsStep({ form, handleFile, removeDocFile, fileRefs, setPreview, setForm }) {
    const [activeTab, setActiveTab] = React.useState('structuralDrawings');
    const activeSlot = DOC_SLOTS.find(s => s.id === activeTab);

    // Count total uploaded files
    const totalUploaded = Object.entries(form.docs).reduce((sum, [id, val]) =>
        sum + (Array.isArray(val) ? val.length : (val ? 1 : 0)), 0);

    // Per-slot upload count
    const slotCount = (id) => {
        const val = form.docs[id];
        return Array.isArray(val) ? val.length : (val ? 1 : 0);
    };

    return (
        <div className={styles.stepSection}>
            <div className={styles.stepHeading}>
                <div className={styles.stepNum}>📄</div>
                <div>
                    <div className={styles.stepTitle}>Project Documents</div>
                    <div className={styles.stepSub}>
                        Upload structural drawings, elevations, slab designs and builder contract.
                        Multiple files supported per category.
                    </div>
                </div>
            </div>

            {/* Upload summary */}
            <div className={styles.docSummaryBar}>
                <span className={styles.docSummaryCount}>
                    {totalUploaded} file{totalUploaded !== 1 ? 's' : ''} uploaded
                </span>
                {totalUploaded > 0 && (
                    <span className={styles.docSummaryHint}>
                        AI will read all documents for material estimates
                    </span>
                )}
            </div>

            {/* Tab bar */}
            <div className={styles.docTabBar}>
                {DOC_SLOTS.map(slot => {
                    const cnt = slotCount(slot.id);
                    return (
                        <button
                            key={slot.id}
                            type="button"
                            className={`${styles.docTab} ${activeTab === slot.id ? styles.docTabActive : ''}`}
                            style={activeTab === slot.id ? { borderBottomColor: slot.color, color: slot.color } : {}}
                            onClick={() => setActiveTab(slot.id)}
                        >
                            <span className={styles.docTabIcon}>{slot.icon}</span>
                            <span className={styles.docTabLabel}>{slot.label}</span>
                            {cnt > 0 && (
                                <span
                                    className={styles.docTabBadge}
                                    style={{ background: slot.color }}
                                >
                                    {cnt}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Active tab content */}
            {activeSlot && (
                <div className={styles.docTabContent}>
                    {/* Slot description */}
                    <div className={styles.docSlotHeader}>
                        <div className={styles.docSlotIconLg}>{activeSlot.icon}</div>
                        <div>
                            <div className={styles.docSlotTitle}>{activeSlot.label}</div>
                            <div className={styles.docSlotNote}>{activeSlot.note}</div>
                        </div>
                    </div>

                    {/* Uploaded files list */}
                    {activeSlot.multi ? (
                        <MultiDocUploader
                            slot={activeSlot}
                            files={Array.isArray(form.docs[activeSlot.id]) ? form.docs[activeSlot.id] : []}
                            onAdd={(file) => handleFile(activeSlot.id, file)}
                            onRemove={(fileId) => removeDocFile(activeSlot.id, fileId)}
                            onPreview={setPreview}
                            fileRef={(el) => (fileRefs.current[activeSlot.id] = el)}
                        />
                    ) : (
                        <SingleDocUploader
                            slot={activeSlot}
                            file={form.docs[activeSlot.id] || null}
                            onUpload={(file) => handleFile(activeSlot.id, file)}
                            onRemove={() => {
                                setForm(f => { const d={...f.docs}; delete d[activeSlot.id]; return {...f,docs:d}; });
                            }}
                            onPreview={setPreview}
                            fileRef={(el) => (fileRefs.current[activeSlot.id] = el)}
                        />
                    )}
                </div>
            )}

            <div className={styles.infoBox}>
                📌 All documents are optional but highly recommended. NirmanIQ AI reads all
                uploaded drawings to generate stage-wise material estimates and cost projections.
                Structural drawings are the most important — upload all sheets.
            </div>
        </div>
    );
}

// ── Multi-file uploader ───────────────────────────────────────────────────────
function MultiDocUploader({ slot, files, onAdd, onRemove, onPreview, fileRef }) {
    const inputRef = React.useRef();
    const handleChange = (e) => {
        Array.from(e.target.files || []).forEach(file => onAdd(file));
        e.target.value = '';
    };

    return (
        <div className={styles.multiDocWrap}>
            {/* Upload drop zone */}
            <label className={styles.multiDropZone} style={{ borderColor: files.length > 0 ? slot.color : undefined }}>
                <input
                    ref={(el) => { inputRef.current = el; if (fileRef) fileRef(el); }}
                    type="file"
                    accept={slot.accept}
                    multiple
                    onChange={handleChange}
                    style={{ display: 'none' }}
                />
                <div className={styles.multiDropIcon}>{slot.icon}</div>
                <div className={styles.multiDropTitle}>
                    {files.length === 0 ? `Upload ${slot.label}` : `Add more files`}
                </div>
                <div className={styles.multiDropHint}>
                    Click to browse · PDF, JPG, PNG · Multiple files allowed
                </div>
                <div className={styles.multiDropBtn} style={{ background: slot.color }}>
                    ↑ Choose files
                </div>
            </label>

            {/* File list */}
            {files.length > 0 && (
                <div className={styles.multiFileList}>
                    <div className={styles.multiFileListHeader}>
                        <span style={{ color: slot.color, fontWeight: 600 }}>{files.length} file{files.length !== 1 ? 's' : ''} uploaded</span>
                        <span className={styles.multiFileListHint}>AI will read all files for this category</span>
                    </div>
                    {files.map((f, i) => (
                        <div key={f.id || i} className={styles.multiFileRow}>
                            <div className={styles.multiFileIcon}>
                                {f.type?.includes('pdf') ? '📄' : '🖼'}
                            </div>
                            <div className={styles.multiFileInfo}>
                                <div className={styles.multiFileName}>{f.name}</div>
                                <div className={styles.multiFileMeta}>
                                    {(f.size / 1024).toFixed(0)} KB · {f.uploaded}
                                </div>
                            </div>
                            <div className={styles.multiFileActions}>
                                {onPreview && (
                                    <button
                                        type="button"
                                        className={styles.multiPreviewBtn}
                                        onClick={() => onPreview(f)}
                                    >
                                        Preview
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className={styles.multiRemoveBtn}
                                    onClick={() => onRemove(f.id)}
                                    title="Remove"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Single-file uploader (Soil Test) ─────────────────────────────────────────
function SingleDocUploader({ slot, file, onUpload, onRemove, onPreview, fileRef }) {
    const handleChange = (e) => {
        const f = e.target.files[0]; if (f) onUpload(f);
        e.target.value = '';
    };
    return (
        <div className={styles.multiDocWrap}>
            <label className={`${styles.multiDropZone} ${file ? styles.multiDropZoneDone : ''}`}
                style={{ borderColor: file ? slot.color : undefined }}>
                <input
                    ref={fileRef}
                    type="file"
                    accept={slot.accept}
                    onChange={handleChange}
                    style={{ display: 'none' }}
                />
                <div className={styles.multiDropIcon}>{file ? '✅' : slot.icon}</div>
                <div className={styles.multiDropTitle}>
                    {file ? file.name : `Upload ${slot.label}`}
                </div>
                <div className={styles.multiDropHint}>
                    {file
                        ? `${(file.size/1024).toFixed(0)} KB · Uploaded ${file.uploaded}`
                        : 'Click to browse · PDF or image'}
                </div>
                {!file && (
                    <div className={styles.multiDropBtn} style={{ background: slot.color }}>
                        ↑ Choose file
                    </div>
                )}
            </label>
            {file && (
                <div className={styles.singleFileActions}>
                    {onPreview && (
                        <button type="button" className={styles.multiPreviewBtn} onClick={() => onPreview(file)}>
                            Preview
                        </button>
                    )}
                    <button type="button" className={styles.multiDropBtn}
                        style={{ background: 'var(--border)', color: 'var(--muted)' }}
                        onClick={() => fileRef?.click?.()}>
                        ↺ Replace
                    </button>
                    <button type="button" className={styles.multiRemoveBtn} onClick={onRemove}>
                        ✕ Remove
                    </button>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLOT DIAGRAM — SVG-based, pixel-perfect layout
// Layout: left axis label | plot rectangle | right space
//                              bottom road bar
//                           compass (centered below plot)
// ─────────────────────────────────────────────────────────────────────────────
function PlotDiagram({
    plotSizing, roadPosition, form,
    topPx, bottomPx, leftPx, rightPx,
    innerPxWidth, innerPxHeight,
    adjustedLength, adjustedWidth,
    sbFront, sbBack, sbLeft, sbRight, rp,
    showRoadVertical,
}) {
    const W = plotSizing.width;   // plot rectangle width in px
    const H = plotSizing.height;  // plot rectangle height in px

    const PAD_LEFT   = 80;   // left axis label
    const PAD_TOP    = 36;   // top axis label
    const PAD_RIGHT  = 24;
    const ROAD_H     = 28;   // height of road bar
    const COMPASS_H  = 72;   // compass below road
    const GAP_ROAD   = 8;    // gap between plot and road
    const GAP_COMPASS= 16;   // gap between road and compass

    const svgW = PAD_LEFT + W + PAD_RIGHT;
    const plotX = PAD_LEFT;
    const plotY = PAD_TOP;

    // Road position
    let roadX = plotX, roadY = plotY, roadW = W, roadHH = ROAD_H;
    let roadIsVertical = false;
    if (roadPosition === 'bottom') {
        roadX = plotX; roadY = plotY + H + GAP_ROAD; roadW = W; roadHH = ROAD_H;
    } else if (roadPosition === 'top') {
        roadX = plotX; roadY = plotY - GAP_ROAD - ROAD_H; roadW = W; roadHH = ROAD_H;
    } else if (roadPosition === 'left') {
        roadX = plotX - GAP_ROAD - ROAD_H; roadY = plotY; roadW = ROAD_H; roadHH = H;
        roadIsVertical = true;
    } else {
        roadX = plotX + W + GAP_ROAD; roadY = plotY; roadW = ROAD_H; roadHH = H;
        roadIsVertical = true;
    }

    // Compass centered below everything
    const compassCX = svgW / 2;
    let compassY;
    if (roadPosition === 'bottom') {
        compassY = roadY + ROAD_H + GAP_COMPASS + COMPASS_H / 2;
    } else if (roadPosition === 'top') {
        compassY = plotY + H + GAP_COMPASS + COMPASS_H / 2;
    } else {
        compassY = plotY + H + GAP_COMPASS + COMPASS_H / 2;
    }

    const svgH = compassY + COMPASS_H / 2 + 12;

    const accentColor   = 'var(--accent)';
    const mutedColor    = 'var(--color-text-secondary, #8B949E)';
    const greenColor    = 'rgba(63,185,80,0.85)';
    const redColor      = 'rgba(248,81,73,0.75)';
    const roadFill      = 'var(--border, #21273A)';
    const roadText      = 'var(--hint, #484F58)';

    const hasSetbacks = sbFront > 0 || sbBack > 0 || sbLeft > 0 || sbRight > 0;
    const roadLabel   = form.roadWidth
        ? `ROAD (${form.roadWidth}M / ${Math.round(form.roadWidth * 3.281)}FT) · ${(form.facing || '').toUpperCase()} SIDE`
        : `ROAD · ${(form.facing || '').toUpperCase()} SIDE`;

    const widthLabel  = form.plotWidth
        ? `↔ ${form.plotWidth} ft / ${(form.plotWidth * 0.3048).toFixed(1)} m`
        : '↔ ?';
    const heightLabel = form.plotLength
        ? `↕ ${form.plotLength} ft / ${(form.plotLength * 0.3048).toFixed(1)} m`
        : '↕ ?';
    const areaLabel   = (form.plotLength && form.plotWidth)
        ? `${Math.round(form.plotLength * form.plotWidth)} sft · ${(form.plotLength * form.plotWidth * 0.0929).toFixed(1)} sqm`
        : '';

    const buildableLabel = hasSetbacks
        ? `${Math.round(adjustedLength * 10) / 10}×${Math.round(adjustedWidth * 10) / 10} ft`
        : '';

    // Setback label values per side (road-aware)
    const topSbLabel    = rp==='top'    ? sbFront : rp==='bottom' ? sbBack  : rp==='left' ? sbLeft  : sbRight;
    const bottomSbLabel = rp==='bottom' ? sbFront : rp==='top'    ? sbBack  : rp==='left' ? sbRight : sbLeft;
    const leftSbLabel   = rp==='left'   ? sbFront : rp==='right'  ? sbBack  : sbLeft;
    const rightSbLabel  = rp==='right'  ? sbFront : rp==='left'   ? sbBack  : sbRight;

    return (
        <div style={{ display:'flex', justifyContent:'center', width:'100%', padding:'8px 0' }}>
            <svg
                width={svgW}
                height={svgH}
                viewBox={`0 0 ${svgW} ${svgH}`}
                style={{ overflow: 'visible', fontFamily: 'var(--font-sans)' }}
            >
                {/* ── Width axis label (top, centered over plot) ── */}
                <text
                    x={plotX + W / 2}
                    y={plotY - 10}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="500"
                    fill={mutedColor}
                >
                    {widthLabel}
                </text>

                {/* ── Height axis label (left side, centered alongside plot, rotated) ── */}
                <text
                    x={plotX - 12}
                    y={plotY + H / 2}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="500"
                    fill={mutedColor}
                    transform={`rotate(-90, ${plotX - 12}, ${plotY + H / 2})`}
                >
                    {heightLabel}
                </text>

                {/* ── Plot outer rectangle ── */}
                <rect
                    x={plotX}
                    y={plotY}
                    width={W}
                    height={H}
                    fill={`color-mix(in srgb, var(--accent) 8%, transparent)`}
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeDasharray="8 4"
                    rx="6"
                />

                {/* ── Setback shading & buildable area ── */}
                {hasSetbacks && (
                    <>
                        {/* Top setback strip */}
                        {topPx > 0 && <rect x={plotX} y={plotY} width={W} height={topPx} fill="rgba(248,81,73,0.10)" rx="4" />}
                        {topPx > 0 && <line x1={plotX} y1={plotY+topPx} x2={plotX+W} y2={plotY+topPx} stroke="rgba(248,81,73,0.4)" strokeWidth="1" strokeDasharray="4 3" />}
                        {/* Bottom setback strip */}
                        {bottomPx > 0 && <rect x={plotX} y={plotY+H-bottomPx} width={W} height={bottomPx} fill="rgba(248,81,73,0.10)" rx="4" />}
                        {bottomPx > 0 && <line x1={plotX} y1={plotY+H-bottomPx} x2={plotX+W} y2={plotY+H-bottomPx} stroke="rgba(248,81,73,0.4)" strokeWidth="1" strokeDasharray="4 3" />}
                        {/* Left setback strip */}
                        {leftPx > 0 && <rect x={plotX} y={plotY} width={leftPx} height={H} fill="rgba(248,81,73,0.10)" />}
                        {leftPx > 0 && <line x1={plotX+leftPx} y1={plotY} x2={plotX+leftPx} y2={plotY+H} stroke="rgba(248,81,73,0.4)" strokeWidth="1" strokeDasharray="4 3" />}
                        {/* Right setback strip */}
                        {rightPx > 0 && <rect x={plotX+W-rightPx} y={plotY} width={rightPx} height={H} fill="rgba(248,81,73,0.10)" />}
                        {rightPx > 0 && <line x1={plotX+W-rightPx} y1={plotY} x2={plotX+W-rightPx} y2={plotY+H} stroke="rgba(248,81,73,0.4)" strokeWidth="1" strokeDasharray="4 3" />}

                        {/* Buildable area rectangle */}
                        <rect
                            x={plotX + leftPx}
                            y={plotY + topPx}
                            width={innerPxWidth}
                            height={innerPxHeight}
                            fill="rgba(63,185,80,0.10)"
                            stroke="rgba(63,185,80,0.7)"
                            strokeWidth="2"
                            rx="3"
                        />
                        <text x={plotX + leftPx + innerPxWidth/2} y={plotY + topPx + innerPxHeight/2 - 6}
                            textAnchor="middle" fontSize="10" fontWeight="700" fill="rgba(63,185,80,0.9)">Buildable</text>
                        <text x={plotX + leftPx + innerPxWidth/2} y={plotY + topPx + innerPxHeight/2 + 8}
                            textAnchor="middle" fontSize="9" fill="rgba(63,185,80,0.75)">{buildableLabel}</text>

                        {/* Setback dimension labels */}
                        {topPx > 10 && <text x={plotX+W/2} y={plotY+topPx/2+4} textAnchor="middle" fontSize="9" fontWeight="600" fill={redColor}>{topSbLabel}ft</text>}
                        {bottomPx > 10 && <text x={plotX+W/2} y={plotY+H-bottomPx/2+4} textAnchor="middle" fontSize="9" fontWeight="600" fill={redColor}>{bottomSbLabel}ft</text>}
                        {leftPx > 14 && <text x={plotX+leftPx/2} y={plotY+H/2+4} textAnchor="middle" fontSize="9" fontWeight="600" fill={redColor}>{leftSbLabel}ft</text>}
                        {rightPx > 14 && <text x={plotX+W-rightPx/2} y={plotY+H/2+4} textAnchor="middle" fontSize="9" fontWeight="600" fill={redColor}>{rightSbLabel}ft</text>}
                    </>
                )}

                {/* ── Plot centre labels ── */}
                <text x={plotX+W/2} y={plotY+H/2 - (areaLabel ? 8 : 0)}
                    textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--accent)">Plot</text>
                {areaLabel && (
                    <text x={plotX+W/2} y={plotY+H/2+12}
                        textAnchor="middle" fontSize="11" fill={mutedColor}>{areaLabel}</text>
                )}

                {/* ── Road bar ── */}
                <rect
                    x={roadX}
                    y={roadY}
                    width={roadW}
                    height={roadHH}
                    fill={roadFill}
                    rx="4"
                />
                {!roadIsVertical ? (
                    <text
                        x={roadX + roadW / 2}
                        y={roadY + roadHH / 2 + 4}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="500"
                        fill={roadText}
                        style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    >
                        {roadLabel}
                    </text>
                ) : (
                    <text
                        x={roadX + roadW / 2}
                        y={roadY + roadHH / 2}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="500"
                        fill={roadText}
                        transform={`rotate(-90, ${roadX + roadW / 2}, ${roadY + roadHH / 2})`}
                        style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    >
                        {roadLabel}
                    </text>
                )}

                {/* ── Compass rose (centered, below diagram) ── */}
                <CompassRose cx={compassCX} cy={compassY} r={26} facing={form.facing} />

                {/* ── "Plot faces X" label below compass ── */}
                {form.facing && (
                    <text
                        x={compassCX}
                        y={compassY + 38}
                        textAnchor="middle"
                        fontSize="12"
                        fill={mutedColor}
                    >
                        Plot faces {form.facing}
                    </text>
                )}
            </svg>
        </div>
    );
}

// ── Compass rose SVG component ───────────────────────────────────────────────
function CompassRose({ cx, cy, r, facing }) {
    const dir     = (facing || '').toLowerCase();
    const isNorth = dir.includes('north');
    const isSouth = dir.includes('south');
    const isEast  = dir.includes('east');
    const isWest  = dir.includes('west');

    // Which cardinal points are highlighted (the road-facing direction = accent colour)
    const accent = 'var(--accent)';
    const dark   = 'var(--hint, #484F58)';
    const bg     = 'var(--surface, #161B22)';

    // The 4 cardinal needle points: N top, S bottom, E right, W left
    // Each needle is a diamond shape. The road-facing one is filled accent.
    const needleN = [
        { x:cx,    y:cy-r },                       // tip
        { x:cx-5,  y:cy-4 },                       // left base
        { x:cx,    y:cy-r*0.3 },                   // inner
        { x:cx+5,  y:cy-4 },                       // right base
    ];
    const needleS = [
        { x:cx,    y:cy+r },
        { x:cx+5,  y:cy+4 },
        { x:cx,    y:cy+r*0.3 },
        { x:cx-5,  y:cy+4 },
    ];
    const needleE = [
        { x:cx+r,  y:cy },
        { x:cx+4,  y:cy-5 },
        { x:cx+r*0.3, y:cy },
        { x:cx+4,  y:cy+5 },
    ];
    const needleW = [
        { x:cx-r,  y:cy },
        { x:cx-4,  y:cy+5 },
        { x:cx-r*0.3, y:cy },
        { x:cx-4,  y:cy-5 },
    ];

    const pts = (arr) => arr.map(p => `${p.x},${p.y}`).join(' ');

    return (
        <>
            {/* Outer circle */}
            <circle cx={cx} cy={cy} r={r} fill={bg} stroke="var(--border-l, #2D3748)" strokeWidth="1.5" />
            {/* Tick marks at 45° */}
            {[45,135,225,315].map(deg => {
                const a = deg * Math.PI / 180;
                return <line key={deg}
                    x1={cx + Math.cos(a)*(r-8)} y1={cy + Math.sin(a)*(r-8)}
                    x2={cx + Math.cos(a)*(r-4)} y2={cy + Math.sin(a)*(r-4)}
                    stroke="var(--border-l,#2D3748)" strokeWidth="1.5" />;
            })}
            {/* N needle */}
            <polygon points={pts(needleN)} fill={isNorth ? accent : 'var(--muted,#8B949E)'} />
            {/* S needle */}
            <polygon points={pts(needleS)} fill={isSouth ? accent : dark} />
            {/* E needle */}
            <polygon points={pts(needleE)} fill={isEast ? accent : dark} />
            {/* W needle */}
            <polygon points={pts(needleW)} fill={isWest ? accent : dark} />
            {/* Centre dot */}
            <circle cx={cx} cy={cy} r={3} fill="var(--muted,#8B949E)" />
            {/* Cardinal labels */}
            <text x={cx}    y={cy-r+11}  textAnchor="middle" fontSize="9" fontWeight="800" fill={isNorth?accent:'var(--muted,#8B949E)'}>N</text>
            <text x={cx}    y={cy+r-3}   textAnchor="middle" fontSize="9" fontWeight="800" fill={isSouth?accent:dark}>S</text>
            <text x={cx+r-3} y={cy+3.5}  textAnchor="middle" fontSize="9" fontWeight="800" fill={isEast?accent:dark}>E</text>
            <text x={cx-r+3} y={cy+3.5}  textAnchor="middle" fontSize="9" fontWeight="800" fill={isWest?accent:dark}>W</text>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectRegistration({ onSaved, onCancel }) {
    const [step, setStep] = useState(0);
    const [form, setForm] = useState(INIT);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState(null);
    const fileRefs = useRef({});

    // ── Stable field setter — passed to children as prop, not recreated ──
    const setField = useCallback((field, value) => {
        setForm((f) => ({ ...f, [field]: value }));
        setErrors((e) => ({ ...e, [field]: undefined }));
    }, []);

    // Batch update (for AI extraction results)
    const setFieldsBatch = useCallback((updates) => {
        setForm((f) => ({ ...f, ...updates }));
    }, []);

    // ── Auto-compute derived fields ──────────────────────────────────
    useEffect(() => {
        const l = Number(form.plotLength);
        const w = Number(form.plotWidth);
        if (!l || !w) return;
        const plotArea = (l * w * 0.0929).toFixed(1);
        const slabArea = computeSlabArea({
            plotLength: l,
            plotWidth: w,
            totalFloors: form.totalFloors,
            hasStilt: form.hasStilt,
            hasLiftRoom: form.hasLiftRoom,
            hasTerraceRoom: form.hasTerraceRoom,
            terraceLength: form.terraceLength,
            terraceWidth: form.terraceWidth,
            liftRoomLength: form.liftRoomLength,
            liftRoomWidth: form.liftRoomWidth,
            setbackFront: form.setbackFront,
            setbackBack: form.setbackBack,
            setbackLeft: form.setbackLeft,
            setbackRight: form.setbackRight,
        });
        setForm((f) => ({ ...f, plotArea, slabArea: String(slabArea) }));
    }, [
        form.plotLength,
        form.plotWidth,
        form.setbackFront,
        form.setbackBack,
        form.setbackLeft,
        form.setbackRight,
        form.totalFloors,
        form.hasStilt,
        form.hasLiftRoom,
        form.hasTerraceRoom,
        form.terraceLength,
        form.terraceWidth,
        form.liftRoomLength,
        form.liftRoomWidth,
    ]);

    // Auto-compute builder quote
    useEffect(() => {
        const sa = Number(form.slabArea);
        const rp = Number(form.ratePerSft);
        if (sa && rp && !form.builderQuote) {
            setForm((f) => ({
                ...f,
                builderQuote: String(Math.round(sa * rp)),
            }));
        }
    }, [form.slabArea, form.ratePerSft]);

    // Auto-compute self funds
    useEffect(() => {
        const total = Number(form.totalBudget);
        const loan = Number(form.loanAmount);
        if (total)
            setForm((f) => ({ ...f, selfFunds: String(total - (loan || 0)) }));
    }, [form.totalBudget, form.loanAmount]);

    // ── File upload handler ──────────────────────────────────────────
    const handleFile = useCallback((docId, file, onDone) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const docObj = {
                id: `${docId}_${Date.now()}`,
                name: file.name,
                size: file.size,
                type: file.type,
                data: ev.target.result,
                uploaded: new Date().toLocaleDateString('en-IN'),
            };
            setForm((f) => {
                if (MULTI_DOC_IDS.has(docId)) {
                    const existing = Array.isArray(f.docs[docId]) ? f.docs[docId] : [];
                    return { ...f, docs: { ...f.docs, [docId]: [...existing, docObj] } };
                }
                return { ...f, docs: { ...f.docs, [docId]: docObj } };
            });
            if (onDone) onDone(docObj);
        };
        reader.readAsDataURL(file);
    }, []);

    const removeDocFile = useCallback((docId, fileId) => {
        setForm((f) => {
            if (MULTI_DOC_IDS.has(docId)) {
                const updated = (Array.isArray(f.docs[docId]) ? f.docs[docId] : []).filter(d => d.id !== fileId);
                const newDocs = { ...f.docs };
                if (updated.length === 0) delete newDocs[docId];
                else newDocs[docId] = updated;
                return { ...f, docs: newDocs };
            }
            const d = { ...f.docs }; delete d[docId];
            return { ...f, docs: d };
        });
    }, []);

    // ── Validation ───────────────────────────────────────────────────
    const validate = useCallback(
        (stepIdx) => {
            const e = {};
            if (stepIdx === 1) {
                if (!form.projectName.trim())
                    e.projectName = 'Project name is required';
                if (!form.ownerName.trim())
                    e.ownerName = 'Owner name is required';
            }
            if (stepIdx === 2) {
                if (!form.plotLength) e.plotLength = 'Required';
                if (!form.plotWidth) e.plotWidth = 'Required';
            }
            if (stepIdx === 4) {
                if (!form.totalBudget)
                    e.totalBudget = 'Total budget is required';
            }
            setErrors(e);
            return Object.keys(e).length === 0;
        },
        [form],
    );

    const nextStep = useCallback(() => {
        if (!validate(step)) return;
        setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, [step, validate]);

    const prevStep = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

    // ── Save ─────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!validate(step)) return;
        setSaving(true);
        try {
            const totalBudget = Number(form.totalBudget) || 0;
            const project = {
                id: 'proj_' + Date.now(),
                name: form.projectName,
                projectName: form.projectName,
                ownerName: form.ownerName,
                siteAddress: form.siteAddress,
                approvalNumber: form.approvalNumber,
                surveyNo: form.surveyNo || '',
                plotLength: Number(form.plotLength),
                plotWidth: Number(form.plotWidth),
                plotArea: form.plotArea,
                dimensions: `${form.plotLength}\u00D7${form.plotWidth} ft`,
                facing: form.facing,
                direction: form.facing,
                roadWidth: Number(form.roadWidth),
                locality: form.locality,
                city: form.city,
                floorConfig: form.floorConfig,
                hasStilt: form.hasStilt,
                stilt: form.hasStilt,
                totalFloors: Number(form.totalFloors),
                suggestedFloors: Number(form.totalFloors),
                floorHeight: Number(form.floorHeight),
                hasLift: form.hasLift,
                hasLiftRoom: form.hasLiftRoom,
                hasTerraceRoom: form.hasTerraceRoom,
                liftRoomLength: Number(form.liftRoomLength) || 0,
                liftRoomWidth: Number(form.liftRoomWidth) || 0,
                terraceLength: Number(form.terraceLength) || 0,
                terraceWidth: Number(form.terraceWidth) || 0,
                setbackFront: Number(form.setbackFront) || 0,
                setbackBack: Number(form.setbackBack) || 0,
                setbackLeft: Number(form.setbackLeft) || 0,
                setbackRight: Number(form.setbackRight) || 0,
                boreWellDepth: Number(form.boreWellDepth) || 350,
                slabArea: Number(form.slabArea),
                builderName: form.builderName,
                startDate: form.startDate,
                durationMonths: Number(form.durationMonths),
                totalBudget,
                builderQuote: Number(form.builderQuote),
                loanAmount: Number(form.loanAmount),
                selfFunds: Number(form.selfFunds),
                ratePerSft: Number(form.ratePerSft),
                docs: form.docs,
                createdAt: new Date().toISOString(),
            };

            await saveProject(project);

            if (
                project.plotLength &&
                project.plotWidth &&
                project.totalFloors
            ) {
                const matEst = estimateMaterials(project);
                const existing = await getStorage('bs_mats', null);
                if (existing) {
                    const updated = existing.map((m) => {
                        const e = matEst.find((x) => x.id === m.id);
                        return e ? { ...m, required: e.required } : m;
                    });
                    await setStorage('bs_mats', updated);
                }
            }

            if (totalBudget > 0) {
                await setStorage('bs_budget', estimateBudget(totalBudget));
            }

            onSaved && onSaved(project);
        } finally {
            setSaving(false);
        }
    }, [form, step, validate, onSaved]);

    // ── Computed ─────────────────────────────────────────────────────
    const totalBudgNum = Number(form.totalBudget) || 0;
    const loanNum = Number(form.loanAmount) || 0;
    const selfFundsNum = totalBudgNum - loanNum;
    const loanPct =
        totalBudgNum > 0 ? Math.round((loanNum / totalBudgNum) * 100) : 0;
    const docsUploaded = Object.entries(form.docs).reduce((sum, [id, val]) =>
        sum + (Array.isArray(val) ? val.length : (val ? 1 : 0)), 0);

    const plotSizing = getPlotSizing(form.plotLength, form.plotWidth);
    const roadPosition = getRoadPosition(form.facing);
    const plotBoxWidth =
        roadPosition === 'left' || roadPosition === 'right'
            ? Math.max(plotSizing.width + 100, 480)
            : Math.max(plotSizing.width + 80, 420);
    const plotInnerMarginTop = roadPosition === 'top' ? 60 : 40;
    const plotRoadStyle = getRoadStyle(
        roadPosition,
        plotSizing.width,
        plotSizing.height,
    );
    const showRoadVertical =
        roadPosition === 'left' || roadPosition === 'right';

    // Slab area breakdown values — account for setbacks (ft)
    const plotL = Number(form.plotLength) || 0;
    const plotW = Number(form.plotWidth) || 0;
    const sbFront = Number(form.setbackFront) || 0;
    const sbBack = Number(form.setbackBack) || 0;
    const sbLeft = Number(form.setbackLeft) || 0;
    const sbRight = Number(form.setbackRight) || 0;
    // Road-facing-aware axis assignment:
    // South/North facing → front/back reduce LENGTH; left/right reduce WIDTH
    // East/West facing   → front/back reduce WIDTH;  left/right reduce LENGTH
    const facingDir = (form.facing || '').toLowerCase();
    const isEWFacing = facingDir.includes('east') || facingDir.includes('west');
    const adjustedLength = isEWFacing
        ? Math.max(0, plotL - sbLeft - sbRight)
        : Math.max(0, plotL - sbFront - sbBack);
    const adjustedWidth = isEWFacing
        ? Math.max(0, plotW - sbFront - sbBack)
        : Math.max(0, plotW - sbLeft - sbRight);
    const perFloorSlab = Math.round(adjustedLength * adjustedWidth); // no coverage factor

    // Buildable area visual sizing (pixels) inside the plot diagram
    const plotWidthFt = Number(form.plotWidth) || 1;
    const plotLengthFt = Number(form.plotLength) || 1;
    const pxPerFtW = plotSizing.width / plotWidthFt; // pixels per ft horizontally
    const pxPerFtL = plotSizing.height / plotLengthFt; // pixels per ft vertically

    // Map setbacks to pixel offsets on each side depending on road position
    const rp = getRoadPosition(form.facing);
    // default mapping: front -> top, back -> bottom, left/right -> left/right
    let topPx = 0,
        bottomPx = 0,
        leftPx = 0,
        rightPx = 0;
    if (rp === 'top') {
        topPx = sbFront * pxPerFtL;
        bottomPx = sbBack * pxPerFtL;
        leftPx = sbLeft * pxPerFtW;
        rightPx = sbRight * pxPerFtW;
    } else if (rp === 'bottom') {
        topPx = sbBack * pxPerFtL;
        bottomPx = sbFront * pxPerFtL;
        leftPx = sbLeft * pxPerFtW;
        rightPx = sbRight * pxPerFtW;
    } else if (rp === 'left') {
        leftPx = sbFront * pxPerFtW;
        rightPx = sbBack * pxPerFtW;
        topPx = sbLeft * pxPerFtL;
        bottomPx = sbRight * pxPerFtL;
    } else if (rp === 'right') {
        leftPx = sbBack * pxPerFtW;
        rightPx = sbFront * pxPerFtW;
        topPx = sbLeft * pxPerFtL;
        bottomPx = sbRight * pxPerFtL;
    }

    const innerPxWidth = Math.max(6, plotSizing.width - leftPx - rightPx);
    const innerPxHeight = Math.max(6, plotSizing.height - topPx - bottomPx);
    const floorsCount = Number(form.totalFloors) || 0;
    const floorsSlabTotal = perFloorSlab * floorsCount;
    const terraceLength = Number(form.terraceLength) || 0;
    const terraceWidth = Number(form.terraceWidth) || 0;
    const terraceArea =
        terraceLength && terraceWidth
            ? terraceLength * terraceWidth
            : form.hasTerraceRoom
              ? 216
              : 0;
    const liftRoomLength = Number(form.liftRoomLength) || 0;
    const liftRoomWidth = Number(form.liftRoomWidth) || 0;
    const liftRoomArea =
        liftRoomLength && liftRoomWidth
            ? liftRoomLength * liftRoomWidth
            : form.hasLiftRoom
              ? 216
              : 0;
    const liftSlabArea = form.hasLift ? liftRoomArea * 2 : 0;
    const computedTotalSlab =
        floorsSlabTotal +
        (form.hasTerraceRoom ? terraceArea : 0) +
        (form.hasLift ? liftSlabArea : 0);

    // ─────────────────────────────────────────────────────────────────
    return (
        <div className={styles.wrap}>
            {/* Step indicator */}
            <div className={styles.stepBar}>
                {STEPS.map((s, i) => (
                    <div
                        key={s.id}
                        className={[
                            styles.stepItem,
                            i === step ? styles.stepActive : '',
                            i < step ? styles.stepDone : '',
                        ].join(' ')}
                        onClick={() => i < step && setStep(i)}
                        role={i < step ? 'button' : undefined}
                    >
                        <div className={styles.stepDot}>
                            {i < step ? '✓' : s.icon}
                        </div>
                        <div className={styles.stepLabel}>{s.label}</div>
                        {i < STEPS.length - 1 && (
                            <div className={styles.stepLine} />
                        )}
                    </div>
                ))}
            </div>

            {/* Step content */}
            <div className={styles.stepContent}>
                {/* ── STEP 0: Upload Approved Plan ── */}
                {step === 0 && (
                    <PlanUploadStep
                        form={form}
                        onFormUpdate={setFieldsBatch}
                        onFile={handleFile}
                        fileRefs={fileRefs}
                        onPreview={setPreview}
                    />
                )}

                {/* ── STEP 1: Project Identity ── */}
                {step === 1 && (
                    <div className={styles.stepSection}>
                        <div className={styles.stepHeading}>
                            <div className={styles.stepNum}>🏷</div>
                            <div>
                                <div className={styles.stepTitle}>
                                    Project Identity
                                </div>
                                <div className={styles.stepSub}>
                                    Confirm or fill in your project and owner
                                    details
                                </div>
                            </div>
                        </div>
                        <div className={styles.grid2}>
                            <Field
                                label="Project name"
                                id="projectName"
                                required
                                error={errors.projectName}
                            >
                                <TextInput
                                    id="projectName"
                                    value={form.projectName}
                                    onChange={(v) => setField('projectName', v)}
                                    placeholder="e.g. Kumar Residence, PM Palem"
                                    hasError={!!errors.projectName}
                                />
                            </Field>
                            <Field
                                label="Owner's full name"
                                id="ownerName"
                                required
                                error={errors.ownerName}
                            >
                                <TextInput
                                    id="ownerName"
                                    value={form.ownerName}
                                    onChange={(v) => setField('ownerName', v)}
                                    placeholder="e.g. K. Somasekhara Kalyana Chakravarty"
                                    hasError={!!errors.ownerName}
                                />
                            </Field>
                        </div>
                        <Field label="Site address" id="siteAddress">
                            <TextInput
                                id="siteAddress"
                                value={form.siteAddress}
                                onChange={(v) => setField('siteAddress', v)}
                                placeholder="H.No. 11-50, Plot MIG-167, Ratnagiri HB Colony, PM Palem, Vizag"
                            />
                        </Field>
                        <div className={styles.grid2}>
                            <Field
                                label="Building approval number"
                                id="approvalNumber"
                                hint="From your BPO (e.g. PER/1086/0349/2026)"
                            >
                                <TextInput
                                    id="approvalNumber"
                                    value={form.approvalNumber}
                                    onChange={(v) =>
                                        setField('approvalNumber', v)
                                    }
                                    placeholder="PER/1086/0349/2026"
                                />
                            </Field>
                            <Field
                                label="Survey / Plot number"
                                id="surveyNo"
                                hint="e.g. S.No. 46, Plot MIG-167"
                            >
                                <TextInput
                                    id="surveyNo"
                                    value={form.surveyNo || ''}
                                    onChange={(v) => setField('surveyNo', v)}
                                    placeholder="S.No. 46, MIG-167"
                                />
                            </Field>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Plot & Site ── */}
                {step === 2 && (
                    <div className={styles.stepSection}>
                        <div className={styles.stepHeading}>
                            <div className={styles.stepNum}>📐</div>
                            <div>
                                <div className={styles.stepTitle}>
                                    Plot & Site
                                </div>
                                <div className={styles.stepSub}>
                                    Plot dimensions, orientation, and road
                                    details
                                </div>
                            </div>
                        </div>

                        {/* Plot diagram — SVG-based for pixel-perfect layout */}
                        <PlotDiagram
                            plotSizing={plotSizing}
                            roadPosition={roadPosition}
                            form={form}
                            topPx={topPx}
                            bottomPx={bottomPx}
                            leftPx={leftPx}
                            rightPx={rightPx}
                            innerPxWidth={innerPxWidth}
                            innerPxHeight={innerPxHeight}
                            adjustedLength={adjustedLength}
                            adjustedWidth={adjustedWidth}
                            sbFront={sbFront}
                            sbBack={sbBack}
                            sbLeft={sbLeft}
                            sbRight={sbRight}
                            rp={rp}
                            showRoadVertical={showRoadVertical}
                        />

                        <div className={styles.grid3}>
                            <Field
                                label="Plot length (ft)"
                                id="plotLength"
                                required
                                error={errors.plotLength}
                                hint="Along the longer axis"
                            >
                                <FtInInput
                                    id="plotLength"
                                    value={form.plotLength}
                                    onChange={(v) => setField('plotLength', v)}
                                    placeholder="60"
                                    hasError={!!errors.plotLength}
                                />
                            </Field>
                            <Field
                                label="Plot width (ft)"
                                id="plotWidth"
                                required
                                error={errors.plotWidth}
                                hint="Along the shorter axis"
                            >
                                <FtInInput
                                    id="plotWidth"
                                    value={form.plotWidth}
                                    onChange={(v) => setField('plotWidth', v)}
                                    placeholder="35"
                                    hasError={!!errors.plotWidth}
                                />
                            </Field>
                            <Field label="Plot area (auto)" id="plotArea">
                                <TextInput
                                    id="plotArea"
                                    value={formatAreaUnits(
                                        form.plotLength,
                                        form.plotWidth,
                                    )}
                                    onChange={() => {}}
                                    readOnly
                                />
                            </Field>
                        </div>
                        <div className={styles.grid2}>
                            <Field
                                label="Plot facing direction"
                                id="facing"
                                hint="Direction of the plot front and the road touching the plot"
                            >
                                <SelectInput
                                    id="facing"
                                    options={DIRECTIONS}
                                    value={form.facing}
                                    onChange={(v) => setField('facing', v)}
                                />
                            </Field>
                            <Field
                                label="Road width (metres)"
                                id="roadWidth"
                                hint="Affects max floors permitted by GVMC"
                            >
                                <TextInput
                                    id="roadWidth"
                                    type="number"
                                    value={form.roadWidth}
                                    onChange={(v) => setField('roadWidth', v)}
                                    placeholder="18"
                                />
                            </Field>
                        </div>
                        {form.roadWidth && (
                            <div className={styles.infoBox}>
                                🏛 Road width{' '}
                                {formatRoadWidthUnits(form.roadWidth)} — GVMC
                                typically permits{' '}
                                <strong>
                                    {suggestFloors(
                                        form.roadWidth,
                                        form.hasStilt,
                                    )}{' '}
                                    floors
                                </strong>
                                . Verify with your approved plan.
                            </div>
                        )}
                        <div className={styles.setbackGrid}>
                            <Field label="Setback — Front (road side)" id="setbackFront">
                                <FtInInput
                                    id="setbackFront"
                                    value={form.setbackFront}
                                    onChange={(v) => setField('setbackFront', v)}
                                    placeholder="0"
                                />
                            </Field>
                            <Field label="Setback — Back" id="setbackBack">
                                <FtInInput
                                    id="setbackBack"
                                    value={form.setbackBack}
                                    onChange={(v) => setField('setbackBack', v)}
                                    placeholder="0"
                                />
                            </Field>
                            <Field label="Setback — Left" id="setbackLeft">
                                <FtInInput
                                    id="setbackLeft"
                                    value={form.setbackLeft}
                                    onChange={(v) => setField('setbackLeft', v)}
                                    placeholder="0"
                                />
                            </Field>
                            <Field label="Setback — Right" id="setbackRight">
                                <FtInInput
                                    id="setbackRight"
                                    value={form.setbackRight}
                                    onChange={(v) => setField('setbackRight', v)}
                                    placeholder="0"
                                />
                            </Field>
                        </div>
                    </div>
                )}

                {/* ── STEP 3: Construction ── */}
                {step === 3 && (
                    <div className={styles.stepSection}>
                        <div className={styles.stepHeading}>
                            <div className={styles.stepNum}>🏗</div>
                            <div>
                                <div className={styles.stepTitle}>
                                    Construction Details
                                </div>
                                <div className={styles.stepSub}>
                                    Floor configuration, height and builder
                                    information
                                </div>
                            </div>
                        </div>
                        <div className={styles.grid2}>
                            <Field label="Floor configuration" id="floorConfig">
                                <SelectInput
                                    id="floorConfig"
                                    options={FLOOR_TYPES}
                                    value={form.floorConfig}
                                    onChange={(v) => {
                                        const hasS = v.includes('S+');
                                        const numStr = v
                                            .replace('S+G+', '')
                                            .replace('G+', '')
                                            .replace('G only', '0');
                                        const num =
                                            parseInt(numStr) +
                                            1 +
                                            (hasS ? 1 : 0);
                                        setFieldsBatch({
                                            floorConfig: v,
                                            hasStilt: hasS,
                                            totalFloors: num,
                                        });
                                    }}
                                />
                            </Field>
                            <Field
                                label="Total slabs / floors"
                                id="totalFloors"
                                hint="Including stilt and terrace"
                            >
                                <TextInput
                                    id="totalFloors"
                                    value={form.totalFloors}
                                    onChange={() => {}}
                                    readOnly
                                />
                            </Field>
                        </div>
                        <div className={styles.grid3}>
                            <Field
                                label="Floor-to-floor height (ft)"
                                id="floorHeight"
                                hint="Typically 10–10.5 ft"
                            >
                                <FtInInput
                                    id="floorHeight"
                                    value={form.floorHeight}
                                    onChange={(v) => setField('floorHeight', v)}
                                    placeholder="10.5"
                                />
                            </Field>
                            <Field label="Lift / elevator" id="hasLift">
                                <ToggleBtn
                                    value={form.hasLift}
                                    onChange={(v) =>
                                        setFieldsBatch({ hasLift: v })
                                    }
                                />
                            </Field>
                            <Field label="Terrace room" id="hasTerraceRoom">
                                <ToggleBtn
                                    value={form.hasTerraceRoom}
                                    onChange={(v) =>
                                        setFieldsBatch({
                                            hasTerraceRoom: v,
                                            terraceLength: v
                                                ? form.terraceLength
                                                : '',
                                            terraceWidth: v
                                                ? form.terraceWidth
                                                : '',
                                        })
                                    }
                                />
                            </Field>
                        </div>
                        <div className={styles.setbackGrid}>
                            <Field label="Setback — Front (road side)" id="setbackFront">
                                <FtInInput
                                    id="setbackFront"
                                    value={form.setbackFront}
                                    onChange={(v) => setField('setbackFront', v)}
                                    placeholder="0"
                                />
                            </Field>
                            <Field label="Setback — Back" id="setbackBack">
                                <FtInInput
                                    id="setbackBack"
                                    value={form.setbackBack}
                                    onChange={(v) => setField('setbackBack', v)}
                                    placeholder="0"
                                />
                            </Field>
                            <Field label="Setback — Left" id="setbackLeft">
                                <FtInInput
                                    id="setbackLeft"
                                    value={form.setbackLeft}
                                    onChange={(v) => setField('setbackLeft', v)}
                                    placeholder="0"
                                />
                            </Field>
                            <Field label="Setback — Right" id="setbackRight">
                                <FtInInput
                                    id="setbackRight"
                                    value={form.setbackRight}
                                    onChange={(v) => setField('setbackRight', v)}
                                    placeholder="0"
                                />
                            </Field>
                        </div>
                        {form.hasLift && (
                            <div className={styles.grid2}>
                                <Field
                                    label="Lift room on terrace - length (ft)"
                                    id="liftRoomLength"
                                >
                                    <TextInput
                                        id="liftRoomLength"
                                        type="number"
                                        value={form.liftRoomLength}
                                        onChange={(v) => {
                                            setField('liftRoomLength', v);
                                            setField('hasLiftRoom', !!v);
                                        }}
                                        placeholder="6"
                                    />
                                </Field>
                                <Field
                                    label="Lift room on terrace - width (ft)"
                                    id="liftRoomWidth"
                                >
                                    <TextInput
                                        id="liftRoomWidth"
                                        type="number"
                                        value={form.liftRoomWidth}
                                        onChange={(v) => {
                                            setField('liftRoomWidth', v);
                                            setField('hasLiftRoom', !!v);
                                        }}
                                        placeholder="6"
                                    />
                                </Field>
                            </div>
                        )}

                        {form.hasTerraceRoom && (
                            <div className={styles.grid2}>
                                <Field
                                    label="Terrace room length (ft)"
                                    id="terraceLength"
                                >
                                    <TextInput
                                        id="terraceLength"
                                        type="number"
                                        value={form.terraceLength}
                                        onChange={(v) =>
                                            setField('terraceLength', v)
                                        }
                                        placeholder="12"
                                    />
                                </Field>
                                <Field
                                    label="Terrace room width (ft)"
                                    id="terraceWidth"
                                >
                                    <TextInput
                                        id="terraceWidth"
                                        type="number"
                                        value={form.terraceWidth}
                                        onChange={(v) =>
                                            setField('terraceWidth', v)
                                        }
                                        placeholder="18"
                                    />
                                </Field>
                            </div>
                        )}

                        {form.slabArea && (
                            <div className={styles.estimateCard}>
                                <div className={styles.estimateTitle}>
                                    📊 Estimated slab area
                                </div>
                                <div className={styles.estimateVal}>
                                    {Number(form.slabArea).toLocaleString()} sft
                                </div>
                                <div className={styles.estimateNote}>
                                    {isEWFacing
                                        ? `(${form.plotLength}−${(sbLeft+sbRight).toFixed(1)}) × (${form.plotWidth}−${(sbFront+sbBack).toFixed(1)}) ft × ${form.totalFloors} floors`
                                        : `(${form.plotLength}−${(sbFront+sbBack).toFixed(1)}) × (${form.plotWidth}−${(sbLeft+sbRight).toFixed(1)}) ft × ${form.totalFloors} floors`
                                    }
                                    {
                                        ' — road-facing setback adjusted (no coverage factor)'
                                    }
                                </div>
                                <div className={styles.estimateBreakdown}>
                                    <div className={styles.breakRow}>
                                        <span>Per-floor slab</span>
                                        <span>
                                            {perFloorSlab.toLocaleString()} sft
                                        </span>
                                    </div>
                                    <div className={styles.breakRow}>
                                        <span>Floors</span>
                                        <span>{floorsCount}</span>
                                    </div>
                                    <div className={styles.breakRow}>
                                        <span>Total floors slab</span>
                                        <span>
                                            {floorsSlabTotal.toLocaleString()}{' '}
                                            sft
                                        </span>
                                    </div>
                                    {form.hasTerraceRoom && (
                                        <div className={styles.breakRow}>
                                            <span>Terrace room area</span>
                                            <span>
                                                {terraceArea.toLocaleString()}{' '}
                                                sft
                                            </span>
                                        </div>
                                    )}
                                    {form.hasLift && (
                                        <div className={styles.breakRow}>
                                            <span>
                                                Lift room area (counted ×2
                                                slabs)
                                            </span>
                                            <span>
                                                {liftRoomArea.toLocaleString()}{' '}
                                                sft (
                                                {liftSlabArea.toLocaleString()}{' '}
                                                slab-sft)
                                            </span>
                                        </div>
                                    )}
                                    <div className={styles.breakRow}>
                                        <strong>Total slab area</strong>
                                        <strong>
                                            {(
                                                Number(form.slabArea) ||
                                                computedTotalSlab
                                            ).toLocaleString()}{' '}
                                            sft
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className={styles.grid2}>
                            <Field
                                label="Builder / contractor name"
                                id="builderName"
                            >
                                <TextInput
                                    id="builderName"
                                    value={form.builderName}
                                    onChange={(v) => setField('builderName', v)}
                                    placeholder="e.g. ABC Constructions"
                                />
                            </Field>
                            <Field label="Expected start date" id="startDate">
                                <TextInput
                                    id="startDate"
                                    type="date"
                                    value={form.startDate}
                                    onChange={(v) => setField('startDate', v)}
                                />
                            </Field>
                            <Field
                                label="Borewell target depth (ft)"
                                id="boreWellDepth"
                                hint="Typical range 300–400 ft in Vizag. Used in borewell stage BOM."
                            >
                                <FtInInput
                                    id="boreWellDepth"
                                    value={form.boreWellDepth}
                                    onChange={(v) => setField('boreWellDepth', v)}
                                    placeholder="350"
                                />
                            </Field>
                        </div>
                        <Field
                            label="Expected construction duration (months)"
                            id="durationMonths"
                            hint="Typically 18–24 months for G+2"
                        >
                            <TextInput
                                id="durationMonths"
                                type="number"
                                value={form.durationMonths}
                                onChange={(v) => setField('durationMonths', v)}
                                placeholder="20"
                            />
                        </Field>
                    </div>
                )}

                {/* ── STEP 4: Budget ── */}
                {step === 4 && (
                    <div className={styles.stepSection}>
                        <div className={styles.stepHeading}>
                            <div className={styles.stepNum}>💰</div>
                            <div>
                                <div className={styles.stepTitle}>
                                    Project Budget
                                </div>
                                <div className={styles.stepSub}>
                                    Budget categories are calculated
                                    automatically from total
                                </div>
                            </div>
                        </div>
                        <Field
                            label="Total project budget (₹)"
                            id="totalBudget"
                            required
                            error={errors.totalBudget}
                            hint="All-in including construction, finishing, systems and contingency"
                        >
                            <TextInput
                                id="totalBudget"
                                type="number"
                                value={form.totalBudget}
                                onChange={(v) => setField('totalBudget', v)}
                                placeholder="14000000"
                                hasError={!!errors.totalBudget}
                            />
                        </Field>
                        {form.totalBudget && (
                            <div className={styles.budgetDisplay}>
                                <div className={styles.budgetBig}>
                                    {fmtINR(Number(form.totalBudget))}
                                </div>
                                <div className={styles.budgetSub}>
                                    Total budget
                                </div>
                                <div className={styles.budgetWords}>
                                    {numberToWordsIndian(form.totalBudget)}
                                </div>
                            </div>
                        )}
                        <div className={styles.divider} />
                        <div className={styles.grid2}>
                            <Field
                                label="Builder quote / contract value (₹)"
                                id="builderQuote"
                                hint="From signed contract or lowest bid"
                            >
                                <TextInput
                                    id="builderQuote"
                                    type="number"
                                    value={form.builderQuote}
                                    onChange={(v) =>
                                        setField('builderQuote', v)
                                    }
                                    placeholder="13935600"
                                />
                            </Field>
                            <Field
                                label="Rate per sft (₹)"
                                id="ratePerSft"
                                hint="Used to auto-compute builder quote"
                            >
                                <TextInput
                                    id="ratePerSft"
                                    type="number"
                                    value={form.ratePerSft}
                                    onChange={(v) => setField('ratePerSft', v)}
                                    placeholder="2100"
                                />
                            </Field>
                        </div>
                        {form.slabArea && form.ratePerSft && (
                            <div className={styles.infoBox}>
                                📐 {Number(form.slabArea).toLocaleString()} sft
                                {' \u00D7 '}₹{form.ratePerSft}/sft ={' '}
                                <strong>
                                    {fmtINR(
                                        Number(form.slabArea) *
                                            Number(form.ratePerSft),
                                    )}
                                </strong>
                            </div>
                        )}
                        <div className={styles.divider} />
                        <div className={styles.grid2}>
                            <Field
                                label="Bank loan amount (₹)"
                                id="loanAmount"
                                hint="0 if fully self-funded"
                            >
                                <TextInput
                                    id="loanAmount"
                                    type="number"
                                    value={form.loanAmount}
                                    onChange={(v) => setField('loanAmount', v)}
                                    placeholder="0"
                                />
                            </Field>
                            <Field
                                label="Own contribution (₹)"
                                id="selfFunds"
                                hint="Auto-calculated"
                            >
                                <TextInput
                                    id="selfFunds"
                                    value={
                                        selfFundsNum > 0
                                            ? selfFundsNum.toLocaleString()
                                            : ''
                                    }
                                    onChange={() => {}}
                                    readOnly
                                />
                            </Field>
                        </div>
                        {totalBudgNum > 0 && (
                            <div className={styles.fundingBar}>
                                <div className={styles.fundingTitle}>
                                    Funding breakdown
                                </div>
                                <div className={styles.fundingTrack}>
                                    <div
                                        className={styles.fundingLoan}
                                        style={{ width: `${loanPct}%` }}
                                    />
                                </div>
                                <div className={styles.fundingLabels}>
                                    <span style={{ color: '#3D7EFF' }}>
                                        Bank loan: {fmtINR(loanNum)} ({loanPct}
                                        %)
                                    </span>
                                    <span style={{ color: '#2DD4A0' }}>
                                        Own funds: {fmtINR(selfFundsNum)} (
                                        {100 - loanPct}%)
                                    </span>
                                </div>
                            </div>
                        )}
                        <div className={styles.infoBox}>
                            💡 Budget will be automatically split across 10
                            categories on save — foundation, structure, masonry,
                            MEP, finishing, etc.
                        </div>
                    </div>
                )}

                {/* ── STEP 5: Documents ── */}
                {step === 5 && (
                    <DocsStep
                        form={form}
                        handleFile={handleFile}
                        removeDocFile={removeDocFile}
                        fileRefs={fileRefs}
                        setPreview={setPreview}
                        setForm={setForm}
                    />
                )}

                                {/* ── STEP 6: Review ── */}
                {step === 6 && (
                    <div className={styles.stepSection}>
                        <div className={styles.stepHeading}>
                            <div className={styles.stepNum}>✅</div>
                            <div>
                                <div className={styles.stepTitle}>
                                    Review & Save
                                </div>
                                <div className={styles.stepSub}>
                                    Confirm all details before creating the
                                    project
                                </div>
                            </div>
                        </div>
                        <div className={styles.reviewGrid}>
                            <ReviewBlock
                                title="Project Identity"
                                color="#3D7EFF"
                                items={[
                                    ['Project name', form.projectName],
                                    ['Owner', form.ownerName],
                                    ['Address', form.siteAddress],
                                    ['Approval no.', form.approvalNumber],
                                    ['Survey / Plot number', form.surveyNo],
                                    ['City', form.city],
                                ]}
                            />
                            <ReviewBlock
                                title="Plot & Site"
                                color="#2DD4A0"
                                items={[
                                    [
                                        'Dimensions',
                                        formatPlotDimensionsUnits(
                                            form.plotLength,
                                            form.plotWidth,
                                        ),
                                    ],
                                    [
                                        'Plot area',
                                        formatAreaUnits(
                                            form.plotLength,
                                            form.plotWidth,
                                        ),
                                    ],
                                    ['Facing', form.facing],
                                    [
                                        'Road width',
                                        form.roadWidth
                                            ? formatRoadWidthUnits(
                                                  form.roadWidth,
                                              )
                                            : '',
                                    ],
                                    ['Locality', form.locality],
                                ]}
                            />
                            <ReviewBlock
                                title="Construction"
                                color="#F5A623"
                                items={[
                                    ['Floor config', form.floorConfig],
                                    ['Total floors', form.totalFloors],
                                    ['Floor height', `${form.floorHeight} ft`],
                                    [
                                        'Slab area',
                                        form.slabArea
                                            ? `${Number(form.slabArea).toLocaleString()} sft`
                                            : '',
                                    ],
                                    ['Builder', form.builderName],
                                    ['Start date', form.startDate],
                                    [
                                        'Duration',
                                        form.durationMonths
                                            ? `${form.durationMonths} months`
                                            : '',
                                    ],
                                ]}
                            />
                            <ReviewBlock
                                title="Budget"
                                color="#FF5A5A"
                                items={[
                                    [
                                        'Total budget',
                                        fmtINR(Number(form.totalBudget)),
                                    ],
                                    [
                                        'Builder quote',
                                        fmtINR(Number(form.builderQuote)),
                                    ],
                                    ['Rate / sft', `₹${form.ratePerSft}`],
                                    [
                                        'Bank loan',
                                        loanNum > 0 ? fmtINR(loanNum) : '',
                                    ],
                                    [
                                        'Own funds',
                                        selfFundsNum > 0
                                            ? fmtINR(selfFundsNum)
                                            : '',
                                    ],
                                ]}
                            />
                        </div>
                        <div className={styles.reviewDocsSummary}>
                            <span>📄</span>
                            <span>
                                {docsUploaded} of {DOC_SLOTS.length + 1}{' '}
                                documents uploaded
                            </span>
                            {docsUploaded === 0 && (
                                <span className={styles.reviewDocsNote}>
                                    {' '}
                                    — material estimates will use standard
                                    calculations
                                </span>
                            )}
                        </div>
                        {form.totalBudget &&
                            form.plotLength &&
                            form.plotWidth && (
                                <div className={styles.estimatePreview}>
                                    <div
                                        className={styles.estimatePreviewTitle}
                                    >
                                        📊 Material estimates that will be
                                        generated
                                    </div>
                                    <div className={styles.estimatePreviewGrid}>
                                        {estimateMaterials(form)
                                            .slice(0, 6)
                                            .map((m, i) => {
                                                const labels = [
                                                    'Steel 20mm',
                                                    'Steel 16mm',
                                                    'Steel 12mm',
                                                    'Steel 10mm',
                                                    'Steel 8mm',
                                                    'OPC Cement',
                                                ];
                                                const units = [
                                                    'MT',
                                                    'MT',
                                                    'MT',
                                                    'MT',
                                                    'MT',
                                                    'bags',
                                                ];
                                                return (
                                                    <div
                                                        key={m.id}
                                                        className={
                                                            styles.estItem
                                                        }
                                                    >
                                                        <div
                                                            className={
                                                                styles.estVal
                                                            }
                                                        >
                                                            {m.required.toLocaleString()}
                                                        </div>
                                                        <div
                                                            className={
                                                                styles.estLbl
                                                            }
                                                        >
                                                            {labels[i]} (
                                                            {units[i]})
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                    <div className={styles.estimatePreviewNote}>
                                        Estimated from buildable area after
                                        setbacks × floor count. Steel: 6.3 kg/sft,
                                        OPC cement: 6.5 bags/cum RCC volume.
                                    </div>
                                    <div className={styles.estimatePreviewHelp}>
                                        Formula: (plotLength − front − back) × (plotWidth − left − right) × floors.
                                        No coverage factor applied. Terrace and lift room areas added separately.
                                    </div>
                                </div>
                            )}
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className={styles.navRow}>
                <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={step === 0 ? onCancel : prevStep}
                >
                    {step === 0 ? 'Cancel' : '← Back'}
                </button>
                <div className={styles.stepProgress}>
                    {STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`${styles.progressDot} ${i <= step ? styles.progressDotFill : ''}`}
                        />
                    ))}
                </div>
                {step < STEPS.length - 1 ? (
                    <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={nextStep}
                    >
                        Next →
                    </button>
                ) : (
                    <button
                        type="button"
                        className={styles.btnSave}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Saving…' : '💾 Save Project'}
                    </button>
                )}
            </div>

            {/* Document preview modal */}
            {preview && (
                <div
                    className={styles.previewOverlay}
                    onClick={() => setPreview(null)}
                >
                    <div
                        className={styles.previewBox}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.previewHeader}>
                            <span>{preview.name}</span>
                            <button
                                className={styles.previewClose}
                                onClick={() => setPreview(null)}
                            >
                                ✕
                            </button>
                        </div>
                        {preview.type?.startsWith('image/') ? (
                            <img
                                src={preview.data}
                                alt={preview.name}
                                className={styles.previewImg}
                            />
                        ) : (
                            <iframe
                                src={preview.data}
                                className={styles.previewPdf}
                                title={preview.name}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
