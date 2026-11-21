window.setClientTab = (t) => { state.clientTab = t; state.msg = null; state.err = null; render(); };
window.setTestMonth = (m) => { state.testMonth = m ? parseInt(m, 10) : null; state.msg = null; state.err = null; render(); };

window.renderCustomer = async () => {
  const c = state.customer;
  state.clientTab = state.clientTab || "offres";
  const tab = state.clientTab;
  const canTest = !!c.is_test || c.role === "staff";

  const [{ data: rewards }, { data: allVouchers }] = await Promise.all([
    sb.from("rewards").select("*").eq("active", true).order("sort_order"),
    sb.from("vouchers").select("*").eq("customer_id", c.id).order("created_at", { ascending: false })
  ]);

  state.rewards = rewards || [];
  const vouchers = allVouchers || [];
  const activeVouchers = vouchers.filter((v) => v.status === "active");
  const activeBirthday = activeVouchers.find((v) => (v.code || "").startsWith("ANNIV-"));
  const regularVouchers = activeVouchers.filter((v) => !(v.code || "").startsWith("ANNIV-"));
  const isVip = !!c.vip_lifetime;

  const now = new Date();
  const moisNoms = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const activeMonth = canTest && state.testMonth ? state.testMonth : (now.getMonth() + 1);
  const moisNom = moisNoms[activeMonth - 1];
  const deMois = /^[ao]/i.test(moisNom) ? "d'" : "de ";
  const anneeDuel = state.rewards.find((r) => r.duel_month)?.year || 2027;
  const dernierJour = new Date(anneeDuel, activeMonth, 0).getDate();
  const periodeTxt = `Valable du 1er au ${dernierJour} ${moisNom}`;

  const duelOffers = state.rewards.filter((r) => r.duel_month === activeMonth);
  const permOffers = state.rewards.filter((r) => r.duel_month === null);

  const usedIds = new Set(vouchers.filter((v) => v.status !== "cancelled").map((v) => v.reward_id));
  const usedDuelThisMonth = duelOffers.some((r) => usedIds.has(r.id));
  const usedBirthdayThisYear = vouchers.some((v) => v.status === "used" && (v.code || "").startsWith("ANNIV-") && new Date(v.created_at).getFullYear() === now.getFullYear());
  const estInstalle = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

  const testBarHtml = canTest ? `
    <div class="flex items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-950">
      <span class="font-bold">🧪 Mode test (mois simulé) :</span>
      <select onchange="setTestMonth(this.value)" class="rounded-lg border border-indigo-300 bg-white px-2 py-1 font-semibold">
        <option value="" ${!state.testMonth ? "selected" : ""}>Mois réel (${moisNoms[now.getMonth()]})</option>
        ${[1, 2, 3, 4, 5, 6].map((m) => `<option value="${m}" ${state.testMonth === m ? "selected" : ""}>${moisNoms[m - 1].charAt(0).toUpperCase() + moisNoms[m - 1].slice(1)} 2027</option>`).join("")}
      </select>
    </div>` : "";

  const birthdayBlockHtml = activeBirthday ? `
    <div class="flex items-center justify-between gap-3 rounded-2xl border-2 border-thot-gold bg-amber-100 p-4 shadow-sm">
      <div>
        <p class="font-serif text-base font-bold text-amber-950">🎂 Votre bon anniversaire</p>
        <p class="mt-0.5 text-xs text-amber-900">Formule Goûter Malin offerte • Pièce d'identité au nom du compte requise</p>
        <p class="mt-1 font-mono text-xs font-bold text-amber-950">${esc(activeBirthday.code)} • ${new Date(activeBirthday.created_at).toLocaleDateString("fr-FR")}</p>
      </div>
      <div class="rounded-xl bg-white p-1.5">${qrSvg(activeBirthday.code, 64)}</div>
    </div>`
  : usedBirthdayThisYear ? `<div class="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-gray-500">🎂 Offre anniversaire déjà utilisée cette année.</div>`
  : `<div class="flex items-center justify-between gap-3 rounded-2xl border-2 border-pink-200 bg-pink-50/70 p-4 shadow-sm">
      <div>
        <p class="font-serif text-sm font-bold text-pink-950">🎂 C'est mon anniversaire !</p>
        <p class="text-[11px] text-pink-900/80">Formule Goûter Malin offerte le jour exact de votre anniversaire (sur présentation d'une pièce d'identité au nom du compte).</p>
      </div>
      <button onclick="claimBirthday()" class="shrink-0 rounded-xl bg-pink-700 px-3.5 py-2 text-xs font-bold text-white">Activer</button>
    </div>`;

  const regularVouchersHtml = regularVouchers.length ? `
    <section class="space-y-2">
      <h3 class="font-serif text-lg font-bold">Mon bon à présenter en caisse</h3>
      ${regularVouchers.map((v) => `<div class="flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-thot-gold bg-white p-4">
        <div>
          <p class="font-bold text-thot-forest">${esc(v.reward_title)}</p>
          <p class="font-mono text-xs text-gray-500">${esc(v.code)} • ${new Date(v.created_at).toLocaleDateString("fr-FR")}</p>
        </div>${qrSvg(v.code, 64)}
      </div>`).join("")}
    </section>` : "";

  const renderCard = (r, isDuel) => {
    const already = usedIds.has(r.id);
    const blocked = isDuel && usedDuelThisMonth && !already;
    const enough = c.points >= r.points_cost;
    const isExclu = r.points_cost >= 4995 || (r.title || "").includes("à vie");
    const pct = already ? 100 : Math.min(100, Math.max(0, (c.points / r.points_cost) * 100));
    return `<div class="${isDuel ? "min-h-[195px]" : ""} flex flex-col justify-between rounded-2xl border p-3 shadow-sm ${already ? "border-emerald-300 bg-emerald-50/70" : isExclu ? "border-2 border-thot-gold bg-amber-50/60" : blocked ? "border-stone-200 bg-stone-50 opacity-70" : enough ? "border-thot-forest bg-white" : "border-stone-200 bg-white/85"}">
      <div>
        <div class="flex items-center justify-between gap-1">
          <span class="text-xl">${esc(r.icon || "🎁")}</span>
          <span class="rounded-full px-2 py-0.5 text-[10px] font-bold ${isExclu ? "bg-amber-200 text-amber-950" : already ? "bg-emerald-200 text-emerald-900" : "bg-stone-100 text-thot-forest"}">${r.points_cost} pts</span>
        </div>
        <p class="mt-2 font-serif text-xs font-bold leading-tight">${esc(r.title)}</p>
        <p class="mt-1 text-[10px] text-gray-600 leading-tight">${esc(r.description || "")}</p>
        ${!isDuel ? `<p class="mt-1.5 text-[10px] font-semibold text-amber-800">Valable jusqu'au 31/12/2027</p>` : ""}
      </div>
      <div class="mt-3 space-y-2">
        <div class="h-2 w-full overflow-hidden rounded-full bg-stone-200">
          <div class="h-full rounded-full transition-all ${already ? "bg-emerald-500" : isExclu ? "bg-thot-gold" : "bg-thot-forest"}" style="width:${pct}%"></div>
        </div>
        ${already ? `<div class="w-full rounded-lg bg-emerald-200/70 py-1.5 text-center text-[10px] font-bold text-emerald-900">✅ Choisie</div>`
        : blocked ? `<div class="w-full rounded-lg bg-stone-200/70 py-1.5 text-center text-[10px] text-stone-500">Autre camp choisi</div>`
        : enough ? `<button onclick="redeemReward('${r.id}')" class="w-full rounded-lg ${isExclu ? "bg-thot-gold" : "bg-thot-forest"} py-1.5 text-[11px] font-bold text-white">Choisir</button>`
        : ""}
      </div>
    </div>`;
  };

  const offresHtml = `
    ${regularVouchersHtml}
    ${birthdayBlockHtml}

    <div class="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950">
      ⚔️ <strong>Le 1er de chaque mois</strong>, un nouveau duel inédit d'offres fidélité apparaît ! Choisissez l'une des deux propositions pendant le mois en cours.
    </div>

    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-serif text-lg font-bold">Duel ${deMois}${moisNom}</h3>
          <p class="text-xs font-semibold text-thot-forest">${periodeTxt}</p>
        </div>
        <span class="rounded-full bg-thot-forest px-2.5 py-1 text-[10px] font-bold text-white">1 choix / mois</span>
      </div>
      ${duelOffers.length === 2 ? `
        <div class="relative grid grid-cols-2 gap-3">
          ${renderCard(duelOffers[0], true)}
          ${renderCard(duelOffers[1], true)}
          <div class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-thot-gold text-[10px] font-extrabold text-white shadow">VS</div>
        </div>`
      : `<div class="rounded-2xl border border-stone-200 bg-white p-4 text-xs text-gray-600">
          Le prochain duel arrive le 1er janvier ! Cumulez vos points en boutique en attendant.
        </div>`}
    </section>

    ${permOffers.length ? `<section class="space-y-2">
      <h3 class="font-serif text-lg font-bold">Exclusivité 2027</h3>
      ${permOffers.map((r) => renderCard(r, false)).join("")}
    </section>` : ""}
  `;

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

    ${birthdayBlockHtml}
    ${regularVouchersHtml}
  `;

  appEl.innerHTML = headerHtml() + `
    <div class="space-y-4">
      ${testBarHtml}
      <div class="flex items-center justify-between gap-3 rounded-2xl bg-thot-forest px-4 py-3 text-white shadow">
        <div>
          <p class="text-[11px] text-emerald-200">Vos points • 1 € = 5 pts</p>
          <p class="text-2xl font-extrabold text-amber-300 leading-tight">${c.points} <span class="text-sm font-normal text-white">pts</span></p>
        </div>
        <div class="text-right">
          <p class="text-xs font-semibold text-emerald-50">${esc(c.full_name)}</p>
          ${isVip ? `<span class="mt-1 inline-block rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold text-thot-ink">👑 -10 % à vie</span>` : ""}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 rounded-xl bg-stone-200/70 p-1">
        <button onclick="setClientTab('offres')" class="rounded-lg py-2 text-xs font-bold ${tab === "offres" ? "bg-white text-thot-forest shadow-sm" : "text-gray-600"}">
          🎁 Offres${activeVouchers.length ? ` <span class="ml-1 inline-block rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">${activeVouchers.length}</span>` : ""}
        </button>
        <button onclick="setClientTab('profil')" class="rounded-lg py-2 text-xs font-bold ${tab === "profil" ? "bg-white text-thot-forest shadow-sm" : "text-gray-600"}">
          👤 Mon Profil
        </button>
      </div>

      ${flashHtml()}
      <div class="space-y-5">${tab === "offres" ? offresHtml : profilHtml}</div>
    </div>`;
};

window.redeemReward = async (id) => {
  const r = state.rewards.find((x) => x.id === id);
  if (!r || !confirm(`Choisir « ${r.title} » pour ${r.points_cost} pts ?`)) return;
  state.msg = null; state.err = null;
  const { error } = await sb.rpc("redeem_reward", { p_reward_id: id, p_test_month: state.testMonth || null });
  if (error) state.err = frError(error.message);
  else state.msg = `Offre « ${r.title} » débloquée ! Présentez le bon en caisse.`;
  await loadProfile();
};

window.claimBirthday = async () => {
  if (!confirm("Attention : ce bon anniversaire est valable UNIQUEMENT le jour exact de votre anniversaire, sur présentation d'une pièce d'identité au nom du compte en caisse.\n\nActiver aujourd'hui ?")) return;
  state.msg = null; state.err = null;
  const { error } = await sb.rpc("claim_birthday_gift");
  if (error) state.err = frError(error.message);
  else state.msg = "🎂 Votre bon anniversaire est prêt !";
  await loadProfile();
};
