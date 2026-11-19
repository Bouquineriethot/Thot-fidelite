window.renderStaff = async () => {
  state.vouchers = [];
  if (state.selected) {
    const { data: v } = await sb.from("vouchers").select("*").eq("customer_id", state.selected.id).eq("status", "active");
    state.vouchers = v || [];
  }
  appEl.innerHTML = headerHtml() + flashHtml() + `<div class="space-y-5">
    <div class="flex flex-wrap gap-2">
      <button onclick="toggleScan()" class="rounded-xl bg-thot-forest px-4 py-2.5 text-sm font-bold text-white">${state.scanning ? "Fermer caméra" : "📷 Scanner QR"}</button>
      <button onclick="toggleNewForm()" class="rounded-xl border border-thot-forest bg-white px-4 py-2.5 text-sm font-bold text-thot-forest">+ Nouveau client</button>
      <label class="cursor-pointer rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700">📄 Importer CSV<input type="file" accept=".csv" onchange="importCsv(event)" class="hidden" /></label>
    </div>
    <div class="${state.scanning ? "" : "hidden"} rounded-xl overflow-hidden bg-black p-2"><div id="qr-reader" class="mx-auto max-w-sm"></div></div>
    <form id="new-client-form" onsubmit="createClient(event)" class="hidden space-y-3 rounded-xl border bg-white p-4">
      <h3 class="font-bold">Nouveau client</h3>
      <input id="nc-name" required placeholder="Nom et prénom *" class="w-full rounded-lg border p-2 text-sm" />
      <input id="nc-email" type="email" placeholder="E-mail" class="w-full rounded-lg border p-2 text-sm" />
      <input id="nc-phone" placeholder="Téléphone" class="w-full rounded-lg border p-2 text-sm" />
      <button class="rounded-lg bg-thot-forest px-4 py-2 text-sm font-bold text-white">Créer</button>
    </form>
    ${state.selected ? `<div class="space-y-4 rounded-2xl border-2 border-thot-forest bg-white p-5 shadow-md">
      <div class="flex justify-between items-start">
        <div><h3 class="font-serif text-xl font-bold">${esc(state.selected.full_name)}</h3>
          <p class="text-xs text-gray-500">${esc(state.selected.email || state.selected.phone || state.selected.card_code)}</p>
          <p class="mt-2 text-2xl font-extrabold text-thot-forest">${state.selected.points} points</p></div>
        <button onclick="clearSelected()" class="text-sm text-gray-400 px-2">✕</button>
      </div>
      ${state.vouchers.length ? `<div class="space-y-2 rounded-xl bg-amber-50 p-3">
        <p class="text-xs font-bold uppercase text-amber-800">Bons à valider :</p>
        ${state.vouchers.map((v) => `<div class="flex items-center justify-between gap-2">
          <span class="text-sm font-semibold">${esc(v.reward_title)} (${esc(v.code)})</span>
          <button onclick="useVoucher('${v.id}')" class="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white">Valider</button>
        </div>`).join("")}</div>` : ""}
      <form onsubmit="addPoints(event)" class="flex flex-wrap gap-2">
        <input id="pts-euros" type="text" inputmode="decimal" required placeholder="Montant € (1€=1pt)" class="w-40 rounded-lg border p-2 text-sm" />
        <input id="pts-reason" type="text" value="Achat boutique" class="flex-1 min-w-[130px] rounded-lg border p-2 text-sm" />
        <button class="rounded-lg bg-thot-forest px-4 py-2 text-sm font-bold text-white">Créditer</button>
      </form>
    </div>` : ""}
    <div class="space-y-2">
      <input id="search-input" placeholder="Chercher nom, e-mail, tél ou code..." value="${esc(state.searchQuery)}" oninput="onSearch(this.value)" class="w-full rounded-xl border border-stone-200 bg-white p-2.5 text-sm" />
      <div id="staff-list" class="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white"></div>
    </div>
  </div>`;
  await window.refreshList();
};

