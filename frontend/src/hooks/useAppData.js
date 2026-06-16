import { useState, useEffect, useCallback, useRef } from 'react';
import { getStorage, setStorage, addPaymentApi, updatePaymentApi, deletePaymentApi, fetchStageMaster,
         fetchMarketRates, fetchMaterialMaster, fetchTeamRoles } from '../utils/api.js';
import { PREREQ_GROUPS } from '../data/prereqData.js';
import { STAGES_DATA } from '../data/stagesData.js';
import { MATERIALS_DATA, BUDGET_DATA, TEAM_DATA } from '../data/appData.js';
import { estimateBudget } from '../utils/estimator.js';
import { fmtDate, fmtTime, pct } from '../utils/format.js';

// ── Build default stages from templates ──────────────────────────────────
// stagesDef: array from DB (preferred) or STAGES_DATA fallback
function buildDefaultStages(stagesDef = null) {
    // Use DB stages only when it returns at least one real construction stage.
    // Otherwise fall back to bundled STAGES_DATA so the UI never becomes blank.
    const hasRegularStages = Array.isArray(stagesDef) && stagesDef.some(s => s && s.id && s.id !== 's0');
    const source = hasRegularStages ? stagesDef : STAGES_DATA;

    // s0 from DB if available, otherwise hardcoded fallback
    const s0db = source.find(s => s && s.id === 's0');
    const prereq = {
        ...(s0db || {}),
        id: 's0',
        label: s0db ? s0db.label : 'Pre-Construction: Documents & Approvals',
        icon:  s0db ? s0db.icon  : '📋',
        color: s0db ? s0db.color : '#F5A623',
        phase: 'prerequisite',
        budgetPct:  s0db ? s0db.budgetPct  : 2.2,
        durationWks: s0db ? s0db.durationWks : 8,
        contractAmount: s0db ? (s0db.contractAmount || 0) : 0,
        paymentRule: s0db ? (s0db.paymentRule || '') : '',
        isPrereq: true,
        // Checklist from DB (used in task tracking)
        tasks: (s0db ? s0db.checklist || [] : []).map((text, i) => ({
            id: `s0_${i}`, text, done: false, doneDate: '',
        })),
        // Groups from prereqData.js for the checklist UI
        groups: PREREQ_GROUPS.map((g) => ({
            ...g,
            items: g.items.map((i) => ({ ...i })),
        })),
    };

    const regular = source
        .filter(s => s && s.id && s.id !== 's0')   // s0 handled above
        .map((s) => ({
            ...s,
            isPrereq: false,
            checklist: Array.isArray(s.checklist) ? s.checklist : [],
            tasks: (Array.isArray(s.checklist) ? s.checklist : []).map((text, i) => ({
                id: `${s.id}_${i}`,
                text,
                done: false,
                doneDate: '',
            })),
        }));

    return [prereq, ...regular];
}

// ── Merge saved state into fresh template ────────────────────────────────
function mergeStages(saved, stagesDef = null) {
    const defaults = buildDefaultStages(stagesDef);
    return defaults.map((def) => {
        const sv = (saved || []).find((x) => x.id === def.id);
        if (!sv) return def;

        if (def.isPrereq) {
            return {
                ...def,
                groups: def.groups.map((g) => ({
                    ...g,
                    items: g.items.map((item) => {
                        const svItems = (sv.groups || []).flatMap(
                            (sg) => sg.items || [],
                        );
                        const found = svItems.find((x) => x.id === item.id);
                        return found
                            ? {
                                  ...item,
                                  done: !!found.done,
                                  doneDate: found.doneDate || '',
                              }
                            : item;
                    }),
                })),
            };
        }

        return {
            ...def,
            tasks: def.tasks.map((t) => {
                const found = (sv.tasks || []).find((x) => x.id === t.id);
                return found
                    ? {
                          ...t,
                          done: !!found.done,
                          doneDate: found.doneDate || '',
                      }
                    : t;
            }),
        };
    });
}


function budgetWithPaymentSpend(budgetRows = [], payments = []) {
    const spentByCat = (Array.isArray(payments) ? payments : []).reduce((acc, pay) => {
        const catId = pay?.catId;
        if (!catId) return acc;
        acc[catId] = (acc[catId] || 0) + (Number(pay.amount) || 0);
        return acc;
    }, {});
    return (Array.isArray(budgetRows) ? budgetRows : []).map((b) => ({
        ...b,
        spent: Number(spentByCat[b.id] || 0),
    }));
}

