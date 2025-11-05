import React, { useMemo, useState, useCallback, useEffect } from "react";
import { usePage, Link } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    ChevronLeft,
    Tag,
    ShieldCheck,
    Clock,
    DollarSign,
    X,
    ShoppingCart,
} from "lucide-react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";

/* ---------------- utils ---------------- */
const formatIDR = (n) =>
    `IDR ${Number(n || 0).toLocaleString("id-ID", {
        minimumFractionDigits: 0,
    })}`;

/** map fulfillment type -> style + desc */
function describeFulfillment(ft) {
    if (ft === "direct") {
        return {
            toneBg: "bg-emerald-600/10 ring-emerald-500/20 text-emerald-700",
            iconColor: "text-emerald-600",
            headline: "Direct Service",
            desc: "Handled immediately, no staff needed.",
        };
    }
    if (ft === "staff_assisted") {
        return {
            toneBg: "bg-violet-600/10 ring-violet-500/20 text-violet-700",
            iconColor: "text-violet-600",
            headline: "Staff Assisted",
            desc: "Our staff will handle and deliver the request.",
        };
    }
    return {
        toneBg: "bg-slate-600/10 ring-slate-500/20 text-slate-700",
        iconColor: "text-slate-600",
        headline: "Service",
        desc: "This service may require hotel assistance.",
    };
}

/** map session -> label & color */
function sessionInfo(sessionKey) {
    switch (sessionKey) {
        case "pre_checkin":
            return {
                label: "Before Check-in",
                badgeClass:
                    "bg-blue-600 text-white shadow-sm shadow-blue-600/30",
            };
        case "post_checkin":
            return {
                label: "During Stay",
                badgeClass:
                    "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30",
            };
        case "pre_checkout":
            return {
                label: "Before Checkout",
                badgeClass:
                    "bg-amber-600 text-white shadow-sm shadow-amber-600/30",
            };
        default:
            return {
                label: sessionKey || "Available",
                badgeClass:
                    "bg-slate-700 text-white shadow-sm shadow-slate-700/30",
            };
    }
}

/** build human promo text */
function humanPromoSummary(p) {
    if (!p) return null;

    // % discount
    if (p.discount_percent) {
        const pct = parseInt(p.discount_percent, 10);
        return {
            badge: `${pct}% Discount`,
            line: `Save ${pct}% on this service.`,
        };
    }

    // amount discount
    if (p.discount_amount) {
        return {
            badge: "Price Cut",
            line: `Get ${formatIDR(p.discount_amount)} off.`,
        };
    }

    // free service
    if (p.free_service_id || p.free_service_name) {
        const qty = Math.max(1, Number(p.free_service_qty || 1));
        const name = p.free_service_name || "Selected Service";
        return {
            badge: "Free Bonus",
            line:
                qty > 1
                    ? `Enjoy ${qty}× ${name} for free.`
                    : `Enjoy a free ${name}.`,
        };
    }

    return {
        badge: "Offer",
        line: p.offer_description || "Special offer available.",
    };
}

/** compute price based on service type */
function computePriceForPayload(service) {
    if (!service) return 0;

    if (service.type === "free") return 0;
    if (service.type === "fixed") return Number(service.price || 0);
    if (service.type === "per_unit") return Number(service.price || 0);

    if (service.type === "selectable") {
        // pick first option as baseline
        const firstOpt = Array.isArray(service.options)
            ? service.options[0]
            : null;
        return Number(firstOpt?.price || 0);
    }

    // multiple_options / fallback
    return Number(service.price || 0);
}

/** group option_images by option_key for fast lookup */
function groupOptionImages(arr) {
    const out = {};
    (Array.isArray(arr) ? arr : []).forEach((img) => {
        const key = img.option_key || "unknown";
        if (!out[key]) out[key] = [];
        out[key].push(img);
    });
    return out;
}

