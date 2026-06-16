export const PREREQ_GROUPS = [
  {
    id: 'g1',
    title: 'A. Land & Ownership Documents',
    color: '#3D7EFF',
    items: [
      { id: 'd01', done: false, text: 'Original Sale Deed (registered) in owner\'s name', note: 'Must be registered at Sub-Registrar. Keep 3 certified copies.' },
      { id: 'd02', done: false, text: 'Encumbrance Certificate (EC) — minimum 30 years', note: 'From Sub-Registrar office. Bank insists on 30-yr EC showing no mortgage or lien.' },
      { id: 'd03', done: false, text: 'Pattadar Passbook / Pahani (Meebhoomi)', note: 'meebhoomi.ap.gov.in — confirms revenue records in your name.' },
      { id: 'd04', done: false, text: 'Latest Property Tax receipt (GVMC Khanapayment)', note: 'Must be paid up to date. Required for both building permission and bank loan.' },
      { id: 'd05', done: false, text: 'Survey Settlement Register (SSR) extract', note: 'From MRO office. Confirms survey number S.No. 46 ownership.' },
      { id: 'd06', done: false, text: 'Link documents / chain of title (prior sale deeds)', note: 'Bank requires clear title chain for minimum 30 years.' },
      { id: 'd07', done: false, text: 'Ratnagiri HB Colony layout approval copy', note: 'Your plot is MIG-167 in HB Colony. Get the colony layout approval from GVMC records.' },
      { id: 'd08', done: false, text: 'Land classification confirmed as residential (non-agricultural)', note: 'Confirm in Pahani. Must be residential, not agricultural.' },
    ],
  },
  {
    id: 'g2',
    title: 'B. Building Permission (GVMC / APDPMS)',
    color: '#2DD4A0',
    items: [
      { id: 'd09', done: true,  text: 'Building Permission Order — PER/1086/0349/2026 ✓ OBTAINED', note: 'Obtained 30-04-2026. Valid. Check BPO for commencement deadline and conditions.' },
      { id: 'd10', done: false, text: 'Digitally signed approved plan — all 5 sheets from APDPMS portal', note: 'Download from portal.apdpms.ap.gov.in with your file number. Print A1 size. Keep digital PDF. PRIMARY on-site document.' },
      { id: 'd11', done: false, text: 'LTP (Licensed Technical Person) signed copies of all drawings', note: 'Abdul Mannan / Mannan Design Group must sign all drawing sets. Required by APDPMS and all banks.' },
      { id: 'd12', done: false, text: 'Structural Engineer stability certificate', note: 'Signed by licensed Structural Engineer. Required by APDPMS and bank.' },
      { id: 'd13', done: true,  text: 'Soil Test Report — Andhra University Civil Dept ✓ OBTAINED', note: 'Obtained 14-05-2026. SBC = 14.4 t/m². FOD = 2.4m. Keep original safely.' },
      { id: 'd14', done: false, text: 'Building commencement notice filed with GVMC', note: 'Submit to GVMC Town Planning before breaking ground. Required by BP conditions.' },
      { id: 'd15', done: false, text: 'Self-Certification Proforma (AP SCS 2025) — owner + LTP signed', note: 'AP SCS 2025 scheme. Both owner and LTP sign and upload to OBPS portal for instant permission.' },
      { id: 'd16', done: false, text: 'LTP Plinth Level Inspection report (after plinth beam)', note: 'SCS 2025: LTP uploads PLI report within 7 days of plinth beam completion with geotagged photos.' },
    ],
  },
  {
    id: 'g3',
    title: 'C. NOCs & Utility Clearances',
    color: '#9B7FFF',
    items: [
      { id: 'd17', done: false, text: 'Demolition NOC — existing structure (26.65 sqm)', note: 'Get GVMC demolition permission before demolishing old structure on site.' },
      { id: 'd18', done: false, text: 'APEPDCL — temporary construction electricity connection', note: 'Apply to APEPDCL Vizag for temp construction power. Needed before work starts.' },
      { id: 'd19', done: false, text: 'GVMC — water connection application', note: 'Apply for water and sewerage connection before construction starts.' },
      { id: 'd20', done: false, text: 'Fire NOC — provisional (GVMC Fire Dept via APDPMS)', note: 'Required for G+2 residential. Apply via gvmc.gov.in Fire NOC portal.' },
      { id: 'd21', done: false, text: 'Rain Water Harvesting (RWH) — implementation plan ready', note: 'AP mandate for buildings >300 sqm. Already shown in approved plan. Arrange contractor.' },
      { id: 'd22', done: false, text: 'APEPDCL permanent connection — transformer sanction letter', note: 'Apply for permanent electricity sanction based on total load. Needed before handover.' },
    ],
  },
  {
    id: 'g4',
    title: 'D. Financial & Insurance',
    color: '#FF5A5A',
    items: [
      { id: 'd23', done: false, text: 'Dedicated construction bank account opened', note: 'Separate savings/current account only for construction payments. Never mix with personal funds.' },
      { id: 'd24', done: false, text: 'Builder contract signed — scope, milestones, penalties', note: 'Must include: full scope of work, stage-wise payment schedule, delay penalty clauses, completion date, material spec list.' },
      { id: 'd25', done: false, text: 'Builder references verified — visit 2–3 completed projects', note: 'Talk to those owners directly. Do not rely on photos or builder\'s claims alone.' },
      { id: 'd26', done: false, text: 'Contractor All Risk (CAR) insurance policy', note: 'Recommended for ₹1.4 Cr project. Covers material theft, fire, structural damage during construction.' },
      { id: 'd27', done: false, text: 'Workmen\'s Compensation Policy (builder to provide)', note: 'Builder must have this. Protects you from liability if any labourer is injured on site.' },
    ],
  },
  {
    id: 'g5',
    title: 'E. Bank Construction Loan (if applicable)',
    color: '#6699FF',
    items: [
      { id: 'd28', done: false, text: 'KYC — Aadhaar + PAN card (all co-applicants)', note: 'Self-attested copies. Originals for bank verification. All co-owners must be co-applicants.' },
      { id: 'd29', done: false, text: 'Income proof — salary slips (3 months) or ITR (3 years)', note: 'Salaried: slips + Form 16 + 6-month bank statement. Self-employed: ITR 3yr + P&L + balance sheet.' },
      { id: 'd30', done: false, text: 'Bank statements — all accounts, last 6 months', note: 'Must show regular income credits. Joint account statements if applicable.' },
      { id: 'd31', done: false, text: 'CIBIL score check — minimum 750 recommended', note: 'Check free at cibil.com. Score below 700 affects loan amount and interest rate significantly.' },
      { id: 'd32', done: false, text: 'Original Sale Deed + EC submitted to bank', note: 'Bank holds originals as security. Get written acknowledgment receipt from bank.' },
      { id: 'd33', done: false, text: 'APDPMS digitally signed approved plan submitted to bank', note: 'Bank requires the official approved plan. Complete item B2 first.' },
      { id: 'd34', done: false, text: 'Structural Engineer certificate submitted to bank', note: 'Bank\'s technical valuer verifies structural safety. Same cert as item B3.' },
      { id: 'd35', done: false, text: 'Detailed construction cost estimate submitted to bank', note: 'Bank sanctions 75–80% of construction cost. Get estimate prepared by your engineer.' },
      { id: 'd36', done: false, text: 'Loan sanction letter received from bank', note: 'Keep original. Disbursements are stage-wise after bank technical officer inspects each stage.' },
      { id: 'd37', done: false, text: 'Bank technical valuation done (pre-disbursement)', note: 'Bank sends officer before each disbursement. Keep their contact number handy for quick visits.' },
    ],
  },
  {
    id: 'g6',
    title: 'F. On-Site Setup Before Work Starts',
    color: '#2DD4A0',
    items: [
      { id: 'd38', done: false, text: 'Approved plan — all 5 sheets laminated and kept on site', note: 'In a waterproof folder on site at all times. GVMC inspector may visit any time.' },
      { id: 'd39', done: false, text: 'BPO displayed at site entrance (visible hoarding)', note: 'GVMC requirement — Building Permission Order must be visibly displayed at entry.' },
      { id: 'd40', done: false, text: 'Site hoarding / boundary fence erected', note: 'Secure perimeter before any demolition or excavation begins.' },
      { id: 'd41', done: false, text: 'Temporary water + electricity connections live', note: 'Construction cannot start without both. Arrange before handing over to builder.' },
      { id: 'd42', done: false, text: 'Watchman + temporary accommodation ready', note: 'Live-in watchman with family before first material delivery. Water + electricity + toilet arranged.' },
      { id: 'd43', done: false, text: 'Soil test report + approved plan handed to builder supervisor', note: 'Builder supervisor must have copies on Day 1. No excuse for wrong founding depth.' },
      { id: 'd44', done: false, text: 'Construction commencement date recorded officially', note: 'Note date in writing. BPO has a commencement deadline. Inform LTP to log it in APDPMS.' },
    ],
  }
]

