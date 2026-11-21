window.setClientTab = (t) => {
  state.clientTab = t;
  state.msg = null;
  state.err = null;
  render();
};

window.renderCustomer = async () => {
  const c = state.customer;
  state.clientTab = state.clientTab || "profil";
  const tab = state.clientTab;

  const [{ data: rewards }, { data: allVouchers }, { data: txs }] = await Promise.all([
    sb.from("rewards").select("*").eq("active", true).order("sort_order"),
    sb.from("vouchers").select("*").eq("customer_id", c.id).order("created_at", { ascending: false }),
    sb.from("transactions").select("*").eq("customer_id", c.id).order("created_at", { ascending: false }).limit(15)
  ]);

  state.rewards = rewards || [];
  const vouchers = allVouchers || [];
  const activeVouchers = vouchers.filter((v) => v.status === "active");
  const usedIds = new Set(vouchers.filter((v) => v.status !== "cancelled").map((v) => v.reward_id));
  const isVip = !!c.vip_lifetime;

  const now = new Date();
  const usedThisMonth = vouchers.some((v) => {
    if (v.status === "cancelled" || (v.code || "").startsWith("ANNIV-")) return false;
    const d = new Date(v.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const usedBirthday = vouchers.some((v) => {
    if (v.status === "cancelled" || !(v.code || "").startsWith("ANNIV-")) return false;
    return new Date(v.created_at).getFullYear() === now.getFullYear();
  });

  const unlockedCount = state.rewards.filter((r) => usedIds.has(r.id)).length;
  const annee = state.rewards[0]?.year || 2027;
  const estInstalle = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

  const activeVouchersHtml = activeVouchers.length ? `
    <section class="space-y-2">
      <h3 class="font-serif text-lg font-bold">Mon bon à présenter en caisse</h3>
      ${activeVouchers.map((v) => `<div class="flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-thot-gold bg-white p-4">
        <div>
          <p class="font-bold text-thot-forest">${esc(v.reward_title)}</p>
          <p class="font-mono text-xs text-gray-500">${esc(v.code)} • ${new Date(v.created_at).toLocaleDateString("fr-FR")}</p>
        </div>${qrSvg(v.code, 64)}
      </div>`).join("")}
    </section>` : "";

  const profilHtml = `
    ${!estInstalle ? `<button onclick="installApp()" class="w-full rounded-xl border border-thot-gold bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-900 shadow-sm">
      📲 Installer l'application sur mon écran d'accueil
    </button>` : ""}

    <div class="rounded-2xl bg-thot-forest p-6 text-white shadow-lg">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-widest text-emerald-200">Bouquinerie Thot</p>
          <h2 class="mt-1 font-serif text-xl font-bold">${esc(c.full_name)}</h2>
          ${isVip ? `<span class="mt-1 inline-block rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-bold text-thot-ink">👑 -10 % à vie actif</span>` : ""}
          <p class="mt-3 text-4xl font-extrabold text-amber-300">${c.points} <span class="text-base font-normal text-white">pts</span></p>
          <p class="mt-1 text-xs text-emerald-100">1 € dépensé = 5 points</p>
        </div>
        <div class="rounded-xl bg-white p-2 text-center">${qrSvg(c.card_code, 84)}<p class="mt-1 font-mono text-[10px] font-bold text-thot-ink">${esc(c.card_code)}</p></div>
      </div>
      <div class="mt-4 flex items-center justify-between rounded-xl bg-emerald-900/60 px-3 py-2 text-xs text-emerald-100">
        <span>🏆 Collection ${annee}</span>
        <span class="font-bold text-amber-300">${unlockedCount} / ${state.rewards.length} cases</span>
      </div>
    </div>

    ${isVip ? `<div class="rounded-2xl border-2 border-thot-gold bg-amber-50 p-4 shadow-sm">
      <div class="flex items-center gap-2">
        <span class="text-xl">👑</span>
        <p class="font-serif text-base font-bold text-amber-950">Vos récompenses actives : -10 % à vie</p>
      </div>
      <p class="mt-2 text-xs leading-relaxed text-amber-900">
        Valable uniquement sur les <strong>livres en boutique</strong> : hors promotions et autres offres fidélité, hors jeux de société et salon de thé, hors événements (déstockage, vente au kilo, au sac...), hors box et calendriers.
      </p>
    </div>` : ""}

    ${activeVouchersHtml}

    <section class="space-y-2"><h3 class="font-serif text-lg font-bold">Historique</h3>
      <div class="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
        ${!txs || !txs.length ? `<p class="p-4 text-sm text-gray-500">Aucun mouvement.</p>` : txs.map((t) => `<div class="flex items-center justify-between px-4 py-3 text-sm">
          <div><p class="font-medium">${esc(t.reason)}</p><p class="text-xs text-gray-400">${new Date(t.created_at).toLocaleDateString("fr-FR")}</p></div>
          <span class="font-bold ${t.points_delta >= 0 ? "text-emerald-700" : "text-amber-700"}">${t.points_delta >= 0 ? "+" + t.points_delta : t.points_delta} pts</span>
        </div>`).join("")}
      </div>
    </section>
  `;

  const offresHtml = `
    ${activeVouchersHtml}

    <div class="flex items-center justify-between gap-3 rounded-2xl border-2 border-pink-200 bg-pink-50/70 p-4 shadow-sm">
      <div>
        <p class="font-serif text-sm font-bold text-pink-950">🎂 C'est mon anniversaire !</p>
        <p class="text-[11px] text-pink-900/80">Formule Goûter Malin offerte le jour exact de votre anniversaire (sur présentation d'une pièce d'identité au nom du compte).</p>
      </div>
      ${usedBirthday ? `<span class="shrink-0 rounded-lg bg-pink-200 px-3 py-1.5 text-[11px] font-bold text-pink-900">✅ Utilisée</span>`
      : `<button onclick="claimBirthday()" class="shrink-0 rounded-xl bg-pink-700 px-3.5 py-2 text-xs font-bold text-white">Activer</button>`}
    </div>

    <section class="space-y-3">
      <div>
        <h3 class="font-serif text-lg font-bold">Les 12 offres (${annee})</h3>
        <p class="text-xs text-gray-500">1 choix max par mois • Chaque case ne sert qu'une fois.</p>
      </div>
      ${usedThisMonth ? `<div class="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-900">
        ⏳ Offre du mois déjà choisie ! Revenez le 1er du mois prochain.
      </div>` : ""}
      <div class="grid grid-cols-2 gap-3">
        ${state.rewards.map((r) => {
          const already = usedIds.has(r.id);
          const enough = c.points >= r.points_cost;
          const canPick = !already && !usedThisMonth && enough;
          const isExclu = r.points_cost >= 4995 || (r.title || "").includes("à vie");
          const pct = already ? 100 : Math.min(100, Math.max(0, (c.points / r.points_cost) * 100));
          return `<div class="min-h-[175px] flex flex-col justify-between rounded-2xl border p-2.5 shadow-sm ${already ? "border-emerald-300 bg-emerald-50/70" : isExclu ? "border-2 border-thot-gold bg-amber-50/50" : canPick ? "border-thot-forest bg-white" : "border-stone-200 bg-white/80"}">
            <div>
              <div class="flex items-center justify-between">
                <span class="text-xl">${esc(r.icon || "🎁")}</span>
                <span class="rounded-full px-2 py-0.5 text-[10px] font-bold ${isExclu ? "bg-amber-200 text-amber-950" : already ? "bg-emerald-200 text-emerald-900" : "bg-stone-100 text-thot-forest"}">${r.points_cost} pts</span>
              </div>
              <p class="mt-1.5 font-serif text-xs font-bold leading-tight">${esc(r.title)}</p>
              <p class="mt-1 text-[10px] text-gray-500 leading-tight">${esc(r.description || "")}</p>
            </div>
            <div class="mt-2.5 space-y-2">
              <div class="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                <div class="h-full rounded-full transition-all ${already ? "bg-emerald-500" : isExclu ? "bg-thot-gold" : "bg-thot-forest"}" style="width:${pct}%"></div>
              </div>
              ${already ? `<div class="w-full rounded-lg bg-emerald-200/70 py-1.5 text-center text-[10px] font-bold text-emerald-900">✅ Obtenue</div>`
              : usedThisMonth ? `<div class="w-full rounded-lg bg-stone-100 py-1.5 text-center text-[10px] text-stone-400">Mois prochain</div>`
              : enough ? `<button onclick="redeemReward('${r.id}')" class="w-full rounded-lg ${isExclu ? "bg-thot-gold" : "bg-thot-forest"} py-1.5 text-[11px] font-bold text-white">Choisir</button>`
              : ""}
            </div>
          </div>`;
        }).join("")}
      </div>
    </section>
  `;

  appEl.innerHTML = headerHtml() + `
    <div class="space-y-4">
      <div class="flex items-center justify-between rounded-2xl bg-thot-forest px-4 py-3 text-white shadow">
        <div>
          <p class="text-[11px] text-emerald-200">Vos points • 1 € = 5 pts</p>
          <p class="text-2xl font-extrabold text-amber-300 leading-tight">${c.points} <span class="text-sm font-normal text-white">pts</span></p>
        </div>
        ${isVip ? `<span class="rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-thot-ink">👑 -10 % à vie</span>` : `<span class="text-xs font-medium text-emerald-100">${esc(c.full_name)}</span>`}
      </div>

      <div class="grid grid-cols-2 gap-2 rounded-xl bg-stone-200/70 p-1">
        <button onclick="setClientTab('profil')" class="rounded-lg py-2 text-xs font-bold ${tab === "profil" ? "bg-white text-thot-forest shadow-sm" : "text-gray-600"}">
          🪪 Mon Profil
        </button>
        <button onclick="setClientTab('offres')" class="rounded-lg py-2 text-xs font-bold ${tab === "offres" ? "bg-white text-thot-forest shadow-sm" : "text-gray-600"}">
          🎁 Offres${activeVouchers.length ? ` <span class="ml-1 inline-block rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">${activeVouchers.length}</span>` : ""}
        </button>
      </div>

      ${flashHtml()}
      <div class="space-y-6">${tab === "profil" ? profilHtml : offresHtml}</div>
    </div>`;
};

window.redeemReward = async (id) => {
  const r = state.rewards.find((x) => x.id === id);
  if (!r || !confirm(`Choisir « ${r.title} » pour ${r.points_cost} pts ?\n(1 seule offre par mois, non réutilisable.)`)) return;
  state.msg = null; state.err = null;
  const { error } = await sb.rpc("redeem_reward", { p_reward_id: id });
  if (error) state.err = frError(error.message);
  else state.msg = `Offre « ${r.title} » débloquée ! Présentez le bon en caisse.`;
  await loadProfile();
};

window.claimBirthday = async () => {
  if (!confirm("Attention : ce bon anniversaire est valable UNIQUEMENT le jour exact de votre anniversaire, sur présentation d'une pièce d'identité au nom du compte en caisse.\n\nActiver aujourd'hui ?")) return;
  state.msg = null; state.err = null;
  const { error } = await sb.rpc("claim_birthday_gift");
  if (error) state.err = frError(error.message);
  else state.msg = "🎂 Bon anniversaire activé ! Présentez-le en caisse avec votre pièce d'identité au nom du compte.";
  await loadProfile();
};
