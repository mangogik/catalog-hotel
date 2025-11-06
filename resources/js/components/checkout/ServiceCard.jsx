import React, { useState, useMemo, useEffect } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    HelpCircle,
    Trash2,
    Package,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    CheckCircle,
    Info,
    Minus,
    Plus,
} from "lucide-react";

const formatIDR = (n) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number(n || 0));

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

/* ---------- Fulfillment metadata ---------- */
const FULFILLMENT_META = {
    direct: {
        label: "Direct",
        desc: "Diproses otomatis/instan tanpa interaksi staf.",
        ring: "ring-emerald-200",
        fg: "text-emerald-700",
        bg: "bg-emerald-50",
    },
    staff_assisted: {
        label: "Staff Assisted",
        desc: "Dibantu staf (antar ke kamar/konfirmasi manual).",
        ring: "ring-amber-200",
        fg: "text-amber-700",
        bg: "bg-amber-50",
    },
};

/* ---------- Tiny chip ---------- */
const Chip = ({ children, className = "" }) => (
    <span
        className={
            "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-[2px] text-[11px] text-slate-700 " +
            className
        }
    >
        {children}
    </span>
);

/* ---------- Tooltip (pure CSS, no deps) ---------- */
const HoverTip = ({ trigger, text }) => (
    <span className="relative inline-flex items-center group">
        {trigger}
        <span className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
            <span className="whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm">
                {text}
            </span>
        </span>
    </span>
);

