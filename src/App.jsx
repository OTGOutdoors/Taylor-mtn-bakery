import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

/* ─── palette & tokens ─── */
const T = {
  cream: "#FBF8F3", white: "#FFFFFF", blue: "#9DC5D8", blueSoft: "#D6EAF1", blueDeep: "#6EA8BE",
  wood: "#C8AD8A", woodLight: "#E8DCC8", woodDark: "#A08B6A", brown: "#3D3229", brownSoft: "#6B5D50",
  brownLight: "#8C7D6D", border: "#E8E0D4", success: "#7EAE8B", red: "#D4736C", redSoft: "#FDEDEC",
  yellow: "#E8C84A", yellowSoft: "#FFF8E1",
};

/* ─── CONFIG: Replace these to activate email features ─── */
const CONFIG = {
  EMAILJS_SERVICE_ID: "service_7tzdv3m",
  EMAILJS_TEMPLATE_ID: "template_svhq4ql",             // order notification → owner
  EMAILJS_ORDER_CONFIRM_ID: "template_jita741",         // order confirmation → customer
  EMAILJS_PUBLIC_KEY: "S8Y5K6z_e8e5GqjJG",
  ADMIN_PASSWORD: "Ilove2bake!",
  OWNER_EMAIL: "taylor.mtn.bakery@gmail.com",
};

const emailjsActive = () => CONFIG.EMAILJS_SERVICE_ID !== "YOUR_SERVICE_ID";

const sendEmail = async (templateId, params) => {
  if (!emailjsActive()) return true; // demo mode
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: CONFIG.EMAILJS_SERVICE_ID, template_id: templateId, user_id: CONFIG.EMAILJS_PUBLIC_KEY, template_params: params }),
    });
    return res.ok;
  } catch { return false; }
};

/* ─── SUPABASE ─── */
const supabase = createClient(
  "https://soznqphntscfjfbxadsm.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvem5xcGhudHNjZmpmYnhhZHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NTU1MzEsImV4cCI6MjA5MzQzMTUzMX0.m9h3S8S0id04qBod8IeXdojKS-zoG8WKbsJdFl4QqNY"
);

/* ─── useReviews hook ─── */
const useReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const fetchReviews = useCallback(async () => {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setReviews(data);
    setLoaded(true);
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const addReview = useCallback(async (review) => {
    const { reviewer_name, reviewer_email, rating, item, review_text, status } = review;
    const { error } = await supabase.from("reviews").insert([
      { reviewer_name, reviewer_email, rating, item, review_text, status: status || "pending" }
    ]);
    if (!error) await fetchReviews();
  }, [fetchReviews]);

  const updateReview = useCallback(async (id, updates) => {
    const { error } = await supabase.from("reviews").update(updates).eq("id", id);
    if (!error) await fetchReviews();
  }, [fetchReviews]);

  const deleteReview = useCallback(async (id) => {
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (!error) await fetchReviews();
  }, [fetchReviews]);

  const approved = reviews.filter((r) => r.status === "approved");
  const pending = reviews.filter((r) => r.status === "pending");
  const pushed = reviews.filter((r) => r.status === "pushed_back");

  const avgRating = approved.length > 0 ? (approved.reduce((s, r) => s + r.rating, 0) / approved.length).toFixed(1) : "0.0";
  const happyCount = approved.filter((r) => r.rating >= 4).length;
  const fiveStarPct = approved.length > 0 ? Math.round((approved.filter((r) => r.rating === 5).length / approved.length) * 100) : 0;

  return { reviews, approved, pending, pushed, loaded, addReview, updateReview, deleteReview, avgRating, happyCount, fiveStarPct, totalApproved: approved.length };
};

/* ─── useOrders hook ─── */
const ORDER_STATUSES = ["new", "reviewed", "waiting_on_customer", "confirmed", "in_progress", "ready_for_pickup", "completed", "cancelled"];
const ORDER_STATUS_LABELS = { new: "New", reviewed: "Reviewed", waiting_on_customer: "Waiting on Customer", confirmed: "Confirmed", in_progress: "In Progress", ready_for_pickup: "Ready for Pickup", completed: "Completed", cancelled: "Cancelled" };
const ORDER_STATUS_COLORS = { new: "#E8C84A", reviewed: "#9DC5D8", waiting_on_customer: "#D4736C", confirmed: "#7EAE8B", in_progress: "#6EA8BE", ready_for_pickup: "#C8AD8A", completed: "#5A9E6F", cancelled: "#999" };
const PAYMENT_LABELS = { unpaid: "Unpaid", deposit_paid: "Deposit Paid", paid_in_full: "Paid in Full" };
const PAYMENT_COLORS = { unpaid: "#D4736C", deposit_paid: "#E8C84A", paid_in_full: "#7EAE8B" };

const generateOrderNumber = async () => {
  const yy = new Date().getFullYear().toString().slice(-2);
  const prefix = `TMB-${yy}-`;
  const { data } = await supabase.from("orders").select("order_number").like("order_number", `${prefix}%`).order("order_number", { ascending: false }).limit(1);
  const lastNum = data && data.length > 0 && data[0].order_number ? parseInt(data[0].order_number.split("-").pop(), 10) : 0;
  return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
};

const useOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (!error && data) setOrders(data);
    setLoaded(true);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateOrder = useCallback(async (id, updates) => {
    const { error } = await supabase.from("orders").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) await fetchOrders();
  }, [fetchOrders]);

  const deleteOrder = useCallback(async (id) => {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (!error) await fetchOrders();
  }, [fetchOrders]);

  const countByStatus = (status) => orders.filter((o) => o.order_status === status).length;

  const orderNeedsAttention = (o) => {
    const now = new Date();
    const updated = new Date(o.updated_at || o.created_at);
    const daysSinceUpdate = (now - updated) / (1000 * 60 * 60 * 24);
    const eventDate = o.event_date ? new Date(o.event_date) : null;
    const daysUntilEvent = eventDate ? (eventDate - now) / (1000 * 60 * 60 * 24) : null;

    if (o.order_status === "new" && daysSinceUpdate >= 2) return "New for " + Math.floor(daysSinceUpdate) + "d — needs review";
    if (o.order_status === "reviewed" && daysSinceUpdate >= 2) return "Reviewed " + Math.floor(daysSinceUpdate) + "d ago — reach out to customer";
    if (o.order_status === "waiting_on_customer" && daysSinceUpdate >= 3) return "Waiting " + Math.floor(daysSinceUpdate) + "d — follow up with customer";
    if (o.order_status === "confirmed" && daysUntilEvent !== null && daysUntilEvent <= 7) return "Event in " + Math.max(0, Math.ceil(daysUntilEvent)) + "d — move to In Progress";
    if (["new", "reviewed", "waiting_on_customer"].includes(o.order_status) && daysUntilEvent !== null && daysUntilEvent <= 3) return "Event in " + Math.max(0, Math.ceil(daysUntilEvent)) + "d — urgent!";
    return null;
  };

  const attentionOrders = orders.filter((o) => orderNeedsAttention(o));
  const attentionCount = attentionOrders.length;

  return { orders, loaded, updateOrder, deleteOrder, fetchOrders, countByStatus, orderNeedsAttention, attentionCount };
};

/* ─── Google Fonts ─── */
const FontLoader = () => {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Outfit:wght@300;400;500;600&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);
  return null;
};

/* ─── reusable components ─── */
const Badge = ({ children, color }) => (
  <span style={{ display: "inline-block", padding: "6px 16px", background: color === "red" ? T.redSoft : color === "yellow" ? T.yellowSoft : T.blueSoft, color: color === "red" ? T.red : color === "yellow" ? "#B8860B" : T.blueDeep, borderRadius: "20px", fontSize: "13px", fontFamily: "Outfit, sans-serif", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>{children}</span>
);

const SectionTitle = ({ badge, title, subtitle }) => (
  <div style={{ textAlign: "center", marginBottom: "48px" }}>
    {badge && <div style={{ marginBottom: "16px" }}><Badge>{badge}</Badge></div>}
    <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 500, color: T.brown, margin: "0 0 12px 0", lineHeight: 1.2 }}>{title}</h2>
    {subtitle && <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "16px", color: T.brownLight, maxWidth: "520px", margin: "0 auto", lineHeight: 1.6 }}>{subtitle}</p>}
  </div>
);