// ── Hook ─────────────────────────────────────────────────────────────────
export function useAppData(project = null) {
    const [ready,         setReady]         = useState(false);
    const [marketRates,    setMarketRates]    = useState(null);
    const [materialMaster, setMaterialMaster] = useState(null);
    const [teamRoles,      setTeamRoles]      = useState(null);
    const [stages, setStages] = useState(() => mergeStages(null));
    const [mats, setMats] = useState([]);
    const [budget, setBudget] = useState([]);
    const [pays, setPays] = useState([]);
    const [team, setTeam] = useState(TEAM_DATA);
    const [logs, setLogs] = useState([]);
    const [photos, setPhotos] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loanItems, setLoanItems] = useState({});
    // Tracks whether budget allocations came from persistent backend storage.
    // When true, project total-budget auto-estimation must not overwrite user-edited
    // Pre-Construction / Construction / Post-Construction budget allocations on reload.
    const hasSavedBudgetRef = useRef(false);

    // Load
    useEffect(() => {
        (async () => {
          try {
            // Load config master tables (market rates, materials, team roles)
            fetchMarketRates().then(rates => { if (rates) setMarketRates(rates); }).catch(() => {});
            fetchMaterialMaster().then(mats => { if (mats.length) setMaterialMaster(mats); }).catch(() => {});
            fetchTeamRoles().then(roles => { if (roles.length) setTeamRoles(roles); }).catch(() => {});

            // Try loading stage definitions from DB (master tables).
            // IMPORTANT: DB data is used only if it contains real construction stages.
            // Empty/corrupt DB or old browser state must never make the Stages screen blank.
            let stagesDef = null;
            try {
                const dbStages = await fetchStageMaster();
                if (Array.isArray(dbStages) && dbStages.some(s => s && s.id && s.id !== 's0')) {
                    stagesDef = dbStages;
                }
            } catch (e) {
                console.warn('Stage master API unavailable; using bundled stage fallback.', e);
            }

            const sv = await getStorage('bs_stages', null);
            let merged = mergeStages(Array.isArray(sv) ? sv : null, stagesDef);

            // Final hard guard: if nothing renderable remains, force contract fallback.
            if (!Array.isArray(merged) || merged.filter(s => s && !s.isPrereq).length === 0) {
                console.warn('No renderable stages found; forcing bundled STAGES_DATA fallback.');
                merged = mergeStages(null, STAGES_DATA);
            }
            setStages(merged);

            const defaultMats = MATERIALS_DATA.map((m) => ({
                ...m,
                ordered: 0,
                received: 0,
                rate: 0,
                supplier: '',
            }));
            const savedMats = await getStorage('bs_mats', defaultMats);
            setMats(Array.isArray(savedMats) ? savedMats : defaultMats);

            const defaultBudget = BUDGET_DATA.map((b) => ({ ...b, spent: 0 }));
            const savedBudget = await getStorage('bs_budget', defaultBudget);
            hasSavedBudgetRef.current = Array.isArray(savedBudget) && savedBudget.length > 0;
            const savedPays = await getStorage('bs_pays', []);
            const safePays = Array.isArray(savedPays) ? savedPays : [];
            // Source of truth for spent amount is payments. Recalculate on startup so
            // Pre-Con, Post-Con, Stage pages and Home always show the same totals.
            setBudget(budgetWithPaymentSpend(Array.isArray(savedBudget) ? savedBudget : defaultBudget, safePays));
            setPays(safePays);

            const savedTeam = await getStorage('bs_team', TEAM_DATA);
            setTeam(Array.isArray(savedTeam) ? savedTeam : TEAM_DATA);

            const savedLogs = await getStorage('bs_logs', []);
            setLogs(Array.isArray(savedLogs) ? savedLogs : []);

            const savedPhotos = await getStorage('bs_photos', []);
            setPhotos(Array.isArray(savedPhotos) ? savedPhotos : []);

            const savedCustomers = await getStorage('bs_customers', []);
            setCustomers(Array.isArray(savedCustomers) ? savedCustomers : []);

            const savedLoanItems = await getStorage('bs_loan', {});
            setLoanItems(
                typeof savedLoanItems === 'object' && savedLoanItems !== null
                    ? savedLoanItems
                    : {},
            );
            setReady(true);
          } catch(e) {
            console.error('useAppData startup error:', e);
            setStages(prev => Array.isArray(prev) && prev.length ? prev : mergeStages(null));
            setReady(true); // still mark ready so app renders
          }
        })();
    }, []);

    // Recalculate budget allocations whenever project total budget changes
    useEffect(() => {
        const total = Number(project?.totalBudget) || 0;
        if (!total || !ready) return;
        // Do not recalculate/overwrite saved budget allocations. Budget edits in
        // Pre-Construction, Construction and Post-Construction are the source of truth
        // once bs_budget exists in the backend database.
        if (hasSavedBudgetRef.current) return;
        setBudget(prev => {
            // Only recalculate if the total doesn't match what's already saved
            const currentTotal = prev.reduce((s, b) => s + b.allocated, 0);
            if (Math.abs(currentTotal - total) < 1000) return prev; // already correct
            const fresh = estimateBudget(total);
            // Preserve existing `spent` values
            return fresh.map(nb => {
                const existing = prev.find(ob => ob.id === nb.id);
                return { ...nb, spent: existing?.spent || 0 };
            });
        });
    }, [project?.totalBudget, ready]);

    // Persist
    useEffect(() => {
        if (ready && stages) setStorage('bs_stages', stages);
    }, [stages, ready]);
    useEffect(() => {
        if (ready && mats) setStorage('bs_mats', mats);
    }, [mats, ready]);
    useEffect(() => {
        if (ready && budget) setStorage('bs_budget', budget);
    }, [budget, ready]);
    useEffect(() => {
        if (ready) setStorage('bs_pays', pays);
    }, [pays, ready]);
    useEffect(() => {
        if (ready) setStorage('bs_team', team);
    }, [team, ready]);
    useEffect(() => {
        if (ready) setStorage('bs_logs', logs);
    }, [logs, ready]);
    useEffect(() => {
        if (ready) setStorage('bs_photos', photos);
    }, [photos, ready]);
    useEffect(() => {
        if (ready) setStorage('bs_customers', customers);
    }, [customers, ready]);
    useEffect(() => {
        if (ready) setStorage('bs_loan', loanItems);
    }, [loanItems, ready]);

    // ── Computed ────────────────────────────────────────────────────────────
    const stageItems = useCallback(
        (s) =>
            s.isPrereq
                ? (s.groups || []).flatMap((g) => g.items)
                : s.tasks || [],
        [],
    );

    const stagePct = useCallback(
        (s) => {
            const items = stageItems(s);
            return pct(items.filter((x) => x.done).length, items.length);
        },
        [stageItems],
    );

    const computed = stages
        ? (() => {
              const totalTasks = stages.reduce(
                  (a, s) => a + stageItems(s).length,
                  0,
              );
              const doneTasks = stages.reduce(
                  (a, s) => a + stageItems(s).filter((x) => x.done).length,
                  0,
              );
              const totalBudget = (budget || []).reduce(
                  (a, b) => a + b.allocated,
                  0,
              );
              const totalSpent = (budget || []).reduce(
                  (a, b) => a + b.spent,
                  0,
              );
              const activeIdx = stages.findIndex((s) =>
                  stageItems(s).some((t) => !t.done),
              );
              return {
                  totalTasks,
                  doneTasks,
                  totalBudget,
                  totalSpent,
                  activeIdx,
              };
          })()
        : {
              totalTasks: 0,
              doneTasks: 0,
              totalBudget: 0,
              totalSpent: 0,
              activeIdx: -1,
          };

    // ── Actions ─────────────────────────────────────────────────────────────
    const toggleTask = useCallback((stageId, itemId) => {
        setStages((prev) =>
            prev.map((s) => {
                if (s.id !== stageId) return s;
                const now = fmtDate();
                if (s.isPrereq) {
                    return {
                        ...s,
                        groups: s.groups.map((g) => ({
                            ...g,
                            items: g.items.map((i) =>
                                i.id !== itemId
                                    ? i
                                    : {
                                          ...i,
                                          done: !i.done,
                                          doneDate: i.done ? '' : now,
                                      },
                            ),
                        })),
                    };
                }
                return {
                    ...s,
                    tasks: s.tasks.map((t) =>
                        t.id !== itemId
                            ? t
                            : {
                                  ...t,
                                  done: !t.done,
                                  doneDate: t.done ? '' : now,
                              },
                    ),
                };
            }),
        );
    }, []);

    const updateMat = useCallback((id, field, value) => {
        setMats((prev) =>
            prev.map((m) =>
                m.id !== id
                    ? m
                    : {
                          ...m,
                          [field]:
                              field === 'supplier' ? value : Number(value) || 0,
                      },
            ),
        );
    }, []);

    const addPayment = useCallback((payData) => {
        const amt = Number(payData.amount) || 0;
        const pay = { id: 'pay_' + Date.now(), ...payData, amount: amt };
        setPays((prev) => [pay, ...prev]);
        setBudget((prev) => {
            const updatedBudget = prev.map((b) =>
                b.id === payData.catId ? { ...b, spent: Number(b.spent || 0) + amt } : b,
            );
            setStorage('bs_budget', updatedBudget).catch(err => console.warn('Budget save error:', err));
            return updatedBudget;
        });
        // Persist directly to dedicated payments table (not just kv_store)
        addPaymentApi(pay).catch(err => console.warn('Payment save error:', err));
    }, []);

    const deletePayment = useCallback((payId) => {
        setPays((prev) => {
            const pay = prev.find((p) => p.id === payId);
            if (pay) {
                setBudget((b) => {
                    const updatedBudget = b.map((c) =>
                        c.id === pay.catId
                            ? { ...c, spent: Math.max(0, Number(c.spent || 0) - Number(pay.amount || 0)) }
                            : c,
                    );
                    setStorage('bs_budget', updatedBudget).catch(err => console.warn('Budget save error:', err));
                    return updatedBudget;
                });
            }
            return prev.filter((p) => p.id !== payId);
        });
        // Persist deletion directly
        deletePaymentApi(payId).catch(err => console.warn('Payment delete error:', err));
    }, []);


    const updatePayment = useCallback((payId, changes) => {
        setPays((prev) => {
            const oldPay = prev.find((p) => p.id === payId);
            if (!oldPay) return prev;
            const updated = {
                ...oldPay,
                ...changes,
                amount: Number(changes.amount ?? oldPay.amount) || 0,
            };

            setBudget((b) => {
                const updatedBudget = b.map((cat) => {
                    let spent = Number(cat.spent || 0);
                    if (cat.id === oldPay.catId) spent -= Number(oldPay.amount || 0);
                    if (cat.id === updated.catId) spent += Number(updated.amount || 0);
                    return { ...cat, spent: Math.max(0, spent) };
                });
                setStorage('bs_budget', updatedBudget).catch(err => console.warn('Budget save error:', err));
                return updatedBudget;
            });

            updatePaymentApi(updated).catch(err => console.warn('Payment update error:', err));
            return prev.map((p) => (p.id === payId ? updated : p));
        });
    }, []);

    const addLog = useCallback((text, stageLabel, stageId) => {
        if (!text.trim()) return;
        setLogs((prev) => [
            {
                id: 'log_' + Date.now(),
                date: fmtDate(),
                time: fmtTime(),
                text: text.trim(),
                stage: stageLabel,
                stageId: stageId || null,
            },
            ...prev.slice(0, 99),
        ]);
    }, []);

    const addPhoto = useCallback((src, name, stageLabel, stageId, reqPhotoId) => {
        setPhotos((prev) => [
            {
                id: 'ph_' + Date.now(),
                src,
                name,
                stageLabel,
                stageId: stageId || null,
                reqPhotoId: reqPhotoId || null,
                date: fmtDate(),
            },
            ...prev.slice(0, 49),
        ]);
    }, []);

    const addCustomer = useCallback((customer) => {
        const c = { id: customer.id || 'cust_' + Date.now(), ...customer };
        setCustomers((prev) => [c, ...prev]);
        return c;
    }, []);

    const updateTeamMember = useCallback((idx, field, value) => {
        setTeam((prev) =>
            prev.map((m, i) => (i !== idx ? m : { ...m, [field]: value })),
        );
    }, []);

    const toggleLoanItem = useCallback((itemId) => {
        setLoanItems((prev) => {
            const existing = prev[itemId] || {};
            const done = !existing.done;
            return {
                ...prev,
                [itemId]: {
                    done,
                    doneDate: done
                        ? new Date().toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                          })
                        : '',
                },
            };
        });
    }, []);

    // Edit a budget category's allocated amount and persist
    const updateBudget = useCallback((catId, newAmount) => {
        const amount = Math.max(0, Number(newAmount) || 0);
        if (!catId || amount <= 0) return;

        // Mark budget as manually edited so the project total-budget estimator
        // will not overwrite this value on this session or future reloads.
        hasSavedBudgetRef.current = true;

        setBudget(prev => {
            const updated = (Array.isArray(prev) ? prev : []).map(b =>
                b.id === catId ? { ...b, allocated: amount } : b
            );
            // Persist immediately to backend SQLite kv_store via /api/storage/bs_budget.
            // The normal budget useEffect also saves it, but this direct call makes the
            // Edit -> Save action durable before navigating to other pages.
            setStorage('bs_budget', updated).catch(err => console.warn('Budget save error:', err));
            return updated;
        });
    }, []);

    return {
        ready,
        stages,
        marketRates,
        materialMaster,
        teamRoles,
        mats,
        budget,
        pays,
        team,
        logs,
        photos,
        customers,
        computed,
        stageItems,
        stagePct,
        toggleTask,
        updateMat,
        addPayment,
        updatePayment,
        deletePayment,
        addLog,
        addPhoto,
        updateTeamMember,
        addCustomer,
        loanItems,
        updateBudget,
        toggleLoanItem,
    };
}