/* ---------------- main page ---------------- */
function ServiceDetailPage() {
    const { props } = usePage();
    const {
        service: rawService,
        gallery: incomingGallery,
    } = props;

    // normalize service object
    const service = useMemo(() => {
        const options = Array.isArray(rawService?.options)
            ? rawService.options
            : [];
        return {
            ...rawService,
            options,
            questions: Array.isArray(
                rawService?.active_question?.questions_json
            )
                ? rawService.active_question.questions_json
                : [],
        };
    }, [rawService]);

    // group option images by option_key
    const optionImagesByKey = useMemo(() => {
        return groupOptionImages(service.option_images);
    }, [service.option_images]);

    // gallery
    const gallery = useMemo(() => {
        if (Array.isArray(incomingGallery)) {
            return incomingGallery;
        }
        return [];
    }, [incomingGallery]);

    const [activeIdx, setActiveIdx] = useState(0);

    // fullscreen image modal (used ONLY when clicking option thumbnails now)
    const [fullImage, setFullImage] = useState(null);

    // promotions
    const [promos, setPromos] = useState([]);
    const [promoLoading, setPromoLoading] = useState(true);
    useEffect(() => {
        let stop = false;
        async function run() {
            setPromoLoading(true);
            try {
                const r = await fetch(
                    `/api/eligible-promotions?service_id=${encodeURIComponent(
                        service.id
                    )}`,
                    {
                        headers: { Accept: "application/json" },
                        credentials: "include",
                    }
                );
                const js = await r.json();
                if (!stop) {
                    const list = Array.isArray(js?.promotions)
                        ? js.promotions
                        : [];
                    setPromos(list);
                }
            } catch {
                if (!stop) setPromos([]);
            } finally {
                if (!stop) setPromoLoading(false);
            }
        }
        if (service?.id) run();
        return () => {
            stop = true;
        };
    }, [service?.id]);

    const topPromo = promos[0] || null;
    const promoExplained = humanPromoSummary(topPromo);

    /* ---------------- ACTIONS ---------------- */

    // Add to Cart (no config, no Q&A)
    const addToCartQuick = useCallback(() => {
        const itemPayload = {
            service_id: service.id,
            serviceId: service.id,
            id: service.id,
            name: service.name,
            quantity: 1,
            details: {}, // we are no longer collecting package/weight here
            answers: [],
            price_per_unit: computePriceForPayload(service),
            type: service.type,
            unit_name: service.unit_name,
            options: service.options,
            fulfillment_type: service.fulfillment_type,
            offering_session: service.offering_session,
        };

        try {
            const raw =
                localStorage.getItem("catalog_cart") ||
                '{"items":[]}';
            const parsed = JSON.parse(raw);
            const itemsArr = Array.isArray(parsed.items)
                ? parsed.items
                : [];
            itemsArr.push(itemPayload);
            localStorage.setItem(
                "catalog_cart",
                JSON.stringify({ items: itemsArr })
            );

            window.dispatchEvent(
                new CustomEvent("catalog:cart:changed")
            );
        } catch {
            // ignore
        }
    }, [service]);

    // Buy Now => redirect checkout
    const buyNowQuick = useCallback(() => {
        const payloadForCheckout = {
            serviceId: service.id,
            id: service.id,
            name: service.name,
            quantity: 1,
            details: {},
            answers: [],
            price_per_unit: computePriceForPayload(service),
            type: service.type,
            unit_name: service.unit_name,
            options: service.options,
            fulfillment_type: service.fulfillment_type,
        };

        const checkoutBase =
            typeof route === "function"
                ? route("catalog.checkout.page")
                : "/checkout";

        const url = `${checkoutBase}?item=${encodeURIComponent(
            JSON.stringify(payloadForCheckout)
        )}`;

        window.location.href = url;
    }, [service]);

    /* ---------------- derived UI text ---------------- */

    const sessionMapped = sessionInfo(service.offering_session);

    const priceDisplay = useMemo(() => {
        if (service.type === "free") return "Complimentary";

        if (service.type === "fixed")
            return `${formatIDR(service.price)}`;

        if (service.type === "per_unit")
            return `${formatIDR(service.price)} / ${
                service.unit_name || "unit"
            }`;

        if (service.type === "selectable") {
            const prices = (service.options || [])
                .map((op) => Number(op.price || 0))
                .filter((v) => !isNaN(v));
            const min = prices.length ? Math.min(...prices) : 0;
            return min > 0
                ? `Starts from ${formatIDR(min)}`
                : "Starts from IDR 0";
        }

        if (service.type === "multiple_options") {
            const prices = (service.options || [])
                .map((op) => Number(op.price || 0))
                .filter((v) => !isNaN(v));
            const min = prices.length ? Math.min(...prices) : 0;
            return min > 0
                ? `Starts from ${formatIDR(min)}`
                : "Starts from IDR 0";
        }

        return service.price
            ? `${formatIDR(service.price)}`
            : "Starts from IDR 0";
    }, [service]);

    const availabilityText = useMemo(() => {
        if (service.offering_session === "pre_checkin") {
            return "Available before you check in.";
        }
        if (service.offering_session === "post_checkin") {
            return "Available during your stay.";
        }
        if (service.offering_session === "pre_checkout") {
            return "Available before checkout.";
        }
        return "Available for guests.";
    }, [service.offering_session]);

    const fulfillMeta = describeFulfillment(
        service.fulfillment_type
    );

    // currently shown hero image
    const heroImage = gallery[activeIdx] || null;

    /* ---------------- RENDER ---------------- */

    return (
        <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_80%_-100px,rgba(16,185,129,0.10),transparent)] from-slate-50 to-slate-100 pb-16">
            {/* Header row w/ Back + Session Badge */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 flex items-start justify-between">
                <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-full border-slate-300 text-slate-700 bg-white hover:bg-slate-50 shadow-sm gap-1.5"
                >
                    <Link
                        href={
                            typeof route === "function"
                                ? route("catalog.browse")
                                : "/catalog"
                        }
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span>Back to Catalog</span>
                    </Link>
                </Button>

                <div className="flex-shrink-0">
                    <span
                        className={
                            "inline-flex items-center rounded-full px-3 py-[5px] text-[11px] font-semibold leading-none " +
                            sessionMapped.badgeClass
                        }
                        title={availabilityText}
                    >
                        {sessionMapped.label}
                    </span>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 grid lg:grid-cols-12 gap-8">
                {/* ---------- LEFT: Gallery ---------- */}
                <div className="lg:col-span-7 lg:top-4 h-fit flex flex-col gap-4">
                    <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm">
                        {/* hero image wrapper: fixed aspect, contain, no hover zoom */}
                        <div className="relative aspect-[16/9] w-full bg-slate-100 flex items-center justify-center">
                            {heroImage ? (
                                <img
                                    src={heroImage}
                                    alt={service.name}
                                    className="max-h-full max-w-full object-contain rounded-2xl"
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
                                    No image
                                </div>
                            )}

                            {/* promo badge overlay, top right */}
                            {promoExplained && (
                                <div className="absolute top-3 right-3">
                                    <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 text-white px-3 py-1 text-[11px] font-bold shadow-md">
                                        <Tag className="h-3.5 w-3.5" />
                                        <span className="truncate max-w-[160px]">
                                            {promoExplained.badge}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* price pill bottom-right */}
                            <div className="absolute bottom-3 right-3 rounded-full bg-black/70 text-white text-[11px] font-semibold px-3 py-1 shadow">
                                {priceDisplay}
                            </div>
                        </div>

                        {/* thumbnails row (click to change hero). no zoom overlay */}
                        <div className="p-3 flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none]">
                            <style>{`.thumbbar::-webkit-scrollbar{display:none}`}</style>
                            {(gallery.length ? gallery : [heroImage || null])
                                .filter(Boolean)
                                .map((src, i) => (
                                    <button
                                        key={src + i}
                                        onClick={() => setActiveIdx(i)}
                                        className={`thumbbar relative shrink-0 w-28 aspect-[16/10] rounded-lg overflow-hidden border ${
                                            i === activeIdx
                                                ? "ring-2 ring-slate-900"
                                                : "border-slate-200"
                                        } bg-slate-100 flex items-center justify-center`}
                                        title={`Image ${i + 1}`}
                                    >
                                        <img
                                            src={src}
                                            alt={`${service.name} ${i + 1}`}
                                            className="h-full w-full object-contain"
                                        />
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>

                {/* ---------- RIGHT: Info + Actions ---------- */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                    <div className="bg-white/90 backdrop-blur border rounded-2xl shadow-sm p-6 flex flex-col gap-4">
                        {/* title + desc */}
                        <div className="flex flex-col gap-1">
                            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                                {service.name}
                            </h1>

                            {/* =================================================================== */}
                            {/* 👇👇👇 PERUBAHAN ADA DI BLOK INI (SOLUSI ANDA) 👇👇👇        */}
                            {/* =================================================================== */}
                            {service.description_html ? (
                                <div
                                    // 'prose' dari @tailwindcss/typography
                                    // Sesuaikan styling (prose-sm) jika perlu
                                    className="prose prose-sm max-w-none text-slate-600 leading-relaxed" 
                                    dangerouslySetInnerHTML={{ __html: service.description_html }}
                                />
                            ) : (
                                // Fallback jika deskripsi (bahkan setelah diproses) kosong
                                service.description && (
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        {service.description}
                                    </p>
                                )
                            )}
                            {/* =================================================================== */}
                            {/* 👆👆👆 AKHIR DARI PERBAIKAN 👆👆👆                             */}
                            {/* =================================================================== */}
                        </div>

                        <Separator />

                        {/* info cards row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Fulfillment */}
                            <InfoPill
                                bgClass={`${fulfillMeta.toneBg} bg-white`}
                                icon={
                                    <ShieldCheck
                                        className={`h-4 w-4 ${fulfillMeta.iconColor}`}
                                    />
                                }
                                title={fulfillMeta.headline}
                                desc={fulfillMeta.desc}
                            />

                            {/* Availability */}
                            <InfoPill
                                bgClass="bg-gradient-to-br from-slate-50 to-white ring-slate-200/60"
                                icon={<Clock className="h-4 w-4 text-slate-600" />}
                                title="Availability"
                                desc={availabilityText}
                            />

                            {/* Pricing */}
                            <InfoPill
                                bgClass="bg-gradient-to-br from-amber-50 to-white ring-slate-200/60"
                                icon={
                                    <DollarSign className="h-4 w-4 text-amber-600" />
                                }
                                title="Pricing"
                                desc={priceDisplay}
                            />
                        </div>

                        {/* Promotions */}
                        <div>
                            <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                                <Tag className="h-3.5 w-3.5 text-slate-500" />
                                <span>Promotions</span>
                            </div>

                            {!promoLoading && promos.length === 0 && (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 text-slate-500 text-[12px] px-3 py-2 shadow-inner">
                                    No active promotions for this service.
                                </div>
                            )}

                            {!promoLoading && promos.length > 0 && (
                                <div className="space-y-2">
                                    {promos.map((p) => {
                                        const info = humanPromoSummary(p);
                                        return (
                                            <div
                                                key={p.id}
                                                className="rounded-xl border px-3 py-2 bg-white shadow-sm flex flex-col gap-0.5"
                                            >
                                                <div className="text-[12px] font-semibold text-slate-900 flex items-center gap-2">
                                                    <span className="inline-flex items-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-2 py-[2px] leading-none">
                                                        {info.badge}
                                                    </span>
                                                    <span className="truncate">
                                                        {p.name}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-600 leading-snug">
                                                    {info.line}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {promoLoading && (
                                <div className="rounded-xl border border-slate-200 bg-white text-[12px] text-slate-500 px-3 py-2 shadow-sm">
                                    Loading promotions…
                                </div>
                            )}
                        </div>

                        {/* Options (READ ONLY now) */}
                        {service.options?.length > 0 && (
                            <>
                                <Separator />
                                <div>
                                    <div className="text-xs text-slate-500 mb-2">
                                        Options
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        {service.options.map((op) => {
                                            const imgsForOp =
                                                optionImagesByKey[op.key] ||
                                                [];
                                            const thumb =
                                                imgsForOp[0]?.url ||
                                                null;

                                            return (
                                                <div
                                                    key={op.key || op.name}
                                                    className="w-full flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 bg-white"
                                                >
                                                    {/* small img (click to zoom fullscreen) */}
                                                    <div className="shrink-0">
                                                        {thumb ? (
                                                            <button
                                                                type="button"
                                                                className="block"
                                                                onClick={() =>
                                                                    setFullImage(
                                                                        thumb
                                                                    )
                                                                }
                                                            >
                                                                <img
                                                                    src={thumb}
                                                                    alt={op.name}
                                                                    className="h-12 w-12 rounded-lg object-cover border border-slate-200"
                                                                />
                                                            </button>
                                                        ) : (
                                                            <div className="h-12 w-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                                                                N/A
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* label + price */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-baseline justify-between gap-2">
                                                            <span className="text-sm font-medium text-slate-900 truncate">
                                                                {op.name}
                                                            </span>
                                                            <span className="text-[13px] font-semibold text-slate-900">
                                                                {formatIDR(op.price)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Actions */}
                        <Separator />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Button
                                className="w-full inline-flex items-center justify-center rounded-md bg-neutral-900 text-white text-sm font-medium h-10 px-4 hover:bg-black"
                                onClick={buyNowQuick}
                            >
                                Buy Now
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full inline-flex items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium h-10 px-4"
                                onClick={addToCartQuick}
                            >
                                <span
                                    role="img"
                                    aria-hidden="true"
                                    className="mr-2"
                                >
                                    <ShoppingCart />
                                </span>
                                Add to Cart
                            </Button>
                        </div>

                        <p className="text-[11px] text-slate-500 text-center sm:text-left">
                            You can review items at checkout.
                        </p>
                    </div>
                </div>
            </main>

            {/* fullscreen image modal (only for option thumbs now) */}
            {fullImage && (
                <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <button
                        className="absolute top-4 right-4 text-white/80 hover:text-white"
                        onClick={() => setFullImage(null)}
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <img
                        src={fullImage}
                        alt="Preview"
                        className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                    />
                </div>
            )}
        </div>
    );
}

/* small pill card component */
function InfoPill({ bgClass, icon, title, desc }) {
    return (
        <div
            className={`rounded-xl border ring-1 px-3 py-3 shadow-sm flex flex-col gap-1 ${bgClass}`}
        >
            <div className="flex items-center gap-2">
                {icon}
                <div className="text-[12px] font-semibold leading-none text-slate-900">
                    {title}
                </div>
            </div>
            <div className="text-[11px] text-slate-600 leading-snug">
                {desc}
            </div>
        </div>
    );
}

ServiceDetailPage.layout = (page) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
);

export default ServiceDetailPage;