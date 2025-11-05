import React, { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

function formatID(n){ return Number(n||0).toLocaleString("id-ID") }

// validasi: SEMUA field pertanyaan dianggap wajib (meski definisinya tidak)
function validate(questions, answers){
  const errs = {}
  for (const q of questions){
    const required = q.required !== false // treat default as required
    if (required && !String(answers[q.key] ?? "").trim()){
      errs[q.key] = "Wajib diisi."
    }
  }
  return errs
}

// Field input
function Field({ q, value, onChange, error, autoFocus, firstFieldRef }){
  const base = "w-full rounded-xl border px-3 py-2 bg-white/90"
  const label = <label className="text-sm text-slate-800">{q.label}{/* semua dianggap required via validate */} *</label>

  if (q.type === "textarea") {
    return (
      <div className="space-y-1">
        {label}
        <textarea
          className={base}
          placeholder={q.placeholder}
          value={value}
          onChange={e=>onChange(e.target.value)}
          ref={autoFocus ? firstFieldRef : undefined}
          rows={4}
        />
        {error && <div className="text-xs text-red-500">{error}</div>}
      </div>
    )
  }
  if (q.type === "number") {
    return (
      <div className="space-y-1">
        {label}
        <input
          type="number"
          className={base}
          placeholder={q.placeholder}
          value={value}
          onChange={e=>onChange(e.target.value)}
          ref={autoFocus ? firstFieldRef : undefined}
        />
        {error && <div className="text-xs text-red-500">{error}</div>}
      </div>
    )
  }
  if (q.type === "date" || q.type === "time") {
    return (
      <div className="space-y-1">
        {label}
        <input
          type={q.type}
          className={base}
          value={value}
          onChange={e=>onChange(e.target.value)}
          ref={autoFocus ? firstFieldRef : undefined}
        />
        {error && <div className="text-xs text-red-500">{error}</div>}
      </div>
    )
  }
  if (q.type === "select") {
    return (
      <div className="space-y-1">
        {label}
        <select
          className={base}
          value={value}
          onChange={e=>onChange(e.target.value)}
          ref={autoFocus ? firstFieldRef : undefined}
        >
          <option value="">Pilih…</option>
          {(q.options||[]).map(op=>{
            const v = typeof op === "object" ? (op.value ?? op.label) : op
            const l = typeof op === "object" ? (op.label ?? op.value) : op
            return <option key={v} value={v}>{l}</option>
          })}
        </select>
        {error && <div className="text-xs text-red-500">{error}</div>}
      </div>
    )
  }
  return (
    <div className="space-y-1">
      {label}
      <input
        className={base}
        placeholder={q.placeholder}
        value={value}
        onChange={e=>onChange(e.target.value)}
        ref={autoFocus ? firstFieldRef : undefined}
      />
      {error && <div className="text-xs text-red-500">{error}</div>}
    </div>
  )
}

export default function QuestionDialog({
  open, onOpenChange, title, description,
  questions = [], onConfirm, summary, priceComputer
}){
  const firstFieldRef = useRef(null)
  const [answers, setAnswers] = useState({})
  const [errors, setErrors] = useState({})

  // konfigurasi layanan (opsi/qty) di dialog
  const [config, setConfig] = useState({
    quantity: summary?.config?.quantity ?? 1,
    package: summary?.config?.package ?? "",
    weight: summary?.config?.weight ?? 1,
  })

  const isSelectable = summary?.type === "selectable"
  const isPerUnit    = summary?.type === "per_unit"
  const isFixed      = summary?.type === "fixed"
  const isAllowed    = summary?.allowed !== false // default true
  const unitName     = summary?.config?.unit_name || "Unit"
  const options      = summary?.config?.options || []

  useEffect(() => {
    if (open){
      setAnswers({})
      setErrors({})
      setConfig({
        quantity: summary?.config?.quantity ?? 1,
        package: summary?.config?.package ?? (options[0]?.name || ""),
        weight: summary?.config?.weight ?? 1,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => { if (open) firstFieldRef.current?.focus?.() }, [open])

  // Harga per unit & total
  const pricePerUnit = useMemo(() => {
    return typeof priceComputer === "function" ? priceComputer(config) : Number(summary?.price || 0)
  }, [config, priceComputer, summary?.price])

  const total = useMemo(() => {
    const qty = Number(config.quantity||1)
    if (isPerUnit){
      const wt = Number(config.weight||1)
      return pricePerUnit * wt * qty
    }
    return pricePerUnit * (Number(config.quantity||1))
  }, [config, isPerUnit, pricePerUnit])

  const handleConfirm = useCallback(()=>{
    const e = validate(questions, answers)
    setErrors(e)
    if (Object.keys(e).length === 0){
      onConfirm?.(answers, config)
    }
  }, [questions, answers, config, onConfirm])

  // --- UI ---
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-900">{title}</DialogTitle>
          <DialogDescription className="text-slate-600">{description}</DialogDescription>
        </DialogHeader>

        {/* FORM: konfigurasi ringkas */}
        <div className="space-y-3">
          {/* kuantitas */}
          <div className="space-y-1">
            <label className="text-sm text-slate-800">Kuantitas *</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-xl border px-3 py-2 bg-white/90"
              value={config.quantity}
              onChange={(e)=>setConfig(c=>({...c, quantity: e.target.value}))}
              ref={firstFieldRef}
            />
          </div>

          {/* paket jika selectable */}
          {isSelectable && (
            <div className="space-y-1">
              <label className="text-sm text-slate-800">Paket *</label>
              <select
                className="w-full rounded-xl border px-3 py-2 bg-white/90"
                value={config.package}
                onChange={(e)=>setConfig(c=>({...c, package: e.target.value}))}
              >
                {(options).map(o => (
                  <option key={o.name} value={o.name}>
                    {o.name} — Rp {formatID(o.price)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* unit jika per_unit */}
          {isPerUnit && (
            <div className="space-y-1">
              <label className="text-sm text-slate-800">{unitName} *</label>
              <input
                type="number"
                min={1}
                className="w-full rounded-xl border px-3 py-2 bg-white/90"
                value={config.weight}
                onChange={(e)=>setConfig(c=>({...c, weight: e.target.value}))}
              />
              <div className="text-xs text-slate-500">
                Harga per {unitName}: Rp {formatID(summary?.price)}
              </div>
            </div>
          )}
        </div>

        {/* PERTANYAAN (selalu required) */}
        <div className="space-y-3 mt-4">
          {questions.length > 0 ? questions.map((q, idx) => (
            <Field
              key={q.key}
              q={q}
              value={answers[q.key] ?? ""}
              onChange={(val)=>setAnswers(a=>({...a, [q.key]: val}))}
              error={errors[q.key]}
              autoFocus={false}
            />
          )) : (
            <div className="text-sm text-slate-600">
              Tidak ada informasi tambahan yang diperlukan.
            </div>
          )}
        </div>

        {/* RINGKASAN DI BAWAH */}
        <div className="mt-4 rounded-2xl border bg-slate-50/80 p-4">
          {summary?.description && (
            <p className="text-sm text-slate-700 leading-relaxed mb-3">{summary.description}</p>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* unit price */}
            <div className="rounded-xl bg-white border p-3">
              <div className="text-slate-500 text-xs mb-1">
                {isPerUnit ? `Harga per ${unitName}` : isSelectable ? "Harga paket" : "Harga"}
              </div>
              <div className="font-semibold">Rp {formatID(pricePerUnit)}</div>
            </div>

            {/* quantity */}
            <div className="rounded-xl bg-white border p-3">
              <div className="text-slate-500 text-xs mb-1">Kuantitas</div>
              <div className="font-semibold">{config.quantity}</div>
            </div>

            {/* unit amount if per unit */}
            {isPerUnit && (
              <div className="rounded-xl bg-white border p-3">
                <div className="text-slate-500 text-xs mb-1">{unitName}</div>
                <div className="font-semibold">{config.weight}</div>
              </div>
            )}

            {/* jika selectable, tampilkan paket */}
            {isSelectable && config.package && (
              <div className="rounded-xl bg-white border p-3">
                <div className="text-slate-500 text-xs mb-1">Paket</div>
                <div className="font-semibold">{config.package}</div>
              </div>
            )}

            {/* TOTAL */}
            <div className="rounded-xl bg-white border p-3 col-span-2">
              <div className="text-slate-500 text-xs mb-1">Total Estimasi</div>
              <div className="text-lg font-semibold">Rp {formatID(total)}</div>
            </div>
          </div>

          {/* notice jika tidak diizinkan */}
          {!isAllowed && (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-[13px] text-amber-800">
              Status booking Anda saat ini tidak mendukung layanan ini.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" className="rounded-xl" onClick={()=>onOpenChange(false)}>Batal</Button>
          <Button
            className="rounded-xl bg-slate-900 hover:bg-black text-white"
            onClick={handleConfirm}
            disabled={!isAllowed || (questions.length > 0 && Object.keys(validate(questions, answers)).length > 0)}
            title={!isAllowed ? "Tidak tersedia untuk status booking saat ini" : undefined}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
