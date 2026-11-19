window.renderCustomer = async () => {
  const c = state.customer;
  const [{ data: rewards }, { data: vouchers }, { data: txs }] = await Promise.all([
    sb.from("rewards").select("*").eq("active", true).order("points_cost"),
    sb.from("vouchers").select("*").eq("customer_id", c.id).eq("status", "active").order("created_at", { ascending: false }),
    sb.from("transactions").select("*").eq("customer_id", c.id).order("created_at", { ascending: false }).limit(15)
  ]);
  state.rewards = rewards || [];
  const next = state.rewards.find((r) => r.points_cost > c.points);
  const pct = next ? Math.min(100, (c.points / next.points_cost) * 100) : 100;

  appEl.innerHTML = headerHtml() + flashHtml() + `<div class="space-y-6">
    <div class="rounded-2xl bg-thot-forest p-6 text-white shadow-lg">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-xs uppercase tracking-widest text-emerald-200">Bouquinerie Thot</p>
          <h2 class="mt-1 font-serif text-xl font-bold">${esc(c.full_name)}</h2>
          <p class="mt-3 text-4xl font-extrabold text-amber-300">${c.points} <span class="text-base font-normal text-white">pts</span></p>
          <p class="mt-1 text-xs text-emerald-100">1 € dépensé = 1 point</p></div>
        <div class="rounded-xl bg-white p-2 text-center">${qrSvg(c.card_code, 84)}<p class="mt-1 font-mono text-[10px] font-bold text-thot-ink">${esc(c.card_code)}</p></div>
      </div>
      ${next ? `<div class="mt-5"><div class="flex justify-between text-xs text-emerald-100"><span>Prochain : ${esc(next.title)}</span><span>${c.points} / ${next.points_cost} pts</span></div>
        <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-emerald-900"><div class="h-full bg-amber-400" style="width:${pct}%"></div></div></div>` : ""}
    </div>
    ${vouchers && vouchers.length ? `<section class="space-y-2"><h3 class="font-serif text-lg font-bold">Mes bons en caisse</h3>
      ${vouchers.map((v) => `<div class="flex items-center justify-between rounded-xl border-2 border-dashed border-thot-gold bg-white p-4">
        <div><p class="font-bold text-thot-forest">${esc(v.reward_title)}</p><p class="font-mono text-xs text-gray-500">${esc(v.code)}</p></div>${qrSvg(v.code, 64)}
      </div>`).join("")}</section>` : ""}
    <section class="space-y-2"><h3 class="font-serif text-lg font-bold">Échanger mes points</h3>
      ${state.rewards.map((r) => { const ok = c.points >= r.points_cost; return `<div class="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-4">
        <div><p class="font-bold">${esc(r.title)}</p><p class="text-xs text-gray-500">${esc(r.description || "")}</p><p class="mt-1 text-xs font-semibold text-thot-forest">${r.points_cost} points</p></div>
        <button ${ok ? `onclick="redeemReward('${r.id}')"` : "disabled"} class="shrink-0 rounded-lg px-4 py-2 text-xs font-bold ${ok ? "bg-thot-forest text-white" : "bg-stone-100 text-stone-400"}">${ok ? "Échanger" : "Insuffisant"}</button>
      </div>`; }).join("")}
    </section>
    <section class="space-y-2"><h3 class="font-serif text-lg font-bold">Historique</h3>
      <div class="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
        ${!txs || !txs.length ? `<p class="p-4 text-sm text-gray-500">Aucun mouvement.</p>` : txs.map((t) => `<div class="flex items-center justify-between px-4 py-3 text-sm">
          <div><p class="font-medium">${esc(t.reason)}</p><p class="text-xs text-gray-400">${new Date(t.created_at).toLocaleDateString("fr-FR")}</p></div>
          <span class="font-bold ${t.points_delta >= 0 ? "text-emerald-700" : "text-amber-700"}">${t.points_delta >= 0 ? "+" + t.points_delta : t.points_delta} pts</span>
        </div>`).join("")}
      </div>
    </section>
  </div>`;
};

window.redeemReward = async (id) => {
  const r = state.rewards.find((x) => x.id === id);
  if (!r || !confirm(`Échanger ${r.points_cost} pts contre "${r.title}" ?`)) return;
  state.msg = null; state.err = null;
  const { error } = await sb.rpc("redeem_reward", { p_reward_id: id });
  if (error) state.err = frError(error.message);
  else state.msg = `Bon "${r.title}" généré ! Présentez-le en caisse.`;
  await loadProfile();
};
