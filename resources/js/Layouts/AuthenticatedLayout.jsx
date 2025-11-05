// resources/js/Layouts/AuthenticatedLayout.jsx
import ApplicationLogo from "@/components/ApplicationLogo";
import FloatingCart from "@/components/catalog/FloatingCart";
import { usePage, Link, router } from "@inertiajs/react";
import React, {
    useEffect,
    useMemo,
    useState,
    useRef,
    useCallback,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/components/ui/popover";
import {
    User,
    MapPin,
    Calendar,
    CreditCard,
    Phone,
    Mail,
    Clock8,
    Search,
    Menu,
    X,
    Lock,
} from "lucide-react";

/* ---------- helpers ---------- */
function safeParse(json, fb) {
    try {
        return JSON.parse(json);
    } catch {
        return fb;
    }
}

function useGlobalCart(key = "catalog_cart") {
    const [cart, setCart] = useState(() => {
        const raw =
            typeof window !== "undefined" ? localStorage.getItem(key) : null;
        return raw
            ? safeParse(raw, { items: [], notes: "" })
            : { items: [], notes: "" };
    });
    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(cart));
        } catch {}
    }, [cart, key]);
    return [cart, setCart];
}

function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return String(dateString || "");
    }
}

function sessionFromStatus(status, checkin_at, checkout_at) {
    const s = String(status || "").toLowerCase();
    if (s === "checked_in") return "post_checkin";
    if (s === "checked_out") return "pre_checkout";
    if (["reserved", "booked", "pending"].includes(s)) return "pre_checkin";

    const now = new Date();
    const ci = new Date(checkin_at);
    const co = new Date(checkout_at);
    if (now < ci) return "pre_checkin";
    if (now >= ci && now <= co) return "post_checkin";
    return "pre_checkout";
}

function getSessionLabel(s) {
    return s === "pre_checkin"
        ? "Reserved"
        : s === "post_checkin"
        ? "Checked In"
        : s === "pre_checkout"
        ? "Checked Out"
        : "Other";
}

function sessionTone(s) {
    if (s === "post_checkin") {
        return {
            badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
            dot: "bg-emerald-500",
        };
    }
    if (s === "pre_checkin") {
        return {
            badge: "bg-blue-100 text-blue-700 border-blue-200",
            dot: "bg-blue-500",
        };
    }
    if (s === "pre_checkout") {
        return {
            badge: "bg-amber-100 text-amber-700 border-amber-200",
            dot: "bg-amber-500",
        };
    }
    return {
        badge: "bg-slate-100 text-slate-700 border-slate-200",
        dot: "bg-slate-500",
    };
}

// service is available in this guest session?
function isSessionAllowed(bookingStatus, offeringSession) {
    const s = String(bookingStatus || "").toLowerCase();
    const sess = String(offeringSession || "").toLowerCase();
    if (["checked_out", "cancelled"].includes(s)) return false;
    if (["reserved", "booked", "pending"].includes(s))
        return sess === "pre_checkin";
    if (s === "checked_in")
        return ["post_checkin", "pre_checkout"].includes(sess);
    return true;
}

// primary img helper
function getPrimaryImageUrl(service) {
    if (
        service &&
        Array.isArray(service.images) &&
        service.images.length > 0 &&
        service.images[0]?.url
    ) {
        return service.images[0].url;
    }
    return "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1200&auto=format&fit=crop";
}

// get min price for selectable service
function minSelectablePrice(svc) {
    const opts = Array.isArray(svc?.options) ? svc.options : [];
    const arr = opts
        .map((o) => Number(o.price || 0))
        .filter((v) => !Number.isNaN(v));
    return arr.length ? Math.min(...arr) : 0;
}

