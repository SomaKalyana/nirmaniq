/**
 * estimator.js
 * Compute material quantity estimates and budget allocations
 * from project parameters (plot dimensions + floor configuration).
 *
 * All formulae are based on standard residential construction in AP/Telangana
 * using IS 456-2000 and typical RCC framing for G+2/G+3 buildings.
 
/**
 * Compute road-facing-aware adjusted dimensions.
 * 
 * Convention:
 *   plotLength = longer axis (North-South for a 60×35 south-facing plot)
 *   plotWidth  = shorter axis (East-West)
 *
 * For South or North facing plots:
 *   front/back setbacks are along the LENGTH axis (reduce plotLength)
 *   left/right setbacks are along the WIDTH axis  (reduce plotWidth)
 *
 * For East or West facing plots:
 *   front/back setbacks are along the WIDTH axis  (reduce plotWidth)
 *   left/right setbacks are along the LENGTH axis (reduce plotLength)
 *
 * @returns {{ adjL: number, adjW: number }}
 */
function adjustedDimensions(p) {
    const L = Math.max(0, Number(p.plotLength) || 60);
    const W = Math.max(0, Number(p.plotWidth)  || 35);
    const sbFront = Number(p.setbackFront) || 0;
    const sbBack  = Number(p.setbackBack)  || 0;
    const sbLeft  = Number(p.setbackLeft)  || 0;
    const sbRight = Number(p.setbackRight) || 0;

    const dir = (p.facing || '').toLowerCase();
    const isEastWest = dir.includes('east') || dir.includes('west');

    if (isEastWest) {
        // front/back setbacks reduce the WIDTH (road-facing short axis)
        // left/right setbacks reduce the LENGTH
        return {
            adjL: Math.max(0, L - sbLeft - sbRight),
            adjW: Math.max(0, W - sbFront - sbBack),
        };
    } else {
        // South/North (default): front/back setbacks reduce the LENGTH
        // left/right setbacks reduce the WIDTH
        return {
            adjL: Math.max(0, L - sbFront - sbBack),
            adjW: Math.max(0, W - sbLeft - sbRight),
        };
    }
}

/**
 * Estimate material quantities from project params.
 * @param {object} p - project object
 * @returns {Array} - array matching MATERIALS_DATA shape with computed `required`
 */
export function estimateMaterials(p) {
    const length = Number(p.plotLength) || 60; // ft
    const width = Number(p.plotWidth) || 35; // ft
    const floors = Number(p.totalFloors) || 4; // including stilt if any
    // compute adjusted slab footprint after setbacks (road-facing aware)
    const { adjL: adjLength, adjW: adjWidth } = adjustedDimensions(p);
    const slabArea = Math.round(adjLength * adjWidth); // buildable footprint, no coverage factor
    const terraceLength = Number(p.terraceLength) || 0;
    const terraceWidth = Number(p.terraceWidth) || 0;
    const liftRoomLength = Number(p.liftRoomLength) || 0;
    const liftRoomWidth = Number(p.liftRoomWidth) || 0;

    const terraceArea =
        terraceLength && terraceWidth
            ? terraceLength * terraceWidth
            : p.hasTerraceRoom
              ? 216
              : 0;

    const liftRoomArea =
        liftRoomLength && liftRoomWidth
            ? liftRoomLength * liftRoomWidth
            : p.hasLiftRoom
              ? 216
              : 0;

    // Terrace room normally contributes one additional slab; lift-room on terrace counts as two slabs
    const terraceSlabArea = p.hasTerraceRoom ? terraceArea * 1 : 0;
    const liftSlabArea = p.hasLiftRoom ? liftRoomArea * 2 : 0;

    // Total slab area across all floors (sft)
    const totalSlabArea = slabArea * floors + terraceSlabArea + liftSlabArea;

    // Steel (MT) — empirical: ~6.3 kg/sft of slab area (Fe415, residential)
    const totalSteelKg = totalSlabArea * 6.3;

    // Steel breakdown by dia — typical distribution for G+2 RCC
    const steel20 = +((totalSteelKg * 0.234) / 1000).toFixed(1); // columns/beams main
    const steel16 = +((totalSteelKg * 0.1) / 1000).toFixed(1);
    const steel12 = +((totalSteelKg * 0.335) / 1000).toFixed(1); // slab main
    const steel10 = +((totalSteelKg * 0.155) / 1000).toFixed(1); // stirrups
    const steel8 = +((totalSteelKg * 0.176) / 1000).toFixed(1); // distribution

    // Cement bags
    // M25 RCC: ~6.5 bags/cum concrete; typical concrete vol = 0.65 cum/sft slab
    const rccVol = totalSlabArea * 0.055; // cum (slab + beams + cols approx)
    const opcBags = Math.round(rccVol * 6.5); // OPC 53 for RCC
    const ppcBags = Math.round(slabArea * floors * 0.12); // PPC for masonry + plaster

    // Sand (cum): masonry + plaster + concrete
    const sand = Math.round(totalSlabArea * 0.092);

    // Aggregate 20mm (cum)
    const agg20 = Math.round((rccVol * 1.54 * 2) / 4);

    // Aggregate 40mm for PCC
    const agg40 = Math.round(length * width * 0.003);

    // Bricks: outer 9" walls + inner 4" walls
    // Perimeter per floor × height × brick factor
    const perim = 2 * (length + width); // lft
    const wallHt = Number(p.floorHeight) || 10.5; // ft
    const outerVol =
        perim * wallHt * (9 / 12) * (floors - (p.hasStilt ? 1 : 0));
    const innerVol = outerVol * 0.55; // inner walls approx 55% of outer
    const bricks = Math.round(((outerVol + innerVol) * 500) / 35.315);

    // Flooring tiles (2×4ft boxes) — 1 box ≈ 10 sft
    const floorTiles = Math.round(
        ((slabArea * (floors - (p.hasStilt ? 1 : 0))) / 10) * 1.1,
    );

    // Bathroom tiles
    const bathTiles = Math.round((floors * 3 * 40) / 8); // 3 baths/floor, 40sft/bath, 8sft/box

    return [
        { id: 'm1', required: steel20 },
        { id: 'm2', required: steel16 },
        { id: 'm3', required: steel12 },
        { id: 'm4', required: steel10 },
        { id: 'm5', required: steel8 },
        { id: 'm6', required: opcBags },
        { id: 'm7', required: ppcBags },
        { id: 'm8', required: sand },
        { id: 'm9', required: agg20 },
        { id: 'm10', required: agg40 },
        { id: 'm11', required: bricks },
        { id: 'm12', required: floorTiles },
        { id: 'm13', required: bathTiles },
    ];
}