const Btn = ({ children, onClick, variant = "primary", style: sx, type, disabled }) => {
  const base = { fontFamily: "Outfit, sans-serif", fontWeight: 500, fontSize: "15px", padding: "14px 32px", borderRadius: "8px", border: "none", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.3s ease", letterSpacing: "0.02em", opacity: disabled ? 0.5 : 1 };
  const styles = variant === "primary" ? { ...base, background: T.blue, color: T.white, ...sx }
    : variant === "danger" ? { ...base, background: T.red, color: T.white, ...sx }
    : variant === "outline" ? { ...base, background: "transparent", color: T.brown, border: `1.5px solid ${T.border}`, ...sx }
    : { ...base, background: T.woodLight, color: T.brown, ...sx };
  return <button type={type} style={styles} onClick={disabled ? undefined : onClick} disabled={disabled}>{children}</button>;
};

const Divider = () => <div style={{ width: "60px", height: "3px", background: `linear-gradient(90deg, ${T.blue}, ${T.woodLight})`, margin: "0 auto", borderRadius: "2px" }} />;

const StarSelector = ({ rating, setRating, size = 24 }) => (
  <div style={{ display: "flex", gap: "4px" }}>
    {[1, 2, 3, 4, 5].map((s) => (
      <button key={s} onClick={() => setRating(s)} type="button" style={{ background: "none", border: "none", cursor: "pointer", padding: "2px" }}>
        <svg width={size} height={size} viewBox="0 0 18 18" fill={s <= rating ? T.wood : T.border}>
          <path d="M9 1l2.47 5.01L17 6.76l-4 3.9.94 5.5L9 13.77l-4.94 2.6.94-5.5-4-3.9 5.53-.76L9 1z" />
        </svg>
      </button>
    ))}
  </div>
);

const StarDisplay = ({ rating, size = 18 }) => (
  <div style={{ display: "flex", gap: "2px" }}>
    {[1, 2, 3, 4, 5].map((s) => (
      <svg key={s} width={size} height={size} viewBox="0 0 18 18" fill={s <= rating ? T.wood : T.border}>
        <path d="M9 1l2.47 5.01L17 6.76l-4 3.9.94 5.5L9 13.77l-4.94 2.6.94-5.5-4-3.9 5.53-.76L9 1z" />
      </svg>
    ))}
  </div>
);

/* ─── SVG icons ─── */
const Icons = {
  cookie: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" stroke={T.wood} strokeWidth="2" fill={T.woodLight} /><circle cx="14" cy="14" r="2.5" fill={T.woodDark} /><circle cx="24" cy="12" r="2" fill={T.woodDark} /><circle cx="18" cy="24" r="2.5" fill={T.woodDark} /><circle cx="27" cy="22" r="2" fill={T.woodDark} /><circle cx="12" cy="22" r="1.5" fill={T.woodDark} /></svg>,
  cupcake: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M12 22h16v12c0 2-2 4-4 4H16c-2 0-4-2-4-4V22z" fill={T.woodLight} stroke={T.wood} strokeWidth="1.5" /><path d="M10 22c0-7 4-12 10-12s10 5 10 12H10z" fill={T.blueSoft} stroke={T.blue} strokeWidth="1.5" /><circle cx="20" cy="8" r="2" fill={T.blue} /></svg>,
  cake: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="6" y="18" width="28" height="16" rx="3" fill={T.woodLight} stroke={T.wood} strokeWidth="1.5" /><rect x="10" y="12" width="20" height="8" rx="2" fill={T.blueSoft} stroke={T.blue} strokeWidth="1.5" /><rect x="18" y="6" width="4" height="8" rx="1" fill={T.wood} /><circle cx="20" cy="5" r="2" fill={T.blue} /></svg>,
  mail: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 4L12 13 2 4" /></svg>,
  pin: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  facebook: <svg width="24" height="24" viewBox="0 0 24 24" fill={T.brownSoft}><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" /></svg>,
  instagram: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.brownSoft} strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r="1.5" fill={T.brownSoft} stroke="none" /></svg>,
  wheat: <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="10" y="9" width="12" height="8" rx="1.5" fill={T.woodLight} stroke={T.wood} strokeWidth="1.3"/><path d="M11.5 9h9a1.5 1.5 0 011.5 1.5V13H10v-2.5A1.5 1.5 0 0111.5 9z" fill={T.blueSoft}/><rect x="7" y="16.5" width="18" height="9" rx="1.5" fill={T.woodLight} stroke={T.wood} strokeWidth="1.3"/><path d="M8.5 16.5h15a1.5 1.5 0 011.5 1.5V21H7v-3a1.5 1.5 0 011.5-1.5z" fill={T.blueSoft}/><path d="M10 12.5c1.5-.6 3.5-1 6-1s4.5.4 6 1" stroke={T.woodDark} strokeWidth="1" fill="none" strokeLinecap="round"/><path d="M7 20.5c2.5-.8 5.5-1.2 9-1.2s6.5.4 9 1.2" stroke={T.woodDark} strokeWidth="1" fill="none" strokeLinecap="round"/></svg>,
  star: <svg width="18" height="18" viewBox="0 0 18 18" fill={T.wood}><path d="M9 1l2.47 5.01L17 6.76l-4 3.9.94 5.5L9 13.77l-4.94 2.6.94-5.5-4-3.9 5.53-.76L9 1z" /></svg>,
  check: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={T.success} strokeWidth="2.5" strokeLinecap="round"><path d="M4 10l4 4 8-8" /></svg>,
  menu: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke={T.brown} strokeWidth="2" strokeLinecap="round"><path d="M4 8h20M4 14h20M4 20h20" /></svg>,
  close: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke={T.brown} strokeWidth="2" strokeLinecap="round"><path d="M6 6l16 16M22 6L6 22" /></svg>,
  camera: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.blueDeep} strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>,
  arrowRight: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>,
  quote: <svg width="32" height="32" viewBox="0 0 32 32" fill={T.blueSoft}><path d="M6 18c0-3.3 2.7-6 6-6V8C6.5 8 2 12.5 2 18v8h12v-8H6zm16 0c0-3.3 2.7-6 6-6V8c-5.5 0-10 4.5-10 10v8h12v-8h-8z" /></svg>,
  alert: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round"><circle cx="10" cy="10" r="8" /><path d="M10 6v4M10 14h.01" /></svg>,
  shield: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.blueDeep} strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  pastry: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M8 28c0-2 4-4 12-4s12 2 12 4v4H8v-4z" fill={T.woodLight} stroke={T.wood} strokeWidth="1.5" /><path d="M12 24c0-6 3-10 8-10s8 4 8 10" fill={T.blueSoft} stroke={T.blue} strokeWidth="1.5" /><path d="M14 18c-3-1-5-4-5-4s3 0 5 2" stroke={T.wood} strokeWidth="1.5" strokeLinecap="round" /><path d="M26 18c3-1 5-4 5-4s-3 0-5 2" stroke={T.wood} strokeWidth="1.5" strokeLinecap="round" /></svg>,
};

const inputStyle = { fontFamily: "Outfit, sans-serif", fontSize: "15px", padding: "14px 16px", borderRadius: "10px", border: `1.5px solid ${T.border}`, background: T.white, color: T.brown, outline: "none", width: "100%", boxSizing: "border-box", transition: "border-color 0.2s" };
const labelStyle = { fontFamily: "Outfit, sans-serif", fontSize: "14px", fontWeight: 500, color: T.brownSoft, marginBottom: "6px", display: "block" };

/* ═══════════════════════  NAV  ═══════════════════════ */
const Nav = ({ page, setPage }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 40); window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h); }, []);
  const links = ["Home", "Order", "Gallery", "Reviews", "About", "Contact"];
  return (
    <>
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, background: scrolled ? "rgba(251,248,243,0.95)" : "transparent", backdropFilter: scrolled ? "blur(12px)" : "none", borderBottom: scrolled ? `1px solid ${T.border}` : "1px solid transparent", transition: "all 0.4s ease", padding: scrolled ? "12px 0" : "20px 0" }}>
        <div style={{ width: "100%", margin: "0 auto", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div onClick={() => { setPage("Home"); window.scrollTo(0, 0); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
            {Icons.wheat}
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 600, color: T.brown }}>Taylor Mountain Bakery</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }} className="desktop-nav">
            {links.map((l) => (
              <button key={l} onClick={() => { setPage(l); window.scrollTo(0, 0); }}
                style={{ fontFamily: "Outfit, sans-serif", fontWeight: page === l ? 500 : 400, fontSize: "14px", color: page === l ? T.blueDeep : T.brownSoft, background: page === l ? T.blueSoft : "transparent", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", transition: "all 0.25s" }}
              >{l}</button>
            ))}
            <Btn onClick={() => { setPage("Order"); window.scrollTo(0, 0); }} style={{ marginLeft: "6px", padding: "10px 22px", fontSize: "14px" }}>Order Now</Btn>
          </div>
          <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} style={{ background: "none", border: "none", cursor: "pointer", display: "none" }}>{mobileOpen ? Icons.close : Icons.menu}</button>
        </div>
      </nav>
      {mobileOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(251,248,243,0.98)", zIndex: 999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "24px" }}>
          {links.map((l) => <button key={l} onClick={() => { setPage(l); window.scrollTo(0, 0); setMobileOpen(false); }} style={{ fontFamily: "'Fraunces', serif", fontSize: "28px", fontWeight: 400, color: page === l ? T.blueDeep : T.brown, background: "none", border: "none", cursor: "pointer" }}>{l}</button>)}
        </div>
      )}
      <style>{`@media(max-width:768px){.desktop-nav{display:none!important}.mobile-toggle{display:block!important}}`}</style>
    </>
  );
};

