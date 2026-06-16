// ── Stage → Budget category mapping ──────────────────────────────────────────
// Maps each stage to its relevant budget category ID from BUDGET_DATA
// and the material IDs that are primarily consumed in that stage.
// Stage → budget category mapping — from Works Contract Agreement (Bheem Enterprises)
export const STAGE_BUDGET_MAP = {
    s0:         { catId: 'b1',  label: 'Pre-Construction'           },  // ₹3L — outside contract
    s_borewell: { catId: 'b0',  label: 'Borewell'                },
    s1:         { catId: 'b2',  label: 'Earth Work & Foundation'  },
    s_col_pb:   { catId: 'b2b', label: 'Columns & Plinth Beam'     },
    s4:         { catId: 'b3a', label: '1st Slab — Stilt Roof'    },
    s5:         { catId: 'b3b', label: '2nd Slab — Ground Roof'       },
    s6:         { catId: 'b3c', label: '3rd Slab — First Roof'       },
    s7:         { catId: 'b3d', label: '4th Slab — Second Roof'    },
    s7b:        { catId: 'b3e', label: '5th Slab — Terrace + OHT'    },
    s8:         { catId: 'b4a', label: 'Brick Work'               },
    s9:         { catId: 'b4b', label: 'Plastering'               },
    s10a:       { catId: 'b5a', label: 'Electrical'               },
    s10b:       { catId: 'b5b', label: 'Plumbing'                 },
    s11a:       { catId: 'b5c', label: 'SS Railing & Glass'       },
    s12:        { catId: 'b8',  label: 'Painting'                 },
    s13a:       { catId: 'b6a', label: 'Granite'                  },
    s13b:       { catId: 'b6b', label: 'Tiles & Flooring'         },
    s14a:       { catId: 'b9a', label: 'Lift & CCTV'              },
    s14b:       { catId: 'b9b', label: 'Generator & Power'        },
    s_handover: { catId: 'b9c', label: 'Systems & Handover'       },
    // Legacy IDs for backward compatibility
    s2:  { catId: 'b2',  label: 'Earth Work & Foundation' },
    s3:  { catId: 'b3a', label: '1st Slab — Stilt Roof'  },
    s10: { catId: 'b5a', label: 'Electrical'             },
    s11: { catId: 'b6b', label: 'Tiles & Flooring'       },
    s13: { catId: 'b8',  label: 'Painting'               },
    s14: { catId: 'b9c', label: 'Systems & Handover'     },
};

// ── Stage → primary materials used ───────────────────────────────────────────
export const STAGE_MATERIALS_MAP = {
    s_borewell: [],  // Borewell — no standard material tracking
    s1:  [],                           // Excavation — no tracked materials
    s2:  ['m1','m2','m3','m4','m5','m6','m9','m10'],  // Foundation — all steel + cement + aggregate
    s3:  ['m1','m2','m3','m4','m5','m6','m9'],         // Columns — steel + M25 cement + agg
    s4:  ['m1','m3','m4','m5','m6','m8','m9'],         // Stilt slab — slab steel + cement + sand + agg
    s5:  ['m1','m3','m4','m5','m6','m8','m9'],         // GF slab
    s6:  ['m2','m3','m4','m5','m6','m8','m9'],         // 1F slab
    s7:  ['m2','m3','m4','m5','m6','m8','m9'],         // 2F slab
    s8:  ['m7','m8','m11'],             // Masonry — PPC cement + sand + bricks
    s9:  ['m7','m8'],                   // Plastering — PPC + sand
    s10: [],                            // MEP — no material tracking in this system
    s11: ['m12','m13'],                 // Flooring — tiles
    s12: [],                            // Doors/windows — no material tracking
    s13: [],                            // Painting
    s14: [],                            // Systems
};

