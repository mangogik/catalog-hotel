import React, { useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, router } from "@inertiajs/react";
import { ShoppingCart, Sparkles, Users, Zap, Lock } from "lucide-react";

/* ---------- helpers ---------- */
const formatID = (n) => Number(n || 0).toLocaleString("id-ID");

function minSelectablePrice(svc) {
    const opts = Array.isArray(svc?.options) ? svc.options : [];
    const arr = opts
        .map((o) => Number(o.price || 0))
        .filter((v) => !Number.isNaN(v));
    return arr.length ? Math.min(...arr) : 0;
}

function unitPrice(service) {
    if (!service) return 0;
    if (service.type === "free") return 0;
    if (service.type === "fixed") return Number(service.price || 0);
    if (service.type === "per_unit") return Number(service.price || 0);
    if (service.type === "selectable" || service.type === "multiple_options") {
        return minSelectablePrice(service);
    }
    return Number(service.price || 0);
}

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

/* ---------- fallback image ---------- */
const FALLBACK =
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1200&auto=format&fit=crop";

function getPrimaryImageUrl(service) {
    if (
        service &&
        Array.isArray(service.images) &&
        service.images.length > 0 &&
        service.images[0]?.url
    ) {
        return service.images[0].url;
    }
    return FALLBACK;
}

/* ---------- quick order redirect ---------- */
const redirectQuickOrderToCheckout = (payload) => {
    const href =
        (typeof route === "function"
            ? route("catalog.checkout.page")
            : "/checkout") +
        `?item=${encodeURIComponent(JSON.stringify(payload))}`;
    window.location.href = href;
};

/* ---------- fulfillment type mapping ---------- */
function getFulfillmentTypeLabel(type) {
    const mapping = {
        staff_assisted: { label: "Staff Assisted", icon: Users },
        direct: { label: "Direct", icon: Zap },
    };
    return mapping[type] || { label: type, icon: null };
}

/* ===================== COMPONENT ===================== */
export default function ServiceCard({
    service,
    bookingStatus,
    eligiblePromotions = [],
    onAddToCart,
    onQuickOrder,
}) {
    if (!service) return null;

    const img = getPrimaryImageUrl(service);
    const isAllowed = isSessionAllowed(
        bookingStatus,
        service?.offering_session
    );

    /* price label */
    const priceLabel = useMemo(() => {
        if (service.type === "free") return "Gratis";
        if (service.type === "fixed") return `Rp ${formatID(service.price)}`;
        if (service.type === "per_unit") {
            return `Rp ${formatID(service.price)}/${service.unit_name || "unit"}`;
        }
        if (
            service.type === "selectable" ||
            service.type === "multiple_options"
        ) {
            const min = minSelectablePrice(service);
            return min > 0 ? `Start from Rp ${formatID(min)}` : "Start from Rp 0";
        }
        return service?.price ? `Rp ${formatID(service.price)}` : "";
    }, [service]);

    /* promo badge */
    const appliedPromo = useMemo(() => {
        const list = (eligiblePromotions || []).filter((p) => {
            const ids = Array.isArray(p.scoped_service_ids)
                ? p.scoped_service_ids
                : [];
            return ids.length ? ids.includes(service?.id) : true;
        });
        return list[0] || null;
    }, [eligiblePromotions, service?.id]);

    const promoLabel = useMemo(() => {
        if (!appliedPromo) return null;
        if (appliedPromo.badge_text) return appliedPromo.badge_text;
        if (appliedPromo.discount_percent)
            return `${parseInt(appliedPromo.discount_percent, 10)}% OFF`;
        if (appliedPromo.discount_amount)
            return `Rp ${formatID(appliedPromo.discount_amount)} OFF`;
        return "Promo";
    }, [appliedPromo]);

    const promoTitle = useMemo(() => {
        if (!appliedPromo) return undefined;
        const parts = [];
        if (appliedPromo.discount_percent)
            parts.push(`${parseInt(appliedPromo.discount_percent, 10)}% off`);
        if (appliedPromo.discount_amount)
            parts.push(`Rp ${formatID(appliedPromo.discount_amount)} off`);
        if (appliedPromo.offer_description)
            parts.push(String(appliedPromo.offer_description));
        return parts.join(" • ") || "Promo";
    }, [appliedPromo]);

    /* fulfillment type info */
    const fulfillmentInfo = useMemo(() => {
        return getFulfillmentTypeLabel(service?.fulfillment_type);
    }, [service?.fulfillment_type]);

    /* safe detail link */
    const goDetail = useCallback(() => {
        if (!isAllowed || !service?.slug) return;
        router.visit(
            typeof route === "function"
                ? route("catalog.service.show", service.slug)
                : `/service/${service.slug}`
        );
    }, [isAllowed, service?.slug]);

    /* actions */
    const addToCart = useCallback(() => {
        const payload = {
            serviceId: service.id,
            id: service.id,
            name: service.name,
            quantity: 1,
            details: {},
            answers: [],
            price_per_unit: unitPrice(service),
            type: service.type,
            unit_name: service.unit_name,
            options: service.options,
            fulfillment_type: service.fulfillment_type,
        };
        onAddToCart?.(payload);
    }, [service, onAddToCart]);

    const quickOrder = useCallback(() => {
        const payload = {
            serviceId: service.id,
            id: service.id,
            name: service.name,
            quantity: 1,
            details: {},
            answers: [],
            price_per_unit: unitPrice(service),
            type: service.type,
            unit_name: service.unit_name,
            options: service.options,
            fulfillment_type: service.fulfillment_type,
        };
        (onQuickOrder || redirectQuickOrderToCheckout)(payload);
    }, [service, onQuickOrder]);

    return (
        <Card
            className={`group relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm flex flex-col transition-shadow duration-200 ${
                isAllowed ? "hover:shadow-md" : "opacity-60"
            }`}
        >
            {/* Promo Ribbon */}
            {appliedPromo && (
                <div className="absolute top-2 right-0 z-10">
                    <div
                        className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-2 py-1 text-[10px] font-bold shadow-md rounded-l-md flex items-center gap-1"
                        title={promoTitle}
                    >
                        <Sparkles className="h-2.5 w-2.5" />
                        <span className="max-w-[80px] truncate">{promoLabel}</span>
                    </div>
                </div>
            )}

            {/* Clickable Card Body */}
            <div className={`block flex-1 ${isAllowed ? "cursor-pointer" : "cursor-not-allowed"}`} onClick={goDetail}>
                <CardBody
                    img={img}
                    service={service}
                    priceLabel={priceLabel}
                    fulfillmentInfo={fulfillmentInfo}
                    isAllowed={isAllowed}
                />
            </div>

            {/* Action Buttons */}
            <div className="px-3 py-2 border-t border-slate-100 bg-white">
                <div className="flex items-center gap-2">
                    {/* Buy Now Button */}
                    <Button
                        size="sm"
                        className="h-8 rounded-md bg-slate-900 hover:bg-slate-800 text-white flex-1"
                        onClick={(e) => {
                            e.stopPropagation();
                            quickOrder();
                        }}
                        disabled={!isAllowed}
                    >
                        <span className="text-[11px] font-medium leading-none">
                            Buy Now
                        </span>
                    </Button>

                    {/* Cart Button */}
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-md border-slate-300 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            addToCart();
                        }}
                        disabled={!isAllowed}
                    >
                        <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                    </Button>
                </div>
            </div>
        </Card>
    );
}