// format price
function formatPrice(svc) {
    if (svc.type === "free") return "Free";
    if (svc.type === "fixed")
        return `Rp ${Number(svc.price || 0).toLocaleString("id-ID")}`;
    if (svc.type === "per_unit") {
        return `Rp ${Number(svc.price || 0).toLocaleString("id-ID")}/${
            svc.unit_name || "unit"
        }`;
    }
    if (svc.type === "selectable" || svc.type === "multiple_options") {
        const min = minSelectablePrice(svc);
        return min > 0 ? `From Rp ${min.toLocaleString("id-ID")}` : "From Rp 0";
    }
    return svc?.price
        ? `Rp ${Number(svc.price || 0).toLocaleString("id-ID")}`
        : "";
}

/* ---------- tiny subcomponents ---------- */
function InfoRow({ label, icon, value }) {
    return (
        <div className="flex items-start gap-3 group">
            <div className="mt-0.5 text-slate-400 group-hover:text-slate-600 transition-colors duration-300">
                {icon}
            </div>
            <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">
                    {label}
                </div>
                <div className="text-sm font-semibold text-slate-900 truncate">
                    {value}
                </div>
            </div>
        </div>
    );
}

function ContactRow({ icon, text, loading }) {
    if (loading) {
        return (
            <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-slate-200 animate-pulse" />
                <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors duration-300">
            <div className="text-slate-500">{icon}</div>
            <span>{text || "-"}</span>
        </div>
    );
}

function FooterLink({ href, children, loading }) {
    if (loading) {
        return <div className="h-3 w-20 rounded bg-slate-200 animate-pulse" />;
    }

    return (
        <a
            href={href || "#"}
            className="text-sm text-slate-600 hover:text-slate-900 transition-all duration-300 relative group"
        >
            {children}
            <span className="absolute bottom-0 left-0 w-0 h-px bg-slate-900 group-hover:w-full transition-all duration-300"></span>
        </a>
    );
}

/* ---------- site data hook (safe fallback + skeleton state) ---------- */
function useSiteSafe() {
    const { props } = usePage();

    // props.site disiapkan dari AppServiceProvider
    // Bisa undefined/null kalau DB belum ada data.
    const raw = props.site;

    // Kita anggap "loading" true kalau props.site masih undefined.
    const loading = typeof raw === "undefined";

    // Kita anggap "errored" kalau object ada tapi kosong semua.
    const errored =
        !!raw &&
        Object.values(raw).every(
            (val) => val === null || val === "" || typeof val === "undefined"
        );

    // fallback aman
    const safe = {
        name: raw?.name || "Hotel",
        tagline: raw?.tagline || "Boutique comfort in the heart of the city.",
        logo: raw?.logo || null,

        phone: raw?.phone || null,
        email: raw?.email || null,
        address: raw?.address || null,
        hours: raw?.hours || null,

        whatsapp: raw?.whatsapp || null,
        instagram: raw?.instagram || null,
        facebook: raw?.facebook || null,

        company: raw?.company || "Our Company",
        url: raw?.url || "https://example-hotel.test",
    };

    return { site: safe, loading, errored };
}

/* ===========================================
   MAIN LAYOUT
=========================================== */
export default function AuthenticatedLayout({ children }) {
    const page = usePage();
    const booking = page.props?.booking;

    // 🔄 SETTINGS DATA (branding/contact) FROM SERVER
    const { site, loading: siteLoading } = useSiteSafe();

    const appName = site.name;

    const [cart, setCart] = useGlobalCart();
    const [currentSession, setCurrentSession] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // hide FloatingCart on checkout screen
    const isCheckoutPage = useMemo(() => {
        const comp = String(page?.component || "");
        const url = String(page?.url || "");
        if (comp.includes("Catalog/Checkout") || comp.endsWith("/Checkout"))
            return true;
        return (
            /\/checkout(?:$|[/?#])/i.test(url) || /catalog\/checkout/i.test(url)
        );
    }, [page?.component, page?.url]);

    // sync cart / session via custom events
    useEffect(() => {
        const onSessionChanged = (e) =>
            setCurrentSession(e?.detail?.session || null);

        const onAddToCart = (e) => {
            const { svc, payload } = e.detail || {};
            if (!svc) return;
            const newItem = {
                service_id: svc.id,
                name: svc.name,
                quantity: payload?.quantity ?? 1,
                price_per_unit: payload?.price_per_unit ?? svc.price ?? 0,
                details: payload?.details || null,
                answers: payload?.answers || null,
                fulfillment_type: svc.fulfillment_type,
                offering_session: svc.offering_session,
            };
            setCart((prev) => ({
                ...prev,
                items: [...(prev.items || []), newItem],
            }));
        };

        window.addEventListener("catalog:sessionChanged", onSessionChanged);
        window.addEventListener("catalog:addToCart", onAddToCart);

        return () => {
            window.removeEventListener(
                "catalog:sessionChanged",
                onSessionChanged
            );
            window.removeEventListener("catalog:addToCart", onAddToCart);
        };
    }, [setCart]);

    /* ==================================================
       🔎 SEARCH STATE
    ================================================== */
    const [allServices, setAllServices] = useState([]);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchText, setSearchText] = useState("");
    const searchWrapperRef = useRef(null);
    const inputRef = useRef(null);

    // fetch all services once
    useEffect(() => {
        let abort = false;
        (async () => {
            try {
                const res = await fetch(`/api/services?session=auto`, {
                    headers: { Accept: "application/json" },
                    credentials: "include",
                });
                if (!res.ok) throw new Error("HTTP " + res.status);
                const js = await res.json();
                if (!abort) {
                    const list = Array.isArray(js?.services) ? js.services : [];
                    setAllServices(list);
                }
            } catch {
                if (!abort) {
                    setAllServices([]);
                }
            }
        })();
        return () => {
            abort = true;
        };
    }, []);

    // compute visible suggestions
    const visibleSuggestions = useMemo(() => {
        if (!searchText.trim()) return [];
        const q = searchText.toLowerCase();

        // figure out current stay session for availability badge
        const session =
            currentSession ||
            sessionFromStatus(
                booking?.status,
                booking?.checkin_at,
                booking?.checkout_at
            ) ||
            "post_checkin";

        return allServices
            .filter((svc) => {
                const name = (svc.name || "").toLowerCase();
                const desc = (svc.description || "").toLowerCase();
                const cat = (svc.category || "").toLowerCase();
                return name.includes(q) || desc.includes(q) || cat.includes(q);
            })
            .map((svc) => {
                const availableInSession = isSessionAllowed(
                    booking?.status,
                    svc.offering_session
                );
                return { ...svc, availableInSession };
            })
            .slice(0, 6);
    }, [allServices, searchText, currentSession, booking]);

    // close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e) {
            if (
                searchWrapperRef.current &&
                !searchWrapperRef.current.contains(e.target)
            ) {
                setSearchOpen(false);
            }
        }
        if (searchOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [searchOpen]);

    function goToService(svc) {
        if (!svc.availableInSession) return;

        setSearchOpen(false);
        setSearchText("");
        if (svc.slug) {
            if (typeof route === "function") {
                router.visit(route("catalog.service.show", svc.slug));
            } else {
                router.visit(`/service/${svc.slug}`);
            }
        } else {
            router.visit(`/service/${svc.id}`);
        }
    }

    function handleSubmit(e) {
        e.preventDefault();
        if (!searchOpen) {
            setSearchOpen(true);
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }
        if (!searchText.trim()) {
            inputRef.current?.focus();
        }
    }

    /* =========================
       Booking avatar popover
    ========================== */
    const guestName = booking?.guest || booking?.customer?.name || "Guest";
    const guestInitial = guestName?.trim()?.charAt(0)?.toUpperCase() || "G";

    const staySessionKey = booking
        ? sessionFromStatus(
              booking.status,
              booking.checkin_at,
              booking.checkout_at
          )
        : null;

    const tone = staySessionKey
        ? sessionTone(staySessionKey)
        : sessionTone("other");

    /* ---------- skeleton chunks for header brand ---------- */
    const BrandBlock = () => (
        <div className="shrink-0 flex items-center gap-3 group">
            <div className="relative">
                {/* logo: either image from DB or fallback ApplicationLogo */}
                {site.logo ? (
                    <img
                        src={site.logo}
                        alt={site.name}
                        className="h-8 w-8 rounded object-contain"
                        onError={(e) => {
                            // fallback ke ApplicationLogo kalau img rusak
                            e.currentTarget.style.display = "none";
                        }}
                    />
                ) : (
                    <ApplicationLogo className="h-8 w-8 text-slate-900 group-hover:scale-110 transition-transform duration-300" />
                )}
            </div>

            {siteLoading ? (
                <div className="h-4 w-28 rounded bg-slate-200 animate-pulse" />
            ) : (
                <span className="text-lg font-bold tracking-tight text-slate-900">
                    {appName}
                </span>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* ===== HEADER / NAV ===== */}
            <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    {/* Desktop Nav */}
                    <div className="hidden lg:flex h-16 items-center justify-between gap-4">
                        {/* LEFT: brand + search */}
                        <div className="flex flex-1 items-center gap-6 min-w-0">
                            {/* brand */}
                            <Link href="/" className="shrink-0">
                                <BrandBlock />
                            </Link>

                            {/* SEARCH PILL */}
                            <div
                                ref={searchWrapperRef}
                                className="relative flex-1 max-w-md"
                            >
                                <form
                                    onSubmit={handleSubmit}
                                    className="group relative"
                                    onClick={() => {
                                        setSearchOpen(true);
                                        requestAnimationFrame(() => {
                                            inputRef.current?.focus();
                                        });
                                    }}
                                >
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Search className="h-4 w-4 text-slate-400 group-focus-within:text-slate-600 transition-colors duration-300" />
                                    </div>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        className="w-full h-10 pl-11 pr-12 text-sm bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-full focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:bg-white transition-all duration-300 placeholder:text-slate-400 text-slate-900 shadow-sm hover:shadow-md"
                                        placeholder="Search services..."
                                        value={searchText}
                                        onChange={(e) => {
                                            setSearchText(e.target.value);
                                            setSearchOpen(true);
                                        }}
                                        onFocus={() => setSearchOpen(true)}
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                                        <button
                                            type="submit"
                                            className="h-7 w-7 rounded-full bg-gradient-to-r from-slate-700 to-slate-900 text-white flex items-center justify-center hover:from-slate-800 hover:to-slate-950 transition-all duration-300 shadow-sm"
                                            title="Search"
                                        >
                                            <Search className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </form>

                                {/* suggestions dropdown */}
                                {searchOpen && searchText.trim() !== "" && (
                                    <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200">
                                        {visibleSuggestions.length === 0 ? (
                                            <div className="px-4 py-3 text-sm text-slate-500">
                                                No matches found
                                            </div>
                                        ) : (
                                            <ul className="max-h-80 overflow-y-auto py-2">
                                                {visibleSuggestions.map(
                                                    (svc) => (
                                                        <li
                                                            key={svc.id}
                                                            className={`relative px-3 py-2 text-sm cursor-pointer transition-colors duration-200 ${
                                                                svc.availableInSession
                                                                    ? "hover:bg-slate-50"
                                                                    : "opacity-60 cursor-not-allowed"
                                                            }`}
                                                            onMouseDown={(
                                                                e
                                                            ) => {
                                                                e.preventDefault();
                                                                goToService(
                                                                    svc
                                                                );
                                                            }}
                                                        >
                                                            <div className="flex gap-3">
                                                                {/* image */}
                                                                <div className="relative h-14 w-14 rounded-md overflow-hidden flex-shrink-0">
                                                                    <img
                                                                        src={getPrimaryImageUrl(
                                                                            svc
                                                                        )}
                                                                        alt={
                                                                            svc.name
                                                                        }
                                                                        className="h-full w-full object-cover"
                                                                        onError={(
                                                                            e
                                                                        ) => {
                                                                            e.currentTarget.src =
                                                                                "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1200&auto=format&fit=crop";
                                                                        }}
                                                                    />

                                                                    {!svc.availableInSession && (
                                                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                                            <Lock className="h-4 w-4 text-white" />
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* info */}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-medium text-slate-900 truncate">
                                                                        {
                                                                            svc.name
                                                                        }
                                                                    </div>
                                                                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                                                                        {svc.category ||
                                                                            svc.description ||
                                                                            "—"}
                                                                    </div>

                                                                    <div className="text-xs font-medium text-slate-700 mt-1">
                                                                        {formatPrice(
                                                                            svc
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {!svc.availableInSession && (
                                                                <div className="absolute inset-0 bg-white/90 flex items-center justify-center">
                                                                    <div className="bg-slate-100 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-sm">
                                                                        <Lock className="h-3.5 w-3.5 text-slate-600" />
                                                                        <span className="text-xs font-medium text-slate-700">
                                                                            {svc.offering_session
                                                                                ?.replace(
                                                                                    /_/g,
                                                                                    " "
                                                                                )
                                                                                .replace(
                                                                                    /\b\w/g,
                                                                                    (
                                                                                        l
                                                                                    ) =>
                                                                                        l.toUpperCase()
                                                                                )}{" "}
                                                                            only
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT nav + avatar */}
                        <div className="flex shrink-0 items-center gap-6">
                            <Link
                                href="/catalog"
                                className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors duration-300"
                            >
                                Catalog
                            </Link>
                            <Link
                                href="/help"
                                className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors duration-300"
                            >
                                Help
                            </Link>

                            {booking && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button
                                            className="relative h-10 w-10 rounded-full bg-slate-900 text-white text-sm font-medium flex items-center justify-center hover:bg-slate-800 transition-all duration-300 hover:scale-105"
                                            title="View booking details"
                                        >
                                            <span>{guestInitial}</span>
                                            <span
                                                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${tone.dot}`}
                                            />
                                        </button>
                                    </PopoverTrigger>

                                    <PopoverContent
                                        align="end"
                                        className="w-80 p-5 shadow-xl"
                                    >
                                        <div className="space-y-4">
                                            {/* header */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-900">
                                                        {guestName}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        Booking #{booking.id}
                                                    </div>
                                                </div>
                                                {staySessionKey && (
                                                    <div
                                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone.badge}`}
                                                    >
                                                        <span
                                                            className={`h-1.5 w-1.5 rounded-full ${tone.dot}`}
                                                        />
                                                        {getSessionLabel(
                                                            staySessionKey
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* info rows */}
                                            <div className="space-y-3">
                                                <InfoRow
                                                    label="Guest"
                                                    icon={
                                                        <User className="h-4 w-4" />
                                                    }
                                                    value={guestName}
                                                />
                                                <InfoRow
                                                    label="Room"
                                                    icon={
                                                        <MapPin className="h-4 w-4" />
                                                    }
                                                    value={booking.room_label}
                                                />
                                                <InfoRow
                                                    label="Stay"
                                                    icon={
                                                        <Calendar className="h-4 w-4" />
                                                    }
                                                    value={`${formatDate(
                                                        booking.checkin_at
                                                    )} – ${formatDate(
                                                        booking.checkout_at
                                                    )}`}
                                                />
                                                <InfoRow
                                                    label="Booking ID"
                                                    icon={
                                                        <CreditCard className="h-4 w-4" />
                                                    }
                                                    value={`#${booking.id}`}
                                                />
                                            </div>

                                            {/* footer action */}
                                            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                                                <Button
                                                    asChild
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <a href="/leave">
                                                        End Session
                                                    </a>
                                                </Button>
                                                <Link
                                                    href={site.url + "/contact"}
                                                    className="text-xs text-slate-500 hover:text-slate-700"
                                                >
                                                    Need help?
                                                </Link>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                    </div>

                    {/* Mobile Nav */}
                    <div className="lg:hidden flex h-16 items-center justify-between">
                        <Link href="/" className="flex items-center gap-2">
                            {/* brand left mobile */}
                            {site.logo ? (
                                <img
                                    src={site.logo}
                                    alt={site.name}
                                    className="h-7 w-7 rounded object-contain"
                                    onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                    }}
                                />
                            ) : (
                                <ApplicationLogo className="h-7 w-7 text-slate-900" />
                            )}

                            {siteLoading ? (
                                <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
                            ) : (
                                <span className="text-base font-bold text-slate-900">
                                    {appName}
                                </span>
                            )}
                        </Link>

                        <div className="flex items-center gap-3">
                            {booking && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button className="relative h-9 w-9 rounded-full bg-slate-900 text-white text-sm font-medium flex items-center justify-center">
                                            <span>{guestInitial}</span>
                                            <span
                                                className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white ${tone.dot}`}
                                            />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        align="end"
                                        className="w-72 p-4"
                                    >
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-900">
                                                        {guestName}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        #{booking.id}
                                                    </div>
                                                </div>
                                                {staySessionKey && (
                                                    <div
                                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone.badge}`}
                                                    >
                                                        <span
                                                            className={`h-1 w-1 rounded-full ${tone.dot}`}
                                                        />
                                                        {getSessionLabel(
                                                            staySessionKey
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">
                                                        Room:
                                                    </span>
                                                    <span className="font-medium">
                                                        {booking.room_label}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">
                                                        Stay:
                                                    </span>
                                                    <span className="font-medium">
                                                        {formatDate(
                                                            booking.checkin_at
                                                        )}{" "}
                                                        -{" "}
                                                        {formatDate(
                                                            booking.checkout_at
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                asChild
                                                variant="ghost"
                                                size="sm"
                                                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <a href="/leave">End Session</a>
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}

                            <button
                                onClick={() => setMobileMenuOpen((v) => !v)}
                                className="p-2 rounded-lg hover:bg-slate-100 transition-colors duration-300"
                            >
                                {mobileMenuOpen ? (
                                    <X className="h-5 w-5" />
                                ) : (
                                    <Menu className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Mobile Menu */}
                    {mobileMenuOpen && (
                        <div className="lg:hidden border-t border-slate-200 py-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="space-y-4">
                                {/* Mobile Search */}
                                <div
                                    ref={searchWrapperRef}
                                    className="relative"
                                >
                                    <form onSubmit={handleSubmit}>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                className="w-full h-10 pl-10 pr-4 text-sm bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-full focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:bg-white transition-all duration-300 placeholder:text-slate-400 shadow-sm"
                                                placeholder="Search services..."
                                                value={searchText}
                                                onChange={(e) => {
                                                    setSearchText(
                                                        e.target.value
                                                    );
                                                    setSearchOpen(true);
                                                }}
                                                onFocus={() =>
                                                    setSearchOpen(true)
                                                }
                                            />
                                        </div>
                                    </form>

                                    {/* suggestions mobile */}
                                    {searchOpen && searchText.trim() !== "" && (
                                        <div className="absolute left-0 right-0 mt-2 rounded-xl bg-white border border-slate-200 shadow-lg z-50">
                                            {visibleSuggestions.length === 0 ? (
                                                <div className="px-4 py-3 text-sm text-slate-500">
                                                    No matches found
                                                </div>
                                            ) : (
                                                <ul className="max-h-64 overflow-y-auto">
                                                    {visibleSuggestions.map(
                                                        (svc) => (
                                                            <li
                                                                key={svc.id}
                                                                className={`relative px-3 py-2 text-sm cursor-pointer transition-colors ${
                                                                    svc.availableInSession
                                                                        ? "hover:bg-slate-50"
                                                                        : "opacity-60 cursor-not-allowed"
                                                                }`}
                                                                onMouseDown={(
                                                                    e
                                                                ) => {
                                                                    e.preventDefault();
                                                                    goToService(
                                                                        svc
                                                                    );
                                                                }}
                                                            >
                                                                <div className="flex gap-3">
                                                                    <div className="relative h-12 w-12 rounded-md overflow-hidden flex-shrink-0">
                                                                        <img
                                                                            src={getPrimaryImageUrl(
                                                                                svc
                                                                            )}
                                                                            alt={
                                                                                svc.name
                                                                            }
                                                                            className="h-full w-full object-cover"
                                                                            onError={(
                                                                                e
                                                                            ) => {
                                                                                e.currentTarget.src =
                                                                                    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1200&auto=format&fit=crop";
                                                                            }}
                                                                        />

                                                                        {!svc.availableInSession && (
                                                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                                                <Lock className="h-3 w-3 text-white" />
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-slate-900 truncate">
                                                                            {
                                                                                svc.name
                                                                            }
                                                                        </div>
                                                                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                                                                            {svc.category ||
                                                                                svc.description ||
                                                                                "—"}
                                                                        </div>

                                                                        <div className="text-xs font-medium text-slate-700 mt-1">
                                                                            {formatPrice(
                                                                                svc
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {!svc.availableInSession && (
                                                                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center">
                                                                        <div className="bg-slate-100 rounded-full px-2 py-1 flex items-center gap-1.5 shadow-sm">
                                                                            <Lock className="h-3 w-3 text-slate-600" />
                                                                            <span className="text-xs font-medium text-slate-700">
                                                                                {svc.offering_session
                                                                                    ?.replace(
                                                                                        /_/g,
                                                                                        " "
                                                                                    )
                                                                                    .replace(
                                                                                        /\b\w/g,
                                                                                        (
                                                                                            l
                                                                                        ) =>
                                                                                            l.toUpperCase()
                                                                                    )}{" "}
                                                                                only
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Mobile Nav Links */}
                                <div className="space-y-2">
                                    <Link
                                        href="/catalog"
                                        className="block px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors duration-300"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Catalog
                                    </Link>
                                    <Link
                                        href="/help"
                                        className="block px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors duration-300"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Help
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* ===== MAIN SLOT ===== */}
            <main className="flex-1">{children}</main>

            {/* ===== FOOTER ===== */}
            <footer className="bg-white border-t border-slate-200 relative overflow-hidden">
                {/* subtle radial glow background */}

                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
                    {/* TOP ROW */}
                    <div className="grid gap-12 lg:grid-cols-12">
                        {/* Brand / contact */}
                        <div className="lg:col-span-5">
                            <div className="flex items-center gap-3 mb-5">
                                {/* Logo (hotel logo or fallback) */}
                                {site.logo ? (
                                    <img
                                        src={site.logo}
                                        alt={site.name}
                                        className="h-10 w-10 rounded object-contain ring-1 ring-slate-200 shadow-sm bg-white"
                                        onError={(e) => {
                                            e.currentTarget.style.display =
                                                "none";
                                        }}
                                    />
                                ) : (
                                    <div className="h-10 w-10 rounded bg-slate-900 text-white flex items-center justify-center ring-1 ring-slate-300 shadow-sm">
                                        <ApplicationLogo className="h-6 w-6 text-white" />
                                    </div>
                                )}

                                {/* Brand name / skeleton */}
                                {siteLoading ? (
                                    <div className="h-5 w-28 rounded bg-slate-200 animate-pulse" />
                                ) : (
                                    <div className="flex flex-col">
                                        <span className="text-lg font-semibold text-slate-900 tracking-tight">
                                            {site.name}
                                        </span>
                                        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                                            Since {new Date().getFullYear()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Tagline */}
                            {siteLoading ? (
                                <div className="space-y-2 mb-6">
                                    <div className="h-3 w-64 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-3 w-48 bg-slate-200 rounded animate-pulse" />
                                </div>
                            ) : (
                                <p className="text-sm text-slate-600 leading-relaxed mb-4 max-w-sm">
                                    {site.tagline}
                                </p>
                            )}

                            {/* contact card */}

                            <div className="space-y-4 text-sm">
                                <ContactRow
                                    icon={<Phone className="h-4 w-4" />}
                                    text={site.phone}
                                    loading={siteLoading}
                                />
                                <ContactRow
                                    icon={<Mail className="h-4 w-4" />}
                                    text={site.email}
                                    loading={siteLoading}
                                />
                                <ContactRow
                                    icon={<Clock8 className="h-4 w-4" />}
                                    text={site.hours}
                                    loading={siteLoading}
                                />
                            </div>

                            {!siteLoading && site.address && (
                                <div className="mt-5 text-[13px] text-slate-500 leading-relaxed">
                                    {site.address}
                                </div>
                            )}
                        </div>

                        {/* Links section */}
                        <div className="lg:col-span-7 grid grid-cols-2 gap-12">
                            {/* Company */}
                            <div>
                                {siteLoading ? (
                                    <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-4" />
                                ) : (
                                    <h3 className="text-[13px] font-semibold tracking-[0.14em] uppercase text-slate-800 mb-4">
                                        Company
                                    </h3>
                                )}

                                <div className="flex flex-col space-y-3">
                                    <FooterLink
                                        href={site.url + "/"}
                                        loading={siteLoading}
                                    >
                                        Home
                                    </FooterLink>
                                    <FooterLink
                                        href={site.url + "/about"}
                                        loading={siteLoading}
                                    >
                                        About Us
                                    </FooterLink>
                                    <FooterLink
                                        href={site.url + "/rooms"}
                                        loading={siteLoading}
                                    >
                                        Rooms & Suites
                                    </FooterLink>
                                    <FooterLink
                                        href={site.url + "/offers"}
                                        loading={siteLoading}
                                    >
                                        Special Offers
                                    </FooterLink>
                                </div>
                            </div>

                            {/* Support */}
                            <div>
                                {siteLoading ? (
                                    <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-4" />
                                ) : (
                                    <h3 className="text-[13px] font-semibold tracking-[0.14em] uppercase text-slate-800 mb-4">
                                        Support
                                    </h3>
                                )}

                                <div className="flex flex-col space-y-3">
                                    <FooterLink
                                        href={site.url + "/help"}
                                        loading={siteLoading}
                                    >
                                        Help Center
                                    </FooterLink>
                                    <FooterLink
                                        href={site.url + "/contact"}
                                        loading={siteLoading}
                                    >
                                        Contact Concierge
                                    </FooterLink>
                                    <FooterLink
                                        href={site.url + "/location"}
                                        loading={siteLoading}
                                    >
                                        Location & Directions
                                    </FooterLink>
                                    <FooterLink
                                        href={site.url + "/events"}
                                        loading={siteLoading}
                                    >
                                        Events & Experiences
                                    </FooterLink>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Divider line with subtle gradient */}
                    <div className="relative mt-16">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-300/40 to-transparent h-px" />
                    </div>

                    {/* Bottom row */}
                    <div className="mt-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-[13px] text-slate-500">
                        {/* left: copyright */}
                        {siteLoading ? (
                            <div className="h-3 w-64 rounded bg-slate-200 animate-pulse" />
                        ) : (
                            <div className="text-slate-500">
                                © {new Date().getFullYear()}{" "}
                                <span className="font-medium text-slate-700">
                                    {site.company || "Company"}
                                </span>
                                . All rights reserved.
                            </div>
                        )}

                        {/* right: mini inline links */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-slate-500">
                            <FooterLink
                                href={site.url + "/privacy"}
                                loading={siteLoading}
                            >
                                Privacy
                            </FooterLink>
                            <FooterLink
                                href={site.url + "/terms"}
                                loading={siteLoading}
                            >
                                Terms
                            </FooterLink>
                            <FooterLink
                                href={site.url + "/cookies"}
                                loading={siteLoading}
                            >
                                Cookies
                            </FooterLink>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Floating Cart (hide on checkout) */}
            {!isCheckoutPage && (
                <FloatingCart
                    cart={cart}
                    onChange={setCart}
                    session={currentSession}
                />
            )}
        </div>
    );
}