export const STAGES_DATA = [
  {
    "id": "s0",
    "label": "Pre-Construction: Documents & Approvals",
    "icon": "\ud83d\udccb",
    "color": "#F5A623",
    "phase": "prerequisite",
    "budgetPct": 2.2,
    "durationWks": 8,
    "budgetCatId": "b1",
    "contractAmount": 0,
    "paymentRule": "Outside contract \u2014 GVMC fees, legal, NOC fees paid directly by owner (~Rs 3L)",
    "materialIds": [],
    "checklist": [
      "A. LAND & OWNERSHIP DOCUMENTS",
      "Original Sale Deed (registered) in owner name \u2014 keep 3 certified copies",
      "Encumbrance Certificate (EC) \u2014 minimum 30 years from Sub-Registrar",
      "Pattadar Passbook / Pahani (meebhoomi.ap.gov.in) \u2014 S.No. 46",
      "Latest Property Tax receipt (GVMC) \u2014 must be paid up to date",
      "Survey Settlement Register (SSR) extract from MRO office",
      "Link documents / chain of title for minimum 30 years",
      "Ratnagiri HB Colony layout approval copy from GVMC",
      "Land classification confirmed as residential in Pahani",
      "B. BUILDING PERMISSION (GVMC / APDPMS)",
      "Building Permission Order (BPO) received \u2014 PER/1086/0349/2026",
      "GVMC-stamped approved plan \u2014 minimum 3 copies kept on site",
      "APDPMS digital copy downloaded and saved offline",
      "Approved structural drawings from Mannan Design Group received",
      "Plot demarcation survey done by licensed surveyor",
      "C. NOCs & UTILITY CLEARANCES",
      "APEPDCL NOC for electrical connection",
      "GVMC water supply NOC obtained",
      "Fire NOC if required for G+2 in Vizag",
      "D. FINANCIAL & INSURANCE",
      "Project budget finalised \u2014 Rs 1.41 Cr (contract + extras)",
      "Works contract signed \u2014 Bheem Enterprises (Rs 2100/sft)",
      "Structural engineer agreement signed \u2014 Mannan Design Group",
      "Construction insurance (CAR policy) taken and active",
      "E. BANK LOAN (IF APPLICABLE)",
      "Bank loan sanction letter received",
      "Loan disbursement schedule agreed with bank",
      "Bank-stamped approved plan obtained from bank",
      "Property mortgage documents executed",
      "F. ON-SITE SETUP BEFORE WORK STARTS",
      "Site handed over to contractor Bheem Enterprises",
      "Temporary electrical connection obtained from APEPDCL",
      "Site boundary wall / hoarding erected",
      "Watchman / security arrangement confirmed",
      "Construction water connection arranged",
      "Site office / store room set up on plot",
      "Safety equipment on site \u2014 helmets, harnesses, first aid box",
      "Labour welfare register opened (AP Labour Act)",
      "G. POST-CONSTRUCTION",
      "Occupancy Certificate (OC) application filed with GVMC",
      "Building completion certificate from structural engineer",
      "Water and electrical connections regularised"
    ],
    "requiredPhotos": [
      {
        "id": "s0_bpo",
        "label": "Building Permission Order",
        "description": "GVMC-stamped BPO \u2014 PER/1086/0349/2026",
        "mandatory": true
      },
      {
        "id": "s0_plan",
        "label": "Approved plan (stamped)",
        "description": "GVMC-stamped architectural drawing on site",
        "mandatory": true
      },
      {
        "id": "s0_site",
        "label": "Site handing over",
        "description": "Contractor Bheem Enterprises on site at handover",
        "mandatory": true
      },
      {
        "id": "s0_sign",
        "label": "Agreement signing",
        "description": "Signed works contract \u2014 both parties",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s0q1",
        "check": "BPO received and GVMC-stamped plan on site before any work starts",
        "severity": "critical"
      },
      {
        "id": "s0q2",
        "check": "Structural drawings from Mannan Design Group on site",
        "severity": "critical"
      },
      {
        "id": "s0q3",
        "check": "Works contract signed with Bheem Enterprises",
        "severity": "critical"
      },
      {
        "id": "s0q4",
        "check": "APEPDCL temporary power connection obtained",
        "severity": "high"
      },
      {
        "id": "s0q5",
        "check": "Construction insurance (CAR policy) active",
        "severity": "high"
      },
      {
        "id": "s0q6",
        "check": "Soil test report on site (Andhra University \u2014 SBC 14.4 t/m2)",
        "severity": "high"
      }
    ]
  },
  {
    "id": "s_borewell",
    "label": "Borewell Drilling",
    "icon": "\ud83d\udca7",
    "color": "#388BFD",
    "phase": "preparation",
    "budgetPct": 2.2,
    "durationWks": 1,
    "budgetCatId": "b0",
    "contractAmount": 300000,
    "paymentRule": "50% advance before drilling starts, 50% after yield test passes",
    "materialIds": [],
    "checklist": [
      "Get quotes from CGWB-licensed contractors \u2014 Bheem Enterprises coordination required",
      "Drilling rig mobilised to site (Plot MIG-167, PM Palem)",
      "Borewell location marked \u2014 minimum 15ft from septic tank, 10ft from boundary",
      "Drilling started at target depth 300\u2013400ft (Schedule A spec)",
      "Water struck at __ ft \u2014 log depth and yield",
      "PVC casing 4\" dia, 6kg/sqcm installed to full depth",
      "Development pumping \u2014 4 hours minimum to clear drilling mud",
      "Yield test \u2014 minimum 1 inch continuous flow",
      "Submersible pump installed (Grundfos / Kirloskar)",
      "Temporary electrical connection made for construction water",
      "Water quality NABL lab test \u2014 potability confirmed",
      "Completion certificate received from contractor with bore log",
      "CGWB registration filed (mandatory >100ft in AP)",
      "Invoice raised by contractor \u2014 \u20b93L total, pay \u20b91.5L advance then \u20b91.5L post yield test"
    ],
    "requiredPhotos": [
      {
        "id": "bw_rig",
        "label": "Drilling rig on site",
        "description": "Rig at marked location before drilling",
        "mandatory": true
      },
      {
        "id": "bw_strike",
        "label": "Water strike depth",
        "description": "Tape/rod showing depth at water strike",
        "mandatory": true
      },
      {
        "id": "bw_casing",
        "label": "PVC casing installation",
        "description": "4\" PVC casing being installed",
        "mandatory": true
      },
      {
        "id": "bw_pump",
        "label": "Submersible pump installation",
        "description": "Pump lowered with cable visible",
        "mandatory": true
      },
      {
        "id": "bw_yield",
        "label": "Yield test water flow",
        "description": "Actual water flow during 1-hour yield test",
        "mandatory": true
      },
      {
        "id": "bw_cert",
        "label": "Completion certificate",
        "description": "Contractor bore log certificate with depth and casing details",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "bwq1",
        "check": "Bore depth minimum 300ft confirmed on bore log",
        "severity": "critical"
      },
      {
        "id": "bwq2",
        "check": "PVC casing 6 kg/sqcm grade \u2014 check manufacturer stamp",
        "severity": "high"
      },
      {
        "id": "bwq3",
        "check": "Yield test: minimum 1 inch continuous flow for 1 hour",
        "severity": "critical"
      },
      {
        "id": "bwq4",
        "check": "NABL water quality test \u2014 potable result received",
        "severity": "high"
      },
      {
        "id": "bwq5",
        "check": "CGWB registration filed with proof",
        "severity": "medium"
      },
      {
        "id": "bwq6",
        "check": "\u20b91.5L advance paid only after rig is on site",
        "severity": "high"
      }
    ]
  },
  {
    "id": "s1",
    "label": "Earth Work & Foundation",
    "icon": "\u26cf",
    "color": "#D29922",
    "phase": "foundation",
    "budgetPct": 6.7,
    "durationWks": 6,
    "budgetCatId": "b2",
    "contractAmount": 1400000,
    "paymentRule": "\u20b97L before earth work starts, \u20b97L after foundation concrete accepted",
    "materialIds": [
      "m1",
      "m2",
      "m3",
      "m4",
      "m5",
      "m6",
      "m9",
      "m10"
    ],
    "checklist": [
      "Structural drawings from Mannan Design Group received and reviewed",
      "Column centre lines marked per approved plan (Option-05)",
      "Excavation to minimum 2.4m FOD (as per Andhra University soil test \u2014 SBC 14.4 t/m\u00b2)",
      "Soil at founding level inspected \u2014 CI soil, Plasticity Index 19%",
      "Anti-termite pre-construction treatment applied",
      "Earth pits / electrode pits dug as per earthing plan",
      "PCC 1:4:8 bed (150mm) placed in all footing pits",
      "F1 footing rebar \u2014 10\u00d8-22 bars both ways (9\u00d77.5ft pad)",
      "F3 footing rebar \u00d79 \u2014 10\u00d8-18 bars (4.5\u00d74.5ft pad)",
      "F4 footing rebar \u2014 12mm@4\"c/c (3.5\u00d73.5ft pad)",
      "F5 footing rebar \u2014 12mm@5\"c/c (2.5\u00d72.5ft pad)",
      "CF-1 combined footing 15\u00d78ft \u2014 beam steel as per drawing",
      "Column pedestal steel placed (8\u00d8@6\"c/c ties, 4-legged)",
      "50mm cover blocks on all footing steel",
      "M20 concrete poured (OPC 53 Ramco/Priya/Maha \u2014 Schedule A)",
      "3 cube samples per batch \u2014 28-day target \u226520 N/mm\u00b2",
      "Vibrator used continuously during pour",
      "7-day wet curing (jute + water) after pour",
      "Cube test results received and filed",
      "Backfilling in 150mm compacted layers"
    ],
    "requiredPhotos": [
      {
        "id": "s1_excav",
        "label": "Excavation depth check",
        "description": "Steel rod measuring 2.4m depth in pit",
        "mandatory": true
      },
      {
        "id": "s1_pcc",
        "label": "PCC bed laid",
        "description": "150mm PCC 1:4:8 before footing steel",
        "mandatory": true
      },
      {
        "id": "s1_steel",
        "label": "Footing rebar in place",
        "description": "All footing steel with cover blocks before pour",
        "mandatory": true
      },
      {
        "id": "s1_pour",
        "label": "M20 concrete pour",
        "description": "Concrete being placed with vibrator",
        "mandatory": true
      },
      {
        "id": "s1_cubes",
        "label": "Cube samples taken",
        "description": "3 cube moulds being filled from same batch",
        "mandatory": true
      },
      {
        "id": "s1_curing",
        "label": "Curing in progress",
        "description": "Wet jute on footings, dated watchman log visible",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s1q1",
        "check": "All column centres match Mannan Design Group plan Option-05",
        "severity": "critical"
      },
      {
        "id": "s1q2",
        "check": "Excavation depth \u22652.4m confirmed at each pit",
        "severity": "critical"
      },
      {
        "id": "s1q3",
        "check": "F1/F3/CF-1 rebar dia and spacing matches structural drawing",
        "severity": "critical"
      },
      {
        "id": "s1q4",
        "check": "Cover blocks 50mm on all sides before pour",
        "severity": "critical"
      },
      {
        "id": "s1q5",
        "check": "M20 concrete (OPC 53 Grade) \u2014 Ramco/Priya/Maha brand",
        "severity": "critical"
      },
      {
        "id": "s1q6",
        "check": "3 cube samples per batch \u2014 lab receipts filed",
        "severity": "high"
      },
      {
        "id": "s1q7",
        "check": "28-day cube results \u226520 N/mm\u00b2 before next stage payment",
        "severity": "high"
      },
      {
        "id": "s1q8",
        "check": "\u20b97L advance released only after contractor starts earthwork",
        "severity": "high"
      }
    ]
  },
  {
    "id": "s_col_pb",
    "label": "Columns & Plinth Beam",
    "icon": "\ud83c\udfdb",
    "color": "#3D7EFF",
    "phase": "foundation",
    "budgetPct": 3.7,
    "durationWks": 4,
    "budgetCatId": "b2b",
    "contractAmount": 0,
    "paymentRule": "Included in Earth Work & Foundation payment (\u20b914L covers excavation through plinth beam)",
    "materialIds": [
      "m1",
      "m2",
      "m3",
      "m4",
      "m5",
      "m6",
      "m9"
    ],
    "checklist": [
      "Pedestal columns (8\u00d8@6\"c/c, 4-legged ties) cast over footings",
      "C1 column (1 no, 9\"\u00d724\") \u2014 8-20\u00d8 main bars",
      "C2 column (1 no, 9\"\u00d718\") \u2014 8-20\u00d8 main bars",
      "C3 columns (9 nos, 9\"\u00d718\") \u2014 4-20\u00d8 + 4-16\u00d8",
      "C4 column (1 no, 9\"\u00d718\") \u2014 8-16\u00d8 (reducing in upper floors)",
      "C5 columns (2 nos, 9\"\u00d715\") \u2014 8-16\u00d8",
      "All column ties 8\u00d8@8\"c/c (IS 13920 C-hooks, 135\u00b0)",
      "Column shuttering plumb checked both directions",
      "M25 concrete (OPC 53 \u2014 Schedule A) with slump test 80-100mm",
      "Cube samples taken",
      "14-day column curing",
      "CF-1 grade beam (24\"\u00d730\") \u2014 8-20\u00d8, 10\u00d8@4\"c/c ties",
      "Plinth beam rebar placed per drawing",
      "Plinth beam M25 pour and curing",
      "DPC (Damp Proof Course) applied"
    ],
    "requiredPhotos": [
      {
        "id": "scol_rebar",
        "label": "Column rebar cage",
        "description": "Main bars + 8\u00d8 ties at correct spacing",
        "mandatory": true
      },
      {
        "id": "scol_cover",
        "label": "38mm cover blocks",
        "description": "Cover blocks on all 4 sides of column cage",
        "mandatory": true
      },
      {
        "id": "scol_plumb",
        "label": "Shuttering plumb check",
        "description": "Spirit level on form \u2014 both directions",
        "mandatory": true
      },
      {
        "id": "scol_pour",
        "label": "M25 column pour",
        "description": "Concrete with vibrator, no segregation",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "scolq1",
        "check": "Column sizes and rebar match schedule: C1=9\u00d724\", C3=9\u00d718\", C5=9\u00d715\"",
        "severity": "critical"
      },
      {
        "id": "scolq2",
        "check": "8\u00d8 ties 135\u00b0 C-hooks as per IS 13920 (seismic detailing)",
        "severity": "critical"
      },
      {
        "id": "scolq3",
        "check": "M25 concrete (OPC 53 Ramco/Priya/Maha)",
        "severity": "critical"
      },
      {
        "id": "scolq4",
        "check": "Slump test 80-100mm on site before pour",
        "severity": "high"
      }
    ]
  },
  {
    "id": "s_col_pb",
    "label": "Columns & Plinth Beam",
    "icon": "🏛",
    "color": "#3D7EFF",
    "phase": "foundation",
    "budgetPct": 3.7,
    "durationWks": 4,
    "budgetCatId": "b2b",
    "contractAmount": 0,
    "paymentRule": "Included in Earth Work & Foundation payment (Rs 14L)",
    "materialIds": ["m1","m2","m3","m4","m5","m6","m9"],
    "checklist": [
      "C1 column (1 no, 9\"x24\") — 8-20Ø main bars",
      "C2 column (1 no, 9\"x18\") — 8-20Ø main bars",
      "C3 columns (9 nos, 9\"x18\") — 4-20Ø + 4-16Ø",
      "C4 column (1 no, 9\"x18\") — 8-16Ø",
      "C5 columns (2 nos, 9\"x15\") — 8-16Ø",
      "All column ties 8Ø@8\"c/c (IS 13920 C-hooks, 135°)",
      "Column shuttering plumb checked both directions",
      "M25 concrete (OPC 53) with slump test 80-100mm",
      "Cube samples taken",
      "14-day column curing",
      "Plinth beam rebar placed per drawing",
      "Plinth beam M25 pour and curing",
      "DPC applied"
    ],
    "requiredPhotos": [],
    "qualityChecks": []
  },
  {
    "id": "s4",
    "label": "1st Slab \u2014 Stilt Roof (GF Slab)",
    "icon": "\ud83c\udfd7",
    "color": "#F5A623",
    "phase": "structure",
    "budgetPct": 8.9,
    "durationWks": 5,
    "budgetCatId": "b3a",
    "contractAmount": 1200000,
    "paymentRule": "\u20b96L before slab shuttering starts, \u20b96L after slab accepted and props stripped at 28 days",
    "materialIds": [
      "m1",
      "m3",
      "m4",
      "m5",
      "m6",
      "m8",
      "m9"
    ],
    "checklist": [
      "Stilt floor columns cast to full stilt height",
      "Beam shuttering and props erected",
      "Beam bottom reinforcement \u2014 24\"\u00d730\" beams: 8-20\u00d8 top, 4-20\u00d8 bottom",
      "Beam stirrups 10\u00d8@4\"c/c (near supports), @8\"c/c (mid)",
      "Slab soffit shuttering at correct level",
      "Slab 12\u00d8@100mm main and distribution bars placed",
      "25mm cover blocks under slab steel",
      "Electrical conduits for stilt/ground floor laid before pour",
      "RMC M25 ordered \u2014 OPC 53 Grade (Schedule A brands)",
      "Slump test on delivery \u2014 80-100mm target",
      "Pour sequence: beams first then slab panel by panel",
      "Mechanical vibrator at every 500mm",
      "Surface finish levelled with screed",
      "3 cube samples per 5cum or per batch",
      "Ponding or wet gunny curing starting within 24 hours",
      "28-day curing before stripping props and releasing second payment",
      "Stilt parking tiles (1\u00d71ft) \u2014 surface prep checked"
    ],
    "requiredPhotos": [
      {
        "id": "s4_beam",
        "label": "Beam rebar before pour",
        "description": "24\u00d730\" beam main bars + stirrups visible",
        "mandatory": true
      },
      {
        "id": "s4_slab",
        "label": "Slab steel in place",
        "description": "12\u00d8@100mm both ways with cover blocks",
        "mandatory": true
      },
      {
        "id": "s4_conduit",
        "label": "Conduits in slab",
        "description": "All electrical conduits tied before pour",
        "mandatory": true
      },
      {
        "id": "s4_rmc",
        "label": "RMC delivery challan",
        "description": "Grade M25 challan showing mix design and batch",
        "mandatory": true
      },
      {
        "id": "s4_pour",
        "label": "Pour in progress",
        "description": "Concrete spread with vibrator \u2014 no dry pockets",
        "mandatory": true
      },
      {
        "id": "s4_cube",
        "label": "Cube samples",
        "description": "3 cubes per batch being labelled",
        "mandatory": true
      },
      {
        "id": "s4_cure",
        "label": "Curing day 1",
        "description": "Ponding or wet jute over full slab area",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s4q1",
        "check": "Beam sizes match drawing: 24\"\u00d730\" main beams",
        "severity": "critical"
      },
      {
        "id": "s4q2",
        "check": "Slab thickness per drawing \u2014 measure at 3 points",
        "severity": "critical"
      },
      {
        "id": "s4q3",
        "check": "M25 RMC with OPC 53 (Ramco/Priya/Maha) \u2014 verify challan",
        "severity": "critical"
      },
      {
        "id": "s4q4",
        "check": "Cube test results \u226525 N/mm\u00b2 at 28 days before prop strip",
        "severity": "critical"
      },
      {
        "id": "s4q5",
        "check": "No loading on slab for 28 days after pour",
        "severity": "high"
      },
      {
        "id": "s4q6",
        "check": "Second \u20b96L released only after 28-day cube results received",
        "severity": "critical"
      }
    ]
  },
  {
    "id": "s5",
    "label": "2nd Slab \u2014 Ground Roof (FF Slab)",
    "icon": "\ud83c\udfd7",
    "color": "#E6A817",
    "phase": "structure",
    "budgetPct": 8.9,
    "durationWks": 5,
    "budgetCatId": "b3b",
    "contractAmount": 1200000,
    "paymentRule": "\u20b96L before FF slab shuttering starts, \u20b96L after slab accepted at 28 days",
    "materialIds": [
      "m1",
      "m3",
      "m4",
      "m5",
      "m6",
      "m8",
      "m9"
    ],
    "checklist": [
      "GF columns cast to FF beam level",
      "FF beam and slab shuttering erected",
      "Beam reinforcement per drawing (bars reducing per column schedule)",
      "Slab 12\u00d8@100mm steel placed with cover blocks",
      "Electrical conduits for first floor laid",
      "M25 RMC pour with slump test",
      "Cube samples \u2014 3 per batch",
      "28-day curing before second payment release"
    ],
    "requiredPhotos": [
      {
        "id": "s5_steel",
        "label": "FF slab rebar",
        "description": "Steel and cover blocks before pour",
        "mandatory": true
      },
      {
        "id": "s5_pour",
        "label": "FF slab pour",
        "description": "RMC delivery + pour in progress",
        "mandatory": true
      },
      {
        "id": "s5_cube",
        "label": "Cube samples",
        "description": "Labelled cubes from pour batch",
        "mandatory": true
      },
      {
        "id": "s5_cure",
        "label": "Curing",
        "description": "28-day curing evidence",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s5q1",
        "check": "Rebar matches column reinforcement schedule (bars reduce at FF)",
        "severity": "critical"
      },
      {
        "id": "s5q2",
        "check": "M25 concrete \u2014 OPC 53 Grade challan verified",
        "severity": "critical"
      },
      {
        "id": "s5q3",
        "check": "28-day cube \u226525 N/mm\u00b2 before balance payment",
        "severity": "critical"
      }
    ]
  },
  {
    "id": "s6",
    "label": "3rd Slab \u2014 First Roof (SF Slab)",
    "icon": "\ud83c\udfd7",
    "color": "#D9960F",
    "phase": "structure",
    "budgetPct": 8.9,
    "durationWks": 5,
    "budgetCatId": "b3c",
    "contractAmount": 1200000,
    "paymentRule": "\u20b96L before SF slab starts, \u20b96L after 28-day acceptance",
    "materialIds": [
      "m2",
      "m3",
      "m4",
      "m5",
      "m6",
      "m8",
      "m9"
    ],
    "checklist": [
      "SF columns cast to SF beam level",
      "SF beam and slab shuttering",
      "Rebar per column schedule (further reduction in bar diameters)",
      "Slab steel + conduits",
      "M25 RMC pour with cube samples",
      "28-day curing"
    ],
    "requiredPhotos": [
      {
        "id": "s6_steel",
        "label": "SF slab rebar",
        "description": "Steel in place before pour",
        "mandatory": true
      },
      {
        "id": "s6_pour",
        "label": "SF slab pour",
        "description": "Pour in progress",
        "mandatory": true
      },
      {
        "id": "s6_cube",
        "label": "Cube samples",
        "description": "Per batch cubes",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s6q1",
        "check": "Column reinforcement reduced per schedule (C3 upper: 8-12\u00d8 at SF)",
        "severity": "critical"
      },
      {
        "id": "s6q2",
        "check": "M25 concrete OPC 53",
        "severity": "critical"
      },
      {
        "id": "s6q3",
        "check": "28-day cube \u226525 N/mm\u00b2 before balance payment",
        "severity": "critical"
      }
    ]
  },
  {
    "id": "s7",
    "label": "4th Slab \u2014 Second Roof (TF Slab)",
    "icon": "\ud83c\udfd7",
    "color": "#CC8A00",
    "phase": "structure",
    "budgetPct": 8.9,
    "durationWks": 5,
    "budgetCatId": "b3d",
    "contractAmount": 1200000,
    "paymentRule": "\u20b96L before 2nd floor roof slab starts; \u20b96L after 28-day cube acceptance.",
    "materialIds": [
      "m2",
      "m3",
      "m4",
      "m5",
      "m6",
      "m8",
      "m9"
    ],
    "checklist": [
      "Terrace slab rebar placed",
      "Terrace slope 1:50 for waterproofing drainage as per drawing",
      "Lift headroom RCC slab constructed as per approved plan",
      "Overhead water tank RCC or brick \u2014 as per drawing",
      "M25 pour with cube samples",
      "Waterproofing treatment on terrace \u2014 minimum 10-year manufacturer warranty (contract clause 5.6)",
      "28-day curing",
      "All concrete cube test results from s4/s5/s6/s7 compiled and filed",
      "Contractor raises invoice \u2014 total payable finalised (1,595 sft \u00d7 4 floors \u00d7 \u20b92,100)"
    ],
    "requiredPhotos": [
      {
        "id": "s7_slope",
        "label": "Terrace slope verification",
        "description": "Level showing 1:50 fall for drainage",
        "mandatory": true
      },
      {
        "id": "s7_lh",
        "label": "Lift headroom slab",
        "description": "Headroom rebar and pour",
        "mandatory": true
      },
      {
        "id": "s7_oht",
        "label": "OHT construction",
        "description": "Overhead tank completed",
        "mandatory": true
      },
      {
        "id": "s7_wp",
        "label": "Waterproofing applied",
        "description": "Waterproofing coat on terrace with contractor warranty card",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s7q1",
        "check": "Terrace waterproofing has minimum 10-year manufacturer warranty (contract clause 5.6)",
        "severity": "critical"
      },
      {
        "id": "s7q2",
        "check": "All slab cube test results (s4\u2013s7) compiled and filed",
        "severity": "high"
      },
      {
        "id": "s7q3",
        "check": "Total built-up area measured and agreed with contractor for final payable",
        "severity": "critical"
      }
    ]
  },
  {
    "id": "s7b",
    "label": "5th Slab \u2014 Terrace + Lift Headroom + OHT",
    "icon": "\ud83c\udfd7",
    "color": "#B8860B",
    "phase": "structure",
    "budgetPct": 0,
    "durationWks": 5,
    "budgetCatId": "b3d",
    "contractAmount": 0,
    "paymentRule": "Included in 4th Slab contract payment. Total payable derived after OHT and lift headroom are cast.",
    "materialIds": [
      "m2",
      "m3",
      "m4",
      "m5",
      "m6",
      "m8",
      "m9"
    ],
    "checklist": [
      "Terrace slab rebar placed per drawing",
      "Terrace slope 1:50 for drainage \u2014 check with spirit level",
      "Lift headroom RCC slab constructed as per approved plan (min 8.5ft total shaft height)",
      "Overhead water tank RCC or brick \u2014 as per drawing",
      "M25 pour with cube samples",
      "Waterproofing treatment on terrace \u2014 minimum 10-year manufacturer warranty (contract clause 5.6)",
      "28-day curing",
      "All concrete cube test results from s4\u2013s7b compiled and filed",
      "Total built-up area measured and agreed with contractor for final payable calculation"
    ],
    "requiredPhotos": [
      {
        "id": "s7b_slope",
        "label": "Terrace slope verification",
        "description": "Level showing 1:50 fall for drainage",
        "mandatory": true
      },
      {
        "id": "s7b_lh",
        "label": "Lift headroom slab",
        "description": "Headroom rebar and pour",
        "mandatory": true
      },
      {
        "id": "s7b_oht",
        "label": "OHT construction",
        "description": "Overhead tank completed",
        "mandatory": true
      },
      {
        "id": "s7b_wp",
        "label": "Waterproofing applied",
        "description": "Waterproofing coat with 10-year warranty card",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s7bq1",
        "check": "Terrace waterproofing has minimum 10-year manufacturer warranty (contract clause 5.6)",
        "severity": "critical"
      },
      {
        "id": "s7bq2",
        "check": "All slab cube test results (s4\u2013s7b) compiled and filed",
        "severity": "high"
      },
      {
        "id": "s7bq3",
        "check": "Total built-up area measured and agreed with contractor for final payable",
        "severity": "critical"
      },
      {
        "id": "s7bq4",
        "check": "Lift headroom height minimum 8.5ft from GF slab (structural drawing note)",
        "severity": "high"
      }
    ]
  },
  {
    "id": "s8",
    "label": "Brick Work",
    "icon": "\ud83e\uddf1",
    "color": "#F85149",
    "phase": "masonry",
    "budgetPct": 8.9,
    "durationWks": 8,
    "budgetCatId": "b4a",
    "contractAmount": 1200000,
    "paymentRule": "\u20b96L before brick work starts, \u20b96L after all masonry completed",
    "materialIds": [
      "m7",
      "m8",
      "m11"
    ],
    "checklist": [
      "Outer walls 9\" red brick \u2014 CM 1:6 (Schedule A spec)",
      "Inner walls 4\" red brick \u2014 CM 1:6",
      "Ground floor: outer walls only until tenant confirmed (contract clause 3.2)",
      "Bricks soaked minimum 30 min before laying",
      "Max 1m wall height per day",
      "Plumb checked every 600mm with spirit level",
      "Lintels over all door and window openings (rebar as per drawing)",
      "Sill beams at window bottoms",
      "Provision for all door and window frames as per Schedule A sizes",
      "Balcony walls as per plan"
    ],
    "requiredPhotos": [
      {
        "id": "s8_soak",
        "label": "Bricks soaking",
        "description": "Bricks submerged in water before use",
        "mandatory": true
      },
      {
        "id": "s8_plumb",
        "label": "Wall plumb check",
        "description": "Spirit level on wall at 600mm intervals",
        "mandatory": true
      },
      {
        "id": "s8_lintel",
        "label": "Lintel rebar in place",
        "description": "Rebar in lintel before concrete",
        "mandatory": true
      },
      {
        "id": "s8_gf",
        "label": "Ground floor outer walls",
        "description": "GF outer walls only per contract clause 3.2",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s8q1",
        "check": "PPC Grade cement used for masonry (Schedule A \u2014 Ramco/Priya/Maha)",
        "severity": "high"
      },
      {
        "id": "s8q2",
        "check": "9\" outer walls, 4\" inner walls as per Schedule A",
        "severity": "high"
      },
      {
        "id": "s8q3",
        "check": "Bricks soaked min 30 min \u2014 verified on site",
        "severity": "high"
      },
      {
        "id": "s8q4",
        "check": "GF inner walls NOT started until tenant confirmation (contract 3.2)",
        "severity": "critical"
      }
    ]
  },
  {
    "id": "s9",
    "label": "Plastering",
    "icon": "\ud83e\udea3",
    "color": "#FF6E40",
    "phase": "masonry",
    "budgetPct": 5.9,
    "durationWks": 6,
    "budgetCatId": "b4b",
    "contractAmount": 800000,
    "paymentRule": "\u20b94L before plastering starts, \u20b94L after internal + external plaster completed",
    "materialIds": [
      "m7",
      "m8"
    ],
    "checklist": [
      "RCC surfaces hacked for key",
      "Chicken mesh at brick-RCC junctions (prevents cracking)",
      "Internal: 12mm CM 1:6 with PPC (Schedule A \u2014 Ramco/Priya/Maha)",
      "External: 15mm CM 1:5 with sponge finish",
      "Ceiling plaster \u2014 smooth finish",
      "7-day wet curing after each coat",
      "Surface quality check \u2014 no hollows, no cracks"
    ],
    "requiredPhotos": [
      {
        "id": "s9_hack",
        "label": "Hacking done",
        "description": "RCC surfaces hacked before plaster",
        "mandatory": true
      },
      {
        "id": "s9_mesh",
        "label": "Chicken mesh at junctions",
        "description": "Mesh at brick-RCC interface",
        "mandatory": true
      },
      {
        "id": "s9_int",
        "label": "Internal plaster completed",
        "description": "All rooms smooth finish",
        "mandatory": true
      },
      {
        "id": "s9_ext",
        "label": "External plaster completed",
        "description": "Exterior plaster with groove lines",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s9q1",
        "check": "PPC cement (Schedule A) used for plaster \u2014 not OPC",
        "severity": "high"
      },
      {
        "id": "s9q2",
        "check": "Chicken mesh installed at all brick-RCC junctions",
        "severity": "high"
      },
      {
        "id": "s9q3",
        "check": "No hollow sound on tap test \u2014 rework any hollow patches",
        "severity": "high"
      }
    ]
  },
  {
    "id": "s10a",
    "label": "Electrical Work",
    "icon": "\u26a1",
    "color": "#D29922",
    "phase": "mep",
    "budgetPct": 4.4,
    "durationWks": 5,
    "budgetCatId": "b5a",
    "contractAmount": 600000,
    "paymentRule": "\u20b93L advance, \u20b93L after electrical work completed and tested",
    "materialIds": [],
    "checklist": [
      "Concealed wiring throughout \u2014 Finolex / R.R. / Havells (Schedule A)",
      "Each bedroom: 1 fan + 2 lights (1 tubelight + 1 LED) + plug point + 3 plug points on different walls",
      "Kitchen: water purifier point + grinder/appliance above platform + fridge point",
      "East balcony/utility: washing machine tap + electrical point",
      "Modular switches \u2014 Legrand / Schneider (Schedule A)",
      "MCB distribution board per floor \u2014 Legrand / Schneider",
      "Earth wiring \u2014 bare copper wire throughout",
      "Inverter wiring provision for all floors",
      "Electricity meter stand erected",
      "Transformer as per APEPDCL recommendation",
      "Continuity test on all circuits before wall closing",
      "DB box load balancing verified"
    ],
    "requiredPhotos": [
      {
        "id": "s10a_conduit",
        "label": "Conduit routing",
        "description": "All conduits in wall before plaster",
        "mandatory": true
      },
      {
        "id": "s10a_db",
        "label": "DB box installation",
        "description": "MCB distribution board per floor",
        "mandatory": true
      },
      {
        "id": "s10a_earth",
        "label": "Earth wiring",
        "description": "Bare copper earth wire routing",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s10aq1",
        "check": "Finolex/R.R./Havells wiring \u2014 verify cable brand on coil sticker",
        "severity": "high"
      },
      {
        "id": "s10aq2",
        "check": "Legrand/Schneider modular switches and MCB boards",
        "severity": "medium"
      },
      {
        "id": "s10aq3",
        "check": "Continuity and insulation test (Megger) on all circuits",
        "severity": "high"
      },
      {
        "id": "s10aq4",
        "check": "Inverter wiring provision in all floors",
        "severity": "medium"
      }
    ]
  },
  {
    "id": "s10b",
    "label": "Plumbing",
    "icon": "\ud83d\udebf",
    "color": "#3FB950",
    "phase": "mep",
    "budgetPct": 5.9,
    "durationWks": 5,
    "budgetCatId": "b5b",
    "contractAmount": 800000,
    "paymentRule": "\u20b94L advance, \u20b94L after pressure test passed and all fittings installed",
    "materialIds": [],
    "checklist": [
      "CPVC inlet lines \u2014 Astral / Truflo (Schedule A)",
      "UPVC drainage lines \u2014 Astral / Truflo",
      "Hot and cold water provision in all bathrooms",
      "Bathroom fittings: medium washbasin + Western commode + flush + jet spray + shower \u2014 Hindware / Cera",
      "Kitchen: steel sink with U-shape tap",
      "Kitchen water purifier electrical + water point",
      "East balcony: washing machine tap + 3-4ft height tap",
      "Utility platform with sink and tap",
      "Rain water harvesting connection",
      "Septic tank connection",
      "Water sump plumbing",
      "Pressure test on all inlet lines before wall closing",
      "All taps installed \u2014 Plumber grade Schedule A"
    ],
    "requiredPhotos": [
      {
        "id": "s10b_cpvc",
        "label": "CPVC inlet lines",
        "description": "Astral/Truflo pipes before wall closing",
        "mandatory": true
      },
      {
        "id": "s10b_upvc",
        "label": "UPVC drainage",
        "description": "Drainage lines installed",
        "mandatory": true
      },
      {
        "id": "s10b_pressure",
        "label": "Pressure test result",
        "description": "Gauge showing pressure test pass",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s10bq1",
        "check": "CPVC/UPVC \u2014 Astral or Truflo brand \u2014 check pipe markings",
        "severity": "high"
      },
      {
        "id": "s10bq2",
        "check": "Pressure test on all inlet lines before walls closed",
        "severity": "critical"
      },
      {
        "id": "s10bq3",
        "check": "Hindware/Cera bathroom fittings \u2014 verify brand before installation",
        "severity": "medium"
      }
    ]
  },
  {
    "id": "s11a",
    "label": "SS Railing & Glass",
    "icon": "\ud83e\ude9e",
    "color": "#8957E5",
    "phase": "finishing",
    "budgetPct": 3.0,
    "durationWks": 3,
    "budgetCatId": "b5c",
    "contractAmount": 400000,
    "paymentRule": "\u20b92L advance, \u20b92L after all railings and glass installed",
    "materialIds": [],
    "checklist": [
      "North balcony: SS 304 frame with glass walls (Schedule A)",
      "South balcony: SS 304 frame with glass walls (Schedule A)",
      "East balcony/utility: SS 304 frame with glass walls + sliding glass door",
      "Staircase railing: SS 304 Jindal brand (Schedule A)",
      "Glass panels \u2014 safety glass (minimum 8mm toughened)",
      "All SS welding joints polished to mirror finish",
      "East balcony: granite door frames for sliding door"
    ],
    "requiredPhotos": [
      {
        "id": "s11a_ss",
        "label": "SS 304 railing installed",
        "description": "Railing with grade stamp visible",
        "mandatory": true
      },
      {
        "id": "s11a_glass",
        "label": "Glass panels installed",
        "description": "Safety glass in balcony railings",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s11aq1",
        "check": "SS 304 grade \u2014 Jindal brand stamp on staircase railing",
        "severity": "high"
      },
      {
        "id": "s11aq2",
        "check": "Glass minimum 8mm toughened safety glass",
        "severity": "high"
      },
      {
        "id": "s11aq3",
        "check": "All balconies: north, south, east completed per Schedule A",
        "severity": "medium"
      }
    ]
  },
  {
    "id": "s12",
    "label": "Painting",
    "icon": "\ud83c\udfa8",
    "color": "#A371F7",
    "phase": "finishing",
    "budgetPct": 5.9,
    "durationWks": 4,
    "budgetCatId": "b8",
    "contractAmount": 800000,
    "paymentRule": "\u20b94L before painting starts, \u20b94L after all painting completed",
    "materialIds": [],
    "checklist": [
      "Interior: putty finish on all walls (Schedule A)",
      "Interior: emulsion paint 2 coats \u2014 Berger / Asian / Birla Opus (Schedule A)",
      "Exterior: texture finish \u2014 Berger / Asian / Birla Opus (Schedule A)",
      "Ceiling: emulsion coat",
      "All paint application after plaster is fully dry (28 days minimum)",
      "Final colour as approved by employer"
    ],
    "requiredPhotos": [
      {
        "id": "s12_putty",
        "label": "Putty application",
        "description": "Putty base coat on all interior walls",
        "mandatory": true
      },
      {
        "id": "s12_int",
        "label": "Interior emulsion complete",
        "description": "Final coat on all walls and ceiling",
        "mandatory": true
      },
      {
        "id": "s12_ext",
        "label": "Exterior texture complete",
        "description": "Full exterior texture finish",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s12q1",
        "check": "Berger/Asian/Birla Opus brand \u2014 verify on paint tin",
        "severity": "medium"
      },
      {
        "id": "s12q2",
        "check": "Putty base fully dry (28 days after plaster) before emulsion",
        "severity": "medium"
      },
      {
        "id": "s12q3",
        "check": "No streaks or uneven patches \u2014 visual check before balance payment",
        "severity": "medium"
      }
    ]
  },
  {
    "id": "s13a",
    "label": "Granite Work",
    "icon": "\ud83e\udea8",
    "color": "#6E7681",
    "phase": "finishing",
    "budgetPct": 4.4,
    "durationWks": 4,
    "budgetCatId": "b6a",
    "contractAmount": 600000,
    "paymentRule": "\u20b93L advance, \u20b93L after granite work completed",
    "materialIds": [],
    "checklist": [
      "Kitchen platform \u2014 Blackberry / Steel Gray granite (Schedule A)",
      "Staircase \u2014 granite flooring (Schedule A)",
      "Lift area \u2014 granite flooring (Schedule A)",
      "Corridors \u2014 granite flooring",
      "All door frames (except main door) \u2014 granite frames (Schedule A)",
      "All window frames \u2014 granite frames (Schedule A)",
      "East balcony sliding door frames \u2014 granite",
      "Main door: African teak wood frame + shutter \u2014 6\u00d73 inch frame (Schedule A)",
      "Kitchen platform with CC plank cupboards"
    ],
    "requiredPhotos": [
      {
        "id": "s13a_kit",
        "label": "Kitchen granite platform",
        "description": "Blackberry/Steel Gray granite platform installed",
        "mandatory": true
      },
      {
        "id": "s13a_stair",
        "label": "Staircase granite",
        "description": "Granite on staircase steps",
        "mandatory": true
      },
      {
        "id": "s13a_door",
        "label": "Main door teak wood",
        "description": "African teak frame and shutter installed",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s13aq1",
        "check": "Kitchen granite: Blackberry or Steel Gray colour \u2014 match Schedule A",
        "severity": "high"
      },
      {
        "id": "s13aq2",
        "check": "Main door: African teak wood, frame size 6\u00d73 inches",
        "severity": "high"
      },
      {
        "id": "s13aq3",
        "check": "All granite frames at doors and windows level and plumb",
        "severity": "medium"
      }
    ]
  },
  {
    "id": "s13b",
    "label": "Tiles & Flooring",
    "icon": "\ud83e\ude9f",
    "color": "#3FB950",
    "phase": "finishing",
    "budgetPct": 4.4,
    "durationWks": 4,
    "budgetCatId": "b6b",
    "contractAmount": 600000,
    "paymentRule": "\u20b93L advance, \u20b93L after all tile work completed",
    "materialIds": [
      "m12",
      "m13"
    ],
    "checklist": [
      "Stilt parking floor: 1\u00d71ft tiles (Schedule A spec)",
      "All rooms + corridors + balcony: 2\u00d74ft Gujarat double-charge vitrified tiles (Schedule A)",
      "Bathroom floor: 2\u00d72ft Gujarat vitrified tiles (Schedule A)",
      "Bathroom walls: 2\u00d74ft Gujarat vitrified tiles up to ceiling (Schedule A)",
      "Kitchen floor: 2\u00d74ft Gujarat tiles",
      "Bedroom floor: 2\u00d74ft Gujarat tiles",
      "Bedroom cupboards: CC plank cupboards",
      "Full evenness \u2014 straight edge test on all tiles",
      "Tap test \u2014 no hollow tiles",
      "Uniform joint spacing"
    ],
    "requiredPhotos": [
      {
        "id": "s13b_room",
        "label": "Room tiles in progress",
        "description": "2\u00d74ft tiles with spacers, uniform joints",
        "mandatory": true
      },
      {
        "id": "s13b_bath",
        "label": "Bathroom tiles",
        "description": "2\u00d72ft floor + 2\u00d74ft wall tiles up to ceiling",
        "mandatory": true
      },
      {
        "id": "s13b_stilt",
        "label": "Stilt parking tiles",
        "description": "1\u00d71ft tiles in stilt floor",
        "mandatory": true
      },
      {
        "id": "s13b_tap",
        "label": "Tap test done",
        "description": "Inspector tapping tiles for hollow sound",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s13bq1",
        "check": "Gujarat Double Charge Vitrified tiles \u2014 check brand on box",
        "severity": "high"
      },
      {
        "id": "s13bq2",
        "check": "No hollow sound on tap test across all areas",
        "severity": "high"
      },
      {
        "id": "s13bq3",
        "check": "Full evenness \u2014 2m straight edge within 3mm tolerance",
        "severity": "medium"
      },
      {
        "id": "s13bq4",
        "check": "Bathroom walls tiled to full ceiling height",
        "severity": "medium"
      }
    ]
  },
  {
    "id": "s14a",
    "label": "Lift & CCTV",
    "icon": "\ud83d\uded7",
    "color": "#388BFD",
    "phase": "systems",
    "budgetPct": 3.7,
    "durationWks": 3,
    "budgetCatId": "b9a",
    "contractAmount": 0,
    "paymentRule": "TBD \u2014 Lift & CCTV amount not specified in contract schedule; to be agreed separately",
    "materialIds": [],
    "checklist": [
      "Lift: 5-person capacity, automatic doors \u2014 Touchwood / Jag (Schedule A)",
      "Lift shaft: min 8'-6\" footing depth (per structural drawing notes)",
      "Lift installation by manufacturer-approved technician",
      "Lift manufacturer warranty minimum 12 months (contract clause 5.6a)",
      "CCTV: 8 cameras with NVR, 30-day recording (Schedule A)",
      "CCTV power backup on inverter circuit",
      "CCTV manufacturer warranty transferred to employer (contract clause 5.6d)"
    ],
    "requiredPhotos": [
      {
        "id": "s14a_lift",
        "label": "Lift installation complete",
        "description": "Lift operational with door closing",
        "mandatory": true
      },
      {
        "id": "s14a_cctv",
        "label": "CCTV cameras installed",
        "description": "All 8 cameras mounted and NVR connected",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s14aq1",
        "check": "Lift brand: Touchwood or Jag \u2014 verify before installation",
        "severity": "high"
      },
      {
        "id": "s14aq2",
        "check": "Lift warranty card (min 12 months) handed over \u2014 per contract 5.6a",
        "severity": "critical"
      },
      {
        "id": "s14aq3",
        "check": "CCTV: 8 cameras + NVR recording 30 days \u2014 test all cameras",
        "severity": "high"
      }
    ]
  },
  {
    "id": "s14b",
    "label": "Generator & Power Connection",
    "icon": "\u2699\ufe0f",
    "color": "#F85149",
    "phase": "systems",
    "budgetPct": 8.9,
    "durationWks": 3,
    "budgetCatId": "b9b",
    "contractAmount": 1200000,
    "paymentRule": "\u20b96L advance, \u20b96L after generator commissioned and APEPDCL connection obtained",
    "materialIds": [],
    "checklist": [
      "Generator: Escort / equivalent brand (Schedule A) \u2014 capacity per APEPDCL calculation",
      "Generator for: common area, lift, borewell, municipal water supply",
      "Transformer capacity as per APEPDCL recommendation (Schedule A)",
      "APEPDCL service connection obtained",
      "Generator installation with ATS (Auto Transfer Switch)",
      "Fuel storage arrangement",
      "Generator room ventilation",
      "Generator commissioning test with full load",
      "Borewell pump on generator circuit verified",
      "Lift on generator circuit verified"
    ],
    "requiredPhotos": [
      {
        "id": "s14b_gen",
        "label": "Generator installed",
        "description": "Generator in place with ATS panel",
        "mandatory": true
      },
      {
        "id": "s14b_apepdcl",
        "label": "APEPDCL connection",
        "description": "Meter box and connection from APEPDCL",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "s14bq1",
        "check": "Generator brand: Escort or equivalent \u2014 verify before purchase",
        "severity": "high"
      },
      {
        "id": "s14bq2",
        "check": "ATS auto-changeover tested \u2014 power cut simulation",
        "severity": "high"
      },
      {
        "id": "s14bq3",
        "check": "APEPDCL sanction letter and meter installation confirmed",
        "severity": "critical"
      }
    ]
  },
  {
    "id": "s_handover",
    "label": "Systems & Handover",
    "icon": "\ud83c\udfe0",
    "color": "#2DD4A0",
    "phase": "handover",
    "budgetPct": 3.0,
    "durationWks": 3,
    "budgetCatId": "b9c",
    "contractAmount": 0,
    "paymentRule": "Balance amount (over \u20b91.35 Cr) released after lift headroom, OHT, compound wall and gate completed",
    "materialIds": [],
    "checklist": [
      "Compound wall completed",
      "Entrance gate installed",
      "Water sump constructed and connected",
      "Rain water harvesting pit installed",
      "Septic tank connected",
      "Snag list prepared \u2014 employer walkthrough with contractor",
      "All snag items rectified within 30 days (contract clause 5.4)",
      "All manufacturer warranties collected: lift (12 months), waterproofing (10 years), CCTV, electrical",
      "Occupancy Certificate application filed with GVMC",
      "Keys handed over to employer",
      "Defect Liability Period starts \u2014 24 months (contract clause 5.1)",
      "Structural warranty period starts \u2014 5 years (contract clause 5.3)",
      "Final payment released after OC filing and compound wall"
    ],
    "requiredPhotos": [
      {
        "id": "sh_wall",
        "label": "Compound wall complete",
        "description": "Full perimeter wall finished",
        "mandatory": true
      },
      {
        "id": "sh_gate",
        "label": "Entrance gate",
        "description": "Gate installed and operational",
        "mandatory": true
      },
      {
        "id": "sh_sump",
        "label": "Water sump",
        "description": "Sump constructed and covered",
        "mandatory": true
      },
      {
        "id": "sh_snag",
        "label": "Snag list walkthrough",
        "description": "Employer and contractor snag walkthrough photos",
        "mandatory": true
      }
    ],
    "qualityChecks": [
      {
        "id": "shq1",
        "check": "All snag items closed before final payment",
        "severity": "critical"
      },
      {
        "id": "shq2",
        "check": "All warranties (lift, waterproofing, CCTV, electrical) handed over",
        "severity": "critical"
      },
      {
        "id": "shq3",
        "check": "OC application filed with GVMC",
        "severity": "critical"
      },
      {
        "id": "shq4",
        "check": "DLP register started \u2014 24-month defect tracking begins",
        "severity": "high"
      }
    ]
  }
];