/* ═══════════════════════  FOOTER  ═══════════════════════ */
const Footer = ({ setPage, pendingCount, newOrderCount, attentionCount }) => (
  <footer style={{ background: T.brown, color: T.woodLight, padding: "64px 24px 32px" }}>
    <div style={{ maxWidth: "1600px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "40px" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="10" y="9" width="12" height="8" rx="1.5" fill={T.woodLight} stroke={T.wood} strokeWidth="1.3"/><path d="M11.5 9h9a1.5 1.5 0 011.5 1.5V13H10v-2.5A1.5 1.5 0 0111.5 9z" fill={T.blueSoft}/><rect x="7" y="16.5" width="18" height="9" rx="1.5" fill={T.woodLight} stroke={T.wood} strokeWidth="1.3"/><path d="M8.5 16.5h15a1.5 1.5 0 011.5 1.5V21H7v-3a1.5 1.5 0 011.5-1.5z" fill={T.blueSoft}/><path d="M10 12.5c1.5-.6 3.5-1 6-1s4.5.4 6 1" stroke={T.woodDark} strokeWidth="1" fill="none" strokeLinecap="round"/><path d="M7 20.5c2.5-.8 5.5-1.2 9-1.2s6.5.4 9 1.2" stroke={T.woodDark} strokeWidth="1" fill="none" strokeLinecap="round"/></svg>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", fontWeight: 600, color: T.cream }}>Taylor Mountain Bakery</span>
        </div>
        <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", lineHeight: 1.7, color: T.brownLight, maxWidth: "280px" }}>Homemade with love from our kitchen to your table. Cookies, cakes, pastries &amp; more — serving our community one sweet treat at a time.</p>
      </div>
      <div>
        <h4 style={{ fontFamily: "'Fraunces', serif", fontSize: "16px", color: T.cream, marginBottom: "16px" }}>Quick Links</h4>
        {["Home", "Order", "Gallery", "Reviews", "About", "Contact"].map((l) => (
          <div key={l} style={{ marginBottom: "8px" }}><button onClick={() => { setPage(l); window.scrollTo(0, 0); }} style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", color: T.brownLight, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.2s" }} onMouseEnter={(e) => (e.target.style.color = T.blue)} onMouseLeave={(e) => (e.target.style.color = T.brownLight)}>{l}</button></div>
        ))}
      </div>
      <div style={{ textAlign: "right" }}>
        <h4 style={{ fontFamily: "'Fraunces', serif", fontSize: "16px", color: T.cream, marginBottom: "16px" }}>Follow Along</h4>
        <div style={{ display: "flex", gap: "16px", justifyContent: "flex-end" }}>
          {[{ href: "https://www.facebook.com/profile.php?id=61562435145114", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill={T.woodLight}><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" /></svg> }, { href: "https://www.instagram.com/taylormtnbakery/", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.woodLight} strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r="1.5" fill={T.woodLight} stroke="none" /></svg> }].map((s, i) => (
            <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" style={{ width: "44px", height: "44px", borderRadius: "10px", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")} onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}>{s.icon}</a>
          ))}
        </div>
        {/* Admin link */}
        <button onClick={() => { setPage("Admin"); window.scrollTo(0, 0); }}
          style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.2)", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: "24px", display: "flex", alignItems: "center", gap: "6px", transition: "color 0.2s", marginLeft: "auto" }}
          onMouseEnter={(e) => (e.target.style.color = "rgba(255,255,255,0.5)")} onMouseLeave={(e) => (e.target.style.color = "rgba(255,255,255,0.2)")}
        >
          {Icons.shield} Owner Dashboard {attentionCount > 0 && <span style={{ background: "#D4736C", color: T.white, fontSize: "11px", fontWeight: 600, padding: "2px 7px", borderRadius: "10px", marginLeft: "4px" }}>{attentionCount}</span>}{newOrderCount > 0 && <span style={{ background: T.blue, color: T.brown, fontSize: "11px", fontWeight: 600, padding: "2px 7px", borderRadius: "10px", marginLeft: "4px" }}>{newOrderCount}</span>}{pendingCount > 0 && <span style={{ background: T.cream, color: T.brown, fontSize: "11px", fontWeight: 600, padding: "2px 7px", borderRadius: "10px", marginLeft: "4px", border: `1px solid ${T.border}` }}>{pendingCount}</span>}
        </button>
      </div>
    </div>
    <div style={{ maxWidth: "1600px", margin: "48px auto 0", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center", fontFamily: "Outfit, sans-serif", fontSize: "13px", color: T.brownLight }}>© 2026 Taylor Mountain Bakery · Made with love, for those you love!</div>
  </footer>
);

/* ═══════════════════════  HOME PAGE  ═══════════════════════ */
const HomePage = ({ setPage }) => (
  <div>
    <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(170deg, ${T.cream} 0%, ${T.white} 40%, ${T.blueSoft} 100%)`, position: "relative", overflow: "hidden", padding: "120px 24px 80px" }}>
      <div style={{ position: "absolute", top: "-80px", right: "-80px", width: "300px", height: "300px", borderRadius: "50%", background: T.blueSoft, opacity: 0.3 }} />
      <div style={{ position: "absolute", bottom: "-40px", left: "-60px", width: "200px", height: "200px", borderRadius: "50%", background: T.woodLight, opacity: 0.25 }} />
      <div style={{ textAlign: "center", maxWidth: "720px", position: "relative", zIndex: 1 }}>
        <Badge>Small Town · Big Flavor</Badge>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(40px, 8vw, 72px)", fontWeight: 500, color: T.brown, margin: "24px 0", lineHeight: 1.1 }}>Baked Fresh, <span style={{ color: T.blueDeep, fontStyle: "italic" }}>With Love</span></h1>
        <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "18px", color: T.brownSoft, lineHeight: 1.7, maxWidth: "520px", margin: "0 auto 40px" }}>Handcrafted cookies, cupcakes, custom cakes, pastries &amp; more — all made from scratch in our small-town kitchen. Every order is baked with love, for those you love.</p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <Btn onClick={() => { setPage("Order"); window.scrollTo(0, 0); }}>Place a Custom Order</Btn>
          <Btn variant="outline" onClick={() => { setPage("About"); window.scrollTo(0, 0); }}>Our Story</Btn>
        </div>
      </div>
    </section>
    <section style={{ padding: "96px 24px", background: T.white }}>
      <div style={{ width: "100%", margin: "0 auto" }}>
        <SectionTitle badge="Our Specialties" title="What We Bake" subtitle="From classic chocolate chip cookies to buttery croissants, every treat is made from scratch with quality ingredients." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "24px" }}>
          {[{ icon: Icons.cookie, title: "Cookies", desc: "Classic favorites and creative flavors, baked golden and chewy. Perfect by the dozen for any occasion.", items: ["Chocolate Chip", "Sugar Cookies", "Snickerdoodle", "Seasonal Specials"] }, { icon: Icons.cupcake, title: "Cupcakes", desc: "Fluffy, flavorful and beautifully topped. Available in a variety of flavors with custom decorating options.", items: ["Vanilla Bean", "Rich Chocolate", "Red Velvet", "Lemon Blueberry"] }, { icon: Icons.cake, title: "Custom Cakes", desc: "Designed just for you. Birthday cakes, celebration cakes, and everything in between — made to order.", items: ["Birthday Cakes", "Celebration Cakes", "Themed Designs", "All Sizes"] }, { icon: Icons.pastry, title: "Pastries & More", desc: "From flaky croissants to sweet confections, we're always exploring new creations fresh from the oven.", items: ["Croissants", "Cinnamon Rolls", "Danishes", "Sweet Confections"] }].map((item) => (
            <div key={item.title} style={{ background: T.cream, borderRadius: "16px", padding: "40px 32px", border: `1px solid ${T.border}`, transition: "transform 0.3s, box-shadow 0.3s" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(61,50,41,0.08)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
              <div style={{ marginBottom: "20px" }}>{item.icon}</div>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", fontWeight: 500, color: T.brown, marginBottom: "12px" }}>{item.title}</h3>
              <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "15px", color: T.brownLight, lineHeight: 1.7, marginBottom: "20px" }}>{item.desc}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>{item.items.map((i) => <span key={i} style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", padding: "4px 12px", background: T.white, borderRadius: "12px", color: T.brownSoft, border: `1px solid ${T.border}` }}>{i}</span>)}</div>
            </div>
          ))}
        </div>
        <div onClick={() => { setPage("Gallery"); window.scrollTo(0, 0); }} style={{ marginTop: "56px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "24px", padding: "28px 32px", borderRadius: "16px", background: `linear-gradient(135deg, ${T.cream} 0%, ${T.blueSoft}44 50%, ${T.woodLight}66 100%)`, border: `1px dashed ${T.border}`, transition: "all 0.35s", maxWidth: "600px", margin: "56px auto 0" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = ""; }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", flexShrink: 0 }}>{[T.woodLight, T.blueSoft, T.woodLight, T.blueSoft, T.woodLight, T.blueSoft].map((c, i) => <div key={i} style={{ width: "36px", height: "36px", borderRadius: "6px", background: c, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.7 + i * 0.05 }}>{i === 4 && Icons.camera}</div>)}</div>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", fontWeight: 500, color: T.brown, marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}>Peek inside our kitchen {Icons.arrowRight}</div>
            <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", color: T.brownLight }}>Browse photos of our cookies, cupcakes, cakes, pastries &amp; more</div>
          </div>
        </div>
      </div>
    </section>
    <section style={{ padding: "96px 24px", background: `linear-gradient(135deg, ${T.blueSoft} 0%, ${T.white} 50%, ${T.woodLight} 100%)`, textAlign: "center" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 500, color: T.brown, marginBottom: "16px" }}>Ready to Order Something Sweet?</h2>
        <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "16px", color: T.brownSoft, lineHeight: 1.7, marginBottom: "32px" }}>Whether it's a dozen cookies for Friday night, fresh croissants for brunch, or a custom cake for a special celebration, we'd love to bake for you.</p>
        <Btn onClick={() => { setPage("Order"); window.scrollTo(0, 0); }}>Place Your Order</Btn>
      </div>
    </section>
  </div>
);

/* ═══════════════════════  GALLERY PAGE  ═══════════════════════ */
const galleryItems = [
  { id: 1, category: "Cookies", label: "Decorated Sugar Cookies", color: `linear-gradient(135deg, ${T.woodLight}, ${T.cream})`, emoji: "🍪" },
  { id: 2, category: "Custom Cakes", label: "Floral Birthday Cake", color: `linear-gradient(135deg, ${T.blueSoft}, ${T.cream})`, emoji: "🎂" },
  { id: 3, category: "Cupcakes", label: "Vanilla Bean Cupcakes", color: `linear-gradient(135deg, ${T.cream}, ${T.woodLight})`, emoji: "🧁" },
  { id: 4, category: "Custom Cakes", label: "Rustic Wedding Cake", color: `linear-gradient(135deg, ${T.woodLight}, ${T.blueSoft})`, emoji: "🎂" },
  { id: 5, category: "Cookies", label: "Holiday Cookie Box", color: `linear-gradient(135deg, ${T.blueSoft}, ${T.woodLight})`, emoji: "🍪" },
  { id: 6, category: "Cupcakes", label: "Chocolate Fudge Cupcakes", color: `linear-gradient(135deg, ${T.woodLight}, ${T.cream})`, emoji: "🧁" },
  { id: 7, category: "Custom Cakes", label: "Graduation Cake", color: `linear-gradient(135deg, ${T.cream}, ${T.blueSoft})`, emoji: "🎂" },
  { id: 8, category: "Cookies", label: "Snickerdoodle Platter", color: `linear-gradient(135deg, ${T.woodLight}, ${T.cream})`, emoji: "🍪" },
  { id: 9, category: "Cupcakes", label: "Lemon Blueberry Cupcakes", color: `linear-gradient(135deg, ${T.blueSoft}, ${T.cream})`, emoji: "🧁" },
  { id: 10, category: "Pastries & More", label: "Butter Croissants", color: `linear-gradient(135deg, ${T.woodLight}, ${T.cream})`, emoji: "🥐" },
  { id: 11, category: "Pastries & More", label: "Cinnamon Rolls", color: `linear-gradient(135deg, ${T.cream}, ${T.woodLight})`, emoji: "🍥" },
  { id: 12, category: "Pastries & More", label: "Fruit Danish Platter", color: `linear-gradient(135deg, ${T.blueSoft}, ${T.woodLight})`, emoji: "🥐" },
];
const heights = [260, 320, 240, 300, 280, 340, 250, 310, 270, 290, 260, 320];

const GalleryPage = ({ setPage }) => {
  const [filter, setFilter] = useState("All");
  const [sel, setSel] = useState(null);
  const filtered = filter === "All" ? galleryItems : galleryItems.filter((g) => g.category === filter);
  return (
    <div style={{ paddingTop: "100px" }}>
      <section style={{ padding: "40px 24px 0", background: `linear-gradient(180deg, ${T.woodLight}88 0%, ${T.cream} 100%)`, textAlign: "center" }}>
        <Badge>Our Creations</Badge>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(32px, 6vw, 48px)", fontWeight: 500, color: T.brown, margin: "20px 0 12px" }}>Gallery</h1>
        <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "16px", color: T.brownSoft, maxWidth: "500px", margin: "0 auto 36px", lineHeight: 1.7 }}>A peek at some of our favorite bakes. Each one made from scratch with love.</p>
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap", marginBottom: "48px" }}>
          {["All", "Cookies", "Cupcakes", "Custom Cakes", "Pastries & More"].map((c) => <button key={c} onClick={() => setFilter(c)} style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", fontWeight: filter === c ? 500 : 400, padding: "8px 20px", borderRadius: "20px", border: `1.5px solid ${filter === c ? T.blue : T.border}`, background: filter === c ? T.blueSoft : T.white, color: filter === c ? T.blueDeep : T.brownSoft, cursor: "pointer", transition: "all 0.25s" }}>{c}</button>)}
        </div>
      </section>
      <section style={{ padding: "0 24px 96px", background: T.cream }}>
        <div style={{ width: "100%", margin: "0 auto" }}>
          <div style={{ columns: "4 280px", columnGap: "20px" }}>
            {filtered.map((item, idx) => (
              <div key={item.id} onClick={() => setSel(item)} style={{ breakInside: "avoid", marginBottom: "20px", borderRadius: "14px", overflow: "hidden", cursor: "pointer", transition: "transform 0.3s, box-shadow 0.3s", border: `1px solid ${T.border}`, background: T.white }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(61,50,41,0.1)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                <div style={{ height: `${heights[idx % heights.length]}px`, background: item.color, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <span style={{ fontSize: "48px" }}>{item.emoji}</span>
                  <div style={{ position: "absolute", bottom: "12px", left: "12px", padding: "4px 12px", background: "rgba(255,255,255,0.85)", borderRadius: "8px", fontFamily: "Outfit, sans-serif", fontSize: "11px", fontWeight: 500, color: T.brownSoft, display: "flex", alignItems: "center", gap: "6px" }}>{Icons.camera} Your photo here</div>
                </div>
                <div style={{ padding: "16px 18px" }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "16px", fontWeight: 500, color: T.brown, marginBottom: "4px" }}>{item.label}</div>
                  <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", color: T.brownLight }}>{item.category}</div>
                </div>
              </div>
            ))}
          </div>
          {sel && (
            <div onClick={() => setSel(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(61,50,41,0.6)", backdropFilter: "blur(8px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: T.white, borderRadius: "20px", maxWidth: "560px", width: "100%", overflow: "hidden", boxShadow: "0 24px 80px rgba(61,50,41,0.2)" }}>
                <div style={{ height: "320px", background: sel.color, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}><span style={{ fontSize: "80px" }}>{sel.emoji}</span><button onClick={() => setSel(null)} style={{ position: "absolute", top: "16px", right: "16px", width: "36px", height: "36px", borderRadius: "50%", background: "rgba(255,255,255,0.8)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{Icons.close}</button></div>
                <div style={{ padding: "28px 32px" }}><Badge>{sel.category}</Badge><h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "26px", fontWeight: 500, color: T.brown, margin: "12px 0 8px" }}>{sel.label}</h3><p style={{ fontFamily: "Outfit, sans-serif", fontSize: "15px", color: T.brownLight, lineHeight: 1.7, marginBottom: "20px" }}>Made from scratch with quality ingredients and a whole lot of love.</p><Btn onClick={() => { setSel(null); setPage("Order"); window.scrollTo(0, 0); }}>Order Something Like This</Btn></div>
              </div>
            </div>
          )}
          <div style={{ textAlign: "center", marginTop: "56px" }}><Divider /><p style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", fontStyle: "italic", color: T.brownSoft, margin: "28px 0" }}>Love what you see? Let's create something special for you.</p><Btn onClick={() => { setPage("Order"); window.scrollTo(0, 0); }}>Place a Custom Order</Btn></div>
        </div>
      </section>
    </div>
  );
};

/* ═══════════════════════  REVIEWS PAGE  ═══════════════════════ */
const ReviewsPage = ({ setPage, reviewsHook }) => {
  const { approved, addReview, avgRating, happyCount, fiveStarPct, totalApproved, loaded } = reviewsHook;
  const [showCount, setShowCount] = useState(6);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", rating: 0, item: "", text: "" });
  const [submitStatus, setSubmitStatus] = useState("idle");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.rating === 0) return;
    setSubmitStatus("sending");
    const displayName = form.lastName ? `${form.firstName} ${form.lastName.charAt(0)}.` : form.firstName;
    const review = { reviewer_name: displayName, reviewer_email: form.email, rating: form.rating, item: form.item, review_text: form.text, status: "pending" };
    await addReview(review);

    setSubmitStatus("success");
    setForm({ firstName: "", lastName: "", email: "", rating: 0, item: "", text: "" });
  };

  if (!loaded) return <div style={{ paddingTop: "200px", textAlign: "center", fontFamily: "Outfit, sans-serif", color: T.brownLight }}>Loading reviews...</div>;

  return (
    <div style={{ paddingTop: "100px" }}>
      <section style={{ padding: "40px 24px 0", background: `linear-gradient(180deg, ${T.blueSoft} 0%, ${T.cream} 100%)`, textAlign: "center" }}>
        <Badge>Testimonials</Badge>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(32px, 6vw, 48px)", fontWeight: 500, color: T.brown, margin: "20px 0 12px" }}>What People Are Saying</h1>
        <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "16px", color: T.brownSoft, maxWidth: "500px", margin: "0 auto 40px", lineHeight: 1.7 }}>Don't just take our word for it — hear from the folks in our community.</p>
      </section>
      <section style={{ padding: "48px 24px 96px", background: T.cream }}>
        <div style={{ width: "100%", margin: "0 auto" }}>
          {/* Auto-calculated stats */}
          <div style={{ background: T.white, borderRadius: "16px", padding: "32px 40px", border: `1px solid ${T.border}`, marginBottom: "48px", display: "flex", alignItems: "center", justifyContent: "center", gap: "48px", flexWrap: "wrap", maxWidth: "700px", margin: "0 auto 48px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "36px", fontWeight: 600, color: T.brown }}>{avgRating}</div>
              <StarDisplay rating={Math.round(parseFloat(avgRating))} />
              <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", color: T.brownLight, marginTop: "6px" }}>Average Rating</div>
            </div>
            <div style={{ width: "1px", height: "48px", background: T.border }} className="stat-divider" />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "36px", fontWeight: 600, color: T.brown }}>{happyCount}</div>
              <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", color: T.brownLight, marginTop: "6px" }}>Happy Customers</div>
            </div>
            <div style={{ width: "1px", height: "48px", background: T.border }} className="stat-divider" />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "36px", fontWeight: 600, color: T.brown }}>{fiveStarPct}%</div>
              <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", color: T.brownLight, marginTop: "6px" }}>5-Star Reviews</div>
            </div>
          </div>

          {/* Approved review cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 400px))", gap: "24px", justifyContent: "center" }}>
            {approved.slice(0, showCount).map((r) => (
              <div key={r.id} style={{ background: T.white, borderRadius: "16px", padding: "28px", border: `1px solid ${T.border}`, display: "flex", flexDirection: "column", transition: "transform 0.25s, box-shadow 0.25s" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(61,50,41,0.06)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                <StarDisplay rating={r.rating} />
                <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "15px", color: T.brownSoft, lineHeight: 1.7, flex: 1, marginBottom: "18px", marginTop: "14px" }}>{r.review_text}</p>
                <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: "15px", fontWeight: 500, color: T.brown }}>{r.reviewer_name}</div>
                  </div>
                  {r.item && <span style={{ fontFamily: "Outfit, sans-serif", fontSize: "11px", padding: "4px 10px", background: T.blueSoft, borderRadius: "8px", color: T.blueDeep }}>{r.item}</span>}
                </div>
              </div>
            ))}
          </div>
          {showCount < approved.length && <div style={{ textAlign: "center", marginTop: "40px" }}><Btn variant="outline" onClick={() => setShowCount((c) => c + 6)}>Show More Reviews</Btn></div>}

          {/* Submit a Review */}
          <div style={{ marginTop: "64px", background: T.white, borderRadius: "16px", padding: "40px", border: `1px solid ${T.border}`, maxWidth: "700px", margin: "64px auto 0" }}>
            {submitStatus === "success" ? (
              <div style={{ textAlign: "center", padding: "32px 16px" }}>
                <div style={{ marginBottom: "16px" }}><svg width="48" height="48" viewBox="0 0 24 24" fill={T.blue} xmlns="http://www.w3.org/2000/svg"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>
                <h3 style={{ fontFamily: "Outfit, sans-serif", fontSize: "26px", fontWeight: 600, color: T.brown, marginBottom: "16px" }}>You Just Made Our Day!</h3>
                <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "16px", color: T.brownSoft, lineHeight: 1.8, maxWidth: "460px", margin: "0 auto 12px" }}>As a small bakery run by a high school junior right here in Vernal, every single review means the world to us. Your kind words keep us inspired to wake up early, mix the batter, and bake with love.</p>
                <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "15px", color: T.brownLight, lineHeight: 1.7, maxWidth: "460px", margin: "0 auto 24px", fontStyle: "italic" }}>Your review will appear on our page after a quick look. Thank you for supporting a local dream!</p>
                <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                  <Btn variant="outline" onClick={() => setSubmitStatus("idle")}>Write Another Review</Btn>
                </div>
              </div>
            ) : !showForm ? (
              <div style={{ textAlign: "center" }}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", fontWeight: 500, color: T.brown, marginBottom: "12px" }}>Enjoyed Your Order?</h3>
                <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "15px", color: T.brownSoft, lineHeight: 1.7, maxWidth: "440px", margin: "0 auto 24px" }}>We'd love to hear about it! Share your experience and help others discover Taylor Mountain Bakery.</p>
                <Btn onClick={() => setShowForm(true)}>Leave a Review</Btn>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 500, color: T.brown, marginBottom: "28px" }}>Share Your Experience</h3>
                <div style={{ marginBottom: "20px" }}>
                  <label style={labelStyle}>Your Rating *</label>
                  <StarSelector rating={form.rating} setRating={(r) => setForm({ ...form, rating: r })} size={32} />
                  {form.rating > 0 && <span style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", color: T.brownLight, marginLeft: "12px" }}>{form.rating === 5 ? "Amazing!" : form.rating === 4 ? "Great!" : form.rating === 3 ? "Good" : form.rating === 2 ? "Fair" : "Poor"}</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  <div><label style={labelStyle}>First Name *</label><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required style={inputStyle} placeholder="Jane" onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
                  <div><label style={labelStyle}>Last Name *</label><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required style={inputStyle} placeholder="Smith" onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
                </div>
                <div style={{ marginBottom: "16px" }}><label style={labelStyle}>Email Address *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required style={inputStyle} placeholder="jane@email.com" onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
                <div style={{ marginBottom: "16px" }}><label style={labelStyle}>What Did You Order?</label><input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} style={inputStyle} placeholder="e.g. Chocolate Chip Cookies, Croissants, Custom Cake" onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
                <div style={{ marginBottom: "24px" }}><label style={labelStyle}>Your Review *</label><textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} required rows={4} style={{ ...inputStyle, resize: "vertical" }} placeholder="Tell us about your experience..." onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <Btn type="submit" disabled={form.rating === 0 || submitStatus === "sending"}>{submitStatus === "sending" ? "Submitting..." : "Submit Review"}</Btn>
                  <Btn variant="outline" onClick={() => setShowForm(false)}>Cancel</Btn>
                </div>
                <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", color: T.brownLight, marginTop: "12px" }}>Your review will be published after a quick look. Only your first name and last initial will be shown publicly.</p>
              </form>
            )}
          </div>
        </div>
      </section>
      <style>{`@media(max-width:600px){.stat-divider{display:none!important}}`}</style>
    </div>
  );
};

/* ═══════════════════════  ADMIN PANEL  ═══════════════════════ */
/* ─── Orders Admin Section ─── */
const OrdersAdmin = ({ ordersHook }) => {
  const { orders, updateOrder, deleteOrder, countByStatus, orderNeedsAttention, attentionCount } = ordersHook;
  const [view, setView] = useState("table");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [editPrice, setEditPrice] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPayment, setEditPayment] = useState("");
  const [draggedId, setDraggedId] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState(() => ORDER_STATUSES.filter((s) => s !== "cancelled"));
  const [emailConfirm, setEmailConfirm] = useState(null);
  const [saveConfirm, setSaveConfirm] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState("");
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: "", email: "", phone: "", itemType: "", quantity: "", flavor: "", date: "", details: "", price: "", payment: "unpaid", notes: "", status: "new" });

  const toggleColumn = (status) => setVisibleColumns((prev) => prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]);
  const activeStatuses = ORDER_STATUSES.filter((s) => s !== "cancelled");
  const filtered = statusFilter === "all" ? orders : statusFilter === "attention" ? orders.filter((o) => orderNeedsAttention(o)) : statusFilter === "active" ? orders.filter((o) => o.order_status !== "completed" && o.order_status !== "cancelled") : orders.filter((o) => o.order_status === statusFilter);

  const openDetail = (order) => {
    setSelectedOrder(order);
    setEditPrice(order.price != null ? String(order.price) : "");
    setEditNotes(order.notes || "");
    setEditPayment(order.payment_status);
  };

  const saveDetail = () => {
    if (!selectedOrder) return;
    setConfirmStatus(selectedOrder.order_status);
    setSaveConfirm(true);
  };

  const confirmSave = async () => {
    if (!selectedOrder) return;
    await updateOrder(selectedOrder.id, { price: editPrice ? parseFloat(editPrice) : null, notes: editNotes || null, payment_status: editPayment, order_status: confirmStatus });
    setSaveConfirm(false);
    setSelectedOrder(null);
  };

  const submitAdminOrder = async () => {
    const orderNumber = await generateOrderNumber();
    const { error } = await supabase.from("orders").insert([{
      order_number: orderNumber,
      customer_name: adminForm.name,
      customer_email: adminForm.email,
      customer_phone: adminForm.phone || null,
      items: [{ type: adminForm.itemType, quantity: adminForm.quantity, flavor: adminForm.flavor }],
      quantity: adminForm.quantity || null,
      flavor: adminForm.flavor || null,
      event_date: adminForm.date || null,
      special_instructions: adminForm.details || null,
      order_status: adminForm.status,
      payment_status: adminForm.payment,
      price: adminForm.price ? parseFloat(adminForm.price) : null,
      notes: adminForm.notes || null
    }]);
    if (!error) {
      await ordersHook.fetchOrders();
      setShowAdminForm(false);
      setAdminForm({ name: "", email: "", phone: "", itemType: "", quantity: "", flavor: "", date: "", details: "", price: "", payment: "unpaid", notes: "", status: "new" });
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : "—";
  const formatItems = (o) => {
    if (o.items && Array.isArray(o.items) && o.items.length > 0) return o.items.map((i) => `${i.type}${i.quantity ? ` (${i.quantity})` : ""}`).join(", ");
    if (typeof o.items === "string") { try { const parsed = JSON.parse(o.items); if (Array.isArray(parsed)) return parsed.map((i) => `${i.type}${i.quantity ? ` (${i.quantity})` : ""}`).join(", "); } catch {} }
    return o.quantity ? `${o.flavor || ""} ${o.quantity}` : "—";
  };

  return (
    <>
      {/* Add order button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <Btn onClick={() => setShowAdminForm(true)}>+ New Order</Btn>
      </div>

      {/* Order stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "12px", marginBottom: "28px" }}>
        {[
          { label: "New", value: countByStatus("new"), color: ORDER_STATUS_COLORS.new },
          { label: "Reviewed", value: countByStatus("reviewed"), color: ORDER_STATUS_COLORS.reviewed },
          { label: "Waiting", value: countByStatus("waiting_on_customer"), color: ORDER_STATUS_COLORS.waiting_on_customer },
          { label: "Confirmed", value: countByStatus("confirmed"), color: ORDER_STATUS_COLORS.confirmed },
          { label: "In Progress", value: countByStatus("in_progress"), color: ORDER_STATUS_COLORS.in_progress },
          { label: "Ready", value: countByStatus("ready_for_pickup"), color: ORDER_STATUS_COLORS.ready_for_pickup },
          { label: "Total", value: orders.length, color: T.brown },
        ].map((s) => (
          <div key={s.label} style={{ background: T.white, borderRadius: "10px", padding: "16px 12px", border: `1px solid ${T.border}`, textAlign: "center" }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 600, color: s.color }}>{s.value}</div>
            <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "11px", color: T.brownLight, marginTop: "2px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* View toggle & filters */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          {view === "table" ? (
            /* Table filters */
            [{key: "all", label: "All"}, {key: "attention", label: `⚠ Needs Attention${attentionCount > 0 ? ` (${attentionCount})` : ""}`}, {key: "active", label: "Active"}, ...ORDER_STATUSES.map((s) => ({key: s, label: ORDER_STATUS_LABELS[s]}))].map((f) => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", fontWeight: statusFilter === f.key ? 500 : 400, padding: "5px 14px", borderRadius: "6px", border: `1px solid ${statusFilter === f.key ? (f.key === "attention" ? "#D4736C" : T.blue) : (f.key === "attention" && attentionCount > 0 ? "#D4736C" : T.border)}`, background: statusFilter === f.key ? (f.key === "attention" ? "#D4736C20" : T.blueSoft) : (f.key === "attention" && attentionCount > 0 ? "#D4736C10" : T.white), color: statusFilter === f.key ? (f.key === "attention" ? "#D4736C" : T.blueDeep) : (f.key === "attention" && attentionCount > 0 ? "#D4736C" : T.brownLight), cursor: "pointer" }}>{f.label}</button>
            ))
          ) : (
            /* Kanban column toggles */
            <>
              <span style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", color: T.brownLight, marginRight: "4px" }}>Show:</span>
              {activeStatuses.map((s) => (
                <button key={s} onClick={() => toggleColumn(s)} style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", fontWeight: visibleColumns.includes(s) ? 500 : 400, padding: "5px 14px", borderRadius: "6px", border: `1px solid ${visibleColumns.includes(s) ? ORDER_STATUS_COLORS[s] : T.border}`, background: visibleColumns.includes(s) ? ORDER_STATUS_COLORS[s] + "20" : T.white, color: visibleColumns.includes(s) ? ORDER_STATUS_COLORS[s] : T.brownLight, cursor: "pointer" }}>{ORDER_STATUS_LABELS[s]}</button>
              ))}
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: "4px", background: T.white, borderRadius: "8px", border: `1px solid ${T.border}`, padding: "3px" }}>
          <button onClick={() => setView("table")} style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", padding: "6px 16px", borderRadius: "6px", border: "none", background: view === "table" ? T.blueSoft : "transparent", color: view === "table" ? T.blueDeep : T.brownLight, cursor: "pointer", fontWeight: 500 }}>Table</button>
          <button onClick={() => setView("kanban")} style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", padding: "6px 16px", borderRadius: "6px", border: "none", background: view === "kanban" ? T.blueSoft : "transparent", color: view === "kanban" ? T.blueDeep : T.brownLight, cursor: "pointer", fontWeight: 500 }}>Board</button>
        </div>
      </div>

      {/* TABLE VIEW */}
      {view === "table" && (
        filtered.length === 0 ? (
          <div style={{ background: T.white, borderRadius: "14px", padding: "48px", border: `1px solid ${T.border}`, textAlign: "center" }}>
            <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "15px", color: T.brownLight }}>No orders found.</p>
          </div>
        ) : (
          <div style={{ background: T.white, borderRadius: "14px", border: `1px solid ${T.border}`, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Outfit, sans-serif", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: T.cream, borderBottom: `1px solid ${T.border}` }}>
                    {["Order #", "Customer", "Items", "Date Needed", "Status", "Payment", "Price", "Submitted"].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 500, color: T.brownSoft, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id} onClick={() => openDetail(o)} style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer", transition: "background 0.15s", background: orderNeedsAttention(o) ? "#D4736C08" : "" }} onMouseEnter={(e) => (e.currentTarget.style.background = T.cream)} onMouseLeave={(e) => (e.currentTarget.style.background = orderNeedsAttention(o) ? "#D4736C08" : "")}>
                      <td style={{ padding: "14px 16px", fontWeight: 500, color: T.blueDeep, fontSize: "12px", whiteSpace: "nowrap" }}>{o.order_number || "—"}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 500, color: T.brown, display: "flex", alignItems: "center", gap: "6px" }}>{o.customer_name}{orderNeedsAttention(o) && <span title={orderNeedsAttention(o)} style={{ color: "#D4736C", fontSize: "14px", cursor: "help" }}>⚠</span>}</div>
                        <div style={{ fontSize: "12px", color: T.brownLight }}>{orderNeedsAttention(o) ? <span style={{ color: "#D4736C" }}>{orderNeedsAttention(o)}</span> : o.customer_email}</div>
                      </td>
                      <td style={{ padding: "14px 16px", color: T.brownSoft, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatItems(o)}</td>
                      <td style={{ padding: "14px 16px", color: T.brownSoft }}>{formatDate(o.event_date)}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <select value={o.order_status} onClick={(e) => e.stopPropagation()} onChange={(e) => updateOrder(o.id, { order_status: e.target.value })} style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", padding: "4px 8px", borderRadius: "6px", border: `1px solid ${T.border}`, background: ORDER_STATUS_COLORS[o.order_status] + "20", color: ORDER_STATUS_COLORS[o.order_status], fontWeight: 500, cursor: "pointer" }}>
                          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "6px", background: PAYMENT_COLORS[o.payment_status] + "20", color: PAYMENT_COLORS[o.payment_status], fontWeight: 500 }}>{PAYMENT_LABELS[o.payment_status]}</span>
                      </td>
                      <td style={{ padding: "14px 16px", color: T.brownSoft, fontWeight: 500 }}>{o.price != null ? `$${Number(o.price).toFixed(2)}` : "—"}</td>
                      <td style={{ padding: "14px 16px", color: T.brownLight, fontSize: "12px" }}>{formatDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* KANBAN VIEW */}
      {view === "kanban" && (
        <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "12px" }}>
          {activeStatuses.filter((s) => visibleColumns.includes(s)).map((status) => {
            const columnOrders = orders.filter((o) => o.order_status === status);
            return (
              <div key={status} style={{ minWidth: "220px", flex: "1", background: T.cream, borderRadius: "12px", border: `1px solid ${T.border}`, display: "flex", flexDirection: "column" }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => { e.preventDefault(); if (draggedId) { await updateOrder(draggedId, { order_status: status }); setDraggedId(null); } }}
              >
                <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", fontWeight: 600, color: ORDER_STATUS_COLORS[status] }}>{ORDER_STATUS_LABELS[status]}</span>
                  <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", background: ORDER_STATUS_COLORS[status] + "20", color: ORDER_STATUS_COLORS[status], fontWeight: 500 }}>{columnOrders.length}</span>
                </div>
                <div style={{ padding: "8px", flex: 1, display: "flex", flexDirection: "column", gap: "8px", minHeight: "80px" }}>
                  {columnOrders.map((o) => (
                    <div key={o.id} draggable onDragStart={() => setDraggedId(o.id)} onClick={() => openDetail(o)}
                      style={{ background: T.white, borderRadius: "10px", padding: "14px", border: `1px solid ${orderNeedsAttention(o) ? "#D4736C" : T.border}`, cursor: "grab", transition: "box-shadow 0.2s, transform 0.2s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(61,50,41,0.08)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}
                    >
                      <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", fontWeight: 500, color: T.brown, marginBottom: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>{o.customer_name}{orderNeedsAttention(o) && <span title={orderNeedsAttention(o)} style={{ color: "#D4736C", fontSize: "12px" }}>⚠</span>}</div>
                      <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", color: T.brownLight, marginBottom: "6px" }}>{formatItems(o)}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "Outfit, sans-serif", fontSize: "11px", color: T.brownLight }}>{formatDate(o.event_date)}</span>
                        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", background: PAYMENT_COLORS[o.payment_status] + "20", color: PAYMENT_COLORS[o.payment_status], fontWeight: 500 }}>{PAYMENT_LABELS[o.payment_status]}</span>
                      </div>
                      {o.price != null && <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", fontWeight: 500, color: T.brown, marginTop: "6px" }}>${Number(o.price).toFixed(2)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ORDER DETAIL MODAL */}
      {selectedOrder && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(61,50,41,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setSelectedOrder(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.white, borderRadius: "16px", maxWidth: "600px", width: "100%", padding: "32px", boxShadow: "0 20px 60px rgba(61,50,41,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 500, color: T.brown, marginBottom: "4px" }}>{selectedOrder.customer_name}</h3>
                <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", color: T.brownLight }}>{selectedOrder.order_number && <span style={{ color: T.blueDeep, fontWeight: 500 }}>{selectedOrder.order_number} · </span>}Order submitted {formatDate(selectedOrder.created_at)}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: "none", border: "none", fontSize: "24px", color: T.brownLight, cursor: "pointer", padding: "4px" }}>×</button>
            </div>

            {/* Contact info */}
            <div style={{ background: T.cream, borderRadius: "10px", padding: "16px", marginBottom: "16px", border: `1px solid ${T.border}` }}>
              <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", color: T.brownLight, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contact</div>
              <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", color: T.brown }}>
                <div style={{ marginBottom: "4px" }}>Email: <a href={`mailto:${selectedOrder.customer_email}`} style={{ color: T.blueDeep }}>{selectedOrder.customer_email}</a></div>
                {selectedOrder.customer_phone && <div>Phone: <a href={`tel:${selectedOrder.customer_phone}`} style={{ color: T.blueDeep }}>{selectedOrder.customer_phone}</a></div>}
              </div>
            </div>

            {/* Order info */}
            <div style={{ background: T.cream, borderRadius: "10px", padding: "16px", marginBottom: "16px", border: `1px solid ${T.border}` }}>
              <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", color: T.brownLight, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Order Details</div>
              <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", color: T.brown }}>
                <div style={{ marginBottom: "4px" }}>Items: {formatItems(selectedOrder)}</div>
                {selectedOrder.flavor && <div style={{ marginBottom: "4px" }}>Flavor: {selectedOrder.flavor}</div>}
                <div style={{ marginBottom: "4px" }}>Date Needed: {formatDate(selectedOrder.event_date)}</div>
                {selectedOrder.special_instructions && <div style={{ marginTop: "8px", padding: "10px", background: T.white, borderRadius: "8px", fontSize: "13px", color: T.brownSoft, lineHeight: 1.6 }}>{selectedOrder.special_instructions}</div>}
              </div>
            </div>

            {/* Editable fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ ...labelStyle, fontSize: "12px" }}>Status</label>
                <select value={selectedOrder.order_status} onChange={(e) => { updateOrder(selectedOrder.id, { order_status: e.target.value }); setSelectedOrder({ ...selectedOrder, order_status: e.target.value }); }} style={{ ...inputStyle, fontSize: "13px", padding: "10px 12px" }}>
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: "12px" }}>Payment Status</label>
                <select value={editPayment} onChange={(e) => setEditPayment(e.target.value)} style={{ ...inputStyle, fontSize: "13px", padding: "10px 12px" }}>
                  {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ ...labelStyle, fontSize: "12px" }}>Price ($)</label>
              <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} style={{ ...inputStyle, fontSize: "13px", padding: "10px 12px" }} placeholder="0.00" />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ ...labelStyle, fontSize: "12px" }}>Internal Notes</label>
              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} style={{ ...inputStyle, fontSize: "13px", padding: "10px 12px", resize: "vertical" }} placeholder="Notes about this order..." />
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Btn onClick={saveDetail}>Save Changes</Btn>
              <Btn variant="outline" onClick={() => setEmailConfirm({ email: selectedOrder.customer_email, subject: "Your Taylor Mountain Bakery Order" })}>Email Customer</Btn>
              <Btn variant="outline" style={{ color: T.red, borderColor: T.red + "44" }} onClick={async () => { if (confirm("Permanently delete this order?")) { await deleteOrder(selectedOrder.id); setSelectedOrder(null); } }}>Delete</Btn>
              <Btn variant="outline" onClick={() => setSelectedOrder(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Email confirmation modal */}
      {/* Email confirmation modal */}
      {emailConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(61,50,41,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "24px" }} onClick={() => setEmailConfirm(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.white, borderRadius: "16px", maxWidth: "420px", width: "100%", padding: "32px", boxShadow: "0 20px 60px rgba(61,50,41,0.2)", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>✉️</div>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", fontWeight: 500, color: T.brown, marginBottom: "12px" }}>Open Gmail to Email Customer</h3>
            <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", color: T.brownSoft, lineHeight: 1.7, marginBottom: "8px" }}>This will open a new compose window in Gmail for:</p>
            <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", fontWeight: 600, color: T.brown, marginBottom: "16px" }}>{emailConfirm.email}</p>
            <div style={{ background: "#FFF3CD", borderRadius: "10px", padding: "12px 16px", marginBottom: "24px", border: "1px solid #FFE69C" }}>
              <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", color: "#856404", lineHeight: 1.6, margin: 0 }}>Make sure you're signed into <strong>taylor.mtn.bakery@gmail.com</strong> in Gmail before sending.</p>
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <Btn onClick={() => { window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(emailConfirm.email)}&su=${encodeURIComponent(emailConfirm.subject)}`, "_blank"); setEmailConfirm(null); }}>Open Gmail</Btn>
              <Btn variant="outline" onClick={() => setEmailConfirm(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Save confirmation modal with status dropdown */}
      {saveConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(61,50,41,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "24px" }} onClick={() => setSaveConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.white, borderRadius: "16px", maxWidth: "420px", width: "100%", padding: "32px", boxShadow: "0 20px 60px rgba(61,50,41,0.2)" }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", fontWeight: 500, color: T.brown, marginBottom: "16px" }}>Save Order Changes</h3>
            <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", color: T.brownSoft, marginBottom: "16px" }}>Does the order status need to be updated?</p>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", color: T.brownLight, display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Current Status</label>
              <select value={confirmStatus} onChange={(e) => setConfirmStatus(e.target.value)} style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", padding: "10px 12px", borderRadius: "8px", border: `1px solid ${T.border}`, background: ORDER_STATUS_COLORS[confirmStatus] + "20", color: ORDER_STATUS_COLORS[confirmStatus], fontWeight: 500, cursor: "pointer", width: "100%" }}>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <Btn variant="outline" onClick={() => setSaveConfirm(false)}>Cancel</Btn>
              <Btn onClick={confirmSave}>Save</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Admin new order form */}
      {showAdminForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(61,50,41,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "24px" }} onClick={() => setShowAdminForm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.white, borderRadius: "16px", maxWidth: "600px", width: "100%", padding: "32px", boxShadow: "0 20px 60px rgba(61,50,41,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 500, color: T.brown }}>New Order (In-Person / Phone)</h3>
              <button onClick={() => setShowAdminForm(false)} style={{ background: "none", border: "none", fontSize: "24px", color: T.brownLight, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div><label style={labelStyle}>Customer Name *</label><input value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} required style={inputStyle} placeholder="Customer name" /></div>
              <div><label style={labelStyle}>Email</label><input type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} style={inputStyle} placeholder="customer@email.com" /></div>
            </div>
            <div style={{ marginBottom: "12px" }}><label style={labelStyle}>Phone</label><input value={adminForm.phone} onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })} style={inputStyle} placeholder="Phone number" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div><label style={labelStyle}>Item Type *</label><input value={adminForm.itemType} onChange={(e) => setAdminForm({ ...adminForm, itemType: e.target.value })} style={inputStyle} placeholder="e.g. Cookies" /></div>
              <div><label style={labelStyle}>Quantity</label><input value={adminForm.quantity} onChange={(e) => setAdminForm({ ...adminForm, quantity: e.target.value })} style={inputStyle} placeholder="e.g. 2 dozen" /></div>
              <div><label style={labelStyle}>Flavor</label><input value={adminForm.flavor} onChange={(e) => setAdminForm({ ...adminForm, flavor: e.target.value })} style={inputStyle} placeholder="e.g. Chocolate Chip" /></div>
            </div>
            <div style={{ marginBottom: "12px" }}><label style={labelStyle}>Date Needed</label><input type="date" value={adminForm.date} onChange={(e) => setAdminForm({ ...adminForm, date: e.target.value })} style={inputStyle} /></div>
            <div style={{ marginBottom: "12px" }}><label style={labelStyle}>Special Instructions</label><textarea value={adminForm.details} onChange={(e) => setAdminForm({ ...adminForm, details: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="Any special requests..." /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={labelStyle}>Price</label>
                <input type="number" step="0.01" value={adminForm.price} onChange={(e) => setAdminForm({ ...adminForm, price: e.target.value })} style={inputStyle} placeholder="0.00" />
              </div>
              <div>
                <label style={labelStyle}>Payment Status</label>
                <select value={adminForm.payment} onChange={(e) => setAdminForm({ ...adminForm, payment: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}>
                  {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Order Status</label>
                <select value={adminForm.status} onChange={(e) => setAdminForm({ ...adminForm, status: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}>
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: "20px" }}><label style={labelStyle}>Internal Notes</label><textarea value={adminForm.notes} onChange={(e) => setAdminForm({ ...adminForm, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="Internal notes..." /></div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <Btn variant="outline" onClick={() => setShowAdminForm(false)}>Cancel</Btn>
              <Btn onClick={submitAdminOrder} disabled={!adminForm.name || !adminForm.itemType}>Create Order</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const AdminPage = ({ reviewsHook, ordersHook, setPage }) => {
  const { reviews, pending, pushed, approved, updateReview, deleteReview, loaded, avgRating, happyCount, fiveStarPct, totalApproved } = reviewsHook;
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [section, setSection] = useState("orders");
  const [tab, setTab] = useState("pending");
  const [replyTo, setReplyTo] = useState(null);
  const [replyMsg, setReplyMsg] = useState("");
  const [pushbackTo, setPushbackTo] = useState(null);
  const [pushbackMsg, setPushbackMsg] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    if (pw === CONFIG.ADMIN_PASSWORD) { setAuthed(true); setPwError(false); }
    else setPwError(true);
  };

  if (!authed) {
    return (
      <div style={{ paddingTop: "100px" }}>
        <section style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.cream, padding: "40px 24px" }}>
          <div style={{ background: T.white, borderRadius: "16px", padding: "48px 40px", border: `1px solid ${T.border}`, maxWidth: "400px", width: "100%", textAlign: "center" }}>
            <div style={{ marginBottom: "20px" }}>{Icons.shield}</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", fontWeight: 500, color: T.brown, marginBottom: "8px" }}>Owner Dashboard</h2>
            <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", color: T.brownLight, marginBottom: "28px" }}>Enter your password to manage your bakery.</p>
            <form onSubmit={handleLogin}>
              <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setPwError(false); }} style={{ ...inputStyle, textAlign: "center", marginBottom: "16px" }} placeholder="Password" onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} />
              {pwError && <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", color: T.red, marginBottom: "12px" }}>Incorrect password. Try again.</p>}
              <Btn type="submit" style={{ width: "100%" }}>Sign In</Btn>
            </form>
          </div>
        </section>
      </div>
    );
  }

  const tabReviews = tab === "pending" ? pending : tab === "pushed_back" ? pushed : tab === "approved" ? approved : reviews;
  const statusColor = (s) => s === "approved" ? T.success : s === "pending" ? "#B8860B" : s === "pushed_back" ? T.blueDeep : T.red;
  const statusLabel = (s) => s === "approved" ? "Approved" : s === "pending" ? "Pending" : s === "pushed_back" ? "Pushed Back" : "Rejected";

  return (
    <div style={{ paddingTop: "100px" }}>
      <section style={{ padding: "40px 24px", background: `linear-gradient(180deg, ${T.brownSoft} 0%, ${T.brown} 100%)`, textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "32px", fontWeight: 500, color: T.cream, marginBottom: "12px" }}>Owner Dashboard</h1>
        {/* Section switcher */}
        <div style={{ display: "inline-flex", gap: "4px", background: "rgba(255,255,255,0.15)", borderRadius: "10px", padding: "4px" }}>
          <button onClick={() => setSection("orders")} style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", fontWeight: 500, padding: "8px 24px", borderRadius: "8px", border: "none", background: section === "orders" ? T.white : "transparent", color: section === "orders" ? T.brown : "rgba(255,255,255,0.8)", cursor: "pointer", transition: "all 0.2s" }}>Orders {ordersHook.countByStatus("new") > 0 && <span style={{ marginLeft: "6px", background: T.red, color: T.white, fontSize: "11px", padding: "2px 7px", borderRadius: "8px" }}>{ordersHook.countByStatus("new")}</span>}</button>
          <button onClick={() => setSection("reviews")} style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", fontWeight: 500, padding: "8px 24px", borderRadius: "8px", border: "none", background: section === "reviews" ? T.white : "transparent", color: section === "reviews" ? T.brown : "rgba(255,255,255,0.8)", cursor: "pointer", transition: "all 0.2s" }}>Reviews {pending.length > 0 && <span style={{ marginLeft: "6px", background: T.red, color: T.white, fontSize: "11px", padding: "2px 7px", borderRadius: "8px" }}>{pending.length}</span>}</button>
        </div>
      </section>

      <section style={{ padding: "40px 24px 96px", background: T.cream }}>
        <div style={{ width: "100%", margin: "0 auto" }}>

          {/* ORDERS SECTION */}
          {section === "orders" && <OrdersAdmin ordersHook={ordersHook} />}

          {/* REVIEWS SECTION */}
          {section === "reviews" && (
            <>
              {/* Quick stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "16px", marginBottom: "32px" }}>
                {[
                  { label: "Avg Rating", value: avgRating },
                  { label: "Happy (4+★)", value: happyCount },
                  { label: "5-Star %", value: `${fiveStarPct}%` },
                  { label: "Pending", value: pending.length, highlight: pending.length > 0 },
                  { label: "Pushed Back", value: pushed.length },
                  { label: "Total Public", value: totalApproved },
                ].map((s) => (
                  <div key={s.label} style={{ background: T.white, borderRadius: "12px", padding: "20px", border: `1px solid ${s.highlight ? T.red : T.border}`, textAlign: "center" }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", fontWeight: 600, color: s.highlight ? T.red : T.brown }}>{s.value}</div>
                    <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", color: T.brownLight, marginTop: "4px" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
                {[
                  { key: "pending", label: "Pending", count: pending.length },
                  { key: "pushed_back", label: "Pushed Back", count: pushed.length },
                  { key: "approved", label: "Approved", count: approved.length },
                  { key: "all", label: "All", count: reviews.length },
                ].map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", fontWeight: tab === t.key ? 500 : 400, padding: "8px 20px", borderRadius: "8px", border: `1.5px solid ${tab === t.key ? T.blue : T.border}`, background: tab === t.key ? T.blueSoft : T.white, color: tab === t.key ? T.blueDeep : T.brownSoft, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                  >{t.label} <span style={{ background: tab === t.key ? T.blueDeep : T.border, color: tab === t.key ? T.white : T.brownSoft, fontSize: "11px", padding: "2px 8px", borderRadius: "10px" }}>{t.count}</span></button>
                ))}
              </div>

              {/* Review list */}
              {tabReviews.length === 0 ? (
                <div style={{ background: T.white, borderRadius: "16px", padding: "48px", border: `1px solid ${T.border}`, textAlign: "center" }}>
                  <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "15px", color: T.brownLight }}>No reviews in this category.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {tabReviews.map((r) => (
                    <div key={r.id} style={{ background: T.white, borderRadius: "14px", padding: "24px", border: `1px solid ${r.rating < 4 && r.status === "pending" ? T.red + "44" : T.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                            <span style={{ fontFamily: "'Fraunces', serif", fontSize: "17px", fontWeight: 500, color: T.brown }}>{r.reviewer_name}</span>
                            <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "6px", background: statusColor(r.status) + "20", color: statusColor(r.status), fontFamily: "Outfit, sans-serif", fontWeight: 500 }}>{statusLabel(r.status)}</span>
                            {r.rating < 4 && <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: T.red, fontFamily: "Outfit, sans-serif" }}>{Icons.alert} Low rating</span>}
                          </div>
                          <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", color: T.brownLight }}>{r.reviewer_email || "No email"} · {r.item || "No item"} · {new Date(r.created_at).toLocaleDateString()}</div>
                        </div>
                        <StarDisplay rating={r.rating} />
                      </div>
                      <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", color: T.brownSoft, lineHeight: 1.7, marginBottom: "16px", padding: "12px 16px", background: T.cream, borderRadius: "8px" }}>{r.review_text}</p>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {r.status !== "approved" && <Btn style={{ padding: "8px 18px", fontSize: "13px" }} onClick={() => updateReview(r.id, { status: "approved" })}>✓ Approve</Btn>}
                        {r.status !== "rejected" && <Btn variant="danger" style={{ padding: "8px 18px", fontSize: "13px" }} onClick={() => updateReview(r.id, { status: "rejected" })}>✕ Reject</Btn>}
                        {r.reviewer_email && <Btn variant="outline" style={{ padding: "8px 18px", fontSize: "13px" }} onClick={() => { setReplyTo(r); setReplyMsg(""); }}>✉ Reply</Btn>}
                        {r.reviewer_email && r.status !== "approved" && <Btn variant="wood" style={{ padding: "8px 18px", fontSize: "13px" }} onClick={() => { setPushbackTo(r); setPushbackMsg(`Hi ${r.reviewer_name},\n\nThank you for your feedback. We took your comments to heart and would love the chance to make it right. We'd be so grateful if you'd consider updating your review based on your experience.\n\nThank you!\nTaylor Mountain Bakery`); }}>↩ Push Back for Update</Btn>}
                        <Btn variant="outline" style={{ padding: "8px 18px", fontSize: "13px", color: T.red, borderColor: T.red + "44" }} onClick={() => { if (confirm("Permanently delete this review?")) deleteReview(r.id); }}>Delete</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply modal */}
              {replyTo && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(61,50,41,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setReplyTo(null)}>
                  <div onClick={(e) => e.stopPropagation()} style={{ background: T.white, borderRadius: "16px", maxWidth: "500px", width: "100%", padding: "32px", boxShadow: "0 20px 60px rgba(61,50,41,0.2)" }}>
                    <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", fontWeight: 500, color: T.brown, marginBottom: "8px" }}>Reply to {replyTo.reviewer_name}</h3>
                    <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", color: T.brownLight, marginBottom: "20px" }}>This will open Gmail to send a reply to {replyTo.reviewer_email}</p>
                    <textarea value={replyMsg} onChange={(e) => setReplyMsg(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical", marginBottom: "16px" }} placeholder="Write your reply..." />
                    <div style={{ background: "#FFF3CD", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", border: "1px solid #FFE69C" }}>
                      <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", color: "#856404", lineHeight: 1.5, margin: 0 }}>Make sure you're signed into <strong>taylor.mtn.bakery@gmail.com</strong> in Gmail before sending.</p>
                    </div>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <Btn onClick={() => window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(replyTo.reviewer_email)}&su=${encodeURIComponent("Thank you for your review! — Taylor Mountain Bakery")}&body=${encodeURIComponent(replyMsg)}`, "_blank")}>Open in Gmail</Btn>
                      <Btn variant="outline" onClick={() => setReplyTo(null)}>Cancel</Btn>
                    </div>
                  </div>
                </div>
              )}

              {/* Push-back modal */}
              {pushbackTo && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(61,50,41,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setPushbackTo(null)}>
                  <div onClick={(e) => e.stopPropagation()} style={{ background: T.white, borderRadius: "16px", maxWidth: "540px", width: "100%", padding: "32px", boxShadow: "0 20px 60px rgba(61,50,41,0.2)" }}>
                    <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", fontWeight: 500, color: T.brown, marginBottom: "8px" }}>Push Back to {pushbackTo.reviewer_name}</h3>
                    <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", color: T.brownLight, marginBottom: "4px" }}>This will mark the review as "Pushed Back." You can reach out to the customer manually using the email below.</p>
                    <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "12px", color: T.blueDeep, marginBottom: "20px" }}>The original review will not be published. If they resubmit, it will appear as a new pending review.</p>
                    <div style={{ background: T.cream, borderRadius: "10px", padding: "16px", marginBottom: "16px", border: `1px solid ${T.border}` }}>
                      <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", color: T.brownLight, marginBottom: "6px" }}>Customer email:</p>
                      <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "15px", color: T.brown, fontWeight: 500, wordBreak: "break-all" }}>{pushbackTo.reviewer_email}</p>
                      <Btn variant="outline" style={{ marginTop: "10px", fontSize: "13px" }} onClick={() => { navigator.clipboard.writeText(pushbackTo.reviewer_email); }}>Copy Email</Btn>
                    </div>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <Btn onClick={async () => {
                        await updateReview(pushbackTo.id, { status: "pushed_back" });
                        setPushbackTo(null);
                      }}>Mark as Pushed Back</Btn>
                      <Btn variant="outline" onClick={() => setPushbackTo(null)}>Cancel</Btn>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

/* ═══════════════════════  ORDER PAGE  ═══════════════════════ */
const OrderPage = () => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", itemType: "", quantity: "", flavor: "", date: "", details: "" });
  const [status, setStatus] = useState("idle");
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleSubmit = async (e) => {
    e.preventDefault(); setStatus("sending");
    // Save order to Supabase
    const orderNumber = await generateOrderNumber();
    const { error: dbError } = await supabase.from("orders").insert([{
      order_number: orderNumber,
      customer_name: form.name,
      customer_email: form.email,
      customer_phone: form.phone,
      items: [{ type: form.itemType, quantity: form.quantity, flavor: form.flavor }],
      quantity: form.quantity,
      flavor: form.flavor,
      event_date: form.date || null,
      special_instructions: form.details,
      order_status: "new",
      payment_status: "unpaid"
    }]);
    if (dbError) { console.error("Order insert failed:", dbError); setStatus("error"); return; }
    // Notify owner (best-effort — order is already saved)
    await sendEmail(CONFIG.EMAILJS_TEMPLATE_ID, { from_name: form.name, from_email: form.email, phone: form.phone, item_type: form.itemType, quantity: form.quantity, flavor: form.flavor, date_needed: form.date, details: form.details });
    // Send branded confirmation to customer (best-effort)
    await sendEmail(CONFIG.EMAILJS_ORDER_CONFIRM_ID, { to_name: form.name, to_email: form.email, item_type: form.itemType, quantity: form.quantity, flavor: form.flavor, date_needed: form.date, details: form.details });
    if (!emailjsActive()) await new Promise((r) => setTimeout(r, 1200));
    setStatus("success"); setForm({ name: "", email: "", phone: "", itemType: "", quantity: "", flavor: "", date: "", details: "" });
  };

  return (
    <div style={{ paddingTop: "100px" }}>
      <section style={{ padding: "40px 24px 60px", background: `linear-gradient(180deg, ${T.blueSoft} 0%, ${T.cream} 100%)`, textAlign: "center" }}>
        <Badge>Custom Orders</Badge>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(32px, 6vw, 48px)", fontWeight: 500, color: T.brown, margin: "20px 0 12px" }}>Order Something Special</h1>
        <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "16px", color: T.brownSoft, maxWidth: "500px", margin: "0 auto", lineHeight: 1.7 }}>Fill out the form below and we'll get back to you within 24 hours.</p>
      </section>
      <section style={{ padding: "60px 24px 96px", background: T.cream }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ background: T.white, borderRadius: "16px", padding: "32px", border: `1px solid ${T.border}`, marginBottom: "40px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "24px" }}>
            {[{ step: "1", title: "Submit", desc: "Fill out the order form" }, { step: "2", title: "Confirm", desc: "We'll reply within 24hrs" }, { step: "3", title: "Enjoy", desc: "Pick up your fresh treats" }].map((s) => (
              <div key={s.step} style={{ textAlign: "center" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: T.blueSoft, color: T.blueDeep, fontFamily: "'Fraunces', serif", fontSize: "18px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>{s.step}</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "16px", fontWeight: 500, color: T.brown, marginBottom: "4px" }}>{s.title}</div>
                <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", color: T.brownLight }}>{s.desc}</div>
              </div>
            ))}
          </div>
          {status === "success" ? (
            <div style={{ background: T.white, borderRadius: "16px", padding: "60px 32px", border: `1px solid ${T.border}`, textAlign: "center" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#EAF5ED", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}><svg width="32" height="32" viewBox="0 0 20 20" fill="none" stroke={T.success} strokeWidth="2.5" strokeLinecap="round"><path d="M4 10l4 4 8-8" /></svg></div>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "28px", fontWeight: 500, color: T.brown, marginBottom: "12px" }}>Order Request Received!</h3>
              <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "16px", color: T.brownSoft, lineHeight: 1.7, maxWidth: "400px", margin: "0 auto 28px" }}>We'll reach out within 24 hours to confirm details and pricing.</p>
              <Btn onClick={() => setStatus("idle")}>Place Another Order</Btn>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ background: T.white, borderRadius: "16px", padding: "40px 32px", border: `1px solid ${T.border}` }}>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 500, color: T.brown, marginBottom: "28px" }}>Order Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div><label style={labelStyle}>Your Name *</label><input name="name" value={form.name} onChange={handleChange} required style={inputStyle} placeholder="Jane Smith" onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
                <div><label style={labelStyle}>Email *</label><input name="email" type="email" value={form.email} onChange={handleChange} required style={inputStyle} placeholder="jane@email.com" onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div><label style={labelStyle}>Phone</label><input name="phone" value={form.phone} onChange={handleChange} style={inputStyle} placeholder="(555) 123-4567" onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
                <div><label style={labelStyle}>Item Type *</label><select name="itemType" value={form.itemType} onChange={handleChange} required style={{ ...inputStyle, appearance: "none", cursor: "pointer" }} onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)}><option value="">Select...</option><option>Cookies</option><option>Cupcakes</option><option>Custom Cake</option><option>Pastries &amp; More</option><option>Assorted / Other</option></select></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div><label style={labelStyle}>Quantity / Size</label><input name="quantity" value={form.quantity} onChange={handleChange} style={inputStyle} placeholder="e.g. 2 dozen" onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
                <div><label style={labelStyle}>Flavor</label><input name="flavor" value={form.flavor} onChange={handleChange} style={inputStyle} placeholder="e.g. Chocolate" onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
              </div>
              <div style={{ marginBottom: "16px" }}><label style={labelStyle}>Date Needed *</label><input name="date" type="date" value={form.date} onChange={handleChange} required style={inputStyle} onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
              <div style={{ marginBottom: "28px" }}><label style={labelStyle}>Details</label><textarea name="details" value={form.details} onChange={handleChange} rows={4} style={{ ...inputStyle, resize: "vertical" }} placeholder="Design ideas, dietary needs, etc." onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
              {status === "error" && <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", color: T.red, marginBottom: "16px", padding: "12px 16px", background: T.redSoft, borderRadius: "8px" }}>Something went wrong. Please try again.</div>}
              <Btn type="submit" style={{ width: "100%" }}>{status === "sending" ? "Sending..." : "Submit Order Request"}</Btn>
              <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", color: T.brownLight, textAlign: "center", marginTop: "16px" }}>This is a request — we'll confirm details and pricing.</p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};

/* ═══════════════════════  ABOUT PAGE  ═══════════════════════ */
const AboutPage = ({ setPage }) => (
  <div style={{ paddingTop: "100px" }}>
    <section style={{ padding: "40px 24px 0", background: `linear-gradient(180deg, ${T.woodLight} 0%, ${T.cream} 100%)`, textAlign: "center" }}>
      <Badge>Our Story</Badge>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(32px, 6vw, 48px)", fontWeight: 500, color: T.brown, margin: "20px 0 12px" }}>About Taylor Mountain Bakery</h1>
      <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "16px", color: T.brownSoft, maxWidth: "500px", margin: "0 auto 48px", lineHeight: 1.7 }}>A small-town bakery with a big heart, started by a high school junior with a passion for baking.</p>
    </section>
    <section style={{ padding: "80px 24px", background: T.cream }}>
      <div style={{ maxWidth: "1600px", margin: "0 auto" }}>
        <div style={{ background: T.white, borderRadius: "16px", padding: "48px 40px", border: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "40px", alignItems: "center", marginBottom: "32px" }}>
          <div>
            <div style={{ marginBottom: "16px" }}>{Icons.wheat}</div>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "26px", fontWeight: 500, color: T.brown, marginBottom: "16px" }}>How It Started</h3>
            <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "15px", color: T.brownSoft, lineHeight: 1.8 }}>What started as baking cookies for friends and family quickly turned into something bigger. As a high school junior with a love for creating beautiful, delicious treats, I decided to turn my passion into Taylor Mountain Bakery — a small business dedicated to serving our wonderful community with everything from cookies and cupcakes to custom cakes, croissants, and all sorts of sweet creations.</p>
            <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "15px", color: T.brownSoft, lineHeight: 1.8, marginTop: "12px" }}>Every recipe is tested and perfected in our home kitchen, using quality ingredients and a whole lot of love. We're always experimenting and exploring new flavors and treats to bring to the table.</p>
          </div>
          <div style={{ background: `linear-gradient(135deg, ${T.blueSoft}, ${T.woodLight})`, borderRadius: "12px", height: "280px", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "12px" }}>{Icons.cookie}{Icons.cupcake}{Icons.cake}{Icons.pastry}</div>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", fontStyle: "italic", color: T.brownSoft }}>Baked with heart</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px" }}>
          {[{ title: "From Scratch", desc: "Every single item is made from scratch — no shortcuts, no box mixes. Just real ingredients and real flavor.", icon: "🌾" }, { title: "Community First", desc: "This bakery exists because of our amazing small town. We love being part of local events, fundraisers, and celebrations.", icon: "🏡" }, { title: "Made to Order", desc: "Your treats are baked fresh for you. Custom designs, flavors, and sizes — because your celebration deserves something special.", icon: "✨" }].map((v) => (
            <div key={v.title} style={{ background: T.white, borderRadius: "16px", padding: "32px", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: "32px", marginBottom: "16px" }}>{v.icon}</div>
              <h4 style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", fontWeight: 500, color: T.brown, marginBottom: "10px" }}>{v.title}</h4>
              <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px", color: T.brownLight, lineHeight: 1.7 }}>{v.desc}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: "64px" }}><Divider /><p style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", fontStyle: "italic", color: T.brownSoft, margin: "32px 0" }}>"Every treat tells a story — let us bake yours."</p><Btn onClick={() => { setPage("Order"); window.scrollTo(0, 0); }}>Place a Custom Order</Btn></div>
      </div>
    </section>
  </div>
);

