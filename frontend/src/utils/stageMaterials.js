/**
 * stageMaterials.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Compute per-stage material quantities and cost estimates.
 *
 * Engineering basis:
 *  - IS 456-2000 for RCC mix design
 *  - IS 2212 for brick masonry
 *  - Typical AP/Telangana residential construction ratios
 *
 * Every function returns:
 *   [ { id, name, unit, qty, rate, amount, spec, category } ]
 *
 * "rate" is the Vizag market rate (₹) as of mid-2025.
 * User can override rates in the UI.
 */

// ── Vizag market rates (₹) — mid 2025 (FALLBACK DEFAULTS)
// These are used when DB rates are not yet loaded.
// Actual rates come from /api/config/market-rates and are passed in via getStageMaterials().
export const MARKET_RATES = {
    steel20:    58000,  // ₹/MT  VSP/Simhadri TMT 20mm
    steel16:    58000,  // ₹/MT
    steel12:    57000,  // ₹/MT
    steel10:    57000,  // ₹/MT
    steel8:     56000,  // ₹/MT
    opc53:      390,    // ₹/bag (50kg) OPC 53 Grade
    ppc:        360,    // ₹/bag (50kg) PPC Grade
    sand:       1800,   // ₹/cum river sand
    agg20:      1200,   // ₹/cum 20mm HBG
    agg40:      1000,   // ₹/cum 40mm HBG
    bricks:     9,      // ₹/No  red bricks 9×4.5×3in
    tiles2x4:   850,    // ₹/box (10 sft/box) Gujarat tiles
    tiles2x2:   750,    // ₹/box (8 sft/box)
    granite:    120,    // ₹/sft
    pcc148:     3200,   // ₹/cum PCC 1:4:8 (labour+material)
    // Labour rates
    labourExcav: 200,   // ₹/cum excavation
    labourMasonry: 18,  // ₹/cft brick masonry labour
    labourPlaster: 22,  // ₹/sft plaster labour
    labourRCC:   45,    // ₹/sft of slab (labour only)
    labourTiling: 35,   // ₹/sft tile laying labour
};