// Post-construction: Occupancy Certificate and handover tasks
// Shown in the separate Post-Construction stage page
export const POST_CONSTRUCTION_GROUPS = [
  {
    id: 'g7',
    title: 'G. Post-Construction: Occupancy Certificate',
    color: '#F5A623',
    items: [
      { id: 'd45', done: false, text: 'Completion certificate from LTP / structural engineer', note: 'LTP certifies construction matches approved plan. Without this, OC won\'t be processed.' },
      { id: 'd46', done: false, text: 'Occupancy Certificate (OC) application — APDPMS portal', note: 'Apply at portal.apdpms.ap.gov.in after completion. GVMC inspects within 15 days.' },
      { id: 'd47', done: false, text: 'Fire NOC — final (post-construction)', note: 'GVMC Fire Dept final NOC after building complete. Required for OC.' },
      { id: 'd48', done: false, text: 'APEPDCL permanent metered connection installed', note: 'Apply with OC draft. Transformer sanction obtained at item C6.' },
      { id: 'd49', done: false, text: 'GVMC permanent water + sewerage connection', note: 'Apply with OC copy.' },
      { id: 'd50', done: false, text: 'Property tax reassessment + new door number (GVMC)', note: 'After OC, apply to GVMC for revised property tax and new door number for the new building.' },
      { id: 'd51', done: false, text: 'RWH + solar compliance certificate from LTP', note: 'AP state mandate. LTP certifies implementation on site.' },
      { id: 'd52', done: false, text: 'Bank mortgage release after full loan repayment', note: 'Collect original sale deed from bank. Get mortgage cancellation deed registered at Sub-Registrar.' },
    ],
  },
]
