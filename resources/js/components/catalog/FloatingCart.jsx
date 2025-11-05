import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  X,
  Trash2,
  Tag,
  Inbox,
} from "lucide-react";

/* ---------------- Utils ---------------- */
function safeNum(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}
function formatPrice(n) {
  return safeNum(n).toLocaleString("id-ID");
}
function normalizeAnswers(val) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === "object") return Object.values(val);
  return [];
}
function readLatestCart() {
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

// helper untuk hindari setCart bila sama persis
function mergeIfChanged(onChange, nextItems) {
  onChange((prev) => {
    const prevItems = Array.isArray(prev?.items) ? prev.items : [];
    const sameLength = prevItems.length === nextItems.length;
    const sameContent =
      sameLength &&
      prevItems.every((p, i) => {
        const q = nextItems[i];
        return (
          p.id === q.id &&
          p.serviceId === q.serviceId &&
          p.quantity === q.quantity &&
          p.price_per_unit === q.price_per_unit
        );
      });

    if (sameContent) {
      return prev; // tidak berubah ⇒ tidak trigger re-render parent
    }

    return { items: nextItems };
  });
}

/* ---------------- Panel isi cart (minimal) ---------------- */
function CartPanel({ cart, onChange, onClose }) {
  const items = useMemo(() => {
    const arr = Array.isArray(cart?.items) ? cart.items : [];
    return arr.filter((it) => it && (it.id || it.serviceId));
  }, [cart]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (s, it) =>
          s +
          safeNum(it?.price_per_unit) * (safeNum(it?.quantity) || 1),
        0
      ),
    [items]
  );

  const removeAt = useCallback(
    (i) => {
      onChange((prev) => {
        const arr = Array.isArray(prev?.items) ? prev.items : [];
        const nextItems = arr.filter((_, idx) => idx !== i);
        const next = { ...prev, items: nextItems };
        try {
          localStorage.setItem("catalog_cart", JSON.stringify(next));
          window.dispatchEvent(new CustomEvent("catalog:cart:changed"));
        } catch {}
        return next;
      });
    },
    [onChange]
  );

  const clear = useCallback(() => {
    const next = { items: [] };
    onChange(next);
    try {
      localStorage.setItem("catalog_cart", JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("catalog:cart:changed"));
    } catch {}
  }, [onChange]);

  function goToCheckout() {
    const latest = readLatestCart().items;
    const base = latest.length ? latest : items;

    const compact = base.map((it) => ({
      serviceId: it.serviceId || it.id,
      id: it.serviceId || it.id,
      name: it.name,
      quantity: it.quantity || 1,
      details: it.details || {},
      answers: normalizeAnswers(it.answers),
      price_per_unit: safeNum(it.price_per_unit),
      type: it.type || "",
      unit_name: it.unit_name || null,
      options: Array.isArray(it.options) ? it.options : null,
      fulfillment_type: it.fulfillment_type ?? null,
    }));

    try {
      localStorage.setItem(
        "catalog_cart",
        JSON.stringify({ items: compact })
      );
      window.dispatchEvent(new CustomEvent("catalog:cart:changed"));
    } catch {}

    const hrefBase =
      typeof route === "function"
        ? route("catalog.checkout.page")
        : "/checkout";

    const url = `${hrefBase}?cart=${encodeURIComponent(
      JSON.stringify({ items: compact })
    )}`;

    window.location.href = url;
  }

  return (
    <div className="w-[340px] max-w-[92vw] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <ShoppingCart className="h-4 w-4 text-slate-600" />
          <span className="font-medium text-slate-900 text-sm truncate">
            Cart
          </span>
          <Badge variant="secondary" className="h-5 text-[11px]">
            {items.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {items.length > 0 && (
            <button
              onClick={clear}
              className="h-7 px-2 text-[12px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md"
              title="Clear cart"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Items (ultra-compact rows) */}
      <div className="max-h-[220px] overflow-auto">
        {items.map((it, i) => {
          const qty = safeNum(it?.quantity) || 1;
          const ppu = safeNum(it?.price_per_unit) || 0;
          const lineTotal = ppu * qty;

          return (
            <div key={i} className="px-3 py-2.5 border-b">
              <div className="flex items-center gap-2">
                <div className="shrink-0 rounded-md bg-slate-100 border text-slate-600 h-7 w-7 inline-flex items-center justify-center">
                  <Tag className="h-3.5 w-3.5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate">
                      <div className="font-medium text-[13px] text-slate-900 truncate">
                        {it?.name || "Item"}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {qty} × Rp {formatPrice(ppu)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13px] font-semibold text-slate-900">
                        Rp {formatPrice(lineTotal)}
                      </div>
                      <button
                        className="mt-1 h-6 w-6 inline-flex items-center justify-center rounded-md border border-slate-200 hover:bg-rose-50 hover:border-rose-300 text-slate-500 hover:text-rose-600"
                        onClick={() => removeAt(i)}
                        title="Remove"
                        aria-label={`Remove ${it?.name || "item"}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 border flex items-center justify-center mb-3">
              <Inbox className="h-5 w-5 text-slate-400" />
            </div>
            Keranjang masih kosong
          </div>
        )}
      </div>

      {/* Subtotal + CTA */}
      <div className="px-3 py-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-slate-600">Subtotal</span>
          <span className="text-sm font-semibold text-slate-900 tabular-nums">
            Rp {formatPrice(subtotal)}
          </span>
        </div>

        <Button
          className="w-full h-10 rounded-lg bg-neutral-900 hover:bg-black text-white text-sm font-medium"
          disabled={items.length === 0}
          onClick={goToCheckout}
        >
          Checkout Now
        </Button>
      </div>
    </div>
  );
}

/* ---------------- FloatingCart trigger + panel ---------------- */
export default function FloatingCart({ cart, onChange }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  // badge jumlah item (dari prop cart yang disinkronkan parent/Catalog)
  const totalItems = Array.isArray(cart?.items) ? cart.items.length : 0;

  // saat membuka, pastikan state parent disinkron dari storage
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem("catalog_cart");
      if (raw) {
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed?.items) ? parsed.items : [];
        mergeIfChanged(onChange, items);
      }
    } catch {}
  }, [open, onChange]);

  // Close on outside click / Esc
  useEffect(() => {
    function onClickOutside(e) {
      if (!open) return;
      const panel = panelRef.current;
      const btn = btnRef.current;
      if (
        panel &&
        !panel.contains(e.target) &&
        btn &&
        !btn.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // sinkron badge via pageshow + event custom
  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const raw = localStorage.getItem("catalog_cart");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed?.items) ? parsed.items : [];
        mergeIfChanged(onChange, items);
      } catch {}
    };

    window.addEventListener("pageshow", syncFromStorage);
    window.addEventListener("catalog:cart:changed", syncFromStorage);
    return () => {
      window.removeEventListener("pageshow", syncFromStorage);
      window.removeEventListener("catalog:cart:changed", syncFromStorage);
    };
  }, [onChange]);

  return (
    <>
      {/* Floating Trigger */}
      <Button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="relative isolate z-[110] fixed bottom-4 right-4 rounded-full p-4 shadow-lg"
        size="lg"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="floating-cart-panel"
      >
        <ShoppingCart className="h-6 w-6" />
        {totalItems > 0 && (
          <span
            className="pointer-events-none absolute -top-2 -right-2 z-[120] bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center"
            aria-label={`${totalItems} items in cart`}
          >
            {totalItems > 9 ? "9+" : totalItems}
          </span>
        )}
      </Button>

      {/* Panel */}
      {open && (
        <>
          {/* Backdrop di bawah button & badge */}
          <div className="fixed inset-0 z-[80] bg-black/20 lg:bg-transparent" />
          <div
            id="floating-cart-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            className="fixed z-[100] bottom-20 right-4 animate-in fade-in slide-in-from-bottom-2"
          >
            <CartPanel
              cart={cart}
              onChange={onChange}
              onClose={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}