window.refreshList = async () => {
  const q = state.searchQuery.trim();
  let req = sb.from("customers").select("*").order("created_at", { ascending: false }).limit(15);
  if (q) req = sb.from("customers").select("*").or(`full_name.ilike.%${q}%,email.ilike.%${q}%,card_code.ilike.%${q}%,phone.ilike.%${q}%`).limit(15);
  const { data: list } = await req;
  const box = document.getElementById("staff-list");
  if (box) box.innerHTML = (list || []).map((c) => `<button onclick="selectCust('${c.id}')" class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-stone-50">
    <div><p class="font-semibold">${esc(c.full_name)}</p><p class="text-xs text-gray-500">${esc(c.email || c.phone || c.card_code)}</p></div>
    <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-thot-forest">${c.points} pts</span>
  </button>`).join("");
};
window.onSearch = (val) => { state.searchQuery = val; window.refreshList(); };
window.selectCust = async (id) => { const { data } = await sb.from("customers").select("*").eq("id", id).single(); state.selected = data; state.msg = null; state.err = null; render(); };
window.clearSelected = () => { state.selected = null; render(); };
window.toggleNewForm = () => document.getElementById("new-client-form").classList.toggle("hidden");
window.createClient = async (e) => {
  e.preventDefault();
  const code = "THOT-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data, error } = await sb.from("customers").insert({ full_name: document.getElementById("nc-name").value.trim(), email: document.getElementById("nc-email").value.trim().toLowerCase() || null, phone: document.getElementById("nc-phone").value.trim() || null, card_code: code, points: 0 }).select().single();
  if (error) state.err = frError(error.message); else { state.selected = data; state.msg = "Client créé !"; }
  render();
};
window.addPoints = async (e) => {
  e.preventDefault();
  const pts = Math.floor(parseFloat(document.getElementById("pts-euros").value.replace(",", ".")));
  if (isNaN(pts) || pts === 0) return;
  const { data: total, error } = await sb.rpc("staff_add_points", { p_customer_id: state.selected.id, p_points: pts, p_reason: document.getElementById("pts-reason").value });
  if (error) state.err = frError(error.message); else { state.selected.points = total; state.msg = `${pts > 0 ? "+" : ""}${pts} pts enregistrés !`; }
  render();
};
window.useVoucher = async (id) => {
  const v = state.vouchers.find((x) => x.id === id);
  if (!v || !confirm(`Valider "${v.reward_title}" ?`)) return;
  const { error } = await sb.rpc("staff_use_voucher", { p_voucher_id: id });
  if (error) state.err = frError(error.message); else state.msg = `Bon "${v.reward_title}" validé !`;
  render();
};
window.importCsv = (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  window.Papa.parse(file, { header: true, skipEmptyLines: true, complete: async (res) => {
    const rows = res.data.map((row) => {
      const get = (keys) => { const k = Object.keys(row).find((c) => keys.some((t) => c.toLowerCase().includes(t))); return k ? row[k] : ""; };
      return { full_name: get(["nom", "name", "client", "prenom", "prénom"]), email: get(["mail", "courriel"]), phone: get(["tel", "tél", "phone", "mobile"]), points: parseInt(get(["point", "pts", "solde"]) || "0", 10) || 0 };
    });
    const { data: count, error } = await sb.rpc("staff_import_customers", { p_rows: rows });
    if (error) state.err = "Erreur import : " + frError(error.message); else state.msg = `${count} comptes importés / mis à jour !`;
    render();
  }});
};
window.toggleScan = async () => {
  if (state.scanning && state.qrScanner) { await state.qrScanner.stop().catch(() => {}); state.scanning = false; return render(); }
  state.scanning = true; await render();
  const scanner = new window.Html5Qrcode("qr-reader"); state.qrScanner = scanner;
  scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 } }, async (txt) => {
    await scanner.stop().catch(() => {}); state.scanning = false;
    const code = txt.trim().toUpperCase();
    if (code.startsWith("BON-")) {
      const { data: v } = await sb.from("vouchers").select("*").eq("code", code).single();
      if (v) { const { data: c } = await sb.from("customers").select("*").eq("id", v.customer_id).single(); state.selected = c || null; }
      else state.err = `Bon ${code} introuvable.`;
    } else {
      const { data: c } = await sb.from("customers").select("*").eq("card_code", code).single();
      if (c) state.selected = c; else state.err = `Carte ${code} introuvable.`;
    }
    render();
  }, () => {}).catch(() => { state.scanning = false; state.err = "Caméra refusée ou indisponible."; render(); });
};
