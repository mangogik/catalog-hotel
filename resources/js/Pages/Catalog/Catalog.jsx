// resources/js/Pages/Catalog.jsx
import React, { useEffect, useState, useCallback } from "react";
import { usePage } from "@inertiajs/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import ServiceCard from "@/components/catalog/ServiceCard";
// import FloatingCart from "@/components/catalog/FloatingCart";
import { MapPin, Package, Clock } from "lucide-react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";

/* ---------------- helpers ---------------- */
function sessionFromStatus(status, checkin_at, checkout_at) {
    const s = String(status || "").toLowerCase();
    if (s === "checked_in") return "post_checkin";
    if (s === "checked_out") return "pre_checkout";
    if (["reserved", "booked", "pending"].includes(s)) return "pre_checkin";

    const now = new Date();
    const ci = checkin_at ? new Date(checkin_at) : null;
    const co = checkout_at ? new Date(checkout_at) : null;

    if (ci && now < ci) return "pre_checkin";
    if (ci && co && now >= ci && now <= co) return "post_checkin";
    return "pre_checkout";
}

function ServiceSkeleton() {
    return (
        <div className="p-3 rounded-lg border bg-white space-y-2">
            <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3.5 w-2/3" />
            <div className="pt-1 space-y-1.5">
                <Skeleton className="h-8 w-full" />
            </div>
        </div>
    );
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

/* 🔔 broadcast perubahan cart ke seluruh tab/komponen */
function broadcastCartChanged() {
    try {
        window.dispatchEvent(new CustomEvent("catalog:cart:changed"));
    } catch {}
}

/* deep-ish equal buat cart kecil */
function sameCart(a, b) {
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
}

/* ---------------- page ---------------- */
export default function Catalog() {
    const { props } = usePage();
    const { booking } = props;

    const [session, setSession] = useState(
        sessionFromStatus(
            booking.status,
            booking.checkin_at,
            booking.checkout_at
        ) ?? "post_checkin"
    );
    const [allServices, setAllServices] = useState([]);
    const [services, setServices] = useState([]);
    const [bookingStatus, setBookingStatus] = useState(booking.status ?? null);

    // --- State Kategori ---
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState("all"); // 'all' sebagai default
    // ----------------------

    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");
    const [eligiblePromotions, seteligiblePromotions] = useState([]);

    // ---- CART STATE (persist) ----
    const [cart, setCart] = useState({ items: [] });

    const sanitizeItems = useCallback((itemsRaw) => {
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
    }, []);

    const readCartFromStorage = useCallback(() => {
        try {
            const raw = localStorage.getItem("catalog_cart");
            if (!raw) return { items: [] };
            const parsed = JSON.parse(raw);
            return { items: sanitizeItems(parsed?.items) };
        } catch {
            return { items: [] };
        }
    }, [sanitizeItems]);

    // ---- CART EFFECT 1: sync state <-> storage on events ----
    useEffect(() => {
        const sync = () => {
            const latest = readCartFromStorage();
            // FIX: hanya update state kalau benar2 beda
            setCart((prev) => {
                if (sameCart(prev, latest)) return prev;
                return latest;
            });
        };

        // initial sync
        sync();

        // listeners
        const onFocus = () => sync();
        const onVisible = () => {
            if (document.visibilityState === "visible") sync();
        };
        const onStorage = (e) => {
            if (e.key === "catalog_cart") sync();
        };
        const onPageShow = () => sync(); // bfcache
        const onPopState = () => sync(); // back/forward
        const onCartChanged = () => sync(); // custom broadcast

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("storage", onStorage);
        window.addEventListener("pageshow", onPageShow);
        window.addEventListener("popstate", onPopState);
        window.addEventListener("catalog:cart:changed", onCartChanged);

        return () => {
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("pageshow", onPageShow);
            window.removeEventListener("popstate", onPopState);
            window.removeEventListener("catalog:cart:changed", onCartChanged);
        };
    }, [readCartFromStorage]);

    // ---- CART EFFECT 2: persist ke localStorage kalau cart berubah ----
    useEffect(() => {
        try {
            const snapshot = JSON.stringify(cart);
            const currentRaw = localStorage.getItem("catalog_cart");
            // FIX: jangan nulis ulang kalau sama persis, biar gak fire "storage" event lintas tab
            if (currentRaw !== snapshot) {
                localStorage.setItem("catalog_cart", snapshot);
                // FIX: jangan broadcast di sini
                // broadcastCartChanged();
            }
        } catch {}
    }, [cart]);

    // helper build item from service
    const normalizeCartItem = useCallback((svc, payload = {}) => {
        const base = svc || {};
        const options = Array.isArray(payload.options)
            ? payload.options
            : Array.isArray(base.options)
            ? base.options
            : null;

        return {
            serviceId: Number(base.id),
            id: Number(base.id),
            name: String(base.name ?? ""),
            quantity: Number(payload.quantity ?? 1) || 1,
            details:
                payload.details && typeof payload.details === "object"
                    ? payload.details
                    : {},
            answers: Array.isArray(payload.answers) ? payload.answers : [],
            price_per_unit: Number(payload.price_per_unit ?? base.price ?? 0),
            type: String(payload.type ?? base.type ?? ""), // force string
            unit_name: base.unit_name ?? null,
            options,
            option_images: base.option_images ?? {},
            fulfillment_type: base.fulfillment_type ?? null,
            offering_session: base.offering_session ?? null,
        };
    }, []);

    // tulis langsung ke storage + broadcast (dipakai ONLY dari aksi user)
    const writeCartToStorageAndBroadcast = useCallback((items) => {
        try {
            const payload = { items };
            localStorage.setItem("catalog_cart", JSON.stringify(payload));
            broadcastCartChanged();
        } catch {}
    }, []);

    // add to cart
    const handleAddToCart = useCallback(
        (svc, payload) => {
            if (!svc?.id) return;
            const item = normalizeCartItem(svc, payload || {});
            setCart((prev) => {
                const merged = Array.isArray(prev.items)
                    ? [...prev.items, item]
                    : [item];
                const cleaned = sanitizeItems(merged);

                // simpan dan broadcast secara manual
                writeCartToStorageAndBroadcast(cleaned);

                return sameCart(prev, { items: cleaned })
                    ? prev
                    : { items: cleaned };
            });
        },
        [normalizeCartItem, sanitizeItems, writeCartToStorageAndBroadcast]
    );

    // fetch services + promos
    useEffect(() => {
        const ctrl = new AbortController();
        setLoading(true);
        setErrorMsg("");

        const sReq = fetch(`/api/services?session=auto`, {
            signal: ctrl.signal,
            credentials: "include",
        });
        const pReq = fetch(`/api/eligible-promotions`, {
            signal: ctrl.signal,
            credentials: "include",
        });

        Promise.all([sReq, pReq])
            .then(async ([rs, rp]) => {
                if (!rs.ok)
                    throw new Error(`Services API Error: HTTP ${rs.status}`);
                if (!rp.ok)
                    throw new Error(`Promotions API Error: HTTP ${rp.status}`);
                const ds = await rs.json();
                const dp = await rp.json();
                if (!ctrl.signal.aborted) {
                    const svcList = Array.isArray(ds.services)
                        ? ds.services
                        : [];
                    // --- Simpan daftar kategori ---
                    const catList = Array.isArray(ds.categories) 
                        ? ds.categories 
                        : [];
                    setAllServices(svcList);
                    setCategories(catList); // <-- SIMPAN DI SINI
                    // ------------------------------------------

                    if (ds.booking_status) setBookingStatus(ds.booking_status);
                    seteligiblePromotions(
                        Array.isArray(dp.promotions) ? dp.promotions : []
                    );

                    // enrich cart items (kalau ada yang belum lengkap type/dll)
                    setCart((prev) => {
                        const items = (prev?.items || []).map((it) => {
                            if (it.type && it.type !== "null" && it.type !== "")
                                return it;
                            const svc = svcList.find(
                                (s) => Number(s.id) === Number(it.id)
                            );
                            if (!svc) return it;
                            return {
                                ...it,
                                type: String(svc.type ?? ""),
                                unit_name:
                                    svc.unit_name ?? it.unit_name ?? null,
                                options: Array.isArray(svc.options)
                                    ? svc.options
                                    : it.options ?? null,
                                fulfillment_type:
                                    svc.fulfillment_type ??
                                    it.fulfillment_type ??
                                    null,
                                offering_session:
                                    svc.offering_session ??
                                    it.offering_session ??
                                    null,
                            };
                        });

                        const cleaned = sanitizeItems(items);

                        // simpan dan broadcast cart hasil enrich
                        writeCartToStorageAndBroadcast(cleaned);

                        const nextCart = { items: cleaned };
                        return sameCart(prev, nextCart) ? prev : nextCart;
                    });
                }
            })
            .catch((e) => {
                if (e?.name !== "AbortError") {
                    console.error("Failed to load data:", e);
                    setErrorMsg(
                        "Failed to load catalog data. Please try again."
                    );
                    setAllServices([]);
                    setCategories([]); // <-- Reset state jika error
                    seteligiblePromotions([]);
                }
            })
            .finally(() => {
                if (!ctrl.signal.aborted) setLoading(false);
            });

        return () => ctrl.abort();
    }, [sanitizeItems, writeCartToStorageAndBroadcast]);

    // --- Update logika filter ---
    // filter by session DAN category
    useEffect(() => {
        const normalize = (v) =>
            String(v ?? "")
                .toLowerCase()
                .trim();
        const matchSession = (svc, current) =>
            String(svc.offering_session || "")
                .toLowerCase()
                .split(",")
                .map((s) => s.trim())
                .includes(normalize(current));

        // Fungsi filter baru untuk kategori
        const matchCategory = (svc, catSlug) => {
            if (catSlug === "all") return true; // Tampilkan semua jika 'all' aktif
            return (svc.category?.slug ?? null) === catSlug;
        };

        setServices(
            allServices.filter(
                (s) =>
                    matchSession(s, session) &&
                    matchCategory(s, activeCategory) // <-- Filter tambahan
            )
        );
    }, [session, allServices, activeCategory]); // <-- Tambahkan activeCategory ke dependencies
    // ----------------------------------------

    // QUICK ORDER → langsung redirect checkout
    const handleQuickOrder = useCallback(
        (svc, payload) => {
            if (!svc?.id) return;
            const full = normalizeCartItem(svc, payload || {});
            const hrefBase =
                typeof route === "function"
                    ? route("catalog.checkout.page")
                    : "/checkout";

            try {
                localStorage.setItem(
                    "catalog_quick_item",
                    JSON.stringify(full)
                );
                broadcastCartChanged();
            } catch {}

            const url = `${hrefBase}?item=${encodeURIComponent(
                JSON.stringify(full)
            )}`;
            window.location.href = url;
        },
        [normalizeCartItem]
    );

    // optional: broadcast session (tidak bikin loop karena event beda)
    useEffect(() => {
        window.dispatchEvent(
            new CustomEvent("catalog:sessionChanged", {
                detail: { session },
            })
        );
    }, [session]);

    // Session configuration with accent colors
    const sessionConfig = [
        {
            key: "pre_checkin",
            title: "Before Check-in",
            shortTitle: "Before Check-in",
            desc: "Plan arrival",
            Icon: Clock,
            accent: "from-amber-400 to-orange-500",
            bgActive: "bg-gradient-to-r from-amber-50 to-orange-50",
            borderActive: "border-amber-200",
            shadowActive: "shadow-amber-100/30",
            iconBgActive: "bg-gradient-to-r from-amber-400 to-orange-500",
            iconBgInactive: "bg-amber-100",
            iconBorderActive: "border-amber-300",
            iconBorderInactive: "border-amber-200",
            textActive: "text-amber-900",
            textInactive: "text-amber-700",
            descActive: "text-amber-700/80",
            descInactive: "text-amber-600/70",
            barActive: "bg-gradient-to-r from-amber-400 to-orange-500",
        },
        {
            key: "post_checkin",
            title: "During Stay",
            shortTitle: "During Stay",
            desc: "In-hotel services",
            Icon: Package,
            accent: "from-emerald-400 to-teal-500",
            bgActive: "bg-gradient-to-r from-emerald-50 to-teal-50",
            borderActive: "border-emerald-200",
            shadowActive: "shadow-emerald-100/30",
            iconBgActive: "bg-gradient-to-r from-emerald-400 to-teal-500",
            iconBgInactive: "bg-emerald-100",
            iconBorderActive: "border-emerald-300",
            iconBorderInactive: "border-emerald-200",
            textActive: "text-emerald-900",
            textInactive: "text-emerald-700",
            descActive: "text-emerald-700/80",
            descInactive: "text-emerald-600/70",
            barActive: "bg-gradient-to-r from-emerald-400 to-teal-500",
        },
        {
            key: "pre_checkout",
            title: "Before Check-out",
            shortTitle: "Before Check-out",
            desc: "Departure & billing",
            Icon: MapPin,
            accent: "from-indigo-400 to-purple-500",
            bgActive: "bg-gradient-to-r from-indigo-50 to-purple-50",
            borderActive: "border-indigo-200",
            shadowActive: "shadow-indigo-100/30",
            iconBgActive: "bg-gradient-to-r from-indigo-400 to-purple-500",
            iconBgInactive: "bg-indigo-100",
            iconBorderActive: "border-indigo-300",
            iconBorderInactive: "border-indigo-200",
            textActive: "text-indigo-900",
            textInactive: "text-indigo-700",
            descActive: "text-indigo-700/80",
            descInactive: "text-indigo-600/70",
            barActive: "bg-gradient-to-r from-indigo-400 to-purple-500",
        },
    ];

    return (
        <div className="bg-slate-50">
            {/* Tabs - Centered and smaller */}
            <div className="px-4 py-4">
                <div className="max-w-2xl mx-auto">
                    {/* Compact rounded container */}
                    <div className="flex gap-1.5 bg-white rounded-full border border-gray-200 p-1 shadow-sm">
                        {sessionConfig.map((item) => {
                            const active = session === item.key;

                            return (
                                <button
                                    key={item.key}
                                    onClick={() => setSession(item.key)}
                                    className={`
                                        flex-1 flex items-center gap-2
                                        rounded-full px-3 py-2
                                        transition-all duration-200
                                        ${
                                            active
                                                ? `${item.bgActive} ${item.borderActive} shadow-sm`
                                                : 'hover:bg-gray-50'
                                        }
                                    `}
                                >
                                    {/* Icon on the left */}
                                    <div
                                        className={`
                                            flex items-center justify-center rounded-full
                                            h-6 w-6 flex-shrink-0
                                            transition-all duration-200
                                            ${
                                                active
                                                    ? `${item.iconBgActive} text-white`
                                                    : `${item.iconBgInactive} ${item.iconBorderInactive} border text-gray-600`
                                            }
                                        `}
                                    >
                                        <item.Icon className="h-3.5 w-3.5" />
                                    </div>

                                    {/* Text content on the right */}
                                    <div className="flex flex-col items-start">
                                        {/* Title - responsive */}
                                        <span
                                            className={`
                                                text-xs font-medium leading-tight
                                                ${active ? item.textActive : 'text-gray-700'}
                                            `}
                                        >
                                            <span className="sm:hidden">{item.shortTitle}</span>
                                            <span className="hidden sm:inline">{item.title}</span>
                                        </span>

                                        {/* Description - desktop only */}
                                        <span
                                            className={`
                                                hidden sm:block text-xs leading-tight
                                                ${active ? item.descActive : 'text-gray-500'}
                                            `}
                                        >
                                            {item.desc}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
            
            {/* --- Filter Kategori (Versi Scrollbar Tipis) --- */}
            {!loading && categories.length > 0 && (
                <div className="px-4 sm:px-6 pt-2 pb-4 max-w-7xl mx-auto">
                    {/* 1. Tambahkan kelas baru 'category-scrollbar' pada DIV ini. */}
                    <div className="flex gap-2 overflow-x-auto category-scrollbar">
                        
                        {/* 2. Tambahkan <style> ini untuk membuat scrollbar kustom */}
                        <style>{`
                            /* Untuk Firefox */
                            .category-scrollbar {
                                scrollbar-width: thin; /* 'thin' atau 'auto' */
                                scrollbar-color: #94a3b8 #e2e8f0; /* warna thumb & track */
                            }

                            /* Untuk Chrome, Safari, dan Edge */
                            .category-scrollbar::-webkit-scrollbar {
                                height: 6px; /* Tinggi scrollbar horizontal */
                            }
                            .category-scrollbar::-webkit-scrollbar-track {
                                background: #e2e8f0; /* Latar belakang track */
                                border-radius: 3px;
                            }
                            .category-scrollbar::-webkit-scrollbar-thumb {
                                background-color: #94a3b8; /* Warna 'jempol' scrollbar */
                                border-radius: 3px;
                            }
                            .category-scrollbar::-webkit-scrollbar-thumb:hover {
                                background-color: #475569; /* Warna saat hover */
                            }
                        `}</style>
                        
                        {/* Tombol "All Categories" (tanpa 'cat-scrollbar') */}
                        <button
                            onClick={() => setActiveCategory("all")}
                            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                                activeCategory === "all"
                                    ? "bg-emerald-600 text-white shadow-sm"
                                    : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                            All Categories
                        </button>
                        
                        {/* Tombol untuk setiap kategori (tanpa 'cat-scrollbar') */}
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.slug)}
                                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                                    activeCategory === cat.slug
                                        ? "bg-emerald-600 text-white shadow-sm"
                                        : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {/* ------------------------------------------- */}


            {/* Services */}
            <div className="px-4 sm:px-6 pb-20 max-w-7xl mx-auto">
                {loading ? (
                    <section className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <ServiceSkeleton key={i} />
                        ))}
                    </section>
                ) : errorMsg ? (
                    <div className="text-center py-14">
                        <h3 className="mt-4 text-lg font-semibold text-slate-900">
                            Couldn't load services
                        </h3>
                        <p className="mt-1 text-slate-600 max-w-md mx-auto">
                            {errorMsg}
                        </p>
                    </div>
                ) : (
                    <>
                        <section className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
                            {services.map((svc) => (
                                <ServiceCard
                                    key={svc.id}
                                    service={svc}
                                    bookingStatus={bookingStatus}
                                    eligiblePromotions={eligiblePromotions}
                                    onAddToCart={(payload) =>
                                        handleAddToCart(svc, payload)
                                    }
                                    onQuickOrder={(payload) =>
                                        handleQuickOrder(svc, payload)
                                    }
                                    bookingInfo={booking}
                                />
                            ))}
                        </section>

                        {/* Update pesan "No services" */}
                        {services.length === 0 && (
                            <div className="text-center py-14">
                                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                                    No services available
                                </h3>
                                <p className="mt-1 text-slate-600 max-w-md mx-auto">
                                    There are no services available for this
                                    session {activeCategory !== 'all' && 'in this category'}. 
                                    Try switching to another session or category.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Floating Cart (sementara dimatikan di code kamu)
      <FloatingCart cart={cart} onChange={setCart} session={session} /> */}
        </div>
    );
}

Catalog.layout = (page) => <AuthenticatedLayout>{page}</AuthenticatedLayout>;