// ── Required photos per stage ─────────────────────────────────────────────────
// These are mandatory evidence photos. Each must be uploaded before stage can
// be marked complete. AI reviews each photo automatically on upload.
export const STAGE_REQUIRED_PHOTOS = {
    s_borewell: [
        { id: 'bw_rig',     label: 'Drilling rig on site',              description: 'Rig positioned at marked borewell location',                mandatory: true },
        { id: 'bw_depth',   label: 'Depth log at water strike',         description: 'Measurement showing depth when water was struck',           mandatory: true },
        { id: 'bw_casing',  label: 'PVC casing pipe installation',      description: 'Casing being inserted or fully installed',                   mandatory: true },
        { id: 'bw_pump',    label: 'Submersible pump installation',     description: 'Pump being lowered into bore with cable visible',           mandatory: true },
        { id: 'bw_water',   label: 'Water flow test',                   description: 'Actual water flow from pipe during yield test',             mandatory: true },
        { id: 'bw_cert',    label: 'Completion certificate',            description: 'Photo of contractor completion cert with bore log details', mandatory: false },
    ],
    s1: [
        { id: 's1_mark',    label: 'Column position markings',          description: 'All column centres marked on ground per drawing',           mandatory: true },
        { id: 's1_excav',   label: 'Excavation in progress',            description: 'Pits at correct depth — steel rod measuring 2.4m depth',   mandatory: true },
        { id: 's1_pit',     label: 'Foundation pit completed',          description: 'All pits at correct size before PCC pour',                  mandatory: true },
        { id: 's1_pcc',     label: 'PCC bed laid',                      description: 'PCC 1:4:8, 150mm thick, covering full footing area',        mandatory: true },
    ],
    s2: [
        { id: 's2_mat',     label: 'Footing mat steel before pour',     description: 'All footing reinforcement in place — show both ways',       mandatory: true },
        { id: 's2_cover',   label: 'Cover blocks visible',              description: 'Minimum 50mm cover blocks clearly visible under rebar',     mandatory: true },
        { id: 's2_pour',    label: 'Concrete pour in progress',         description: 'Concrete being placed with vibrator visible',               mandatory: true },
        { id: 's2_cube',    label: 'Cube samples being taken',          description: '3 cube moulds being filled from same batch',                mandatory: true },
        { id: 's2_curing',  label: 'Curing in progress',               description: 'Water/wet jute on footings — show date on watchman log',    mandatory: true },
        { id: 's2_done',    label: 'Completed footings before backfill',description: 'All footings completed and inspected before covering',      mandatory: true },
    ],
    s3: [
        { id: 's3_rebar',   label: 'Column rebar cage assembled',       description: 'Main bars + ties clearly visible with correct spacing',     mandatory: true },
        { id: 's3_cover',   label: 'Cover blocks on column rebar',      description: '38mm cover blocks tied to column rebar on all sides',      mandatory: true },
        { id: 's3_shutt',   label: 'Column shuttering plumb check',     description: 'Spirit level on column form — show plumb in 2 directions', mandatory: true },
        { id: 's3_pour',    label: 'Column concrete pour',              description: 'Concrete being poured with vibrator, no segregation',       mandatory: true },
        { id: 's3_pb_rebar', label: 'Plinth beam rebar in place',      description: 'Main bars + stirrups at correct spacing per drawing',       mandatory: true },
        { id: 's3_pb_pour', label: 'Plinth beam pour',                 description: 'Beam concrete being placed with vibration',                 mandatory: true },
    ],
    s4: [
        { id: 's4_bot',     label: 'Slab bottom steel',                 description: '12Ø@100mm laid throughout, distribution bars visible',      mandatory: true },
        { id: 's4_cover',   label: 'Slab cover blocks',                 description: '25mm chairs/cover blocks under slab steel, uniform spacing',mandatory: true },
        { id: 's4_conduit', label: 'Electrical conduits in slab',       description: 'All conduits placed and tied before pour',                  mandatory: true },
        { id: 's4_pour',    label: 'Slab pour in progress',             description: 'Concrete spread with vibrator — no dry pockets visible',    mandatory: true },
        { id: 's4_level',   label: 'Slab surface finish',               description: 'Levelled top surface before final set',                     mandatory: true },
        { id: 's4_cure',    label: 'Slab curing day 1',                 description: 'Water ponding or wet gunny bags over full slab area',       mandatory: true },
    ],
    s5: [{ id:'s5_rebar', label:'GF slab rebar', mandatory:true, description:'Steel in place before pour' }, { id:'s5_pour', label:'GF slab pour', mandatory:true, description:'Pour in progress with vibration' }, { id:'s5_cure', label:'Curing', mandatory:true, description:'28-day curing evidence' }],
    s6: [{ id:'s6_rebar', label:'1F slab rebar', mandatory:true, description:'Steel in place before pour' }, { id:'s6_pour', label:'1F slab pour', mandatory:true, description:'Pour in progress' }, { id:'s6_cure', label:'Curing', mandatory:true, description:'28-day curing evidence' }],
    s7: [{ id:'s7_rebar', label:'2F slab rebar', mandatory:true, description:'Steel in place before pour' }, { id:'s7_pour', label:'2F + terrace pour', mandatory:true, description:'Pour in progress' }, { id:'s7_cure', label:'Curing', mandatory:true, description:'28-day curing evidence' }],
    s7b: [{id:'s7b_slope',label:'Terrace slope 1:50',mandatory: true,description:'Spirit level showing drainage fall'},{id:'s7b_lh',label:'Lift headroom slab',mandatory: true,description:'Headroom rebar and pour'},{id:'s7b_oht',label:'OHT construction',mandatory: true,description:'Overhead tank completed'},{id:'s7b_wp',label:'Waterproofing applied',mandatory: true,description:'10-year warranty waterproofing coat'}],
    s8: [{ id:'s8_soak', label:'Bricks soaking', mandatory:true, description:'Bricks in water before use' }, { id:'s8_course', label:'First course and plumb', mandatory:true, description:'First row level + plumb check' }, { id:'s8_lintel', label:'Lintel reinforcement', mandatory:true, description:'Rebar over door/window before concrete' }],
    s9: [{ id:'s9_hack', label:'Hacking of RCC surfaces', mandatory:true, description:'All RCC surfaces hacked before plaster' }, { id:'s9_int', label:'Internal plaster done', mandatory:false, description:'Internal wall plaster finished' }, { id:'s9_ext', label:'External plaster done', mandatory:false, description:'External plaster + groove lines' }],
    s10:[{ id:'s10_conduit', label:'Conduit routing map', mandatory:true, description:'All conduit routes before wall closing' }, { id:'s10_plumb', label:'Plumbing pressure test', mandatory:true, description:'Pipe pressure test in progress/result' }],
    s11:[{ id:'s11_tile', label:'Tiling in progress', mandatory:false, description:'Tiles laid with spacers, uniform joints' }, { id:'s11_tap', label:'Tap test on tiles', mandatory:true, description:'Tapping tiles for hollow sound check' }],
    s12:[{ id:'s12_door', label:'Main door installation', mandatory:true, description:'Main teak door frame and shutter installed' }],
    s13:[{ id:'s13_putty', label:'Putty coat done', mandatory:false, description:'Interior putty base coat applied' }, { id:'s13_final', label:'Final painting done', mandatory:false, description:'All walls final coat completed' }],
    s14:[{ id:'s14_snag', label:'Snag list photos', mandatory:true, description:'Photos of each snag item listed' }, { id:'s14_handover', label:'Final walkthrough', mandatory:true, description:'Complete building walkthrough before handover' }],
};

