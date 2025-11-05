import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  CheckCircle2, 
  CreditCard, 
  Percent,
  Banknote,
  Gift,
  AlertCircle,
  Sparkles // Added icon for promotion indicator
} from "lucide-react";

const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", { 
    style: "currency", 
    currency: "IDR", 
    maximumFractionDigits: 0 
  }).format(Number(n || 0));

// Improved promotion display component - ensures single-line text
const SelectedPromoDisplay = ({ promo }) => {
  if (!promo) return null;
  return (
    <div className="flex items-center gap-2 overflow-hidden">
      <div className="flex-shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
      </div>
      <div className="overflow-hidden">
        <span className="font-medium text-sm truncate block">
          {promo.name}
        </span>
      </div>
    </div>
  );
};

// Promotion list item - single-line text for clarity
const PromoListItem = ({ promo }) => {
  return (
    <div className="flex items-center gap-2 overflow-hidden py-1">
      <div className="flex-shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
      </div>
      <div className="overflow-hidden">
        <span className="font-medium text-sm truncate block">
          {promo.name}
        </span>
        <span className="text-[11px] text-slate-500 truncate block">
          {promo.badge_text || promo.offer_description || "Special offer"}
        </span>
      </div>
    </div>
  );
};

const SummaryCard = ({ 
  items, 
  summary, 
  loadingPreview, 
  
  // New props from Checkout.jsx
  loadingPromos,
  isCartComplete,

  availablePromos, 
  promotionId, 
  setPromotionId,
  paymentPref, 
  setPaymentPref,
  notes, 
  setNotes,
  placing,
  handlePlaceOrder
}) => {

  const selectedPromo = React.useMemo(() => {
    return availablePromos.find(p => String(p.id) === String(promotionId));
  }, [availablePromos, promotionId]);

  const isButtonDisabled = items.length === 0 || placing || !isCartComplete;

  return (
    <Card className="border border-slate-200/70 shadow-sm sticky top-6 rounded-xl">
      {/* Header */}
      <CardHeader className="px-4 py-3 bg-white/60 backdrop-blur border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            <CardTitle className="text-base">Order Summary</CardTitle>
          </div>
          <Badge variant="secondary" className="h-5 text-[11px]">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <CardDescription className="mt-1 text-[12px] text-slate-500">
          Review & finalize your order
        </CardDescription>
      </CardHeader>
      
      <CardContent className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {/* ====================================================== */}
          {/* === SECTION 1: PROMOTION DROPDOWN LOGIC              === */}
          {/* ====================================================== */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                <Percent className="h-3.5 w-3.5" /> Promotion
              </Label>
              {/* Enhanced promotion availability indicator */}
              {availablePromos.length > 0 && !loadingPromos && (
                <div className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500 animate-pulse" />
                  <Badge variant="outline" className="h-5 text-[11px] text-amber-600 border-amber-300 bg-amber-50">
                    {availablePromos.length} offer{availablePromos.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              )}
            </div>
            
            <Select
              value={promotionId || "none"}
              onValueChange={(v) => setPromotionId(v === "none" ? "" : v)}
              disabled={loadingPromos || availablePromos.length === 0}
            >
              <SelectTrigger 
                className={`h-auto min-h-[36px] bg-white border-slate-200 text-sm ${
                  !loadingPromos && availablePromos.length > 0 && !promotionId 
                    ? 'border-amber-300 bg-amber-50/50 transition-all' 
                    : ''
                }`}
              >
                <SelectValue>
                  {loadingPromos ? (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading offers...</span>
                    </div>
                  ) : selectedPromo ? (
                    <SelectedPromoDisplay promo={selectedPromo} />
                  ) : availablePromos.length > 0 ? (
                    <div className="flex items-center gap-2 text-amber-600 font-medium">
                      <Gift className="h-4 w-4" />
                      <span className="text-sm">Select an offer to save!</span>
                    </div>
                  ) : (
                    <span className="text-slate-500">No offers available</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <div className="flex items-center gap-2">
                    <span>No promotion</span>
                  </div>
                </SelectItem>
                {availablePromos.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    <PromoListItem promo={p} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {availablePromos.length > 0 && !loadingPromos && !promotionId && (
              <div className="flex items-center gap-1 text-[11px] text-amber-600 mt-1">
                <Sparkles className="h-3 w-3" />
                <span>Save money by selecting an offer above!</span>
              </div>
            )}
          </div>
          {/* ====================================================== */}

          {/* Payment */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" /> Payment Method
            </Label>
            <Select value={paymentPref} onValueChange={setPaymentPref}>
              <SelectTrigger className="h-8 bg-white border-slate-200 text-sm">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-emerald-700" />
                    <span className="text-sm">Cash</span>
                  </div>
                </SelectItem>
                <SelectItem value="online">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-700" />
                    <span className="text-sm">Online</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-medium">
              {summary ? formatIDR(summary?.subtotal || 0) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-slate-600">Discount</span>
            <span className="font-medium text-rose-600">
              {summary ? formatIDR(summary?.discount_total || 0) : "—"}
            </span>
          </div>
          <div className="h-px bg-slate-200 my-1" />
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">Total</span>
            <span className="font-bold text-[18px] text-emerald-700">
              {summary ? formatIDR(summary?.grand_total || 0) : "—"}
            </span>
          </div>

          {loadingPreview && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Updating summary...
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Special Notes</Label>
          <Textarea
            rows={2}
            placeholder="Special requests or delivery instructions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="resize-none text-sm"
          />
        </div>

        {/* ====================================================== */}
        {/* === SECTION 2: ORDER BUTTON & ERROR MESSAGES         === */}
        {/* ====================================================== */}
        <Button 
          className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-sm font-medium disabled:opacity-50"
          disabled={isButtonDisabled}
          onClick={handlePlaceOrder}
        >
          {placing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            "Complete Order"
          )}
        </Button>
        
        {items.length > 0 && !isCartComplete && !placing && (
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-amber-700 text-center">
            <AlertCircle className="h-3.5 w-3.5" />
            Please fill in all required item details.
          </p>
        )}
        
        <p className="text-[11px] text-slate-500 text-center">
          By completing this order, you agree to our terms
        </p>
      </CardContent>
    </Card>
  );
};

export default SummaryCard;
