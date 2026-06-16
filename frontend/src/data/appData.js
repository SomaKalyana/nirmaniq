import { C } from '../utils/colors.js'

export const MATERIALS_DATA = [
  { id: 'm1',  name: 'Steel 20mm TMT',  unit: 'MT',   required: 9.8,   color: C.red,     cat: 'steel' },
  { id: 'm2',  name: 'Steel 16mm TMT',  unit: 'MT',   required: 4.2,   color: C.red,     cat: 'steel' },
  { id: 'm3',  name: 'Steel 12mm TMT',  unit: 'MT',   required: 14.0,  color: C.amber,   cat: 'steel' },
  { id: 'm4',  name: 'Steel 10mm TMT',  unit: 'MT',   required: 6.5,   color: C.amber,   cat: 'steel' },
  { id: 'm5',  name: 'Steel 8mm TMT',   unit: 'MT',   required: 7.3,   color: C.amber,   cat: 'steel' },
  { id: 'm6',  name: 'OPC 53 Cement',   unit: 'bags', required: 2288,  color: C.accent,  cat: 'cement' },
  { id: 'm7',  name: 'PPC Cement',      unit: 'bags', required: 1493,  color: C.accentL, cat: 'cement' },
  { id: 'm8',  name: 'River Sand',      unit: 'cum',  required: 608,   color: C.green,   cat: 'aggregate' },
  { id: 'm9',  name: 'Aggregate 20mm',  unit: 'cum',  required: 166,   color: C.green,   cat: 'aggregate' },
  { id: 'm10', name: 'Aggregate 40mm',  unit: 'cum',  required: 6,     color: C.purple,  cat: 'aggregate' },
  { id: 'm11', name: 'Red Bricks',      unit: 'nos',  required: 93270, color: C.red,     cat: 'masonry' },
  { id: 'm12', name: 'Flooring Tiles',  unit: 'boxes',required: 420,   color: C.purple,  cat: 'finishing' },
  { id: 'm13', name: 'Bathroom Tiles',  unit: 'boxes',required: 180,   color: C.purple,  cat: 'finishing' },
]

// Budget categories derived from Works Contract Agreement (Bheem Enterprises)
// Total contract: ₹1,35,00,000 | Rate: ₹2,100/sft | 1,595 sft × 4 floors
// 50% advance before each stage, 50% after satisfactory completion
export const BUDGET_DATA = [
  { id: 'b1',  label: 'Pre-Construction',            allocated: 300000   },  // ₹3L — approvals, legal, GVMC liaison, NOC fees
  { id: 'b0',  label: 'Borewell',                    allocated: 300000   },
  { id: 'b2',  label: 'Earth Work & Foundation',     allocated: 900000   },  // ₹9L (excav+footing); b2b covers columns ₹5L = ₹14L total
  { id: 'b2b', label: 'Columns & Plinth Beam',      allocated: 500000   },  // split from ₹14L contract
  { id: 'b3a', label: '1st Slab — Stilt Roof',       allocated: 1200000  },
  { id: 'b3b', label: '2nd Slab — Ground Roof',          allocated: 1200000  },
  { id: 'b3c', label: '3rd Slab — First Roof',          allocated: 1200000  },
  { id: 'b3d', label: '4th Slab — Second Roof',      allocated: 600000   },  // split: 2nd floor roof
  { id: 'b3e', label: '5th Slab — Terrace + OHT',       allocated: 600000   },  // terrace + headroom + OHT
  { id: 'b4a', label: 'Brick Work',                  allocated: 1200000  },
  { id: 'b4b', label: 'Plastering',                  allocated: 800000   },
  { id: 'b5a', label: 'Electrical',                  allocated: 600000   },
  { id: 'b5b', label: 'Plumbing',                    allocated: 800000   },
  { id: 'b5c', label: 'SS Railing & Glass',          allocated: 400000   },
  { id: 'b8',  label: 'Painting',                    allocated: 800000   },
  { id: 'b6a', label: 'Granite',                     allocated: 600000   },
  { id: 'b6b', label: 'Tiles & Flooring',            allocated: 600000   },
  { id: 'b9a', label: 'Lift & CCTV',                 allocated: 0        },  // TBD — not fixed in contract Schedule 4
  { id: 'b9b', label: 'Generator & Power',           allocated: 1200000  },
  { id: 'b9c', label: 'Systems & Handover (balance)',allocated: 0        },  // Contract: balance over ₹1.35Cr after OHT + compound wall
  { id: 'b10', label: 'Contingency',                 allocated: 400000   },
]

export const TEAM_DATA = [
  { id: 't1', role: 'Site Supervisor',    name: '', phone: '', salary: 30000, status: 'pending', hired: '' },
  { id: 't2', role: 'Watchman (live-in)', name: '', phone: '', salary: 9000,  status: 'pending', hired: '' },
  { id: 't3', role: 'RCC Contractor',     name: '', phone: '', salary: 0,     status: 'pending', hired: '' },
  { id: 't4', role: 'Mason Contractor',   name: '', phone: '', salary: 0,     status: 'pending', hired: '' },
  { id: 't5', role: 'Plumber',            name: '', phone: '', salary: 0,     status: 'pending', hired: '' },
  { id: 't6', role: 'Electrician',        name: '', phone: '', salary: 0,     status: 'pending', hired: '' },
  { id: 't7', role: 'Tile Contractor',    name: '', phone: '', salary: 0,     status: 'pending', hired: '' },
  { id: 't8', role: 'Painter',            name: '', phone: '', salary: 0,     status: 'pending', hired: '' },
]