/* ═══════════════════════  CONTACT PAGE  ═══════════════════════ */
const ContactPage = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const handleSubmit = (e) => { e.preventDefault(); setSent(true); setForm({ name: "", email: "", message: "" }); };

  return (
    <div style={{ paddingTop: "100px" }}>
      <section style={{ padding: "40px 24px 0", background: `linear-gradient(180deg, ${T.blueSoft} 0%, ${T.cream} 100%)`, textAlign: "center" }}>
        <Badge>Get in Touch</Badge>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(32px, 6vw, 48px)", fontWeight: 500, color: T.brown, margin: "20px 0 12px" }}>Contact Us</h1>
        <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "16px", color: T.brownSoft, maxWidth: "500px", margin: "0 auto 48px", lineHeight: 1.7 }}>Have a question or need help with an order? We'd love to hear from you!</p>
      </section>
      <section style={{ padding: "60px 24px 96px", background: T.cream }}>
        <div style={{ maxWidth: "1600px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 2fr", gap: "40px" }}>
          <div>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", fontWeight: 500, color: T.brown, marginBottom: "28px" }}>Let's Connect</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {[{ icon: Icons.mail, label: "Email", value: "taylor.mtn.bakery@gmail.com", href: "mailto:taylor.mtn.bakery@gmail.com" }, { icon: Icons.pin, label: "Location", value: "Vernal, UT USA" }].map((c) => (
                <div key={c.label} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: T.blueSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{c.icon}</div>
                  <div>
                    <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "13px", color: T.brownLight, marginBottom: "2px" }}>{c.label}</div>
                    {c.href ? <a href={c.href} style={{ fontFamily: "Outfit, sans-serif", fontSize: "15px", color: T.brown, textDecoration: "none" }}>{c.value}</a> : <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "15px", color: T.brown }}>{c.value}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "40px" }}>
              <h4 style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", fontWeight: 500, color: T.brown, marginBottom: "16px" }}>Follow Us</h4>
              <div style={{ display: "flex", gap: "12px" }}>
                {[{ href: "https://www.facebook.com/profile.php?id=61562435145114", icon: Icons.facebook, label: "Facebook" }, { href: "https://www.instagram.com/taylormtnbakery/", icon: Icons.instagram, label: "Instagram" }].map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 20px", background: T.white, borderRadius: "10px", border: `1px solid ${T.border}`, textDecoration: "none", fontFamily: "Outfit, sans-serif", fontSize: "14px", fontWeight: 500, color: T.brownSoft, transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.background = T.blueSoft; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.white; }}>{s.icon}{s.label}</a>
                ))}
              </div>
            </div>
          </div>
          <div>
            {sent ? (
              <div style={{ background: T.white, borderRadius: "16px", padding: "48px 32px", border: `1px solid ${T.border}`, textAlign: "center" }}>
                {Icons.check}<h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", fontWeight: 500, color: T.brown, margin: "16px 0 12px" }}>Message Sent!</h3><p style={{ fontFamily: "Outfit, sans-serif", fontSize: "15px", color: T.brownSoft }}>We'll get back to you soon.</p><Btn onClick={() => setSent(false)} style={{ marginTop: "20px" }} variant="outline">Send Another</Btn>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ background: T.white, borderRadius: "16px", padding: "36px 32px", border: `1px solid ${T.border}` }}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", fontWeight: 500, color: T.brown, marginBottom: "24px" }}>Send Us a Message</h3>
                <div style={{ marginBottom: "16px" }}><label style={labelStyle}>Name *</label><input name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={inputStyle} placeholder="Your name" onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
                <div style={{ marginBottom: "16px" }}><label style={labelStyle}>Email *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required style={inputStyle} placeholder="your@email.com" onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
                <div style={{ marginBottom: "24px" }}><label style={labelStyle}>Message *</label><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required rows={4} style={{ ...inputStyle, resize: "vertical" }} placeholder="How can we help?" onFocus={(e) => (e.target.style.borderColor = T.blue)} onBlur={(e) => (e.target.style.borderColor = T.border)} /></div>
                <Btn type="submit" style={{ width: "100%" }}>Send Message</Btn>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

/* ═══════════════════════  APP SHELL  ═══════════════════════ */
export default function App() {
  const [page, setPage] = useState("Home");
  const reviewsHook = useReviews();
  const ordersHook = useOrders();

  return (
    <div style={{ background: T.cream, minHeight: "100vh", fontFamily: "Outfit, sans-serif" }}>
      <FontLoader />
      <Nav page={page} setPage={setPage} />
      {page === "Home" && <HomePage setPage={setPage} />}
      {page === "Order" && <OrderPage />}
      {page === "Gallery" && <GalleryPage setPage={setPage} />}
      {page === "Reviews" && <ReviewsPage setPage={setPage} reviewsHook={reviewsHook} />}
      {page === "About" && <AboutPage setPage={setPage} />}
      {page === "Contact" && <ContactPage />}
      {page === "Admin" && <AdminPage reviewsHook={reviewsHook} ordersHook={ordersHook} setPage={setPage} />}
      <Footer setPage={setPage} pendingCount={reviewsHook.pending.length} newOrderCount={ordersHook.countByStatus("new")} attentionCount={ordersHook.attentionCount} />
    </div>
  );
}