/**
 * Distribute total budget across 10 categories proportionally.
 * Uses typical percentage splits for residential construction in AP.
 */
export function estimateBudget(totalBudget) {
    // Splits derived from Works Contract Agreement — proportional to ₹1.35 Cr total
    const SPLITS = [
        { id: 'b1',  label: 'Pre-Construction',        pct: 0.015 },
        { id: 'b0',  label: 'Borewell',                pct: 0.022 },  // ₹3L / ₹1.35Cr
        { id: 'b2',  label: 'Earth Work & Foundation', pct: 0.067 },  // ₹9L (excav + footings)
        { id: 'b2b', label: 'Columns & Plinth Beam',     pct: 0.037 },  // ₹5L (columns + plinth beam)
        { id: 'b3a', label: '1st Slab — Stilt Roof',   pct: 0.089 },  // ₹12L
        { id: 'b3b', label: '2nd Slab — Ground Roof',      pct: 0.089 },  // ₹12L
        { id: 'b3c', label: '3rd Slab — First Roof',      pct: 0.089 },  // ₹12L
        { id: 'b3d', label: '4th Slab — Second Roof',  pct: 0.089 },  // ₹12L
        { id: 'b4a', label: 'Brick Work',              pct: 0.089 },  // ₹12L
        { id: 'b4b', label: 'Plastering',              pct: 0.059 },  // ₹8L
        { id: 'b5a', label: 'Electrical',              pct: 0.044 },  // ₹6L
        { id: 'b5b', label: 'Plumbing',                pct: 0.059 },  // ₹8L
        { id: 'b5c', label: 'SS Railing & Glass',      pct: 0.030 },  // ₹4L
        { id: 'b8',  label: 'Painting',                pct: 0.059 },  // ₹8L
        { id: 'b6a', label: 'Granite',                 pct: 0.044 },  // ₹6L
        { id: 'b6b', label: 'Tiles & Flooring',        pct: 0.044 },  // ₹6L
        { id: 'b9a', label: 'Lift & CCTV',             pct: 0.037 },  // TBD
        { id: 'b9b', label: 'Generator & Power',       pct: 0.089 },  // ₹12L
        { id: 'b9c', label: 'Systems & Handover',      pct: 0.030 },  // Balance
        { id: 'b10', label: 'Contingency',             pct: 0.030 },
    ];
    // Normalise so they sum to 1 exactly
    const sumPct = SPLITS.reduce((a, s) => a + s.pct, 0);
    return SPLITS.map((s) => ({
        ...s,
        allocated: Math.round((s.pct / sumPct) * totalBudget),
        spent: 0,
    }));
}

/**
 * Compute total slab area from project params.
 */
export function computeSlabArea(p) {
    const l = Number(p.plotLength) || 60;
    const w = Number(p.plotWidth) || 35;
    const f = Number(p.totalFloors) || 4;
    const terraceLength = Number(p.terraceLength) || 0;
    const terraceWidth = Number(p.terraceWidth) || 0;
    const liftRoomLength = Number(p.liftRoomLength) || 0;
    const liftRoomWidth = Number(p.liftRoomWidth) || 0;

    const terraceArea =
        terraceLength && terraceWidth
            ? terraceLength * terraceWidth
            : p.hasTerraceRoom
              ? 216
              : 0;

    const liftRoomArea =
        liftRoomLength && liftRoomWidth
            ? liftRoomLength * liftRoomWidth
            : p.hasLiftRoom
              ? 216
              : 0;

    // Road-facing-aware setback adjustment — no coverage factor
    const { adjL, adjW } = adjustedDimensions(p);
    const baseSlab = Math.round(adjL * adjW);
    return (
        baseSlab * f +
        (p.hasTerraceRoom ? terraceArea * 1 : 0) +
        (p.hasLiftRoom ? liftRoomArea * 2 : 0)
    );
}

/**
 * Suggest number of floors based on road width (GVMC rules).
 */
export function suggestFloors(roadWidthM, hasStilt) {
    const w = Number(roadWidthM) || 6;
    let floors;
    if (w >= 18) floors = hasStilt ? 5 : 4;
    else if (w >= 12) floors = hasStilt ? 4 : 3;
    else if (w >= 9) floors = hasStilt ? 3 : 2;
    else floors = hasStilt ? 2 : 1;
    return floors;
}
