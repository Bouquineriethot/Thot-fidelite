window.renderStaff = async () => {
  state.vouchers = [];
  if (state.selected) {
    const { data: allV } = await sb.from("vouchers").select("*").eq("customer_id", state.selected.id).eq("status", "active");
    state.vouchers = allV || [];
  }
  const isVip = !!state.selected?.vip_lifetime;
  appEl.innerHTML = headerHtml() + flashHtml() + `<div class="space-y-5">
    <div id="notif-banner" class="hidden rounded-xl border-2 border-red-400 bg-red-50 p-3 text-xs font-bold text-red-900"></div>
    <div class="flex flex-wrap gap-2">
      <button onclick="toggleScan()" class="rounded-xl bg-thot-forest px-4 py-2.5 text-sm font-bold text-white">${state.scanning ? "Fermer caméra" : "📷 Scanner QR"}</button>
      <button onclick="toggleNewForm()" class="rounded-xl border border-thot-forest bg-white px-4 py-2.5 text-sm font-bold text-thot-forest">+ Nouveau client</button>
      <label class="cursor-pointer rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700">📄 Importer CSV<input type="file" accept=".csv" onchange="importCsv(event)" class="hidden" /></label>
    </div>
    <div class="${state.scanning ? "" : "hidden"} rounded-xl overflow-hidden bg-black p-2"><div id="qr-reader" class="mx-auto max-w-sm"></div></div>
    <form id="new-client-form" onsubmit="createClient(event)" class="hidden space-y-3 rounded-xl border bg-white p-4">
      <h3 class="font-bold">Nouveau client</h3>
      <input id="nc-name" required placeholder="Nom et prénom *" class="w-full rounded-lg border p-2 text-sm" />
      <input id="nc-email" type="email" required placeholder="Adresse e-mail *" class="w-full rounded-lg border p-2 text-sm" />
      <button class="rounded-lg bg-thot-forest px-4 py-2 text-sm font-bold text-white">Créer</button>
    </form>
    ${state.selected ? `<div class="space-y-4 rounded-2xl border-2 border-thot-forest bg-white p-5 shadow-md">
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-serif text-xl font-bold">${esc(state.selected.full_name)}</h3>
          ${isVip ? `<span class="mt-1 inline-block rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-bold text-thot-ink">👑 Récompense active : -10 % à vie</span>` : ""}
          <p class="text-xs text-gray-500 mt-1">${esc(state.selected.email || state.selected.card_code)}</p>
          <p class="mt-2 text-2xl font-extrabold text-thot-forest">${state.selected.points} points</p>
        </div>
        <button onclick="clearSelected()" class="text-sm text-gray-400 px-2">✕</button>
      </div>
      <label class="flex items-start gap-2.5 rounded-xl border ${isVip ? "border-thot-gold bg-amber-50" : "border-stone-200 bg-stone-50"} p-3 cursor-pointer">
        <input type="checkbox" ${isVip ? "checked" : ""} onchange="toggleVip(this.checked)" class="mt-0.5 h-4 w-4 accent-amber-700" />
        <div>
          <p class="text-xs font-bold text-thot-ink">Vos récompenses actives : 10 % à vie</p>
          <p class="text-[10px] text-gray-600 leading-snug mt-0.5">Livres en boutique uniquement : hors promos/offres fidélité, hors jeux et salon de thé, hors déstockage/kilo/sac, hors box/calendriers.</p>
        </div>
      </label>
      ${state.vouchers.length ? `<div class="space-y-2 rounded-xl bg-amber-50 p-3">
        <p class="text-xs font-bold uppercase text-amber-800">Bons à valider :</p>
        ${state.vouchers.map((v) => `<div class="flex items-center justify-between gap-2">
          <div><span class="text-sm font-semibold">${esc(v.reward_title)}</span><p class="font-mono text-[11px] text-gray-600">${esc(v.code)} • ${new Date(v.created_at).toLocaleDateString("fr-FR")}</p></div>
          <button onclick="useVoucher('${v.id}')" class="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white">Valider</button>
        </div>`).join("")}</div>` : ""}
      <div class="space-y-2">
        <div class="flex flex-wrap gap-2">
          <input id="pts-val" type="text" inputmode="decimal" oninput="updatePreview()" placeholder="Montant € (1€ = 5 pts)" class="w-44 rounded-lg border p-2 text-sm" />
          <input id="pts-reason" type="text" value="Achat boutique" class="flex-1 min-w-[130px] rounded-lg border p-2 text-sm" />
        </div>
        <div class="flex items-center justify-between text-xs">
          <label class="flex items-center gap-1.5 text-gray-600"><input id="pts-direct" type="checkbox" onchange="updatePreview()" /> Saisir en points directs</label>
          <span id="pts-preview" class="font-bold text-thot-forest"></span>
        </div>
        <div class="flex gap-2">
          <button type="button" onclick="adjustPoints(1)" class="flex-1 rounded-lg bg-thot-forest px-4 py-2 text-sm font-bold text-white">+ Créditer</button>
          <button type="button" onclick="adjustPoints(-1)" class="flex-1 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-700">− Retirer</button>
        </div>
      </div>
    </div>` : ""}
    <div class="space-y-2">
      <input id="search-input" placeholder="Chercher nom, e-mail, tél ou code..." value="${esc(state.searchQuery)}" oninput="onSearch(this.value)" class="w-full rounded-xl border border-stone-200 bg-white p-2.5 text-sm" />
      <div id="staff-list" class="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white"></div>
    </div>
  </div>`;

  if (!window._rtVouchers) {
    window._rtVouchers = sb.channel("vouchers-caisse")
      .on("postgres_changes", { event: "*", schema: "public", table: "vouchers" }, () => {
        if (state.customer?.role === "staff" && state.staffMode) window.refreshList();
      }).subscribe();
  }
  if (!window._caissePoll) {
    window._caissePoll = setInterval(() => {
      if (state.customer?.role === "staff" && state.staffMode && !state.scanning) window.refreshList();
    }, 10000);
  }
  await window.refreshList();
};