/* ---------- Presentational ---------- */
function CardBody({ img, service, priceLabel, fulfillmentInfo, isAllowed }) {
    const Icon = fulfillmentInfo?.icon;

    return (
        <div className="flex flex-col">
            {/* Image Container */}
            <div className="relative h-32 w-full overflow-hidden bg-slate-100">
                <img
                    src={img}
                    alt={service.name}
                    onError={(e) => {
                        e.currentTarget.src = FALLBACK;
                    }}
                    className="h-full w-full object-cover duration-200 ease-linear group-hover:scale-[1.03]"
                    style={{
                        transitionProperty: "transform",
                    }}
                    loading="lazy"
                />

                {/* Price Badge */}
                <div className="absolute right-2 bottom-2">
                    <div className="rounded-full bg-white/95 backdrop-blur-sm border border-slate-200/70 px-2 py-[3px] text-[11px] font-semibold text-slate-900 shadow-sm leading-none">
                        {priceLabel}
                    </div>
                </div>

                {/* Fulfillment Type Badge */}
                {fulfillmentInfo?.label && (
                    <div className="absolute left-2 top-2">
                        <div
                            className={`rounded-full px-2 py-[3px] flex items-center gap-1 text-[10px] font-medium leading-none shadow-sm border backdrop-blur-[2px] ${
                                fulfillmentInfo.label === "Direct"
                                    ? "bg-emerald-500/90 border-emerald-600 text-white shadow-emerald-700/30"
                                    : "bg-sky-500/90 border-sky-600 text-white shadow-sky-700/30"
                            }`}
                        >
                            {Icon && (
                                <Icon className="h-[10px] w-[10px] text-white shrink-0" />
                            )}
                            <span>{fulfillmentInfo.label}</span>
                        </div>
                    </div>
                )}

                {/* Updated Availability Overlay - matching search results style */}
                {!isAllowed && (
                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center">
                        <div className="bg-slate-100 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-sm">
                            <Lock className="h-3.5 w-3.5 text-slate-600" />
                            <span className="text-xs font-medium text-slate-700">
                                {service.offering_session?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} only
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="p-3 pb-2 flex-1">
                <h3 className="text-[13px] font-semibold text-slate-900 leading-snug line-clamp-2 mb-1">
                    {service.name}
                </h3>

                {/* =================================================================== */}
                {/* 👇👇👇 PERUBAHAN ADA DI BLOK INI (SOLUSI ANDA) 👇👇👇                */}
                {/* =================================================================== */}
                {service.description_html ? (
                    <div
                        // Terapkan 'prose' untuk styling, 'line-clamp-1' untuk memotong
                        className="prose prose-sm max-w-none text-slate-600 text-[11px] leading-snug line-clamp-1"
                        // 'title' sekarang bisa dihapus jika Anda tidak ingin
                        // menampilkan HTML mentah saat hover
                        dangerouslySetInnerHTML={{ __html: service.description_html }}
                    />
                ) : null}
                {/* =================================================================== */}
                {/* 👆👆👆 AKHIR DARI PERBAIKAN 👆👆👆                             */}
                {/* =================================================================== */}
            </div>
        </div>
    );
}