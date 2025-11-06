import React, {
    useEffect,
    useMemo,
    useState,
    useCallback,
    useRef,
} from "react";
import { usePage } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Package } from "lucide-react";
import ServiceCard from "@/components/checkout/ServiceCard";
import SummaryCard from "@/components/checkout/SummaryCard";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";

/* ---------------- helpers ---------------- */
const formatIDR = (n) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number(n || 0));

function safeParseParam(key) {
    try {
        const url = new URL(window.location.href);
        const raw = url.searchParams.get(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function normalizeAnswers(val) {
    if (Array.isArray(val)) return val;
    if (val && typeof val === "object") return Object.values(val);
    return [];
}

function getOptionsArray(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function getCsrfToken(props) {
    return (
        document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content") ||
        props?.csrf_token ||
        window?.Laravel?.csrfToken ||
        ""
    );
}

function validateItemForType(item) {
    const type = String(item?.type || "fixed");
    const details = item?.details || {};

    if (type === "selectable") {
        if (!details.package)
            return { ok: false, reason: "Please choose an option." };
    }

    if (type === "multiple_options") {
        const packages = details.packages;
        if (!packages) {
            return { ok: false, reason: "Please choose at least one option." };
        }
        
        if (Array.isArray(packages)) {
            if (packages.length === 0) {
                return { ok: false, reason: "Please choose at least one option." };
            }
        } else if (typeof packages === 'object' && packages !== null) {
            const hasItems = Object.values(packages).some(qty => Number(qty) > 0);
            if (!hasItems) {
                return { ok: false, reason: "Please add a quantity for at least one option." };
            }
        } else {
             return { ok: false, reason: "Invalid options format." };
        }
    }

    if (type === "per_unit") {
        const w = details.weight;
        if (
            w === undefined ||
            w === null ||
            w === "" ||
            Number.isNaN(Number(w)) ||
            Number(w) <= 0
        ) {
            return { ok: false, reason: "Amount is required and must be > 0." };
        }
    }

    return { ok: true };
}

/* ---------- cart sync utils (sinkron ke localStorage + event bus) ---------- */
function broadcastCartChanged() {
    try {
        window.dispatchEvent(new CustomEvent("catalog:cart:changed"));
    } catch {}
}

function readCartStorage() {
    try {
        const raw = localStorage.getItem("catalog_cart");
        if (!raw) return { items: [] };
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed?.items) ? parsed.items : [];
        return { items };
    } catch {
        return { items: [] };
    }
}

function stableKeyFromDetails(details) {
    try {
        if (!details || typeof details !== "object") return "";
        const keys = Object.keys(details).sort();
        const obj = {};
        for (const k of keys) obj[k] = details[k];
        return JSON.stringify(obj);
    } catch {
        return "";
    }
}

function sanitizeItems(itemsRaw) {
    const arr = Array.isArray(itemsRaw) ? itemsRaw : [];
    const cleaned = arr
        .map((it) => {
            const id = it?.serviceId ?? it?.id;
            if (!id) return null;
            return {
                serviceId: Number(id),
                id: Number(id),
                name: it?.name ?? "",
                quantity: Number(it?.quantity ?? 1) || 1,
                details:
                    it?.details && typeof it.details === "object"
                        ? it.details
                        : {},
                answers: Array.isArray(it?.answers) ? it.answers : [],
                price_per_unit: Number(it?.price_per_unit || 0),
                type: it?.type ?? null,
                unit_name: it?.unit_name ?? null,
                options: Array.isArray(it?.options) ? it.options : null,
                fulfillment_type: it?.fulfillment_type ?? null,
                offering_session: it?.offering_session ?? null,
                description: it?.description ?? null,
                description_html: it?.description_html ?? null,
                // Pastikan category diambil dengan benar
                category: it?.category ?? null,
                image: it?.image ?? null,
                option_images: it?.option_images ?? null,
            };
        })
        .filter(Boolean);

    const seen = new Set();
    const dedup = [];
    for (const it of cleaned) {
        const sig = `${it.id}__${stableKeyFromDetails(it.details)}__${
            it.price_per_unit
        }`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        dedup.push(it);
    }
    return dedup;
}

function writeCartStorage(items) {
    try {
        localStorage.setItem("catalog_cart", JSON.stringify({ items }));
        broadcastCartChanged();
    } catch {}
}

/* ---------------- Main Component ---------------- */
export default function Checkout() {
    const { props } = usePage();
    const booking = props?.booking ?? null;
    const CSRF = getCsrfToken(props);

    const customerName = booking?.customer?.name ?? "";
    const roomLabel = booking?.room_label ?? "";

    const initialItem = safeParseParam("item"); // quick order (single)
    const initialCart = safeParseParam("cart"); // { items: [...] }

    const [items, setItems] = useState(() => {
        const fromUrl = Array.isArray(initialCart?.items)
            ? sanitizeItems(initialCart.items)
            : initialItem
            ? sanitizeItems([initialItem])
            : [];

        if (fromUrl.length > 0) {
            writeCartStorage(fromUrl);
            return fromUrl;
        }
        const storage = readCartStorage().items;
        if (storage.length > 0) {
            return sanitizeItems(storage);
        }
        return [];
    });

    const [svcIndex, setSvcIndex] = useState(null);
    const [svcLoading, setSvcLoading] = useState(false);
    const [allPromos, setAllPromos] = useState([]);
    const [promotionId, setPromotionId] = useState("");
    const [loadingPromos, setLoadingPromos] = useState(false);
    const [paymentPref, setPaymentPref] = useState("cash");
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [summary, setSummary] = useState(null);
    const [placing, setPlacing] = useState(false);
    const [svcQuestions, setSvcQuestions] = useState({});
    const [loadingQs, setLoadingQs] = useState({});
    const [notes, setNotes] = useState("");

    /* -------------- Persist setiap perubahan items -------------- */
    useEffect(() => {
        writeCartStorage(sanitizeItems(items));
    }, [items]);

    /* -------------- Fetch service list (session=auto) untuk HYDRATE -------------- */
    useEffect(() => {
        let abort = false;
        (async () => {
            try {
                setSvcLoading(true);
                const res = await fetch(`/api/services?session=auto`, {
                    headers: { Accept: "application/json" },
                    credentials: "include",
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const js = await res.json();
                const arr = Array.isArray(js?.services) ? js.services : [];
                const idx = {};
                for (const s of arr) {
                    const options = Array.isArray(s?.options)
                        ? s.options
                        : (() => {
                              try {
                                  const p = JSON.parse(s?.options || "[]");
                                  return Array.isArray(p) ? p : [];
                              } catch {
                                  return [];
                              }
                          })();
                    idx[s.id] = {
                        id: s.id,
                        name: s.name,
                        type: s.type,
                        unit_name: s.unit_name,
                        price: Number(s.price || 0),
                        options,
                        description: s.description || null,
                        description_html: s.description_html || null,
                        // Pastikan category diambil dengan benar
                        category: s.category || null,
                        image: s.image || null,
                        fulfillment_type: s.fulfillment_type ?? null,
                        option_images: s.option_images || null,
                    };
                }
                if (!abort) setSvcIndex(idx);
            } catch {
                if (!abort) setSvcIndex({});
            } finally {
                if (!abort) setSvcLoading(false);
            }
        })();
        return () => {
            abort = true;
        };
    }, []);

    /** HYDRATE items: jika item belum punya metadata → isi dari svcIndex */
    useEffect(() => {
        if (!svcIndex || !items?.length) return;
        setItems((prev) =>
            prev.map((it) => {
                const id = Number(it?.serviceId || it?.id);
                const svc = svcIndex[id];
                if (!svc) return it;
                const merged = { ...it };

                if (!merged.type) merged.type = svc.type;
                if (!merged.unit_name && svc.unit_name)
                    merged.unit_name = svc.unit_name;
                if (!merged.description && svc.description)
                    merged.description = svc.description;
                if (!merged.description_html && svc.description_html)
                    merged.description_html = svc.description_html;
                
                // Perbaiki hydrasi category
                if (!merged.category && svc.category) {
                    merged.category = svc.category;
                }
                
                if (!merged.image && svc.image) merged.image = svc.image;
                if (!merged.fulfillment_type && svc.fulfillment_type != null) {
                    merged.fulfillment_type = svc.fulfillment_type;
                }

                const needsOpts =
                    merged.type === "selectable" ||
                    merged.type === "multiple_options";
                const hasOpts =
                    Array.isArray(merged.options) && merged.options.length > 0;
                if (needsOpts && !hasOpts) merged.options = svc.options || null;

                if (merged.price_per_unit == null) {
                    if (merged.type === "fixed" || merged.type === "per_unit") {
                        merged.price_per_unit = Number(svc.price || 0);
                    } else {
                        merged.price_per_unit = 0;
                    }
                }
                if (!merged.option_images && svc.option_images) {
                    merged.option_images = svc.option_images;
                }
                return merged;
            })
        );
    }, [svcIndex]);

    /* -------------- Fetch promos lalu filter by items -------------- */
    useEffect(() => {
        let abort = false;
        (async () => {
            try {
                setLoadingPromos(true);
                const res = await fetch(`/api/eligible-promotions`, {
                    headers: { Accept: "application/json" },
                    credentials: "include",
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                if (!abort)
                    setAllPromos(
                        Array.isArray(json?.promotions) ? json.promotions : []
                    );
            } catch {
                if (!abort) setAllPromos([]);
            } finally {
                if (!abort) setLoadingPromos(false);
            }
        })();
        return () => {
            abort = true;
        };
    }, []);

    const availablePromos = useMemo(() => {
        const selectedIds = new Set(
            (items || [])
                .map((it) => Number(it?.serviceId || it?.id))
                .filter((x) => Number.isFinite(x))
        );
        if (selectedIds.size === 0) return [];
        return (allPromos || []).filter((p) => {
            const scoped = Array.isArray(p?.scoped_service_ids)
                ? p.scoped_service_ids
                : [];
            if (scoped.length === 0) return true;
            return scoped.some((sid) => selectedIds.has(Number(sid)));
        });
    }, [items, allPromos]);

    useEffect(() => {
        if (!promotionId) return;
        const stillThere = availablePromos.some(
            (p) => String(p.id) === String(promotionId)
        );
        if (!stillThere) setPromotionId("");
    }, [availablePromos, promotionId]);

    /* -------------- Fetch pertanyaan per service (lazy) -------------- */
    useEffect(() => {
        items.forEach((it, idx) => {
            const serviceId = it?.serviceId || it?.id;
            if (!serviceId) return;
            if (svcQuestions[serviceId] || loadingQs[serviceId]) return;
            setLoadingQs((prev) => ({ ...prev, [serviceId]: true }));
            fetch(`/api/services/${serviceId}/questions`, {
                headers: { Accept: "application/json" },
                credentials: "include",
            })
                .then(async (r) => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    const js = await r.json();
                    const qs = Array.isArray(js)
                        ? js
                        : Array.isArray(js?.questions)
                        ? js.questions
                        : [];
                    setSvcQuestions((prev) => ({ ...prev, [serviceId]: qs }));
                    setItems((prev) => {
                        const arr = [...prev];
                        const current = arr[idx];
                        if (!current) return prev;
                        const seeded = Array.isArray(current.answers)
                            ? [...current.answers]
                            : [];
                        while (seeded.length < qs.length) seeded.push("");
                        arr[idx] = { ...current, answers: seeded };
                        return arr;
                    });
                })
                .catch(() => {
                    setSvcQuestions((prev) => ({ ...prev, [serviceId]: [] }));
                })
                .finally(() => {
                    setLoadingQs((prev) => ({ ...prev, [serviceId]: false }));
                });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items]);

    /* -------------- Preview totals setiap items/promo berubah -------------- */
    useEffect(() => {
        let aborted = false;
        async function run() {
            if (!items.length) {
                setSummary(null);
                return;
            }
            setLoadingPreview(true);
            try {
                const normalized = items.map((it) => {
                    const type = String(it?.type || "fixed");
                    const details = { ...(it?.details || {}) };

                    if (type === "per_unit") {
                        const w = Number(details.weight || 0);
                        return {
                            id: it.serviceId || it.id,
                            quantity: Number.isFinite(w) ? w : 0,
                            details: {
                                ...details,
                                answers: normalizeAnswers(it.answers),
                            },
                        };
                    }

                    return {
                        id: it.serviceId || it.id,
                        quantity: Number(it.quantity || 1),
                        details: {
                            ...details,
                            answers: normalizeAnswers(it.answers),
                        },
                    };
                });

                const res = await fetch(`/api/cart-preview`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                        "X-CSRF-TOKEN": CSRF,
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        items: normalized,
                        promotion_id: promotionId || null,
                    }),
                });
                const json = await res.json();
                if (!aborted) setSummary(json || null);
            } catch {
                if (!aborted) setSummary(null);
            } finally {
                if (!aborted) setLoadingPreview(false);
            }
        }
        run();
        return () => {
            aborted = true;
        };
    }, [items, promotionId, CSRF]);


    const isCartComplete = useMemo(() => {
        if (!items.length) return false;
        return items.every((item) => {
            const basicValidation = validateItemForType(item);
            if (!basicValidation.ok) return false;

            const questions = svcQuestions[item.serviceId] || [];
            if (questions.length > 0) {
                const answers = Array.isArray(item.answers) ? item.answers : [];
                if (answers.length < questions.length) return false;
                const hasEmptyAnswer = answers
                    .slice(0, questions.length)
                    .some((a) => !a || String(a).trim() === "");
                if (hasEmptyAnswer) return false;
            }
            return true;
        });
    }, [items, svcQuestions]);


    /* ---------------- item helpers ---------------- */
    const updateItem = useCallback((idx, patch) => {
        setItems((prev) => {
            const arr = [...prev];
            arr[idx] = { ...arr[idx], ...patch };
            return arr;
        });
    }, []);

    const updateItemDetails = useCallback((idx, key, value) => {
        setItems((prev) => {
            const arr = [...prev];
            const it = arr[idx] || {};
            arr[idx] = {
                ...it,
                details: { ...(it.details || {}), [key]: value },
            };
            return arr;
        });
    }, []);

    const removeItem = useCallback((idx) => {
        setItems((prev) => prev.filter((_, i) => i !== idx));
    }, []);

    /* ---------------- NAV: Back to Catalog sambil bawa cart ---------------- */
    const backToCatalog = useCallback(() => {
        try {
            const compact = { items: sanitizeItems(items) };
            localStorage.setItem("catalog_cart", JSON.stringify(compact));
            broadcastCartChanged();
        } catch {}
        const href =
            (typeof route === "function"
                ? route("catalog.browse")
                : "/catalog") +
            `?cart=${encodeURIComponent(
                JSON.stringify({ items: sanitizeItems(items) })
            )}`;
        window.location.href = href;
    }, [items]);

    /* ---------------- submit ---------------- */
    async function handlePlaceOrder() {
        if (!isCartComplete) {
            alert(
                "Please fill in all required item details before completing the order."
            );
            return;
        }
        if (!items.length) return;

        setPlacing(true);
        try {
            const normalized = items.map((it) => {
                const type = String(it?.type || "fixed");
                const d = { ...(it?.details || {}) };
                const payload = {
                    id: it.serviceId || it.id,
                    quantity: Number(it.quantity || 1),
                    details: { ...d, answers: normalizeAnswers(it.answers) },
                };
                if (type === "per_unit") {
                    const w = Number(d.weight || 0);
                    payload.quantity = Number.isFinite(w) ? w : 0;
                }
                return payload;
            });

            const res = await fetch(`/api/checkout`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CSRF-TOKEN": CSRF,
                },
                credentials: "include",
                body: JSON.stringify({
                    items: normalized,
                    payment_preference: paymentPref || "cash",
                    promotion_id: promotionId || null,
                    order_notes: notes || "",
                }),
            });

            const json = await res.json();
            if (!res.ok || !json?.success) {
                console.error("Checkout failed:", json);
                alert(json?.message || "Checkout failed. Please try again.");
                setPlacing(false); 
                return;
            }

            if (json.xendit_invoice_url) {
                try {
                    localStorage.setItem(
                        "catalog_cart",
                        JSON.stringify({ items: [] })
                    );
                    broadcastCartChanged();
                } catch {}
                window.location.href = json.xendit_invoice_url;
            } else {
                alert("Order successfully created!");
                try {
                    localStorage.setItem(
                        "catalog_cart",
                        JSON.stringify({ items: [] })
                    );
                    broadcastCartChanged();
                } catch {}

                const href =
                    typeof route === "function"
                        ? route("catalog.browse")
                        : "/catalog";
                window.location.href = href;

                setPlacing(false);
            }
        } catch (e) {
            console.error(e);
            alert("An error occurred while creating your order.");
            setPlacing(false);
        }
    }

    /* ---------------- render ---------------- */

    if (!booking) {
        return (
            <div className="px-4 py-10">
                <p className="text-sm text-slate-500">Loading checkout…</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_80%_-100px,rgba(16,185,129,0.10),transparent)] from-slate-50 to-slate-100">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 ">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900">
                                Checkout
                            </h1>
                            <p className="text-[13px] sm:text-sm text-slate-600">
                                {customerName ? (
                                    <>
                                        Guest{" "}
                                        <span className="font-medium text-emerald-700">
                                            {customerName}
                                        </span>
                                    </>
                                ) : (
                                    "Guest"
                                )}
                                {roomLabel ? ` • Room ${roomLabel}` : ""}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {svcLoading && (
                                <span className="inline-flex items-center text-xs sm:text-sm text-slate-600 bg-white/70 border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                                    Loading catalog…
                                </span>
                            )}
                            <Button
                                variant="outline"
                                className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl"
                                onClick={backToCatalog}
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Catalog
                            </Button>
                        </div>
                    </div>

                    <div className="mt-5 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                </div>

                {/* Main Content */}
                {items.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                        {/* Service Cards */}
                        <div className="lg:col-span-2 space-y-5">
                            {items.map((it, idx) => {
                                const svcId = it?.serviceId || it?.id;
                                const qs = svcQuestions[svcId] || [];
                                const isQsLoading = !!loadingQs[svcId];

                                return (
                                    <ServiceCard
                                        key={`${svcId}-${idx}`}
                                        item={it}
                                        index={idx}
                                        updateItem={updateItem}
                                        updateItemDetails={updateItemDetails}
                                        removeItem={removeItem}
                                        questions={qs}
                                        isLoadingQuestions={isQsLoading}
                                    />
                                );
                            })}
                        </div>

                        {/* Summary Card (sticky di desktop) */}
                        <div className="lg:col-span-1">
                            <div className="lg:sticky lg:top-6">
                                <SummaryCard
                                    items={items}
                                    summary={summary}
                                    loadingPreview={loadingPreview}
                                    loadingPromos={loadingPromos}
                                    isCartComplete={isCartComplete}
                                    availablePromos={availablePromos}
                                    promotionId={promotionId}
                                    setPromotionId={setPromotionId}
                                    paymentPref={paymentPref}
                                    setPaymentPref={setPaymentPref}
                                    notes={notes}
                                    setNotes={setNotes}
                                    placing={placing}
                                    handlePlaceOrder={handlePlaceOrder}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl bg-white/60 border border-slate-200 shadow-sm">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4 shadow-inner">
                            <Package className="h-8 w-8 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-800 mb-1">
                            Your cart is empty
                        </h3>
                        <p className="text-slate-600 max-w-md mb-6 text-sm">
                            Add services from our catalog to proceed with
                            checkout.
                        </p>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 rounded-xl px-5"
                            onClick={backToCatalog}
                        >
                            Browse Services
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

Checkout.layout = (page) => <AuthenticatedLayout>{page}</AuthenticatedLayout>;