// ── Helper ────────────────────────────────────────────────────────────────────
function item(id, name, unit, qty, rate, spec = '', category = '') {
    const q      = Math.max(0, Number(qty.toFixed(qty < 10 ? 2 : 0)));
    const amount = Math.round(q * rate);
    return { id, name, unit, qty: q, rate, amount, spec, category };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-stage calculators
// All accept a `project` object (from saved project registration).
// Fall back to sensible defaults if project values are missing.
// ─────────────────────────────────────────────────────────────────────────────

function baseParams(p) {
    const L  = Number(p?.plotLength)  || 60;   // ft
    const W  = Number(p?.plotWidth)   || 35;   // ft
    const fH = Number(p?.floorHeight) || 10.5; // ft
    const nF = Number(p?.totalFloors) || 4;
    const slabArea  = Math.round(L * W * 0.92); // ~92% coverage
    return { L, W, fH, nF, slabArea };
}

// s1 — Excavation & Earthwork
export function s1_materials(p) {
    const { L, W } = baseParams(p);
    const depth   = 2.4;  // m (as per soil report)
    const perim   = 2*(L + W) * 0.3048; // lft → m
    const volume  = perim * 1.5 * depth; // trench vol (cum) approx
    const pccArea = L * W * 0.0929;      // sqm → slab area for PCC bed
    const pccVol  = pccArea * 0.15;      // 150mm thick PCC bed

    return [
        item('exc-soil',  'Excavation (earth removal)',     'cum',  volume,       MARKET_RATES.labourExcav, 'Min 2.4m depth as per soil report (SBC 14.4 t/m²)', 'labour'),
        item('exc-pcc',   'PCC 1:4:8 bed',                 'cum',  pccVol,       MARKET_RATES.pcc148,      '150mm thick under all footings', 'concrete'),
        item('exc-agg40', 'Aggregate 40mm (PCC bed)',       'cum',  pccVol*0.62,  MARKET_RATES.agg40,       'For PCC 1:4:8 mix', 'aggregate'),
        item('exc-opc',   'OPC 43 Cement (PCC bed)',        'bags', pccVol*3.5,   MARKET_RATES.opc53,       '1:4:8 mix — 3.5 bags/cum', 'cement'),
        item('exc-sand',  'River Sand (PCC bed)',           'cum',  pccVol*0.44,  MARKET_RATES.sand,        'Zone 2 river sand', 'aggregate'),
        item('exc-anti',  'Anti-termite chemical treatment','sqm',  L*W*0.0929,   12,                       'Pre-construction soil treatment (Chlorpyrifos 1%)', 'chemical'),
    ];
}

// s2 — Foundation & Footings
export function s2_materials(p) {
    const { L, W } = baseParams(p);
    // F1 (1No), F3 (9No), F4 (1No), F5 (1No), CF-1 (combined)
    const concreteVol = 24.9; // cum from structural drawings
    const steelKg     = 542;  // kg from structural drawings

    return [
        item('f-steel20',  'Steel 20mm TMT (CF-1 beam)',    'MT',   steelKg*0.55/1000, MARKET_RATES.steel20,  'CF-1 combined footing main bars (8-20Ø)', 'steel'),
        item('f-steel10',  'Steel 10mm TMT (footing mat)',  'MT',   steelKg*0.45/1000, MARKET_RATES.steel10,  'F1/F3/F4/F5 mat bars (10Ø both ways)', 'steel'),
        item('f-opc53',    'OPC 53 Cement (M20 concrete)',  'bags', concreteVol*5.5,   MARKET_RATES.opc53,    'M20 mix (1:1.5:3) — 5.5 bags/cum', 'cement'),
        item('f-sand',     'River Sand (M20)',              'cum',  concreteVol*0.42,  MARKET_RATES.sand,     'Zone 2 river sand for M20', 'aggregate'),
        item('f-agg20',    'Aggregate 20mm (M20)',          'cum',  concreteVol*0.84,  MARKET_RATES.agg20,    '20mm HBG for M20 footings', 'aggregate'),
        item('f-labour',   'Foundation RCC labour',         'cum',  concreteVol,       3500,                  'Labour for footing reinforcement + pour', 'labour'),
        item('f-shutt',    'Shuttering (pedestal)',         'sqm',  14*0.75*0.6,       250,                   'Pedestal shuttering for 14 columns', 'shuttering'),
    ];
}

// s3 — Columns & Plinth Beam
export function s3_materials(p) {
    const { fH, nF } = baseParams(p);
    // 14 columns × 4 floors × 10.5ft height
    const colVol   = 18.73; // cum from structural drawings
    const steelKg  = 3375;  // kg
    const pbLen    = 190;   // lft plinth beam

    return [
        item('col-steel20', 'Steel 20mm TMT (column main)',  'MT',  steelKg*0.52/1000, MARKET_RATES.steel20, 'Stilt/GF columns: C1/C2 8×20Ø', 'steel'),
        item('col-steel16', 'Steel 16mm TMT (column main)',  'MT',  steelKg*0.24/1000, MARKET_RATES.steel16, '1F columns: 4×20+4×16Ø', 'steel'),
        item('col-steel12', 'Steel 12mm TMT (2F columns)',   'MT',  steelKg*0.12/1000, MARKET_RATES.steel12, '2F columns: 8×12Ø', 'steel'),
        item('col-steel8',  'Steel 8mm TMT (ties/stirrups)', 'MT',  steelKg*0.12/1000, MARKET_RATES.steel8,  '8Ø@200mm ties all columns', 'steel'),
        item('col-opc53',   'OPC 53 Cement (M25)',           'bags',colVol*6.5,        MARKET_RATES.opc53,   'M25 mix (1:1:2) — 6.5 bags/cum', 'cement'),
        item('col-sand',    'River Sand (M25)',              'cum', colVol*0.385,      MARKET_RATES.sand,    'Fine aggregate for M25', 'aggregate'),
        item('col-agg20',   'Aggregate 20mm (M25)',          'cum', colVol*0.77,       MARKET_RATES.agg20,   '20mm HBG for M25', 'aggregate'),
        item('col-shutt',   'Column shuttering (all floors)','sqm', 14*4*(9/12)*fH*0.3048*2, 300,           'All 14 columns × 4 floors × 2 faces', 'shuttering'),
        item('col-labour',  'Column + plinth beam labour',   'cum', colVol,            4000,                 'Bar bending + concreting labour', 'labour'),
    ];
}

// s4-s7 — Slab stages (parametric: which slab number)
function slab_materials(p, slabIndex, slabLabel) {
    const { L, W, slabArea } = baseParams(p);
    const slabThick  = 0.125;          // 5" = 125mm
    const slabVol    = slabArea*0.0929*slabThick; // cum
    const beamVol    = slabVol * 0.7;  // beams approx 70% of slab vol
    const totalVol   = slabVol + beamVol;
    const steelKgSlab= slabArea * 4.2; // 4.2 kg/sft for 5" two-way slab
    const steelKgBeam= slabArea * 2.1; // beam steel

    return [
        item(`sl${slabIndex}-s12`,  'Steel 12mm TMT (slab main)',      'MT', steelKgSlab*0.55/1000, MARKET_RATES.steel12, '12Ø@100mm c/c main direction', 'steel'),
        item(`sl${slabIndex}-s8`,   'Steel 8mm TMT (distribution)',    'MT', steelKgSlab*0.45/1000, MARKET_RATES.steel8,  '8Ø@150mm distribution bars', 'steel'),
        item(`sl${slabIndex}-s20`,  'Steel 20mm TMT (beam main)',      'MT', steelKgBeam*0.60/1000, MARKET_RATES.steel20, '8×20Ø main bars in 24"×30" beams', 'steel'),
        item(`sl${slabIndex}-s10`,  'Steel 10mm TMT (beam stirrups)',  'MT', steelKgBeam*0.40/1000, MARKET_RATES.steel10, '10Ø@100mm (support) / @200mm (mid)', 'steel'),
        item(`sl${slabIndex}-opc`,  'OPC 53 Cement (M25 slab+beam)',   'bags', totalVol*6.5,        MARKET_RATES.opc53,   'M25 mix throughout slab and beams', 'cement'),
        item(`sl${slabIndex}-sand`, 'River Sand (M25)',                'cum', totalVol*0.385,       MARKET_RATES.sand,    'Fine aggregate for M25', 'aggregate'),
        item(`sl${slabIndex}-agg`,  'Aggregate 20mm (M25)',            'cum', totalVol*0.77,        MARKET_RATES.agg20,   '20mm HBG for M25', 'aggregate'),
        item(`sl${slabIndex}-form`, `Shuttering (${slabLabel})`,       'sqm', slabArea*0.0929*1.1,  350,                  'Slab + beam soffit + sides', 'shuttering'),
        item(`sl${slabIndex}-lab`,  `RCC labour (${slabLabel})`,       'sft', slabArea,             45,                   'Labour for bar bending, shuttering & pour', 'labour'),
        item(`sl${slabIndex}-cure`, 'Curing water + compound',        'sqm', slabArea*0.0929,      25,                   '28-day wet curing — watchman tally required', 'curing'),
    ];
}
export const s4_materials = (p) => slab_materials(p, 4, 'Stilt Slab');
export const s5_materials = (p) => slab_materials(p, 5, 'Ground Floor Slab');
export const s6_materials = (p) => slab_materials(p, 6, 'First Floor Slab');
export const s7_materials = (p) => slab_materials(p, 7, '2F + Terrace Slabs');

// s8 — Brick Masonry
export function s8_materials(p) {
    const { L, W, fH, nF } = baseParams(p);
    const perim    = 2*(L + W);
    const floors   = nF - 1; // exclude stilt
    const outerVol = perim * fH * (9/12) * floors;  // cft
    const innerVol = outerVol * 0.55;
    const totalVol = outerVol + innerVol;
    const bricks   = Math.round(totalVol * 500 / 35.315);
    const cementBags = Math.round((totalVol/35.315)*1.54/7/0.035);
    const sandVol  = (totalVol/35.315)*1.54*6/7;

    return [
        item('mas-bricks', 'Red Bricks (9"×4.5"×3")',        'nos',  bricks,      MARKET_RATES.bricks, 'IS 1077 Class designation, min 35 kg/cm² strength', 'masonry'),
        item('mas-ppc',    'PPC Cement (CM 1:6)',             'bags', cementBags,  MARKET_RATES.ppc,    'PPC for brick masonry mortar CM 1:6 ratio', 'cement'),
        item('mas-sand',   'River Sand (CM 1:6)',             'cum',  sandVol,     MARKET_RATES.sand,   'Zone 2 river sand — check silt <8%', 'aggregate'),
        item('mas-labour', 'Masonry labour',                  'cft',  totalVol,    MARKET_RATES.labourMasonry, 'Rate per cft of brick work in CM', 'labour'),
        item('mas-lintel', 'Lintel bars (10Ø)',               'MT',   0.45,        MARKET_RATES.steel10, 'Over all door + window openings', 'steel'),
        item('mas-mesh',   'Chicken wire mesh (BRC junctions)','sqm', 280,         45,                  'At all brick-RCC junctions to prevent cracks', 'misc'),
    ];
}

// s9 — Plastering
export function s9_materials(p) {
    const { L, W, fH, nF } = baseParams(p);
    const wallArea   = 2*(L + W)*fH * (nF-1) * 2.5; // both sides, rough
    const intPlaster = wallArea * 0.70 * 0.0929;  // sqm
    const extPlaster = wallArea * 0.30 * 0.0929;
    const ceiling    = L * W * 0.0929 * (nF-1);
    const totalPlast = intPlaster + extPlaster + ceiling;
    const cementBags = Math.round(totalPlast * 0.32); // ~0.32 bags/sqm
    const sand       = totalPlast * 0.03;             // 0.03 cum/sqm

    return [
        item('plas-ppc',    'PPC Cement (plastering)',   'bags', cementBags,  MARKET_RATES.ppc,   'Internal 12mm CM 1:6 + external 15mm CM 1:5', 'cement'),
        item('plas-sand',   'River Sand (plaster)',      'cum',  sand,        MARKET_RATES.sand,  'Screened fine river sand Zone 2', 'aggregate'),
        item('plas-labour', 'Plastering labour',         'sqm',  totalPlast,  MARKET_RATES.labourPlaster, 'Internal + external + ceiling plaster', 'labour'),
        item('plas-putty',  'White cement putty (base)', 'bags', Math.round(totalPlast*0.4*0.1), 450, 'Internal wall putty base coat before paint', 'finishing'),
    ];
}

// s10 — MEP
export function s10_materials(p) {
    const { nF } = baseParams(p);
    const floors = nF;
    return [
        item('mep-conduit', 'Electrical conduit (Finolex/RR)',  'mtr', floors*650,  35,    '20mm + 25mm concealed PVC conduit', 'electrical'),
        item('mep-wire',    'Electrical wire (Finolex 2.5sqmm)','mtr', floors*400,  55,    'FR/FRLS 2.5 sqmm copper wire', 'electrical'),
        item('mep-mcb',     'MCB + distribution board (Legrand)','nos',floors+1,    3500,  'Per floor MCB DB + main 4-way DB', 'electrical'),
        item('mep-cpvc',    'CPVC pipes 1" (Astral/Truflo)',    'mtr', floors*120,  180,   'Hot + cold water supply piping', 'plumbing'),
        item('mep-upvc',    'UPVC pipes 4" (SWR drainage)',     'mtr', floors*80,   120,   'Soil + waste water drainage', 'plumbing'),
        item('mep-earthpipe','GI earthing pipe 40mm dia',       'nos', 14,          450,   '14 earth pits as per drawing', 'electrical'),
        item('mep-borewell', 'Borewell drilling 300-400ft',     'nos', 1,           85000, 'Includes casing pipe + pump', 'civil'),
    ];
}

// s11 — Flooring & Tiling
export function s11_materials(p) {
    const { L, W, nF } = baseParams(p);
    const slabArea   = Math.round(L * W * 0.92);
    const floors     = nF - 1;
    const roomArea   = slabArea * floors * 0.0929; // sqm
    const bathArea   = floors * 3 * 4.0;  // 3 baths/floor × 4 sqm each
    const wallBath   = floors * 3 * 18;   // 18 sqm wall/bath up to ceiling
    const kitchen    = floors * 12;       // ~12 sqm granite kitchen/staircase/lift

    return [
        item('fl-room',    'Gujarat Tiles 2×4ft (rooms)',  'sqm',  roomArea,        850,  'Full evenness required — Gujarat brand', 'tiles'),
        item('fl-bath-fl', 'Gujarat Tiles 2×2ft (bath floor)','sqm',bathArea,       750,  'Uniform spacing — anti-skid', 'tiles'),
        item('fl-bath-wl', 'Gujarat Tiles 2×4ft (bath walls)','sqm',wallBath,       850,  'Floor to ceiling height', 'tiles'),
        item('fl-granite', 'Granite flooring (Blackberry)',  'sqm',  kitchen,        1800, 'Kitchen, staircase, lift lobby, corridors', 'tiles'),
        item('fl-adhesive','Tile adhesive (Acc/Roff)',       'bags', Math.round(roomArea*0.8*0.5), 280, '0.5 bags/sqm for 2×4ft tiles', 'material'),
        item('fl-grout',   'Tile grout (Fosroc/Roff)',       'kg',   Math.round((roomArea+bathArea)*0.2), 180, 'For tile joints', 'material'),
        item('fl-labour',  'Tiling labour (all areas)',      'sqm',  roomArea+bathArea+wallBath, MARKET_RATES.labourTiling, 'Rate includes cutting and waste', 'labour'),
    ];
}

// s12 — Doors, Windows & Railings
export function s12_materials(p) {
    const { nF } = baseParams(p);
    const floors = nF - 1;
    return [
        item('dw-mainteak', 'Main door — African Teak (6×3in frame)', 'nos', 1,           45000, 'Ground floor main entry door', 'doors'),
        item('dw-wpvc',     'WPVC/PVC doors (rooms + baths)',         'nos', floors*6,     8500,  'Laminated WPVC with granite frame', 'doors'),
        item('dw-upvc',     'UPVC windows 90-series (Wento)',         'nos', floors*8,    12000, 'Wento/Simta Astrix 90-series with SS grill', 'windows'),
        item('dw-ss304',    'SS 304 railing + glass (balcony)',        'rft', 80,          2200,  'Jindal SS 304 + toughened glass panels', 'railings'),
        item('dw-stair',    'Staircase railing SS 304 (Jindal)',       'rft', 60,          1800,  'Staircase + landing railing', 'railings'),
        item('dw-granite',  'Granite frames (doors + windows)',        'rft', floors*120,  350,   'Granite sill + frame all openings', 'material'),
    ];
}

// s13 — Painting & Exterior
export function s13_materials(p) {
    const { L, W, nF } = baseParams(p);
    const wallArea  = 2*(L+W)*10.5*(nF-1)*2;
    const wallSqm   = wallArea * 0.0929;
    const ceilSqm   = L*W*0.0929*(nF-1);
    const extSqm    = 2*(L+W)*10.5*(nF-1)*0.0929;

    return [
        item('pt-putty',   'Putty (Birla/Asian) — interior',     'kg',  wallSqm*0.8,    25,    '2 coats interior putty base', 'paint'),
        item('pt-emulsion', 'Emulsion paint (Berger/Asian)',      'ltr', wallSqm*0.25,   180,   '2 coats interior emulsion', 'paint'),
        item('pt-primer',  'Primer (Berger Weathercoat base)',    'ltr', extSqm*0.12,    220,   'Exterior primer before texture', 'paint'),
        item('pt-texture', 'Texture paint (exterior weather-shield)','ltr',extSqm*0.3,  280,   'Exterior texture + weather-shield coat', 'paint'),
        item('pt-labour',  'Painting labour (all areas)',          'sqm', wallSqm+ceilSqm, 35,  'Interior walls + ceiling + exterior', 'labour'),
        item('pt-cwwall',  'Compound wall (brick + plaster)',      'rft', 2*(L+W),        1800,  'Full perimeter compound wall RCC + brick', 'civil'),
        item('pt-gate',    'Main entrance gate (MS fabrication)',  'nos', 1,              35000, 'MS gate with SS cladding or teak panel', 'misc'),
    ];
}

// s14 — Systems & Handover
export function s14_materials(p) {
    return [
        item('sys-lift',  'Lift (5-person, Touchwood/Jag)',         'nos', 1, 600000, 'Automatic doors, 5-person capacity', 'systems'),
        item('sys-cctv',  'CCTV 8-camera + NVR (30-day recording)','nos', 1, 80000,  '4MP cameras + 2TB NVR storage', 'systems'),
        item('sys-gen',   'Generator (Escort/equivalent)',           'KVA', 15, 10000, '15 KVA diesel generator for common areas', 'systems'),
        item('sys-ohwt',  'Overhead water tank (Sintex 3000L)',     'nos', 2, 18000,  '2×3000L capacity on terrace', 'systems'),
        item('sys-sump',  'Underground sump (brick + CC cover)',    'cum', 8,  8000,   '8 cum capacity for 2 floors', 'systems'),
        item('sys-bath',  'Bathroom fittings set (Hindware/Cera)',  'set', 3, 18000,  'WC, washbasin, tap, shower per floor', 'systems'),
        item('sys-rwh',   'Rain water harvesting (percolation pit)','nos', 1, 25000,  'As per GVMC approval plan', 'systems'),
        item('sys-septic','Septic tank (brick, 4-chamber)',         'nos', 1, 35000,  'As per IS 2470 — 4 chamber design', 'civil'),
    ];
}


// s_borewell — Borewell Drilling
// depth comes from: project.boreDepth (manually entered or read from activities log)
// Falls back to 350 ft (typical Vizag hard-rock depth)
export function s_borewell_materials(p) {
    const depth = Math.max(100, Number(p.boreDepth) || 350); // ft
    const cableLen = Math.round(depth * 0.35); // ~35% of depth for cable run to panel
    return [
        item('bw-drill',  'Borewell drilling 4" dia',               'ft',  depth,     300,   `Rate/ft for 4" bore in Vizag hard rock. ${depth === 350 ? 'Using default 350 ft — update when actual depth is known.' : `Actual depth: ${depth} ft.`} Includes rig mobilisation.`, 'civil'),
        item('bw-casing', 'PVC casing pipe 4" (6kg/sqcm)',          'ft',  depth,     120,   'Heavy-duty PVC casing to full depth. Do not compromise on grade.', 'civil'),
        item('bw-pump',   'Submersible pump (Grundfos/Kirloskar)',   'nos', 1,         22000, '0.5–1 HP depending on yield. Stainless steel body for borewater.', 'systems'),
        item('bw-wire',   'Submersible pump cable 4-core',           'mtr', cableLen,  85,    'Flat submersible cable, armoured. Length = ~35% of bore depth for surface run.', 'electrical'),
        item('bw-panel',  'Control panel + starter',                 'nos', 1,         4500,  'DOL starter + overload protection for pump', 'electrical'),
        item('bw-test',   'Water quality test (NABL lab)',           'nos', 1,         1500,  'Potability + chemical analysis. Mandatory before use for construction.', 'misc'),
        item('bw-cgwb',   'CGWB registration fee',                   'nos', 1,         500,   'Mandatory registration with Central Ground Water Board (AP)', 'misc'),
        item('bw-labour', 'Plumber for pump installation',           'nos', 1,         2500,  'Connection to storage tank + pressure testing', 'labour'),
    ];
}


// s_col_pb — Columns & Plinth Beam (new contract stage ID)
export function s_col_pb_materials(p) {
    return s3_materials(p);  // same structural work
}

// s10a — Electrical Work
export function s10a_materials(p) {
    const { nF } = baseParams(p);
    const floors = nF;
    return [
        item('elec-conduit', 'PVC conduit 20mm (Finolex)',         'mtr', floors*500,  32,    'Concealed wiring conduit per Schedule A', 'electrical'),
        item('elec-conduit25','PVC conduit 25mm (Finolex)',        'mtr', floors*150,  45,    'Heavy point circuits', 'electrical'),
        item('elec-wire25',  'FR wire 2.5sqmm (Finolex/Havells)',  'mtr', floors*600,  55,    'Lighting + plug points — FR/FRLS grade', 'electrical'),
        item('elec-wire4',   'FR wire 4sqmm (Finolex/Havells)',    'mtr', floors*200,  80,    'Power circuits — AC/geyser points', 'electrical'),
        item('elec-wire6',   'FR wire 6sqmm (Finolex/Havells)',    'mtr', floors*80,   110,   'DB incomer and generator changeover', 'electrical'),
        item('elec-mcb-db',  'MCB distribution board (Legrand)',   'nos', floors+1,    3500,  'Per floor + main DB — Legrand/Schneider (Schedule A)', 'electrical'),
        item('elec-mcb',     'MCBs (Legrand/Schneider)',           'nos', floors*12,   180,   '6A, 10A, 16A, 32A as required', 'electrical'),
        item('elec-switches','Modular switches set (Legrand)',      'set', floors*6,    850,   '1-gang, 2-gang, 6A/16A — Legrand/Schneider (Schedule A)', 'electrical'),
        item('elec-earth',   'Earth wire bare copper',             'mtr', floors*100,  45,    'Bare copper earth conductor throughout (Schedule A)', 'electrical'),
        item('elec-earth-pit','Earthing pipe 40mm GI',             'nos', 14,          450,   '14 earth pits as per Mannan Design drawing', 'electrical'),
        item('elec-inverter','Inverter wiring provision',          'set', floors,      2500,  'Inverter changeover wiring all floors (Schedule A)', 'electrical'),
        item('elec-meter',   'Electricity meter stand',            'nos', 1,           4500,  'As per APEPDCL specification (Schedule A)', 'electrical'),
        item('elec-labour',  'Electrical wiring labour',           'nos', floors,      8000,  'Concealed wiring complete per floor', 'labour'),
    ];
}

// s10b — Plumbing
export function s10b_materials(p) {
    const { nF } = baseParams(p);
    const floors = nF;
    const baths  = (nF - 1) * 3;  // 3 bathrooms per residential floor
    return [
        item('plumb-cpvc1',  'CPVC pipe 1" (Astral/Truflo)',       'mtr', floors*100,  180,   'Hot + cold water supply — Astral/Truflo (Schedule A)', 'plumbing'),
        item('plumb-cpvc75', 'CPVC pipe 3/4" (Astral/Truflo)',     'mtr', floors*80,   130,   'Branch lines to fixtures', 'plumbing'),
        item('plumb-cpvc50', 'CPVC pipe 1/2" (Astral/Truflo)',     'mtr', floors*60,   90,    'Final connections to taps and geysers', 'plumbing'),
        item('plumb-upvc4',  'UPVC SWR pipe 4" (Astral/Truflo)',   'mtr', floors*60,   150,   'Soil drain — WC connection (Schedule A)', 'plumbing'),
        item('plumb-upvc3',  'UPVC SWR pipe 3" (Astral/Truflo)',   'mtr', floors*40,   110,   'Waste drain — bath/kitchen', 'plumbing'),
        item('plumb-wc',     'Western commode + cistern (Hindware/Cera)','nos', baths, 7500, 'With flush and jet spray — Schedule A brands', 'plumbing'),
        item('plumb-basin',  'Wash basin medium (Hindware/Cera)',   'nos', baths,       3200,  'With tap — Hindware/Cera (Schedule A)', 'plumbing'),
        item('plumb-shower', 'Shower + taps hot+cold (Jaquar/eq)', 'set', baths,       3500,  'Hot & cold water provision (Schedule A)', 'plumbing'),
        item('plumb-sink',   'Kitchen steel sink + U-tap',          'nos', nF-1,        4500,  'Steel sink with U-shape tap (Schedule A)', 'plumbing'),
        item('plumb-taps',   'All other taps (plumber grade)',      'nos', floors*8,    350,   'Bib cocks, stop cocks, angle valves (Schedule A)', 'plumbing'),
        item('plumb-sump',   'Underground sump (brick + RCC cover)','cum', 8,           8500,  '8 cum capacity, brick walls, RCC cover slab', 'civil'),
        item('plumb-ohwt',   'Overhead tank 3000L (Sintex)',        'nos', 2,           18000, '2×3000L on terrace as per plan', 'systems'),
        item('plumb-rwh',    'Rain water harvesting pit',           'nos', 1,           25000, 'Percolation pit as per GVMC approved plan', 'civil'),
        item('plumb-septic', 'Septic tank (IS 2470 — 4 chamber)',   'nos', 1,           40000, '4-chamber brick septic tank with soak pit', 'civil'),
        item('plumb-labour', 'Plumbing labour',                     'nos', floors,       6000,  'CPVC + UPVC + fixture installation per floor', 'labour'),
    ];
}

// s11a — SS Railing & Glass (new contract stage)
export function s11a_materials(p) {
    const { nF } = baseParams(p);
    const floors = nF - 1;
    return [
        item('rail-ss304',   'SS 304 tube 2" (Jindal)',             'mtr', 60,          850,   'Vertical posts + top rail — Jindal SS 304 (Schedule A)', 'railings'),
        item('rail-ss16',    'SS 304 flat 1.5" (horizontal fill)',  'mtr', 120,         550,   'Horizontal infill bars', 'railings'),
        item('rail-glass',   'Toughened glass 8mm (balcony)',        'sqm', floors*12,   1800,  'Safety toughened glass panels — all 3 balconies', 'misc'),
        item('rail-bracket', 'SS 304 wall brackets + anchors',       'nos', 40,          380,   'Wall fixing brackets, chemical anchors', 'misc'),
        item('rail-stair',   'Staircase SS 304 railing (Jindal)',    'rft', 65,          1800,  'Staircase + landing — Jindal SS 304 (Schedule A)', 'railings'),
        item('rail-glass-slide','Sliding glass door (E balcony)',    'nos', nF-1,        18000, 'Sliding glass door with granite frame — east balcony', 'misc'),
        item('rail-labour',  'SS railing + glass installation',      'mtr', 80,          650,   'Welding, grinding, polishing, glass fitting', 'labour'),
    ];
}

// s12 — Painting (contract stage s12 = painting, NOT doors/windows)
export function s12_painting_materials(p) {
    const { L, W, nF } = baseParams(p);
    const wallArea  = 2*(L+W)*10.5*(nF-1)*2;   // both sides interior
    const wallSqm   = wallArea * 0.0929;
    const ceilSqm   = L * W * 0.0929 * (nF-1);
    const extSqm    = 2*(L+W)*10.5*(nF-1)*0.0929;

    return [
        item('pt-putty',    'Putty (Birla/Asian/Berger)',            'kg',   Math.round(wallSqm*0.8),  25,   '2 coats — all interior walls (Schedule A)', 'paint'),
        item('pt-primer',   'Interior primer (Berger/Asian)',        'ltr',  Math.round(wallSqm*0.1),  180,  '1 coat primer before emulsion', 'paint'),
        item('pt-emulsion', 'Emulsion paint interior (Berger/Asian)','ltr',  Math.round(wallSqm*0.25), 220,  '2 coats — Berger/Asian/Birla Opus (Schedule A)', 'paint'),
        item('pt-ext-primer','Exterior primer',                      'ltr',  Math.round(extSqm*0.12),  240,  'Weather-resistant primer coat', 'paint'),
        item('pt-texture',  'Texture paint exterior (Berger/Asian)', 'ltr',  Math.round(extSqm*0.35),  320,  'Texture finish coat — Berger/Asian/Birla Opus (Schedule A)', 'paint'),
        item('pt-ceil',     'Ceiling emulsion (white)',              'ltr',  Math.round(ceilSqm*0.15), 180,  '2 coats ceiling emulsion', 'paint'),
        item('pt-labour',   'Painting labour (all areas)',           'sqm',  Math.round(wallSqm+ceilSqm+extSqm), 35, 'Interior walls + ceiling + exterior', 'labour'),
    ];
}

// s13a — Granite Work
export function s13a_materials(p) {
    const { nF, L, W } = baseParams(p);
    const floors = nF - 1;
    const kitchenGran = floors * 6;     // sqm kitchen platform
    const stairGran   = 80;             // sqft staircase
    const corridorGran= floors * 8;     // sqm corridors + lift lobby
    const totalGran   = kitchenGran + stairGran*0.093 + corridorGran;

    return [
        item('gran-kitchen','Granite kitchen platform (Blackberry/Steel Gray)','sqm', kitchenGran, 2800, 'Polished 20mm thick — Blackberry or Steel Gray (Schedule A)', 'material'),
        item('gran-stair',  'Granite staircase (Blackberry/Steel Gray)',       'sft', stairGran,   220,  'Staircase treads + risers (Schedule A)', 'material'),
        item('gran-corridor','Granite corridor + lift lobby',                  'sqm', corridorGran,2200, 'Polished granite flooring (Schedule A)', 'material'),
        item('gran-door',   'Granite door frames (all except main)',           'rft', floors*120,  350,  'Granite sill + frame — all openings (Schedule A)', 'material'),
        item('gran-win',    'Granite window frames',                           'rft', floors*80,   300,  'Window sill + frame — all windows (Schedule A)', 'material'),
        item('gran-main',   'Main door — African Teak (6×3" frame)',          'nos', 1,           55000,'African Teak wood door + frame, 6×3 inch (Schedule A)', 'doors'),
        item('gran-wpvc',   'Bedroom doors Laminated/WPVC',                   'nos', floors*3,    9000, 'Laminated/WPVC doors — Schedule A spec', 'doors'),
        item('gran-bath',   'Bathroom doors Laminated/WPVC',                  'nos', floors*3,    7500, 'Laminated/WPVC bathroom doors (Schedule A)', 'doors'),
        item('gran-upvc',   'UPVC windows 90-series (Wento/Simta)',           'nos', floors*8,    14000,'Wento UPVC 90-series with SS security grill (Schedule A)', 'windows'),
        item('gran-labour', 'Granite + door + window fitting labour',         'sqm', totalGran,   450,  'Cutting, polishing, fixing', 'labour'),
    ];
}

// s13b — Tiles & Flooring
export function s13b_materials(p) {
    const { L, W, nF } = baseParams(p);
    const floors  = nF - 1;
    const stiltArea   = L * W * 0.0929;           // sqm stilt parking
    const roomArea    = L * W * 0.0929 * floors;  // sqm all room floors
    const bathFloor   = floors * 3 * 4.0;         // sqm bath floors
    const bathWall    = floors * 3 * 18.0;        // sqm bath walls to ceiling
    const kitchenFloor= floors * 10.0;            // sqm kitchen

    return [
        item('tile-stilt',  'Parking tiles 1×1ft (stilt)',           'sqm', stiltArea,          550,  'Non-slip 1×1ft parking tiles (Schedule A)', 'tiles'),
        item('tile-room',   'Gujarat tiles 2×4ft (rooms+corridors+balcony)','sqm', roomArea,     900,  'Double charge vitrified Gujarat tiles (Schedule A)', 'tiles'),
        item('tile-bath-fl','Gujarat tiles 2×2ft (bathroom floor)',   'sqm', bathFloor,          800,  'Anti-skid vitrified 2×2ft Gujarat (Schedule A)', 'tiles'),
        item('tile-bath-wl','Gujarat tiles 2×4ft (bathroom walls)',   'sqm', bathWall,           900,  'Vitrified 2×4ft Gujarat up to ceiling (Schedule A)', 'tiles'),
        item('tile-kitchen','Gujarat tiles 2×4ft (kitchen)',          'sqm', kitchenFloor,       900,  'Gujarat vitrified tiles — kitchen (Schedule A)', 'tiles'),
        item('tile-adhesive','Tile adhesive (Acc/Roff)',              'bags', Math.round((roomArea+bathFloor+kitchenFloor)*0.5), 280, '0.5 bags/sqm for vitrified tiles', 'material'),
        item('tile-grout',  'Tile grout (Fosroc/Roff)',               'kg',   Math.round((roomArea+bathFloor+bathWall)*0.2), 180, 'For tile joints', 'material'),
        item('tile-labour', 'Tiling labour (all areas)',              'sqm',  roomArea+bathFloor+bathWall+kitchenFloor, 35, 'Rate includes cutting and waste', 'labour'),
    ];
}

// s14a — Lift & CCTV
export function s14a_materials(p) {
    return [
        item('lift-unit',   'Lift 5-person automatic (Touchwood/Jag)','nos', 1, 650000, 'Automatic doors, 5-person capacity — Touchwood or Jag (Schedule A). Minimum 12-month warranty.', 'systems'),
        item('lift-guide',  'Lift guide rails + controller',           'set', 1, 80000,  'Machine room controller + guide rails (included in lift supply)', 'systems'),
        item('lift-ht',     'Lift shaft headroom RCC (if not in s7)',  'nos', 1, 30000,  'Min 8.5ft footing depth per structural drawing notes', 'civil'),
        item('cctv-cam',    'CCTV cameras 4MP (8 nos)',                'nos', 8, 4500,   '4MP dome cameras for all entry/exit points', 'systems'),
        item('cctv-nvr',    'NVR + 2TB HDD (30-day recording)',        'nos', 1, 18000,  '8-channel NVR with 2TB storage (Schedule A)', 'systems'),
        item('cctv-cable',  'CCTV coaxial cable',                      'mtr', 300, 35,   'RG6 cable from cameras to NVR', 'electrical'),
        item('cctv-monitor','Monitor 21" for CCTV',                   'nos', 1, 8000,   'Security monitoring screen at watchman room', 'systems'),
        item('lift-labour', 'Lift installation + commissioning',       'nos', 1, 25000,  'Manufacturer-approved technician installation', 'labour'),
    ];
}

// s14b — Generator & Power Connection
export function s14b_materials(p) {
    return [
        item('gen-unit',    'Generator 15KVA (Escort/equivalent)',     'nos', 1, 185000, 'Diesel genset for common area, lift, borewell, municipal supply (Schedule A)', 'systems'),
        item('gen-ats',     'ATS — Auto Transfer Switch',              'nos', 1, 18000,  'Automatic changeover between APEPDCL and generator', 'electrical'),
        item('gen-cables',  'Generator cabling 10sqmm armoured',       'mtr', 80, 220,   'From generator to ATS panel', 'electrical'),
        item('gen-exhaust', 'Exhaust pipe + silencer',                 'nos', 1, 8000,   'Generator exhaust routing with silencer', 'misc'),
        item('gen-room',    'Generator room (brick + roof)',            'sqm', 12, 2500,  'Covered ventilated generator room', 'civil'),
        item('gen-fuel',    'Fuel tank 200L with pump',                'nos', 1, 12000,  'Day tank for generator', 'systems'),
        item('gen-transformer','Transformer (APEPDCL capacity)',       'nos', 1, 95000,  'As per APEPDCL recommendation (Schedule A)', 'systems'),
        item('gen-apepdcl', 'APEPDCL service connection charges',      'nos', 1, 35000,  'Deposit + connection charges as per APEPDCL', 'misc'),
        item('gen-labour',  'Generator + transformer installation',    'nos', 1, 12000,  'Licensed electrician installation and commissioning', 'labour'),
    ];
}

// s_handover — Systems & Handover  
export function s_handover_materials(p) {
    const { L, W } = baseParams(p);
    return [
        item('hw-compound', 'Compound wall (brick + plaster + cap)',   'rft', Math.round(2*(L+W)), 1800, 'Full perimeter RCC columns + brick wall + plaster', 'civil'),
        item('hw-gate',     'Entrance gate (MS fabrication)',          'nos', 1, 38000,  'MS gate with SS cladding or teak panel', 'misc'),
        item('hw-bath-fit', 'Bathroom fittings (Hindware/Cera)',       'set', 3, 18000,  'Per-floor set: WC + washbasin + shower (Schedule A)', 'plumbing'),
        item('hw-labour',   'Handover + snag rectification labour',    'nos', 1, 15000,  'Final cleaning, snag fixes, documentation', 'labour'),
    ];
}

// ── Master dispatcher ─────────────────────────────────────────────────────────
const STAGE_CALCULATORS = {
    // Contract stage IDs (from Works Contract Agreement — Bheem Enterprises)
    s_borewell: s_borewell_materials,
    s1:         s1_materials,           // Earth Work & Foundation
    s_col_pb:   s_col_pb_materials,     // Columns & Plinth Beam
    s4:         s4_materials,           // 1st Slab (Stilt Roof)
    s5:         s5_materials,           // 2nd Slab (FF Slab)
    s6:         s6_materials,           // 3rd Slab (SF Slab)
    s7:         s7_materials,           // 4th Slab (Second Roof)
    s7b:        s7_materials,           // 5th Slab (Terrace+OHT) — same RCC work
    s8:         s8_materials,           // Brick Work
    s9:         s9_materials,           // Plastering
    s10a:       s10a_materials,         // Electrical Work
    s10b:       s10b_materials,         // Plumbing
    s11a:       s11a_materials,         // SS Railing & Glass
    s12:        s12_painting_materials, // Painting
    s13a:       s13a_materials,         // Granite Work
    s13b:       s13b_materials,         // Tiles & Flooring
    s14a:       s14a_materials,         // Lift & CCTV
    s14b:       s14b_materials,         // Generator & Power
    s_handover: s_handover_materials,   // Systems & Handover
    // Legacy IDs (backward compatibility for any saved data)
    s2:  s2_materials,
    s3:  s3_materials,
    s10: s10_materials,
    s11: s11_materials,
    s13: s13_materials,
    s14: s14_materials,
};

/**
 * Get materials for a specific stage.
 * @param {string} stageId  e.g. 's2'
 * @param {object} project  saved project object (for dimensions)
 * @returns {{ items: Array, totalCost: number }}
 */
export function getStageMaterials(stageId, project = {}, ratesOverride = null) {
    const fn = STAGE_CALCULATORS[stageId];
    if (!fn) return { items: [], totalCost: 0 };
    // Merge DB rates over hardcoded defaults if provided
    const effectiveRates = ratesOverride
        ? { ...MARKET_RATES, ...ratesOverride }
        : MARKET_RATES;
    // Temporarily patch MARKET_RATES keys — functions reference MARKET_RATES directly
    // so we patch and restore (thread-safe for single-threaded JS)
    const saved = {};
    if (ratesOverride) {
        Object.keys(ratesOverride).forEach(k => {
            saved[k] = MARKET_RATES[k];
            MARKET_RATES[k] = ratesOverride[k];
        });
    }
    const items = fn(project);
    // Restore
    if (ratesOverride) Object.keys(saved).forEach(k => { MARKET_RATES[k] = saved[k]; });
    const totalCost = items.reduce((a, i) => a + i.amount, 0);
    return { items, totalCost };
}

/**
 * Summarise stage cost into categories.
 */
export function getStageCostSummary(stageId, project = {}) {
    const { items, totalCost } = getStageMaterials(stageId, project);
    const byCategory = {};
    items.forEach(i => {
        if (!byCategory[i.category]) byCategory[i.category] = 0;
        byCategory[i.category] += i.amount;
    });
    return { totalCost, byCategory, items };
}