// ── Quality checks per stage ──────────────────────────────────────────────────
// Separate from activity tasks — these are quality verification items
export const STAGE_QUALITY_CHECKS = {
    s_borewell: [
        { id: 'bwq1', check: 'Bore location min 15ft from septic tank boundary',  severity: 'high'     },
        { id: 'bwq2', check: 'PVC casing pipe is rated 6 kg/sqcm (check stamp)',  severity: 'high'     },
        { id: 'bwq3', check: 'Yield test minimum 1 inch continuous flow for 1hr', severity: 'critical' },
        { id: 'bwq4', check: 'Water quality test (NABL lab) — potable result',    severity: 'high'     },
        { id: 'bwq5', check: 'Bore depth ≥ 300ft (verify on bore log certificate)',severity: 'medium'   },
    ],
    s1: [
        { id: 's1q1', check: 'All column centres match approved drawing (verify with tape)', severity: 'critical' },
        { id: 's1q2', check: 'Excavation depth confirmed ≥ 2.4m at each pit (soil report FOD)', severity: 'critical' },
        { id: 's1q3', check: 'Anti-termite treatment applied to all pit surfaces', severity: 'high' },
        { id: 's1q4', check: 'PCC bed minimum 150mm thick — check at 3 points', severity: 'high' },
        { id: 's1q5', check: 'No standing water in pits before PCC pour', severity: 'medium' },
    ],
    s2: [
        { id: 's2q1', check: 'Footing steel dia and spacing matches structural drawing (F1/F3/CF-1)', severity: 'critical' },
        { id: 's2q2', check: 'Cover blocks 50mm minimum on all sides — visible before shuttering', severity: 'critical' },
        { id: 's2q3', check: 'M20 mix design confirmed (1:1.5:3 or RMC M20)', severity: 'critical' },
        { id: 's2q4', check: '3 cube samples taken per pour batch', severity: 'high' },
        { id: 's2q5', check: 'Concrete vibrated throughout — no honeycombing after strip', severity: 'critical' },
        { id: 's2q6', check: 'Curing for minimum 28 days — daily log signed by watchman', severity: 'high' },
        { id: 's2q7', check: 'Cube test results received (target: min 20 N/mm² at 28 days)', severity: 'high' },
    ],
    s3: [
        { id: 's3q1', check: 'Column rebar dia matches schedule: C1/C2=8×20Ø, C3=4×20+4×16Ø', severity: 'critical' },
        { id: 's3q2', check: 'Column cover 38mm — cover blocks on all 4 sides', severity: 'critical' },
        { id: 's3q3', check: 'Tie spacing 8Ø@200mm (mid) and @100mm (near joints)', severity: 'high' },
        { id: 's3q4', check: 'Shuttering plumb in both directions (spirit level)', severity: 'high' },
        { id: 's3q5', check: 'M25 mix — slump test done (80-100mm target)', severity: 'critical' },
        { id: 's3q6', check: 'No water added to concrete after truck delivery', severity: 'critical' },
        { id: 's3q7', check: 'Column curing minimum 14 days', severity: 'high' },
    ],
    s4: [{ id:'s4q1', check:'12Ø@100mm slab steel both ways', severity:'critical'}, {id:'s4q2', check:'25mm cover blocks under slab rebar', severity:'critical'}, {id:'s4q3', check:'M25 concrete throughout slab and beams', severity:'critical'}, {id:'s4q4', check:'Continuous mechanical vibration during pour', severity:'high'}, {id:'s4q5', check:'No construction load for 28 days', severity:'high'}],
    s5: [{id:'s5q1', check:'Beam rebar matches drawing', severity:'critical'}, {id:'s5q2', check:'M25 pour with cube tests', severity:'critical'}, {id:'s5q3', check:'28-day curing', severity:'high'}],
    s6: [{id:'s6q1', check:'Rebar per drawing', severity:'critical'}, {id:'s6q2', check:'M25 cube tests', severity:'critical'}, {id:'s6q3', check:'28-day curing', severity:'high'}],
    s7: [{id:'s7q1', check:'Rebar per drawing (2nd floor/TF slab)', severity:'critical'}, {id:'s7q2', check:'M25 concrete cube tests', severity:'critical'}, {id:'s7q3', check:'28-day curing', severity:'high'}],
    s7b: [{id:'s7bq1', check:'Terrace waterproofing: min 10-year manufacturer warranty (contract clause 5.6)', severity:'critical'}, {id:'s7bq2', check:'Terrace slope 1:50 — verify with spirit level', severity:'high'}, {id:'s7bq3', check:'All cube test results (s4–s7b) compiled and filed', severity:'high'}, {id:'s7bq4', check:'Total built-up area measured for final contract payable', severity:'critical'}],
    s8: [{id:'s8q1', check:'Bricks soaked min 30 min before use', severity:'high'}, {id:'s8q2', check:'Plumb check every 600mm height', severity:'high'}, {id:'s8q3', check:'Max 1m wall height per day per lift', severity:'medium'}],
    s9: [{id:'s9q1', check:'RCC surfaces hacked before plaster', severity:'high'}, {id:'s9q2', check:'Chicken mesh at brick-RCC junctions', severity:'high'}, {id:'s9q3', check:'7-day curing after each coat', severity:'medium'}],
    s10:[{id:'s10q1', check:'Plumbing pressure test before wall closing', severity:'critical'}, {id:'s10q2', check:'Electrical continuity test before plastering', severity:'high'}],
    s11:[{id:'s11q1', check:'No hollow sound on tile tap test', severity:'high'}, {id:'s11q2', check:'Full evenness — straight edge test on tiles', severity:'medium'}],
    s12:[{id:'s12q1', check:'All door/window frames plumb and level', severity:'high'}, {id:'s12q2', check:'SS 304 railing: check grade stamp on material', severity:'medium'}],
    s13:[{id:'s13q1', check:'Putty base coat fully dry before emulsion', severity:'medium'}, {id:'s13q2', check:'Exterior texture — no bare patches visible', severity:'medium'}],
    s14:[{id:'s14q1', check:'All snag items resolved before payment', severity:'high'}, {id:'s14q2', check:'OC application filed with GVMC', severity:'critical'}],
};