window.refreshList = async () => {
  const q = state.searchQuery.trim();
  const { data: actV } = await sb.from("vouchers").select("customer_id, reward_title, created_at").eq("status", "active").order("created_at", { ascending: false });
  const activeMap = new Map();
  (actV || []).forEach((v) => { if (!activeMap.has(v.customer_id)) activeMap.set(v.customer_id, v.reward_title); });
  state.activeCount = (actV || []).length;

  const banner = document.getElementById("notif-banner");
  if (banner) {
    if (state.activeCount > 0) {
      banner.classList.remove("hidden");
      banner.innerHTML = `🔔 ${state.activeCount} bon${state.activeCount > 1 ? "s" : ""} activé${state.activeCount > 1 ? "s" : ""} en attente en caisse (clients placés en haut de liste) !`;
    } else banner.classList.add("hidden");
  }

  let req = sb.from("customers").select("*").order("created_at", { ascending: false }).limit(20);
  if (q) req = sb.from("customers").select("*").or(`full_name.ilike.%${q}%,email.ilike.%${q}%,card_code.ilike.%${q}%,phone.ilike.%${q}%`).limit(20);
  const { data: list } = await req;
  let rows = list || [];

  if (!q && activeMap.size > 0) {
    const missingIds = [...activeMap.keys()].filter((id) => !rows.some((c) => c.id === id));
    if (missingIds.length) {
      const { data: extra } = await sb.from("customers").select("*").in("id", missingIds);
      rows = [...(extra || []), ...rows];
    }
    const orderIds = [...activeMap.keys()];
    rows.sort((a, b) => {
      const ia = orderIds.indexOf(a.id), ib = orderIds.indexOf(b.id);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return 0;
    });
  }

  const box = document.getElementById("staff-list");
  if (box) box.innerHTML = rows.map((c) => {
    const bon = activeMap.get(c.id);
    return `<button onclick="selectCust('${c.id}')" class="flex w-full items-center justify-between px-4 py-3 text-left ${bon ? "bg-amber-50 hover:bg-amber-100/70" : "hover:bg-stone-50"}">
      <div>
        <div class="flex items-center gap-2">
          <p class="font-semibold">${esc(c.full_name)}</p>
          ${c.vip_lifetime ? `<span class="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">👑 -10%</span>` : ""}
          ${bon ? `<span class="h-2.5 w-2.5 rounded-full bg-red-600"></span>` : ""}
        </div>
        <p class="text-xs ${bon ? "font-semibold text-amber-800" : "text-gray-500"}">${bon ? "🎁 " + esc(bon) : esc(c.email || c.card_code)}</p>
      </div>
      <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-thot-forest">${c.points} pts</span>
    </button>`;
  }).join("");
};

window.toggleVip = async (checked) => {
  if (!state.selected) return;
  const { error } = await sb.from("customers").update({ vip_lifetime: checked }).eq("id", state.selected.id);
  if (error) state.err = frError(error.message);
  else {
    state.selected.vip_lifetime = checked;
    state.msg = checked ? "👑 Récompense « -10 % à vie » activée pour ce client !" : "Récompense « -10 % à vie » désactivée.";
  }
  render();
};
window.updatePreview = () =