const ServiceCard = ({
    item,
    index,
    updateItem,
    updateItemDetails,
    removeItem,
    questions = [],
    isLoadingQuestions = false,
}) => {
    const type = String(item?.type || "fixed");
    const opts = getOptionsArray(item?.options);
    const [expanded, setExpanded] = useState(false);

    /* ---------- Fulfillment ---------- */
    const fKey = String(item?.fulfillment_type || "").toLowerCase();
    const fMeta = FULFILLMENT_META[fKey];

    /* ---------- Completeness ---------- */
    const isComplete = useMemo(() => {
        if (type === "selectable" && !item?.details?.package) return false;

        if (type === "multiple_options") {
            const packages = item?.details?.packages;
            if (!packages) return false;

            if (Array.isArray(packages)) {
                if (packages.length === 0) return false;
            } else if (typeof packages === "object" && packages !== null) {
                if (Object.values(packages).every((qty) => Number(qty) <= 0))
                    return false;
            } else {
                return false;
            }
        }

        if (
            type === "per_unit" &&
            (item?.details?.weight === undefined ||
                item?.details?.weight === null ||
                item?.details?.weight === "" ||
                Number.isNaN(Number(item?.details?.weight)) ||
                Number(item?.details?.weight) <= 0)
        )
            return false;

        if (Array.isArray(questions) && questions.length > 0) {
            const answers = Array.isArray(item?.answers) ? item.answers : [];
            if (answers.length < questions.length) return false;
            if (answers.some((a) => !a || String(a).trim() === ""))
                return false;
        }
        return true;
    }, [item, type, questions]);

    /* ---------- Total Price ---------- */
    const totalPrice = useMemo(() => {
        if (type === "selectable") {
            const selectedOpt = opts.find(
                (opt) => opt?.name === item?.details?.package
            );
            return (
                (selectedOpt ? Number(selectedOpt.price || 0) : 0) *
                Number(item?.quantity || 1)
            );
        }

        if (type === "multiple_options") {
            const packages = item?.details?.packages;
            if (!packages) return 0;

            if (Array.isArray(packages)) {
                return packages.reduce((sum, name) => {
                    const opt = opts.find((o) => o?.name === name);
                    return sum + (opt ? Number(opt.price || 0) : 0);
                }, 0);
            }

            if (typeof packages === "object" && packages !== null) {
                return Object.keys(packages).reduce((sum, name) => {
                    const qty = Number(packages[name] || 0);
                    const opt = opts.find((o) => o?.name === name);
                    const price = opt ? Number(opt.price || 0) : 0;
                    return sum + price * qty;
                }, 0);
            }

            return 0;
        }

        if (type === "per_unit") {
            const weight = Number(item?.details?.weight || 0);
            return weight * Number(item?.price_per_unit || 0);
        }

        return Number(item?.quantity || 1) * Number(item?.price_per_unit || 0);
    }, [item, type, opts]);

    /* ---------- Collapsed quick facts ---------- */
    const QuickFacts = () => {
        // Helper untuk membatasi panjang teks
        const truncateText = (text, maxLength = 15) => {
            if (text.length <= maxLength) return text;
            return text.substring(0, maxLength - 2) + "...";
        };

        return (
            <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {(type === "fixed" || type === "selectable") && (
                        <Chip>Qty: {item?.quantity || 1}</Chip>
                    )}

                    {type === "selectable" && (
                        <Chip>
                            Paket:
                            <span className="font-medium">
                                {truncateText(item?.details?.package || "—")}
                            </span>
                        </Chip>
                    )}

                    {type === "multiple_options" && (
                        <>
                            {(() => {
                                const packages = item?.details?.packages;
                                if (!packages) return <Chip>Options: 0</Chip>;

                                let optionsList = [];
                                if (Array.isArray(packages)) {
                                    optionsList = packages.map((name) => ({
                                        name,
                                        qty: 1,
                                    }));
                                } else if (
                                    typeof packages === "object" &&
                                    packages !== null
                                ) {
                                    optionsList = Object.entries(packages)
                                        .filter(([_, qty]) => Number(qty) > 0)
                                        .map(([name, qty]) => ({
                                            name,
                                            qty: Number(qty),
                                        }));
                                }

                                if (optionsList.length === 0)
                                    return <Chip>Options: 0</Chip>;

                                // Batasi jumlah opsi yang ditampilkan (maksimal 2)
                                const visibleOptions = optionsList.slice(0, 2);
                                const hasMore = optionsList.length > 2;

                                return (
                                    <>
                                        {visibleOptions.map((opt, idx) => (
                                            <Chip key={idx}>
                                                <span className="font-medium">
                                                    {truncateText(opt.name)}:{" "}
                                                    {opt.qty}
                                                </span>
                                            </Chip>
                                        ))}
                                        {hasMore && (
                                            <Chip>
                                                <span className="font-medium">
                                                    +{optionsList.length - 2}
                                                </span>
                                            </Chip>
                                        )}
                                    </>
                                );
                            })()}
                        </>
                    )}

                    {type === "per_unit" && (
                        <Chip>
                            {item?.details?.weight || 0}{" "}
                            {item?.unit_name || "unit"}
                        </Chip>
                    )}

                    {fMeta && (
                        <HoverTip
                            text={fMeta.desc}
                            trigger={
                                <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px] ${fMeta.bg} ${fMeta.fg} border-transparent`}
                                >
                                    <Info className="h-3.5 w-3.5" />
                                    {fMeta.label}
                                </span>
                            }
                        />
                    )}

                    {!isComplete && (
                        <Badge
                            variant="destructive"
                            className="text-[11px] h-5"
                        >
                            Incomplete
                        </Badge>
                    )}
                </div>

                <div className="shrink-0 text-emerald-700 font-semibold">
                    {formatIDR(totalPrice)}
                </div>
            </div>
        );
    };

    /* ---------- Option image lookup helper ---------- */
    const findOptionImage = (optionData) => {
        if (!item?.option_images || typeof item.option_images !== "object") {
            return null;
        }
        let optionName, optionKey;
        if (typeof optionData === "string") {
            optionName = optionData;
            optionKey = optionData;
        } else if (optionData && typeof optionData === "object") {
            optionName = optionData.name || optionData.option_name || "unknown";
            optionKey = optionData.key || optionData.option_key || optionName;
        } else {
            return null;
        }

        let imagesForOption = item.option_images[optionKey];
        if (!imagesForOption && optionName !== optionKey) {
            imagesForOption = item.option_images[optionName];
        }
        if (!imagesForOption) {
            for (const key in item.option_images) {
                if (key.includes(optionName) || optionName.includes(key)) {
                    imagesForOption = item.option_images[key];
                    break;
                }
            }
        }
        if (!Array.isArray(imagesForOption) || imagesForOption.length === 0) {
            return null;
        }
        const firstImage = imagesForOption[0];
        return firstImage?.url || null;
    };

    /* ---------- handler untuk kuantitas 'multiple_options' ---------- */
    const handlePackageQtyChange = (optionName, newQty) => {
        const qty = Math.max(0, parseInt(newQty, 10) || 0);

        const currentPackages = item?.details?.packages;
        let newPackages = {};

        if (Array.isArray(currentPackages)) {
            currentPackages.forEach((name) => {
                newPackages[name] = 1;
            });
        } else if (
            typeof currentPackages === "object" &&
            currentPackages !== null
        ) {
            newPackages = { ...currentPackages };
        }

        if (qty === 0) {
            delete newPackages[optionName];
        } else {
            newPackages[optionName] = qty;
        }

        updateItemDetails(index, "packages", newPackages);
    };

    return (
        <Card
            className={`border border-slate-200/70 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md rounded-xl ${
                !isComplete ? "ring-1 ring-amber-200" : ""
            }`}
        >
            <CardHeader className="p-4 sm:p-5 bg-white/60 backdrop-blur border-b">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        {item?.image && (
                            <div className="hidden sm:block shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border">
                                <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}

                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <CardTitle className="text-[15px] sm:text-base font-semibold text-slate-900 truncate">
                                    {item?.name || "Service"}
                                </CardTitle>
                                {/* {item?.category && (
                                    <Badge
                                        variant="secondary"
                                        className="h-5 text-[11px]"
                                    >
                                        {typeof item.category === "string"
                                            ? item.category
                                            : item.category?.name ||
                                              "Uncategorized"}
                                    </Badge>
                                )} */}
                            </div>

                            {/* =================================================================== */}
                            {/* 👇👇👇 PERUBAHAN ADA DI SINI 👇👇👇                                    */}
                            {/* =================================================================== */}
                            {/* Ganti CardDescription dengan div untuk render HTML */}
                            {item?.description_html ? (
                                <div
                                    className="prose prose-sm max-w-none text-slate-600 text-xs sm:text-[13px] leading-snug line-clamp-1 mt-0.5"
                                    dangerouslySetInnerHTML={{
                                        __html: item.description_html,
                                    }}
                                />
                            ) : (
                                <CardDescription className="mt-0.5 text-xs sm:text-[13px] text-slate-600 line-clamp-1">
                                    {item?.description ||
                                        "Premium service for your comfort"}
                                </CardDescription>
                            )}
                            {/* =================================================================== */}
                            {/* 👆👆👆 AKHIR DARI PERUBAHAN 👆👆👆                                 */}
                            {/* =================================================================== */}

                            {!expanded && <QuickFacts />}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {removeItem && (
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeItem(index)}
                                className="h-8 w-8 text-slate-400 hover:text-rose-500"
                                title="Remove"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded((v) => !v)}
                            className="h-8 px-2 text-slate-600"
                        >
                            {expanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="ml-1 text-xs">
                                {expanded ? "Hide" : "Details"}
                            </span>
                        </Button>
                    </div>
                </div>
            </CardHeader>

            {expanded && (
                <CardContent className="p-4 sm:p-5 space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Chip>
                            Type:
                            <span className="font-medium capitalize ml-1">
                                {type.replace("_", " ")}
                            </span>
                        </Chip>

                        {item?.unit_name && (
                            <Chip>
                                Unit:
                                <span className="font-medium ml-1">
                                    {item.unit_name}
                                </span>
                            </Chip>
                        )}

                        {fMeta && (
                            <HoverTip
                                text={fMeta.desc}
                                trigger={
                                    <span
                                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px] ${fMeta.bg} ${fMeta.fg} border-transparent`}
                                    >
                                        <Info className="h-3.5 w-3.5" />
                                        {fMeta.label}
                                    </span>
                                }
                            />
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* LEFT COLUMN */}
                        <div className="space-y-3">
                            {type === "selectable" && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                                        <Package className="h-4 w-4" /> Package
                                    </Label>
                                    <Select
                                        value={item?.details?.package || ""}
                                        onValueChange={(v) =>
                                            updateItemDetails(
                                                index,
                                                "package",
                                                v
                                            )
                                        }
                                    >
                                        <SelectTrigger className="h-9 bg-white border-slate-200">
                                            <SelectValue placeholder="Choose" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {opts.map((o, i) => {
                                                const imgUrl =
                                                    findOptionImage(o);
                                                return (
                                                    <SelectItem
                                                        key={i}
                                                        value={o?.name || ""}
                                                    >
                                                        <div className="flex items-center justify-between w-full gap-2">
                                                            {imgUrl ? (
                                                                <img
                                                                    src={imgUrl}
                                                                    alt={
                                                                        o?.name
                                                                    }
                                                                    className="w-16 h-16 rounded-md border border-slate-200 object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-16 h-16 rounded-md border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[9px] text-slate-400">
                                                                    —
                                                                </div>
                                                            )}
                                                            <span className="truncate">
                                                                {o?.name ||
                                                                    "Package"}
                                                            </span>
                                                            <span className="text-slate-500 ml-auto">
                                                                {formatIDR(
                                                                    o?.price ||
                                                                        0
                                                                )}
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                    {!item?.details?.package && (
                                        <p className="text-[11px] text-rose-500 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />{" "}
                                            Please select a package
                                        </p>
                                    )}
                                </div>
                            )}

                            {type === "multiple_options" && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                                        <Package className="h-4 w-4" /> Options
                                    </Label>
                                    <div className="bg-white border border-slate-200 rounded-lg p-2.5 max-h-60 overflow-y-auto">
                                        {opts.length ? (
                                            <div className="grid grid-cols-1 gap-2.5">
                                                {opts.map((o, i) => {
                                                    const currentPackages =
                                                        item?.details
                                                            ?.packages || {};
                                                    let currentQty = 0;
                                                    if (
                                                        Array.isArray(
                                                            currentPackages
                                                        )
                                                    ) {
                                                        currentQty =
                                                            currentPackages.includes(
                                                                o?.name
                                                            )
                                                                ? 1
                                                                : 0;
                                                    } else if (
                                                        typeof currentPackages ===
                                                        "object"
                                                    ) {
                                                        currentQty = Number(
                                                            currentPackages[
                                                                o?.name
                                                            ] || 0
                                                        );
                                                    }

                                                    const imgUrl =
                                                        findOptionImage(o);

                                                    return (
                                                        <div
                                                            key={i}
                                                            className="flex items-center justify-between py-1"
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                {imgUrl ? (
                                                                    <div className="relative group w-16 h-16 shrink-0 rounded-md overflow-hidden border border-slate-200 bg-white ">
                                                                        <img
                                                                            src={
                                                                                imgUrl
                                                                            }
                                                                            alt={
                                                                                o?.name
                                                                            }
                                                                            className="object-cover w-full h-full"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-16 h-16 shrink-0 rounded-md border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400">
                                                                        N/A
                                                                    </div>
                                                                )}
                                                                <div className="min-w-0">
                                                                    <span className="text-sm font-medium text-slate-800 truncate block">
                                                                        {o?.name ||
                                                                            `Option #${
                                                                                i +
                                                                                1
                                                                            }`}
                                                                    </span>
                                                                    <span className="text-xs text-slate-500">
                                                                        {formatIDR(
                                                                            o?.price ||
                                                                                0
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-7 w-7"
                                                                    onClick={() =>
                                                                        handlePackageQtyChange(
                                                                            o?.name,
                                                                            currentQty -
                                                                                1
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        currentQty <=
                                                                        0
                                                                    }
                                                                >
                                                                    <Minus className="h-4 w-4" />
                                                                </Button>
                                                                <Input
                                                                    type="number"
                                                                    value={
                                                                        currentQty
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        handlePackageQtyChange(
                                                                            o?.name,
                                                                            e
                                                                                .target
                                                                                .value
                                                                        )
                                                                    }
                                                                    className="h-7 w-12 text-center px-1"
                                                                />
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-7 w-7"
                                                                    onClick={() =>
                                                                        handlePackageQtyChange(
                                                                            o?.name,
                                                                            currentQty +
                                                                                1
                                                                        )
                                                                    }
                                                                >
                                                                    <Plus className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-2 text-slate-500 text-xs">
                                                No options available
                                            </div>
                                        )}
                                    </div>
                                    {!isComplete && (
                                        <p className="text-[11px] text-rose-500 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />{" "}
                                            Please add a quantity for at least
                                            one option
                                        </p>
                                    )}
                                </div>
                            )}

                            {type === "per_unit" && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                                        <Package className="h-4 w-4" /> Amount
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item?.details?.weight ?? ""}
                                            placeholder={
                                                item?.unit_name
                                                    ? `Amount (${item.unit_name})`
                                                    : "Amount"
                                            }
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                const w =
                                                    raw === ""
                                                        ? ""
                                                        : parseFloat(raw) || 0;
                                                updateItem(index, {
                                                    details: {
                                                        ...(item.details || {}),
                                                        weight: w,
                                                    },
                                                    quantity:
                                                        w === ""
                                                            ? 1
                                                            : Number(w || 0),
                                                });
                                            }}
                                            className="h-9 max-w-[160px]"
                                        />
                                        {item?.unit_name ? (
                                            <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-md">
                                                {item.unit_name}
                                            </span>
                                        ) : null}
                                        <span className="ml-auto text-sm font-semibold text-emerald-700">
                                            {formatIDR(totalPrice)}
                                        </span>
                                    </div>
                                    {(item?.details?.weight === undefined ||
                                        item?.details?.weight === null ||
                                        item?.details?.weight === "" ||
                                        Number.isNaN(
                                            Number(item?.details?.weight)
                                        ) ||
                                        Number(item?.details?.weight) <= 0) && (
                                        <p className="text-[11px] text-rose-500 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            {item?.unit_name
                                                ? `${item.unit_name} is required (> 0)`
                                                : "Amount is required (> 0)"}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN */}
                        <div className="space-y-3">
                            {(type === "fixed" || type === "selectable") && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-slate-700">
                                        Quantity
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() =>
                                                updateItem(index, {
                                                    quantity: Math.max(
                                                        1,
                                                        (item?.quantity || 1) -
                                                            1
                                                    ),
                                                })
                                            }
                                            disabled={
                                                (item?.quantity || 1) <= 1
                                            }
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={Number(item?.quantity || 1)}
                                            onChange={(e) =>
                                                updateItem(index, {
                                                    quantity: Math.max(
                                                        1,
                                                        parseInt(
                                                            e.target.value ||
                                                                "1",
                                                            10
                                                        )
                                                    ),
                                                })
                                            }
                                            className="h-9 w-16 text-center"
                                        />
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() =>
                                                updateItem(index, {
                                                    quantity:
                                                        (item?.quantity || 1) +
                                                        1,
                                                })
                                            }
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>

                                        <span className="ml-auto text-sm font-semibold text-emerald-700">
                                            {formatIDR(totalPrice)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Q&A */}
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-slate-700">
                                    <HelpCircle className="h-4 w-4" />
                                    <h5 className="text-xs font-medium">
                                        Additional Details
                                    </h5>
                                    {questions.length > 0 && (
                                        <Badge
                                            variant="outline"
                                            className="ml-auto h-5 text-[11px]"
                                        >
                                            {questions.length}{" "}
                                            {questions.length === 1
                                                ? "question"
                                                : "questions"}
                                        </Badge>
                                    )}
                                </div>

                                {isLoadingQuestions ? (
                                    <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-md border border-slate-200">
                                        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                                        <span className="text-xs text-slate-600">
                                            Loading questions...
                                        </span>
                                    </div>
                                ) : questions.length > 0 ? (
                                    <div className="space-y-2">
                                        {questions.map((q, qi) => {
                                            const answer = Array.isArray(
                                                item?.answers
                                            )
                                                ? item.answers[qi] ?? ""
                                                : "";
                                            const isAnswered =
                                                answer &&
                                                String(answer).trim() !== "";
                                            return (
                                                <div
                                                    key={qi}
                                                    className="space-y-1"
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <Label className="text-[12px] font-medium text-slate-700">
                                                            {q}
                                                        </Label>
                                                        {isAnswered ? (
                                                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                                        ) : (
                                                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                                        )}
                                                    </div>
                                                    <Textarea
                                                        placeholder="Your answer..."
                                                        value={answer}
                                                        onChange={(e) => {
                                                            const arr =
                                                                Array.isArray(
                                                                    item?.answers
                                                                )
                                                                    ? [
                                                                          ...item.answers,
                                                                      ]
                                                                    : [];
                                                            while (
                                                                arr.length <
                                                                questions.length
                                                            )
                                                                arr.push("");
                                                            arr[qi] =
                                                                e.target.value;
                                                            updateItem(index, {
                                                                answers: arr,
                                                            });
                                                        }}
                                                        className="min-h-[54px] resize-none text-sm"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-2 text-slate-500 bg-slate-50 rounded-md border border-slate-200 text-xs">
                                        No additional questions
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
};

export default ServiceCard;
