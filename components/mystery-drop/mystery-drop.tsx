"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowUpRight, Check, CircleAlert, LockKeyhole, PackageSearch, Sparkles, WandSparkles } from "lucide-react";
import { apiRequest } from "@/lib/api/browser";
import type { DropInput, DropProduct, MysteryDrop as Drop } from "@/lib/mystery-drop/types";

const moods = ["practical", "weird", "nostalgic", "creative", "collectible"] as const;
const dollars = (cents: number | null) => cents === null ? "Unknown" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
export function MysteryDrop() {
  const [form, setForm] = useState<DropInput>({ interests: "", budgetCents: 1500, categories: [], exclusions: "", condition: "new", delivery: "No special constraints", vibe: [] });
  const [drop, setDrop] = useState<Drop | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [error, setError] = useState("");
  async function discover(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setDrop(null); setDemoMode(false);
    try {
      const result = await apiRequest<{ drop: Drop }>("/api/mystery-drop/discover", form);
      setDrop(result.drop);
    } catch (e) { setError(e instanceof Error ? e.message : "Discovery failed. Try again."); }
    finally { setBusy(false); }
  }
  function loadDemo() {
    const now = new Date().toISOString();
    const candidates: DropProduct[] = [
      { name: "USB cassette-shaped desk speaker", merchant: "Sample Audio Supply", url: "https://example.invalid/demo/speaker", priceCents: 1200, shippingCents: 0, taxCents: 99, totalCents: 1299, deliveryEstimate: "Sample only", returnInfo: "Sample only", condition: "new", reason: "A playful retro object that also has a useful audio role for a music desk.", evidence: "Fictional sample listing for interface preview only.", score: 86 },
      { name: "Mini desktop cable maze", merchant: "Sample Gadget Co.", url: "https://example.invalid/demo/maze", priceCents: 900, shippingCents: 0, taxCents: 74, totalCents: 974, deliveryEstimate: "Sample only", returnInfo: "Sample only", condition: "new", reason: "A small oddity for a tech workspace with a retro visual cue.", evidence: "Fictional sample listing for interface preview only.", score: 74 },
    ];
    setDrop({ id: "demo-preview", ownerHash: "", createdAt: now, input: form, candidates, selected: candidates[0], status: "BLOCKED_UNSUPPORTED", events: [] });
    setDemoMode(true); setError("");
  }
  const selected = drop?.selected;
  return <main className="drop-page" id="main-content">
    <header className="drop-nav"><Link href="/" className="drop-back"><ArrowLeft size={16}/> Daymade</Link><span><span className="drop-live-dot"/> MYSTERY DROP <span className="drop-nav-index">/ 001</span></span><span className="drop-secure"><LockKeyhole size={14}/> Private session</span></header>
    <div className="drop-shell">
      <section className="drop-intro"><div className="drop-kicker"><span>DAYMADE SPECIAL PROJECTS</span><i/></div><h1>Something<br/><em>unexpected.</em></h1><p>Tell us what you love. We’ll find a real object that belongs in your orbit, even if it wasn’t on your radar.</p><div className="drop-steps"><span><b>01</b> Tune in</span><i/><span><b>02</b> Find a fit</span><i/><span><b>03</b> Your call</span></div></section>
      <section className="drop-layout">
        <form className="drop-form" onSubmit={discover}>
          <div className="drop-section-title"><span>THE BRIEF</span><small>01 — 04</small></div>
          <label className="drop-label" htmlFor="drop-interests">What are you into lately?</label><textarea id="drop-interests" required minLength={8} maxLength={1200} placeholder="Tech, retro games, music production, weird gadgets…" value={form.interests} onChange={e=>setForm({...form,interests:e.target.value})}/>
          <div className="drop-field-row"><label><span className="drop-label">Your hard spending limit</span><div className="drop-money"><span>$</span><input aria-label="Spending limit in dollars" type="number" min="1" max="1000" step="1" value={form.budgetCents/100} onChange={e=>setForm({...form,budgetCents:Math.round(Number(e.target.value||0)*100)})}/><small>USD · total</small></div></label><label><span className="drop-label">Condition</span><select value={form.condition} onChange={e=>setForm({...form,condition:e.target.value as DropInput["condition"]})}><option value="new">New only</option><option value="used">Used is fine</option><option value="either">Either</option></select></label></div>
          <label className="drop-label" htmlFor="drop-categories">Categories to lean into <small>optional</small></label><input id="drop-categories" placeholder="Audio, desk tools, collectibles…" value={form.categories.join(", ")} onChange={e=>setForm({...form,categories:e.target.value.split(",").map(v=>v.trim()).filter(Boolean).slice(0,12)})}/>
          <label className="drop-label" htmlFor="drop-exclusions">Anything to avoid? <small>optional</small></label><input id="drop-exclusions" placeholder="No clothing, no subscriptions…" value={form.exclusions} onChange={e=>setForm({...form,exclusions:e.target.value})}/>
          <label className="drop-label" htmlFor="drop-delivery">Delivery notes <small>optional</small></label><input id="drop-delivery" placeholder="Must arrive by Friday…" value={form.delivery} onChange={e=>setForm({...form,delivery:e.target.value})}/>
          <span className="drop-label">The energy <small>choose any</small></span><div className="drop-moods">{moods.map(m=><button type="button" key={m} className={form.vibe.includes(m)?"selected":""} onClick={()=>setForm({...form,vibe:form.vibe.includes(m)?form.vibe.filter(x=>x!==m):[...form.vibe,m]})}>{m}</button>)}</div>
          <div className="drop-consent"><LockKeyhole size={17}/><p>We’ll show you the exact item and its price before any authorization. Searching does not purchase anything.</p></div>
          <button className="drop-submit" disabled={busy}><span>{busy?<><PackageSearch className="drop-spin" size={18}/> Searching real listings…</>:<>Find my drop <ArrowUpRight size={18}/></>}</span><small>NO PURCHASE · NO CARD CREATED</small></button>
          {process.env.NODE_ENV !== "production"&&<button type="button" className="drop-demo" disabled={busy} onClick={loadDemo}>Load safe simulated preview <span>NO NETWORK · NO PURCHASE</span></button>}
          {busy&&<div className="drop-progress" role="status"><div className="drop-progress-line"/><b>Claude is searching real listings</b><p>This request searches current product pages, then compares the returned candidates. Its internal steps are not streamed.</p></div>}
          {error&&<div className="drop-error" role="alert"><CircleAlert size={18}/>{error}</div>}
        </form>
        <aside className="drop-aside"><div className="drop-aside-art"><div className="drop-orbit orbit-a"/><div className="drop-orbit orbit-b"/><div className="drop-glyph"><Sparkles size={32}/></div><span className="art-label art-label-a">UNEXPECTED</span><span className="art-label art-label-b">PERSONAL</span><span className="art-coordinate">41°52′N<br/>087°37′W</span></div><div className="drop-aside-copy"><div><span className="drop-aside-number">01</span><strong>A good surprise<br/>starts with you.</strong></div><p>Real products. Sourced listings. Your budget stays in charge.</p></div><div className="drop-integrations"><span>DISCOVERY</span><b><span/> CLAUDE WEB SEARCH</b><span>PAYMENT</span><b className="unsupported">FO CHECKOUT NOT AVAILABLE</b></div></aside>
      </section>
      {drop&&selected&&<section className="drop-review" aria-live="polite"><div className="drop-section-title"><span>YOUR DROP — REVIEW FIRST</span><small>{demoMode?"SIMULATED PREVIEW · NO REAL LISTINGS":`${drop.candidates.length} LISTINGS COMPARED`}</small></div>{demoMode&&<div className="drop-demo-banner"><CircleAlert size={16}/> DEMO ONLY — all product and price details below are fictional. No network request, card, authorization, or purchase.</div>}<article className="drop-product">{selected.imageUrl?<Image src={selected.imageUrl} alt="" width={126} height={112} unoptimized/>:<div className="drop-product-placeholder"><WandSparkles size={28}/></div>}<div className="drop-product-copy"><span className="drop-product-merchant">{selected.merchant} · {selected.condition.toUpperCase()}</span><h2>{selected.name}</h2><p>{selected.reason}</p><a href={selected.url} target="_blank" rel="noreferrer">View current listing <ArrowUpRight size={14}/></a></div><span className="drop-score">FIT {selected.score}</span></article>
        <div className="drop-price-grid"><div><span>Item price</span><b>{dollars(selected.priceCents)}</b></div><div><span>Shipping</span><b>{dollars(selected.shippingCents)}</b></div><div><span>Est. tax</span><b>{dollars(selected.taxCents)}</b></div><div className="total"><span>Expected total</span><b>{selected.totalCents===null?"Not verified":dollars(selected.totalCents)}</b></div></div>
        <div className="drop-review-notes"><p><Check size={16}/> <span><b>Why this one</b>{selected.evidence} {selected.deliveryEstimate?` · ${selected.deliveryEstimate}`:" · Delivery estimate unavailable"}</span></p><p><CircleAlert size={16}/> <span><b>Listing details</b>{selected.returnInfo??"Return terms unavailable from the retrieved listing."} {selected.totalCents===null?"Complete delivered cost is not verified; this is not purchaseable yet.":"The displayed total is a listing estimate; it must be rechecked at checkout."}</span></p></div>
        <div className="drop-blocked"><LockKeyhole size={19}/><div><b>{selected.totalCents===null?"Complete delivered price is unknown.":"Real checkout isn’t connected yet."}</b><p>This exact product is disclosed before authorization. {selected.totalCents===null?"Tax, shipping, or another mandatory cost is missing, so it cannot be shown as within your spending limit. ":"Fo’s connected tools do not support virtual cards or payments, so Daymade cannot accept purchase authorization or charge you. "}No purchase was attempted.</p></div></div>
        <button className="drop-authorize" disabled><LockKeyhole size={16}/> Purchase authorization unavailable</button>
        <div className="drop-alternatives"><span>OTHER FINDS</span>{drop.candidates.filter((p:DropProduct)=>p.url!==selected.url).map(p=><a key={p.url} href={p.url} target="_blank" rel="noreferrer"><span><b>{p.name}</b><small>{p.merchant} · {dollars(p.priceCents)} · FIT {p.score}</small></span><ArrowUpRight size={16}/></a>)}</div>
      </section>}
      <footer className="drop-footer"><span>DAYMADE <i>·</i> A BETTER KIND OF SURPRISE</span><span>YOUR MONEY. YOUR CALL. ALWAYS.</span></footer>
    </div>
  </main>;
}
