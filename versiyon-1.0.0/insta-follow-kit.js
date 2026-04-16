// =====================================================================
//  InstaFollowKit — Instagram Takip Analiz Aracı
//  Versiyon: 1.0.0  ·  Depo yolu: versiyon-1.0.0/insta-follow-kit.js
//  Kullanım: www.instagram.com adresinde tarayıcı konsoluna yapıştırın.
// =====================================================================
(function () {
    "use strict";

    if (location.hostname !== "www.instagram.com") {
        alert("Bu script yalnızca www.instagram.com adresinde çalışır.");
        return;
    }

    /** Profil sayfasındaysanız (/kullanici/) bu kullanıcı adı API ile birleştirilir. */
    const IG_PATH_USERNAME = (function () {
        try {
            const seg = location.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
            if (seg.length !== 1) return null;
            const u = seg[0];
            if (/^(direct|explore|reels|accounts|stories|p|reel|legal|tv|www|graphql|developer|help)$/i.test(u)) return null;
            if (!/^[A-Za-z0-9._]+$/.test(u)) return null;
            return u;
        } catch (_) {
            return null;
        }
    })();

    // ─────────────────────────────────────────────────────────────────
    // SABITLER
    // ─────────────────────────────────────────────────────────────────
    const VERSIYON = "1.0.0";

    /** Yazar panelinde gösterilen kısa sürüm notu (görünür sürüm = VERSIYON). */
    const SURUM_NOTU = "İlk kararlı sürüm: güvenli mod, tema, işlem geçmişi, liste dışa aktarma ve HD profil önizlemesi.";

    /** Tarama istekleri arasında bu kadar sayfa sonra kısa güvenlik molası (klasik mod, sadece okuma). */
    const TARAMA_MOLA_SAYFA = 25;
    /** Referans (IU-bundle) modunda her N tam sayfa isteğinden sonra ek seri molası. */
    const TARAMA_SERI_MOLA_DONGU = 7;

    /**
     * Popüler Instagram Unfollowers bundle ile aynı taban süreler (ms).
     * Tarama: istek arası ~1.0–1.3×; her 7 istekte seri mola; bırakma: ~1.0–1.2× arası; her N başarıda uzun mola.
     */
    const REFERANS_PROFIL = {
        taramaArasi:       1000,
        taramaSeriMolaMs:  10000,
        taramaMola:        3000,
        birakmaArasi:      4000,
        birakmaMola:       300000,
        saatlikLimit:      200,
        gunlukLimit:       4800,
    };

    const VARSAYILAN = {
        taramaArasi:  400,
        taramaMola:   3000,
        birakmaArasi: 18000,
        birakmaMola:  300000,
        saatlikLimit: 200,
        gunlukLimit:  4800,
        otoDurak:     true,
        insanModu:    true,
        /** Bundle ile uyumlu gecikme bantları + 7’lik seri mola (insan modu ile birlikte). */
        referansZamanlama: true,
        taramaSeriMolaMs: 10000,
        guvenlikSeviyesi: "yuksek",
        sayfaAdet:    50,
        siralama:     "az",
        tema:         "turuncu",
    };

    // Güvenli mod kilitlendiğinde sıfırlanan profil — referans sürelerine yakın
    const GUVENLI_PROFIL = {
        taramaArasi:       REFERANS_PROFIL.taramaArasi,
        taramaMola:        REFERANS_PROFIL.taramaMola,
        taramaSeriMolaMs:  REFERANS_PROFIL.taramaSeriMolaMs,
        birakmaArasi:      REFERANS_PROFIL.birakmaArasi,
        birakmaMola:       REFERANS_PROFIL.birakmaMola,
        saatlikLimit:      REFERANS_PROFIL.saatlikLimit,
        gunlukLimit:       REFERANS_PROFIL.gunlukLimit,
        referansZamanlama: true,
    };

    /** Ayarlar ekranında kilit açıkken gösterilen yazar (tek yerden düzenleyin). */
    const YAZAR_GOSTERIM = "Bahadır B. Bekdemir";

    /** Yan panelde seçilebilir 5 canlı tema anahtarı (TEMALAR ile uyumlu). */
    const TEMALAR_CANLI = ["mor", "mavi", "pembe", "turuncu", "cam", "kirmizi", "altin"];

    /** Başarılı unfollow sayısına göre uzun mola öncesi rastgele eşik (~50, ör. 45–55). */
    function rastgeleBatchEsigi() {
        return 45 + Math.floor(Math.random() * 11);
    }

    // Tema renk paleteleri
    const TEMALAR = {
        mor:    { acc:"#9333ea", acc2:"#7e22ce", acc3:"rgba(147,51,234,.12)", prog:"#a855f7" },
        mavi:   { acc:"#2563eb", acc2:"#1d4ed8", acc3:"rgba(37,99,235,.12)",  prog:"#3b82f6" },
        cam:    { acc:"#0891b2", acc2:"#0e7490", acc3:"rgba(8,145,178,.12)",   prog:"#06b6d4" },
        pembe:  { acc:"#db2777", acc2:"#be185d", acc3:"rgba(219,39,119,.12)",  prog:"#ec4899" },
        yesil:  { acc:"#16a34a", acc2:"#15803d", acc3:"rgba(22,163,74,.12)",   prog:"#22c55e" },
        turuncu:{ acc:"#ea580c", acc2:"#c2410c", acc3:"rgba(234,88,12,.12)",   prog:"#fb923c" },
        kirmizi:{ acc:"#dc2626", acc2:"#b91c1c", acc3:"rgba(220,38,38,.12)",   prog:"#f87171" },
        indigo: { acc:"#4f46e5", acc2:"#4338ca", acc3:"rgba(79,70,229,.12)",   prog:"#818cf8" },
        altin:  { acc:"#ca8a04", acc2:"#a16207", acc3:"rgba(202,138,4,.12)",    prog:"#eab308" },
        gul:    { acc:"#e11d48", acc2:"#be123c", acc3:"rgba(225,29,72,.12)",   prog:"#fb7185" },
        lacivert:{ acc:"#1e3a8a", acc2:"#1e40af", acc3:"rgba(30,58,138,.12)",  prog:"#60a5fa" },
    };

    const ANAHTAR = {
        beyazListe: "iu_wl_v3",
        notlar:     "iu_notlar_v3",
        etiketler:  "iu_etiket_v3",
        gecmis:     "iu_gecmis_v3",
        ayarlar:    "iu_ayarlar_v3",
        guvenliKilit: "iu_guvenli_kilit_v1",
        gunSayac:   "iu_gun_v3",
        saatSayac:  "iu_saat_v3",
    };

    const PROFIL_RESMI_YOK = [
        "44884218_345707102882519_2446069589734326272_n",
        "464760996_1254146839119862_3605321457742435801_n",
    ];

    const SEKMELER = {
        takipEtmeyen: "Takip Etmeyenler",
        karsiliksiz:  "Karşılıklı",
        takipci:      "Takipçi",
        tumu:         "Tüm Takipçiler",
        beyazListe:   "⭐ Beyaz Liste",
    };

    const SIRALAMALAR = {
        az:        "A → Z",
        za:        "Z → A",
        dogrulandi:"Doğrulanmış Önce",
        gizli:     "Gizli Önce",
        fotosuz:   "Fotoğrafsız Önce",
    };

    /** sessionStorage: harf bölümü kapalı { [harfKey]: true } */
    const SS_HARF_KAPALI = "iu_harf_kapali_v1";

    function harfIdSafe(key) {
        return String(key).replace(/[^a-zA-Z0-9_-]/g, "_");
    }

    function harfKapaliOku() {
        try {
            return JSON.parse(sessionStorage.getItem(SS_HARF_KAPALI) || "{}");
        } catch {
            return {};
        }
    }

    function harfKapaliToggle(key) {
        const o = harfKapaliOku();
        const wasKapali = !!o[key];
        o[key] = !o[key];
        sessionStorage.setItem(SS_HARF_KAPALI, JSON.stringify(o));
        return wasKapali && !o[key];
    }

    /** Harf bölümü kapalı (true) / açık (false) — kapanış animasyonu sonrası doğrudan yazım için. */
    function harfKapaliYaz(key, kapali) {
        const o = harfKapaliOku();
        o[key] = kapali;
        sessionStorage.setItem(SS_HARF_KAPALI, JSON.stringify(o));
    }

    /** Harf başlığı tıklanınca: açılışta toggle+reveal; kapanışta önce satır fade-out sonra depolama. */
    function harfBolumTiklama(hk) {
        const st = harfKapaliOku();
        const simdikiKapali = !!st[hk];
        if (simdikiKapali) {
            if (harfKapaliToggle(hk)) Ref.harfRevealHarf = hk;
            render();
            return;
        }
        if (Ref.harfKapatiliyor) return;
        Ref.harfKapatiliyor = hk;
        render();
        clearTimeout(Ref.harfKapatTimer);
        Ref.harfKapatTimer = setTimeout(() => {
            harfKapaliYaz(hk, true);
            Ref.harfKapatiliyor = null;
            Ref.harfKapatTimer = null;
            render();
        }, 320);
    }

    /** Instagram CDN profil foto URL adayları (Lens / HD için büyükten küçüğe). */
    function profilPicUrlCandidates(raw) {
        const s = String(raw || "");
        if (!s) return [];
        const out = [];
        const add = u => { if (u && !out.includes(u)) out.push(u); };
        const up1080 = u => u.replace(/s150x150|s240x240|s320x320|s480x480|s640x640/gi, "s1080x1080");
        add(up1080(s.replace(/\/stp=[^/]+\//g, "/")));
        add(up1080(s));
        add(s.replace(/\/stp=[^/]+\//g, "/"));
        add(s.replace(/s150x150|s240x240|s320x320|s480x480/gi, "s1080x1080"));
        add(s.replace(/s150x150|s240x240|s320x320|s480x480/gi, "s640x640"));
        add(s.replace(/s150x150|s240x240|s320x320|s480x480/gi, "s320x320"));
        add(s.replace(/s150x150\//g, "").replace(/s320x320\//g, ""));
        return out;
    }

    /** Google Lens için mümkün olan en büyük profil görseli URL’si. */
    function profilPicUrlBestForLens(raw) {
        const c = profilPicUrlCandidates(raw);
        return c[0] || String(raw || "").trim();
    }

    function isletmeHesabi(k) {
        return !!(k.is_business_account || k.is_business || k.is_professional_account);
    }

    /** Tablo rozet sütunu ile aynı onay işareti SVG (yan panel karolarında da kullanılır). */
    const IU_BT_VER_SVG = `<svg class="iu-bt-svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;

    /** Yan panel satırı — liste tablosundaki rozet karoları ile aynı sınıflar. */
    const yanPanelRozetKaro = {
        takipEtmeyen: () => `<span class="iu-badge-tile iu-bt-empty" title="${titleAttr("Takip etmeyen — tabloda rozet yok")}" aria-hidden="true">—</span>`,
        karsiliksiz: () => `<span class="iu-badge-tile iu-bt-mut" title="${titleAttr("Karşılıklı takip")}" aria-hidden="true"><span class="iu-bt-ic">⇄</span></span>`,
        dogrulandi: () => `<span class="iu-badge-tile iu-bt-ver" title="${titleAttr("Onaylı hesap")}" aria-hidden="true">${IU_BT_VER_SVG}</span>`,
        gizli: () => `<span class="iu-badge-tile iu-bt-lock" title="${titleAttr("Gizli hesap")}" aria-hidden="true"><span class="iu-bt-ic">🔒</span></span>`,
        fotosuz: () => `<span class="iu-badge-tile iu-bt-noph" title="${titleAttr("Fotoğrafsız / varsayılan avatar")}" aria-hidden="true"><span class="iu-bt-ic">👤</span></span>`,
        sayfa: () => `<span class="iu-badge-tile iu-bt-page" title="${titleAttr("Bu sayfadaki satırlar")}" aria-hidden="true"><span class="iu-bt-ic">▢</span></span>`,
        tumunu: () => `<span class="iu-badge-tile iu-bt-tum" title="${titleAttr("Tüm liste")}" aria-hidden="true">${IU_BT_VER_SVG}</span>`,
    };

    /** Satırda en fazla gösterilecek rozet (fazlası "+N daha" olarak gösterilir). */
    const ROZET_SATIR_LIMIT = 3;

    function rozetGridHtml(k) {
        const tiles = [];
        if (k.is_verified) {
            tiles.push(`<span class="iu-badge-tile iu-bt-ver" title="${titleAttr("Onaylı hesap")}" aria-label="${titleAttr("Onaylı hesap")}">${IU_BT_VER_SVG}</span>`);
        }
        if (isletmeHesabi(k)) {
            tiles.push(`<span class="iu-badge-tile iu-bt-biz" title="${titleAttr("İşletme / profesyonel hesap")}" aria-label="${titleAttr("İşletme")}"><span class="iu-bt-ic" aria-hidden="true">🏢</span></span>`);
        }
        if (k.is_private) {
            tiles.push(`<span class="iu-badge-tile iu-bt-lock" title="${titleAttr("Gizli hesap")}" aria-label="${titleAttr("Gizli hesap")}"><span class="iu-bt-ic" aria-hidden="true">🔒</span></span>`);
        }
        if (fotosuzMu(k)) {
            tiles.push(`<span class="iu-badge-tile iu-bt-noph" title="${titleAttr("Fotoğrafsız / varsayılan avatar")}" aria-label="${titleAttr("Fotoğrafsız")}"><span class="iu-bt-ic" aria-hidden="true">👤</span></span>`);
        }
        if (k.follows_viewer) {
            tiles.push(`<span class="iu-badge-tile iu-bt-mut" title="${titleAttr("Karşılıklı takip")}" aria-label="${titleAttr("Karşılıklı takip")}"><span class="iu-bt-ic" aria-hidden="true">⇄</span></span>`);
        }
        if (!tiles.length) {
            return `<div class="iu-badge-chips" role="group" aria-label="Rozetler"><span class="iu-badge-tile iu-bt-empty" title="Rozet yok">—</span></div>`;
        }
        const gorunen = tiles.slice(0, ROZET_SATIR_LIMIT);
        const fazla = tiles.length - ROZET_SATIR_LIMIT;
        const fazlaHtml = fazla > 0
            ? `<span class="iu-badge-tile iu-bt-artik" title="${titleAttr("+" + fazla + " rozet daha")}" aria-label="${fazla} rozet daha">+${fazla}</span>`
            : "";
        return `<div class="iu-badge-chips" role="group" aria-label="Rozetler">${gorunen.join("")}${fazlaHtml}</div>`;
    }

    // ─────────────────────────────────────────────────────────────────
    // YARDIMCILAR
    // ─────────────────────────────────────────────────────────────────
    const bekle = ms => new Promise(r => setTimeout(r, ms));

    function rastgeleMola(ms) {
        const v = ms * 0.35;
        return Math.max(1000, ms + Math.floor(Math.random() * v * 2 - v));
    }

    /** IU-bundle: tarama istekleri arası ~taban ile ~%30 üst rastgele. */
    function taramaAralikReferans(ms) {
        const b = Math.max(1, Math.round(ms));
        return Math.floor(Math.random() * (0.3 * b)) + b;
    }

    /** IU-bundle: bırakma arası ~taban ile ~%20 üst rastgele. */
    function birakmaAralikReferans(ms) {
        const b = Math.max(1, Math.round(ms));
        return Math.floor(Math.random() * (0.2 * b)) + b;
    }

    function cerez(ad) {
        const p = `; ${document.cookie}`.split(`; ${ad}=`);
        return p.length === 2 ? p.pop().split(";").shift() : null;
    }

    function tarihStr(ts) { return new Date(ts).toLocaleString("tr-TR"); }

    /** Geçmiş tablosu: `14.04.2026 / 10:39:10` */
    function tarihGecmisGoster(ts) {
        const d = new Date(Number(ts) || 0);
        if (Number.isNaN(d.getTime())) return "—";
        return `${d.toLocaleDateString("tr-TR")} / ${d.toLocaleTimeString("tr-TR")}`;
    }

    function sureFmt(ms) {
        const n = Math.max(0, Math.floor(Number(ms) || 0));
        if (n < 60000) return `${Math.max(0, Math.round(n / 1000))} sn`;
        const dk = Math.floor(n / 60000);
        const sn = Math.floor((n % 60000) / 1000);
        if (n < 3600000) return sn > 0 ? `${dk} dk ${sn} sn` : `${dk} dk`;
        const sa = n / 3600000;
        return `${sa >= 10 ? sa.toFixed(0) : sa.toFixed(1)} sa`;
    }

    function fotosuzMu(k) {
        return PROFIL_RESMI_YOK.some(id => k.profile_pic_url.includes(id));
    }

    function esc(s) { return String(s || "").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

    /** HTML title="" için güvenli tek satır (tam metin ipucu). */
    function titleAttr(s) {
        return String(s ?? "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/\s+/g, " ")
            .trim();
    }

    /** Profil görseli URL’si ile Google Lens (URL ile yükleme; önizlemedeki HD ile aynı HTTPS kaynak). */
    function googleReverseImageUrl(imageUrl) {
        const u = String(imageUrl || "").trim();
        if (!u) return "";
        return "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(u);
    }

    /**
     * Instagram web API: seçili kullanıcı adına göre HD profil görseli URL’si.
     * Oturum çerezleriyle çağrılır (sayfa instagram.com üzerindeyken).
     */
    async function instagramWebProfilHdPicUrl(username) {
        const u = String(username || "").trim();
        if (!u) throw new Error("Kullanıcı adı yok");
        const res = await fetch(
            `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(u)}`,
            {
                headers: {
                    "X-IG-App-ID": "936619743392459",
                    "accept-language": "tr-TR,tr;q=0.9",
                },
                credentials: "include",
            }
        );
        if (!res.ok) throw new Error(`Profil isteği başarısız (${res.status})`);
        const json = await res.json();
        const user = json?.data?.user;
        if (!user) throw new Error("Kullanıcı bulunamadı");
        const imgUrl =
            user.profile_pic_url_hd
            || user.hd_profile_pic_url_info?.url
            || user.profile_pic_url;
        if (!imgUrl) throw new Error("Profil fotoğrafı adresi yok");
        return String(imgUrl).trim();
    }

    /** Profil HTML sayfasından (girişli oturum) görsel URL çıkar — API yedek. */
    async function instagramProfilSayfasindanPicUrl(username) {
        const un = String(username || "").trim().replace(/^@/, "");
        if (!un) return "";
        const res = await fetch(`https://www.instagram.com/${encodeURIComponent(un)}/`, {
            credentials: "include",
            headers: {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "accept-language": "tr-TR,tr;q=0.9",
            },
        });
        if (!res.ok) return "";
        const html = await res.text();
        const temiz = s => String(s || "").replace(/\\\//g, "/").replace(/\\u0026/g, "&").trim();
        let m = html.match(/"profile_pic_url_hd"\s*:\s*"(https?:[^"]+)"/);
        if (m) return temiz(m[1]);
        m = html.match(/profile_pic_url_hd["']?\s*:\s*["'](https?:[^"']+)["']/);
        if (m) return temiz(m[1]);
        m = html.match(/"profile_pic_url"\s*:\s*"(https?:[^"]+)"/);
        if (m) return temiz(m[1]);
        m = html.match(/property="og:image"\s+content="([^"]+)"/i);
        if (m) return m[1].replace(/&amp;/g, "&");
        const i = html.indexOf("profile_pic_url_hd");
        if (i !== -1) {
            const snip = html.slice(i, i + 900);
            m = snip.match(/(https?:\\\/\\\/cdninstagram[^"\\\s]+)/) || snip.match(/(https:\/\/[^"\\\s]*cdninstagram[^"\\\s]*)/);
            if (m) return temiz(m[1]);
        }
        return "";
    }

    /** API + profil sayfası sırayla dener (ikisi de başarısızsa hata). */
    async function cozHdProfilPicUrl(username) {
        let url = "";
        try {
            url = await instagramWebProfilHdPicUrl(username);
        } catch (e) {
            console.warn("[IU] web_profile_info:", e);
        }
        if (!url) {
            try {
                url = await instagramProfilSayfasindanPicUrl(username);
            } catch (e) {
                console.warn("[IU] profil HTML:", e);
            }
        }
        if (!url) throw new Error("Profil fotoğrafı adresi bulunamadı (API ve profil sayfası)");
        return url;
    }

    /** CDN görselini çekip blob URL döndürür; bazı CDN yanıtları için çerezli/çerezsiz dener. */
    async function profilResmiBlobUrlOlustur(imageHttpUrl) {
        const u = String(imageHttpUrl || "").trim();
        if (!u) return null;
        const attempts = [
            () => fetch(u, { credentials: "include", mode: "cors", cache: "no-store" }),
            () => fetch(u, { credentials: "omit", mode: "cors", cache: "no-store" }),
        ];
        for (const run of attempts) {
            try {
                const r = await run();
                if (!r.ok) continue;
                const blob = await r.blob();
                if (!blob || blob.size < 32) continue;
                return URL.createObjectURL(blob);
            } catch {
                /* bir sonraki */
            }
        }
        return null;
    }

    function profilHdBlobIptal() {
        const p = D.profilHdOnizleme;
        if (p && p.blobSrc && p.url && String(p.url).startsWith("blob:")) {
            try { URL.revokeObjectURL(p.url); } catch (_) {}
        }
    }

    function attrEscUrl(u) {
        return String(u || "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;");
    }

    /** HD önizleme: ilgili satırın hemen altına eklenen tablo satırı. */
    function profilHdOnizlemeSatirHtml(po) {
        if (!po || !po.url) return "";
        const imgOnerr = `(function(el){if(!el.dataset.iuHdid){el.dataset.iuHdid='1';var fb=el.getAttribute('data-iu-hd-fb');if(fb){el.src=fb;return;}}el.onerror=null;el.style.opacity='.4';})(this)`;
        return `<tr class="iu-hd-inline-tr" id="iu-hd-onizleme"><td colspan="6" class="iu-hd-inline-td">
  <div class="iu-hd-onizleme iu-hd-onizleme--inline iu-hd-animate" role="region" aria-label="@${esc(po.username)} HD profil">
  <div class="iu-hd-onizleme-sheet">
    <div class="iu-hd-sheet-head">
      <div class="iu-hd-sheet-head-txt">
        <span class="iu-hd-sheet-user">@${esc(po.username)}</span>
      </div>
      <button type="button" class="iu-hd-onizleme-x" id="iu-hd-onizleme-kapat" title="Kapat" aria-label="Önizlemeyi kapat">×</button>
    </div>
    <div class="iu-hd-imgrow">
      <div class="iu-hd-onizleme-imgwrap">
        <img class="iu-hd-onizleme-img" src="${attrEscUrl(po.url)}" alt="@${esc(po.username)} — HD profil" loading="eager" decoding="async" referrerpolicy="no-referrer-when-downgrade"${po.fallbackUrl ? ` data-iu-hd-fb="${attrEscUrl(po.fallbackUrl)}"` : ""} onerror="${imgOnerr}"/>
      </div>
      <div class="iu-hd-actions iu-hd-actions--export" role="toolbar" aria-label="Görsel dışa aktarma">
        <div class="iu-hd-actions-sec">
          <button type="button" class="iu-hd-tool iu-hd-tool--mini" data-iu-hd-png data-iu-hd-un="${esc(po.username)}" title="PNG indir">PNG</button>
          <button type="button" class="iu-hd-tool iu-hd-tool--mini" data-iu-hd-jpg data-iu-hd-un="${esc(po.username)}" title="JPG indir">JPG</button>
          <button type="button" class="iu-hd-tool iu-hd-tool--mini" data-iu-hd-copy title="Panoya kopyala">Kopyala</button>
        </div>
      </div>
    </div>
  </div>
</div>
</td></tr>`;
    }

    async function profilHdOnizlemeYukle(username, fallbackUrl, afterPid) {
        const un = String(username || "").trim();
        if (!un) return;
        const ap = afterPid != null ? String(afterPid) : "";
        const cur = D.profilHdOnizleme;
        if (cur && cur.url && ap && cur.afterPid != null && String(cur.afterPid) === ap) {
            profilHdBlobIptal();
            D.profilHdOnizleme = null;
            const elRes = document.getElementById("iu-res");
            Ref.iuResPending = elRes ? elRes.scrollTop : 0;
            render();
            return;
        }
        let rawUrl = "";
        try {
            rawUrl = await cozHdProfilPicUrl(un);
        } catch (err) {
            console.warn("[IU] HD profil:", err);
            if (fallbackUrl) rawUrl = fallbackUrl;
            else {
                toast(`Profil görseli alınamadı: ${err.message || "bilinmiyor"}`, "warning", 4500);
                return;
            }
        }
        if (!rawUrl) {
            toast("Profil fotoğrafı adresi boş döndü.", "warning", 3200);
            return;
        }
        profilHdBlobIptal();
        const blobUrl = await profilResmiBlobUrlOlustur(rawUrl);
        const blobSrc = !!blobUrl;
        const displayUrl = blobUrl || rawUrl;
        const showFallback = !!fallbackUrl && fallbackUrl !== rawUrl;
        D.profilHdOnizleme = {
            url: displayUrl,
            username: un,
            blobSrc,
            fallbackUrl: showFallback ? fallbackUrl : "",
            afterPid: ap,
            lensUrl: rawUrl,
        };
        const elRes = document.getElementById("iu-res");
        Ref.iuResPending = elRes ? elRes.scrollTop : 0;
        render();
    }

    /** Küçük önizleme URL’sinden türetilmiş HD aday ile Lens bağlantısı. */
    function googleLensProfilUrl(profilePicUrl) {
        const best = profilPicUrlBestForLens(profilePicUrl);
        return best ? googleReverseImageUrl(best) : "";
    }

    /** Lens engellenirse yedek: Google görsel arama (kullanıcı adı). */
    function googleGorselAramaYedek(username) {
        const u = String(username || "").replace(/[^\w.]/g, "") || "user";
        return "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(`"${u}" instagram`);
    }

    /** Instagram GraphQL: sayfa başına en fazla ~50 öğe (daha büyük değerler yok sayılır). */
    function taramaSayfaBoyu() {
        const a = Depo.ayarlar();
        const n = Number(a.sayfaAdet);
        const x = Number.isFinite(n) && n > 0 ? n : 50;
        return Math.min(50, Math.max(12, Math.round(x)));
    }

    /** Takip edilenler (following) — web GraphQL. */
    function taramaURL(cursor) {
        const id = cerez("ds_user_id");
        const first = String(taramaSayfaBoyu());
        const v = { id, include_reel: "true", fetch_mutual: "true", first };
        if (cursor) v.after = cursor;
        return `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables=${encodeURIComponent(JSON.stringify(v))}`;
    }

    /** Sizi takip edenler (followers) — aynı değişken yapısı, farklı hash / edge. */
    function taramaTakipciURL(cursor) {
        const id = cerez("ds_user_id");
        const first = String(taramaSayfaBoyu());
        const v = { id, include_reel: "true", fetch_mutual: "true", first };
        if (cursor) v.after = cursor;
        const TAKIPCI_QUERY_HASH = "c76146de99bb02f6415203be841dd25a";
        return `https://www.instagram.com/graphql/query/?query_hash=${TAKIPCI_QUERY_HASH}&variables=${encodeURIComponent(JSON.stringify(v))}`;
    }

    /** Tarayıcının tarama ekranını çizmesi için bir kare bekler (siyah ekran hissi azalır). */
    function paintBirKere() {
        return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }

    const birakURL = id => `https://www.instagram.com/web/friendships/${id}/unfollow/`;
    const takipURL = id => `https://www.instagram.com/web/friendships/${id}/follow/`;
    const takipciKaldirURL = id => `https://www.instagram.com/web/friendships/${id}/remove_follower/`;

    /** Instagram web arayüzüyle uyumlu POST başlıkları (CSRF + App-ID + Referer). */
    function instagramWebFetchHeaders(csrf, refererPath) {
        const ref = refererPath
            ? `https://www.instagram.com${String(refererPath).startsWith("/") ? refererPath : "/" + refererPath}`
            : "https://www.instagram.com/";
        return {
            "content-type": "application/x-www-form-urlencoded",
            "x-csrftoken": csrf,
            "x-requested-with": "XMLHttpRequest",
            "x-ig-app-id": "936619743392459",
            "accept": "*/*",
            "accept-language": "tr-TR,tr;q=0.9",
            "origin": "https://www.instagram.com",
            "referer": ref,
        };
    }

    /** friendship/* yanıtında başarı / hata metni (JSON veya gövde). */
    async function instagramFriendshipYanitOku(res) {
        let mesaj = "";
        let apiOk = res.ok;
        try {
            const j = await res.clone().json();
            if (j && typeof j === "object") {
                mesaj = String(j.message || j.feedback_message || j.error || "").trim();
                if (j.status === "fail" || j.result === "fail") apiOk = false;
            }
        } catch (_) {
            if (!res.ok) {
                mesaj = mesaj || `HTTP ${res.status}`;
                apiOk = false;
            }
        }
        if (!res.ok) apiOk = false;
        return { apiOk, mesaj };
    }

    /** Web `/web/friendships/.../remove_follower/` sonra yedek olarak API v1 uç noktası. */
    async function instagramRemoveFollowerDene(k, csrf) {
        const h = instagramWebFetchHeaders(csrf, `/${k.username}/`);
        let r = await fetch(takipciKaldirURL(k.id), {
            method: "POST",
            headers: h,
            credentials: "include",
            mode: "cors",
        });
        if (r.status === 429) return { r, ...(await instagramFriendshipYanitOku(r)) };
        let y = await instagramFriendshipYanitOku(r);
        if (r.ok && y.apiOk) return { r, ...y };
        const r2 = await fetch(`https://www.instagram.com/api/v1/friendships/remove_follower/${k.id}/`, {
            method: "POST",
            headers: h,
            credentials: "include",
            mode: "cors",
        });
        if (r2.status === 429) return { r: r2, ...(await instagramFriendshipYanitOku(r2)) };
        y = await instagramFriendshipYanitOku(r2);
        return { r: r2, ...y };
    }

    /** Google Lens: herkese açık HTTPS profil URL’si (blob değil; `lensUrl` / HD CDN). */
    function tersGorselAramaBaglantilari(httpUrl) {
        const base = profilPicUrlBestForLens(httpUrl || "");
        if (!base || !/^https?:\/\//i.test(base)) return null;
        return { lens: googleReverseImageUrl(base) };
    }

    function profilHdGorselPngIndir(username) {
        const img = document.querySelector("#iu-hd-onizleme .iu-hd-onizleme-img");
        if (!img || !img.naturalWidth) {
            toast("Görsel henüz yüklenmedi.", "warning", 2800);
            return;
        }
        const safe = String(username || "profil").replace(/[^\w.-]/g, "_");
        try {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext("2d").drawImage(img, 0, 0);
            c.toBlob(b => {
                if (!b) {
                    toast("PNG oluşturulamadı.", "error", 3000);
                    return;
                }
                const a = Object.assign(document.createElement("a"), {
                    href: URL.createObjectURL(b),
                    download: `ig_${safe}_hd.png`,
                });
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(a.href);
                toast("PNG indirildi.", "success", 2000);
            }, "image/png");
        } catch (e) {
            console.warn("[IU] PNG:", e);
            const a = Object.assign(document.createElement("a"), { href: img.src, download: `ig_${safe}.jpg`, target: "_blank", rel: "noopener" });
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast("Doğrudan bağlantı açıldı (PNG dönüşümü engellendi).", "info", 4000);
        }
    }

    function profilHdGorselJpgIndir(username) {
        const img = document.querySelector("#iu-hd-onizleme .iu-hd-onizleme-img");
        if (!img || !img.naturalWidth) {
            toast("Görsel henüz yüklenmedi.", "warning", 2800);
            return;
        }
        const safe = String(username || "profil").replace(/[^\w.-]/g, "_");
        try {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext("2d").drawImage(img, 0, 0);
            c.toBlob(b => {
                if (!b) {
                    toast("JPG oluşturulamadı.", "error", 3000);
                    return;
                }
                const a = Object.assign(document.createElement("a"), {
                    href: URL.createObjectURL(b),
                    download: `ig_${safe}_hd.jpg`,
                });
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(a.href);
                toast("JPG indirildi.", "success", 2000);
            }, "image/jpeg", 0.92);
        } catch (e) {
            console.warn("[IU] JPG:", e);
            toast("JPG indirilemedi.", "warning", 3000);
        }
    }

    function profilHdGorselPanoyaKopyala() {
        const img = document.querySelector("#iu-hd-onizleme .iu-hd-onizleme-img");
        if (!img || !img.naturalWidth) {
            toast("Görsel henüz yüklenmedi.", "warning", 2800);
            return;
        }
        try {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext("2d").drawImage(img, 0, 0);
            c.toBlob(async b => {
                if (!b) {
                    toast("Kopyalanacak veri oluşmadı.", "error", 3000);
                    return;
                }
                try {
                    if (!navigator.clipboard?.write) throw new Error("clipboard");
                    await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
                    toast("Görsel panoya kopyalandı.", "success", 2000);
                } catch (e) {
                    console.warn("[IU] pano:", e);
                    toast("Panoya kopyalanamadı (tarayıcı izni veya güvenlik).", "warning", 4200);
                }
            }, "image/png");
        } catch (e) {
            console.warn("[IU] kopyala:", e);
            toast("Kopyalama başarısız.", "warning", 3000);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // DEPO
    // ─────────────────────────────────────────────────────────────────
    const Depo = {
        oku(k, v = null)   { try { const d = localStorage.getItem(k); return d ? JSON.parse(d) : v; } catch { return v; } },
        yaz(k, v)          { localStorage.setItem(k, JSON.stringify(v)); },
        sil(k)             { localStorage.removeItem(k); },

        ayarlar() {
            const m = { ...VARSAYILAN, ...this.oku(ANAHTAR.ayarlar, {}) };
            if (!TEMALAR_CANLI.includes(m.tema)) m.tema = "turuncu";
            return m;
        },
        ayarlarKaydet(a)   { this.yaz(ANAHTAR.ayarlar, a); },

        /** true = kilit açık (varsayılan): yazar paneli, ayarlar düzenlenemez. */
        guvenliKilit() {
            const v = this.oku(ANAHTAR.guvenliKilit, null);
            return v === null ? true : !!v;
        },
        guvenliKilitKaydet(kilitli) { this.yaz(ANAHTAR.guvenliKilit, !!kilitli); },

        beyazListe()       { return this.oku(ANAHTAR.beyazListe, []); },
        beyazListeKaydet(l){ this.yaz(ANAHTAR.beyazListe, l); },

        gecmis()           { return this.oku(ANAHTAR.gecmis, []); },
        gecmisEkle(g)      { const l = this.gecmis(); l.unshift({ ...g, tarih: Date.now() }); if (l.length > 500) l.length = 500; this.yaz(ANAHTAR.gecmis, l); },
        gecmisSil()        { this.sil(ANAHTAR.gecmis); },

        gunSayac() {
            const d = this.oku(ANAHTAR.gunSayac, { tarih: "", sayi: 0 });
            return d.tarih === new Date().toDateString() ? d : { tarih: new Date().toDateString(), sayi: 0 };
        },
        gunArttir()   { const s = this.gunSayac(); s.sayi++; this.yaz(ANAHTAR.gunSayac, s); },

        saatSayac() {
            const d = this.oku(ANAHTAR.saatSayac, { saat: -1, sayi: 0 });
            return d.saat === new Date().getHours() ? d : { saat: new Date().getHours(), sayi: 0 };
        },
        saatArttir()  { const s = this.saatSayac(); s.sayi++; this.yaz(ANAHTAR.saatSayac, s); },
    };

    // ─────────────────────────────────────────────────────────────────
    // GÜVENLİK
    // ─────────────────────────────────────────────────────────────────
    const Guvenlik = {
        limitler() {
            const a = Depo.ayarlar(), g = Depo.gunSayac(), s = Depo.saatSayac();
            return {
                gunKul: g.sayi, gunMax: a.gunlukLimit, gunKalan: Math.max(0, a.gunlukLimit - g.sayi),
                saatKul: s.sayi, saatMax: a.saatlikLimit, saatKalan: Math.max(0, a.saatlikLimit - s.sayi),
                dolduMu: g.sayi >= a.gunlukLimit || s.sayi >= a.saatlikLimit,
            };
        },
        islemKaydet() { Depo.gunArttir(); Depo.saatArttir(); },
        bekleme(a) {
            let ms;
            if (a.referansZamanlama) ms = birakmaAralikReferans(a.birakmaArasi);
            else if (a.insanModu) ms = rastgeleMola(a.birakmaArasi);
            else ms = a.birakmaArasi;
            return Math.max(ms, 3000);
        },
        skor(a) {
            let s = 0;
            if (a.birakmaArasi >= 15000) s += 22;
            else if (a.birakmaArasi >= 10000) s += 18;
            else if (a.birakmaArasi >= 4000) s += 15;
            else if (a.birakmaArasi >= 3000) s += 10;
            else s += 4;
            if (a.birakmaMola >= 300000) s += 22;
            else if (a.birakmaMola >= 120000) s += 16;
            else if (a.birakmaMola >= 60000) s += 8;
            else s += 3;
            if (a.saatlikLimit <= 30) s += 20;
            else if (a.saatlikLimit <= 80) s += 14;
            else if (a.saatlikLimit <= 200) s += 8;
            else s += 4;
            if (a.gunlukLimit <= 200) s += 20;
            else if (a.gunlukLimit <= 800) s += 14;
            else if (a.gunlukLimit <= 5000) s += 8;
            else s += 4;
            if (a.referansZamanlama) s += 6;
            if (a.insanModu) s += 4;
            if (a.otoDurak) s += 3;
            if (a.taramaArasi >= 1000) s += 4;
            else if (a.taramaArasi >= 400) s += 2;
            return Math.min(100, Math.round(s));
        },
        // Sıfırlanma saati tahmini
        saatSifirlanma() {
            const now = new Date();
            const sonraki = new Date(now);
            sonraki.setHours(now.getHours() + 1, 0, 0, 0);
            return Math.round((sonraki - now) / 60000);
        },
        gunSifirlanma() {
            const now = new Date();
            const sonraki = new Date(now);
            sonraki.setDate(now.getDate() + 1);
            sonraki.setHours(0, 0, 0, 0);
            return Math.round((sonraki - now) / 60000);
        },
    };

    // ─────────────────────────────────────────────────────────────────
    // DIŞA AKTARMA
    // ─────────────────────────────────────────────────────────────────
    /** RFC 4180 uyumlu CSV alanı; Excel (TR) için UTF-8 BOM eklenir. */
    function csvAlan(v) {
        const s = v == null ? "" : String(v);
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    }

    function rozetOzeti(k) {
        const p = [];
        if (k.is_verified) p.push("Onaylı");
        if (isletmeHesabi(k)) p.push("İşletme");
        if (k.is_private) p.push("Gizli");
        if (fotosuzMu(k)) p.push("Fotoğrafsız");
        if (k.follows_viewer) p.push("Karşılıklı");
        return p.length ? p.join(" | ") : "";
    }

    function evetHayir(b) { return b ? "Evet" : "Hayır"; }

    const Aktar = {
        _indir(icerik, ad, tip) {
            const a = Object.assign(document.createElement("a"), {
                href: URL.createObjectURL(new Blob([icerik], { type: tip })),
                download: ad,
            });
            document.body.appendChild(a); a.click(); a.remove();
        },
        json(liste, ad) {
            const paket = {
                _meta: {
                    arac: "InstaFollowKit",
                    surum: VERSIYON,
                    olusturulmaIso: new Date().toISOString(),
                    olusturulmaYerel: new Date().toLocaleString("tr-TR"),
                    kayitSayisi: Array.isArray(liste) ? liste.length : 0,
                },
                kullanicilar: liste,
            };
            const dosya = ad || `instagram_analiz_v${VERSIYON.replace(/\./g, "_")}.json`;
            this._indir(JSON.stringify(paket, null, 2), dosya, "application/json");
        },
        csv(liste) {
            const BOM = "\uFEFF";
            const tarih = new Date().toLocaleString("tr-TR");
            const n = Array.isArray(liste) ? liste.length : 0;
            const basliklar = [
                "Kullanıcı ID",
                "Kullanıcı adı",
                "Tam ad",
                "Onaylı hesap",
                "Gizli hesap",
                "Karşılıklı takip",
                "Fotoğrafsız profil",
                "Rozet özeti",
                "Profil bağlantısı",
                "Profil görseli URL",
            ];
            const satirlar = [
                "# ═══════════════════════════════════════════════════════════════",
                "# InstaFollowKit · CSV dışa aktarma",
                `# Sürüm: ${VERSIYON}    Kayıt sayısı: ${n}    Oluşturulma: ${tarih}`,
                "# Bir sonraki boş satırdan sonra başlık satırı, ardından veri satırları gelir.",
                "# Kolonlar: kimlik; metin alanları tırnak içinde; Evet/Hayır boolean alanlar",
                "# ═══════════════════════════════════════════════════════════════",
                "",
                basliklar.map(csvAlan).join(","),
            ];
            liste.forEach(k => {
                const prof = `https://www.instagram.com/${k.username}/`;
                satirlar.push([
                    k.id,
                    k.username,
                    k.full_name || "",
                    evetHayir(!!k.is_verified),
                    evetHayir(!!k.is_private),
                    evetHayir(!!k.follows_viewer),
                    evetHayir(fotosuzMu(k)),
                    rozetOzeti(k),
                    prof,
                    k.profile_pic_url || "",
                ].map(csvAlan).join(","));
            });
            this._indir(BOM + satirlar.join("\r\n"), `instagram_analiz_v${VERSIYON.replace(/\./g, "_")}.csv`, "text/csv");
        },
        pano(liste) {
            const m = [...liste].sort((a,b) => a.username.localeCompare(b.username)).map(k => k.username).join("\n");
            navigator.clipboard.writeText(m).then(() => toast("Liste panoya kopyalandı!", "success", 2000));
        },
    };

    // ─────────────────────────────────────────────────────────────────
    // DURUM
    // ─────────────────────────────────────────────────────────────────
    const D = {
        ekran: "baslangic",
        sonuclar: [], takipciler: [], beyazListe: [], secili: [],
        sayfa: 1, arama: "", sidebarArama: "", gecmisArama: "",
        sekme: "takipEtmeyen", siralama: "az",
        yuzde: 0, toplamTahmin: 0, toplamTahminTakipci: 0, taramaFaz: "takip_edilen", takipciYuklenen: 0, taramaBaslangic: 0,
        filtre: { takipEtmeyen:false, karsiliksiz:false, dogrulandi:false, gizli:false, fotosuz:false },
        birakmaFiltre: { basarili:true, basarisiz:true },
        birakmaArama: "",
        birakmaLog: [], molaKalan: 0, molaAciklama: "", hataSayac: 0,
        /** Son oturumda işlenen seçim adedi; `secili` temizlendikten sonra özet satırları için. */
        birakmaIslemToplam: 0,
        sonBirakilan: [],
        /** Toplu seçim (`data-qs`) son tik göstergesi; satır filtreleri gibi kalıcı görünüm. */
        topluQsSon: null,
        /** Giriş yapan hesabın üst bilgi çubuğu (API’den). */
        viewerProfil: null,
        /** HD profil önizlemesi: `{ url, username, afterPid?, ... }` veya `null`. */
        profilHdOnizleme: null,
    };

    const Ref = {
        dur: false,
        profilHdYukleniyor: false,
        listAraAktif: false,
        listAraSelStart: 0,
        listAraSelEnd: 0,
        taramaKbd: false,
        /** Liste `#iu-res` kaydırması; `render()` sonrası geri yüklenir (`null` = yok). */
        iuResPending: null,
        /** Yan panel `.iu-side-scroll` kaydırması; tarama sırasında yeniden çizimde korunur (`null` = yok). */
        iuSideScrollPending: null,
        /** Tablo ilk kez göründüğünde bir kez reveal animasyonu (yeni taramada sıfırlanır). */
        didListRevealAnim: false,
        /** Harf bölümü açıldığında (bir sonraki `ekranTarama` satır animasyonu için) harf anahtarı. */
        harfRevealHarf: null,
        /** Harf satırları kapanırken (animasyon süresince) harf anahtarı; `harfKapaliYaz` ile tamamlanır. */
        harfKapatiliyor: null,
        /** `render` öncesi ekran; sayfa geçiş animasyonu için. */
        prevEkran: null,
        /** İlk çizimde geçiş animasyonu yok. */
        pageAnimHazir: false,
        harfKapatTimer: null,
        viewerProfilYukleniyor: false,
        /** Üst logo: `profilResmiBlobUrlOlustur` ile CDN yerine blob (yüklenme güvenilirliği). */
        viewerPicBlobUrl: null,
        /** Takipçi GraphQL aşaması başarısız (hash/kısıtlama). */
        taramaTakipciHata: false,
        /** Bırakma ekranı: `unfollow` veya `remove_follower`. */
        birakmaIslem: "unfollow",
    };

    /** Arama: liste GraphQL bio / site alanları */
    function kullaniciBioAramaMetni(k) {
        return kullaniciBio(k);
    }

    function kullaniciSiteAramaMetni(k) {
        return (k.external_url || "").trim();
    }

    function kullaniciBio(k) {
        const b = (k.biography || "").trim();
        return b ? b : "";
    }

    // ─────────────────────────────────────────────────────────────────
    // TOAST
    // ─────────────────────────────────────────────────────────────────
    let _tt = null;
    function toast(msg, tip = "info", sure = 4000) {
        document.querySelector(".iu-toast")?.remove();
        clearTimeout(_tt);
        const el = document.createElement("div");
        el.className = `iu-toast iu-t-${tip}`;
        const txt = document.createElement("span");
        txt.className = "iu-toast-txt";
        txt.textContent = msg;
        el.appendChild(txt);
        const kok = document.getElementById("iu-kok");
        (kok || document.body).appendChild(el);
        if (sure > 0) _tt = setTimeout(() => el.remove(), sure);
    }

    function viewerWebUserToProfil(wu) {
        if (!wu) return null;
        const posts = wu.edge_owner_to_timeline_media?.count ?? wu.media_count;
        const takip = wu.edge_follow?.count ?? wu.following_count;
        const takipci = wu.edge_followed_by?.count ?? wu.follower_count;
        return {
            username: wu.username || "",
            full_name: (wu.full_name || "").trim(),
            profile_pic_url: wu.profile_pic_url_hd || wu.profile_pic_url || wu.hd_profile_pic_url_info?.url || "",
            posts: posts != null ? posts : "—",
            takip: takip != null ? takip : "—",
            takipci: takipci != null ? takipci : "—",
        };
    }

    /** Üst çubukta oturum hesabı: path → web_profile → current_user → hesap düzenle sayfası. */
    async function viewerProfilGuncelle() {
        if (Ref.viewerProfilYukleniyor) return;
        Ref.viewerProfilYukleniyor = true;
        const csrf = cerez("csrftoken");
        const headers = {
            "x-ig-app-id": "936619743392459",
            "accept-language": "tr-TR,tr;q=0.9",
            "x-requested-with": "XMLHttpRequest",
            "x-asbd-id": "129477",
        };
        if (csrf) headers["x-csrftoken"] = csrf;

        async function webProfile(username) {
            const r = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, { credentials: "include", headers });
            if (!r.ok) return null;
            const j = await r.json().catch(() => null);
            return viewerWebUserToProfil(j?.data?.user);
        }

        async function currentUserThenMerge() {
            const r = await fetch("https://www.instagram.com/api/v1/accounts/current_user/", { credentials: "include", headers });
            if (!r.ok) return null;
            const j = await r.json().catch(() => null);
            let p = viewerWebUserToProfil(j?.user);
            if (p?.username && (p.takipci === "—" || p.posts === "—" || p.takip === "—")) {
                const w = await webProfile(p.username);
                if (w) {
                    p = {
                        ...p,
                        ...w,
                        profile_pic_url: w.profile_pic_url || p.profile_pic_url,
                        full_name: p.full_name || w.full_name,
                    };
                }
            }
            return p;
        }

        async function usernameFromEditPage() {
            const rE = await fetch("https://www.instagram.com/accounts/edit/", { credentials: "include" });
            const html = await rE.text();
            const m = html.match(/"username":"([^"]+)"/);
            return m ? m[1] : null;
        }

        try {
            let p = null;
            if (IG_PATH_USERNAME) p = await webProfile(IG_PATH_USERNAME);
            if (!p) p = await currentUserThenMerge();
            if (!p) {
                const un = await usernameFromEditPage();
                if (un) p = await webProfile(un);
                if (!p && un) p = { username: un, full_name: "", profile_pic_url: "", posts: "—", takip: "—", takipci: "—" };
            }
            D.viewerProfil = p || {
                username: "",
                full_name: "",
                profile_pic_url: "",
                posts: "—",
                takip: "—",
                takipci: "—",
                _bos: true,
            };
            if (Ref.viewerPicBlobUrl) {
                try { URL.revokeObjectURL(Ref.viewerPicBlobUrl); } catch (_) {}
                Ref.viewerPicBlobUrl = null;
            }
            const picHttp = D.viewerProfil?.profile_pic_url;
            if (picHttp && !D.viewerProfil._bos) {
                const blobU = await profilResmiBlobUrlOlustur(picHttp);
                if (blobU) Ref.viewerPicBlobUrl = blobU;
            }
            hdrLogoGuncelle();
            if (D.viewerProfil._bos || !D.viewerProfil.username) {
                setTimeout(async () => {
                    if (Ref.viewerProfilYukleniyor) return;
                    const retry = await currentUserThenMerge();
                    if (retry?.username) {
                        D.viewerProfil = retry;
                        if (Ref.viewerPicBlobUrl) {
                            try { URL.revokeObjectURL(Ref.viewerPicBlobUrl); } catch (_) {}
                            Ref.viewerPicBlobUrl = null;
                        }
                        if (retry.profile_pic_url) {
                            const b = await profilResmiBlobUrlOlustur(retry.profile_pic_url);
                            if (b) Ref.viewerPicBlobUrl = b;
                        }
                        hdrLogoGuncelle();
                    }
                }, 900);
            }
        } catch (e) {
            console.warn("[IU] Profil bilgisi alınamadı:", e);
            if (Ref.viewerPicBlobUrl) {
                try { URL.revokeObjectURL(Ref.viewerPicBlobUrl); } catch (_) {}
                Ref.viewerPicBlobUrl = null;
            }
            D.viewerProfil = { username: IG_PATH_USERNAME || "", full_name: "", profile_pic_url: "", posts: "—", takip: "—", takipci: "—", _bos: true };
            hdrLogoGuncelle();
        } finally {
            Ref.viewerProfilYukleniyor = false;
        }
    }

    /** Logo: kullanıcı adını header'da günceller. */
    function hdrLogoGuncelle() {
        const unEl = document.getElementById("iu-logo-un");
        const v = D.viewerProfil;
        if (unEl) {
            if (!v) unEl.textContent = "Oturum yükleniyor…";
            else if (!v.username) unEl.textContent = "Giriş bilgisi yok";
            else unEl.textContent = `@${v.username}`;
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // FİLTRELEME & SIRALAMA
    // ─────────────────────────────────────────────────────────────────
    function sirala(liste, s) {
        return [...liste].sort((a, b) => {
            if (s === "za")        return b.username.localeCompare(a.username);
            if (s === "dogrulandi")return (b.is_verified?1:0) - (a.is_verified?1:0) || a.username.localeCompare(b.username);
            if (s === "gizli")     return (b.is_private?1:0)  - (a.is_private?1:0)  || a.username.localeCompare(b.username);
            if (s === "fotosuz")   return (fotosuzMu(b)?1:0)  - (fotosuzMu(a)?1:0)  || a.username.localeCompare(b.username);
            return a.username.localeCompare(b.username);
        });
    }

    function filtrele(sonuclar, beyazListe, sekme, aramaH, aramaS, filtre) {
        const wl = new Set(beyazListe.map(k => k.id));
        return sonuclar.filter(k => {
            if (sekme === "takipEtmeyen" && (k.follows_viewer || wl.has(k.id))) return false;
            if (sekme === "karsiliksiz"  && !k.follows_viewer)                   return false;
            if (sekme === "beyazListe"   && !wl.has(k.id))                       return false;

            const relTakip = filtre.takipEtmeyen;
            const relKar = filtre.karsiliksiz;
            const relAny = relTakip || relKar;
            if (relAny) {
                const okTakip = relTakip && !k.follows_viewer;
                const okKar = relKar && k.follows_viewer;
                if (!(okTakip || okKar)) return false;
            }

            const trDog = filtre.dogrulandi;
            const trGiz = filtre.gizli;
            const trFot = filtre.fotosuz;
            const featAll = trDog && trGiz && trFot;
            if (!featAll && (trDog || trGiz || trFot)) {
                const okFeat = (trDog && k.is_verified) || (trGiz && k.is_private) || (trFot && fotosuzMu(k));
                if (!okFeat) return false;
            }

            const q1 = aramaH.toLowerCase();
            const q2 = aramaS.toLowerCase();
            if (q1 && !k.username.toLowerCase().includes(q1) && !(k.full_name || "").toLowerCase().includes(q1)) return false;
            if (q2) {
                const bio = kullaniciBioAramaMetni(k).toLowerCase();
                const site = kullaniciSiteAramaMetni(k).toLowerCase();
                const u = k.username.toLowerCase().includes(q2);
                const fn = (k.full_name || "").toLowerCase().includes(q2);
                if (!u && !fn && !bio.includes(q2) && !site.includes(q2)) return false;
            }
            return true;
        });
    }

    /** Takip + takipçi kümelerinin birleşimi (aynı ID tek kez; öncelik takip listenizdeki kayıt). */
    function iuBirlesikListe() {
        const m = new Map();
        for (const k of D.sonuclar) m.set(String(k.id), k);
        for (const k of D.takipciler) {
            const id = String(k.id);
            if (!m.has(id)) m.set(id, k);
        }
        return Array.from(m.values());
    }

    function iuBirlesikSayi() {
        return iuBirlesikListe().length;
    }

    /** Aktif sekmedeki ham kaynak: takip listeniz, takipçiler veya birleşik “Tüm Takipçiler”. */
    function iuListeEkran() {
        if (D.sekme === "tumu") return iuBirlesikListe();
        if (D.sekme === "takipci") return D.takipciler;
        return D.sonuclar;
    }

    function iuKullaniciBul(id) {
        const s = String(id);
        return D.sonuclar.find(x => String(x.id) === s)
            || D.takipciler.find(x => String(x.id) === s);
    }

    function sayfala(liste, sayfa) {
        const adet = Depo.ayarlar().sayfaAdet || 50;
        return liste.slice(adet * (sayfa - 1), adet * sayfa);
    }

    function maxSayfa(liste) {
        const adet = Depo.ayarlar().sayfaAdet || 50;
        return Math.max(1, Math.ceil(liste.length / adet));
    }

    // ─────────────────────────────────────────────────────────────────
    // STİLLER
    // ─────────────────────────────────────────────────────────────────
    function stilEkle() {
        document.getElementById("iu-style")?.remove();
        const a = Depo.ayarlar();
        const tema = TEMALAR[a.tema] || TEMALAR.turuncu;
        const s = document.createElement("style");
        s.id = "iu-style";
        s.textContent = `
/* ── TEMA DEĞİŞKENLERİ ── */
:root{
  /* Yüzeyler */
  --bg:  #0f0f10;
  --bg2: #161618;
  --bg3: #1c1c1f;
  --bg4: #242427;
  --bg5: #2c2c30;
  /* Kenarlıklar */
  --br:  #2e2e32;
  --br2: #3a3a3e;
  /* Metinler */
  --tx:  #f0f0f2;
  --t2:  #98989e;
  --t3:  #58585e;
  /* Vurgu rengi (temaya göre değişir) */
  --acc: ${tema.acc};
  --acc2:${tema.acc2};
  --acc3:${tema.acc3};
  --prog:${tema.prog};
  /* Alt nav ile yan panel aynı sütun genişliği (kenarlık hizası) */
  --iu-nav-cols:5;
  --iu-nav-cell:calc(100vw / var(--iu-nav-cols));
  /* Sistem renkleri */
  --ok:  #30d158;
  --dan: #ff453a;
  --warn:#ffd60a;
  --gold:#ffd700;
  /* Gölgeler */
  --sh:  0 2px 12px rgba(0,0,0,.45);
  --sh2: 0 4px 24px rgba(0,0,0,.6);
}
/* ── RESET ── */
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--bg)!important;color:var(--tx);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;min-height:100vh;line-height:1.4}
html{scrollbar-width:thin;scrollbar-color:var(--br2) var(--bg)}
html::-webkit-scrollbar{width:10px;height:10px}
html::-webkit-scrollbar-track{background:var(--bg);border-radius:6px}
html::-webkit-scrollbar-thumb{background:var(--br2);border-radius:6px;border:2px solid var(--bg)}
html::-webkit-scrollbar-thumb:hover{background:var(--acc)}
.iu-cont,.iu-side-scroll,#iu-res,.iu-list-wrap,.iu-gecmis-area,.iu-gecmis-rows-wrap,.iu-ayarlar-scroll,.iu-cards,.iu-log{scrollbar-width:thin;scrollbar-color:var(--br2) var(--bg3)}
.iu-cont::-webkit-scrollbar,.iu-side-scroll::-webkit-scrollbar,#iu-res::-webkit-scrollbar,.iu-list-wrap::-webkit-scrollbar,.iu-gecmis-rows-wrap::-webkit-scrollbar,.iu-ayarlar-scroll::-webkit-scrollbar{width:8px;height:8px}
.iu-cont::-webkit-scrollbar-track,.iu-side-scroll::-webkit-scrollbar-track,#iu-res::-webkit-scrollbar-track,.iu-list-wrap::-webkit-scrollbar-track,.iu-gecmis-rows-wrap::-webkit-scrollbar-track,.iu-ayarlar-scroll::-webkit-scrollbar-track{background:var(--bg3);border-radius:4px}
.iu-cont::-webkit-scrollbar-thumb,.iu-side-scroll::-webkit-scrollbar-thumb,#iu-res::-webkit-scrollbar-thumb,.iu-list-wrap::-webkit-scrollbar-thumb,.iu-gecmis-rows-wrap::-webkit-scrollbar-thumb,.iu-ayarlar-scroll::-webkit-scrollbar-thumb{background:var(--br2);border-radius:4px}
.iu-cont::-webkit-scrollbar-thumb:hover,.iu-side-scroll::-webkit-scrollbar-thumb:hover,#iu-res::-webkit-scrollbar-thumb:hover,.iu-list-wrap::-webkit-scrollbar-thumb:hover,.iu-gecmis-rows-wrap::-webkit-scrollbar-thumb:hover,.iu-ayarlar-scroll::-webkit-scrollbar-thumb:hover{background:var(--acc)}

/* ── HEADER ── */
.iu-hdr{
  position:fixed;top:0;left:0;right:0;height:3.25rem;
  background:var(--bg3);z-index:60;display:flex;align-items:center;
  border-bottom:1px solid var(--br);box-shadow:var(--sh);flex-shrink:0;
}
.iu-hdr-in{
  width:100%;max-width:1400px;margin:0 auto;padding:0 1rem;
  position:relative;display:flex;align-items:center;justify-content:space-between;gap:.5rem;
}
.iu-logo{display:flex;align-items:center;gap:.55rem;cursor:pointer;flex-shrink:0;user-select:none;min-width:0;text-decoration:none;z-index:2}
.iu-logo-icon{flex-shrink:0;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 6px rgba(0,0,0,.35))}
.iu-logo-t{display:flex;flex-direction:column;line-height:1.2;min-width:0}
.iu-logo-brand{font-size:.88rem;font-weight:800;letter-spacing:.02em;color:var(--acc);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(200px,40vw)}
.iu-logo-line1{font-size:.66rem;font-weight:500;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(200px,40vw)}
.iu-hdr-act{display:flex;align-items:center;gap:.35rem;flex-shrink:0;margin-left:auto;z-index:2}
.iu-hdr-ver{font-size:.65rem;font-weight:700;color:var(--t3);letter-spacing:.04em;padding:.18rem .42rem;border:1px solid var(--br2);border-radius:5px;background:var(--bg4);white-space:nowrap}
.iu-prog{position:absolute;bottom:0;left:0;right:0;height:2px;appearance:none;border:none;background:transparent}
.iu-prog::-webkit-progress-bar{background:transparent}
.iu-prog::-webkit-progress-value{background:var(--prog);border-radius:1px;transition:width .5s ease}

/* ── BUTONLAR ── */
.iu-btn{
  display:inline-flex;align-items:center;gap:.3rem;
  background:var(--bg4);border:1px solid var(--br);color:var(--tx);
  padding:.3rem .6rem;border-radius:6px;cursor:pointer;font-size:.75rem;
  font-family:inherit;font-weight:500;white-space:nowrap;
  transition:background .12s,border-color .12s,transform .1s;
  line-height:1;
}
.iu-btn:hover{background:var(--bg5);border-color:var(--br2)}
.iu-btn:active{transform:scale(.97)}
.iu-btn:disabled{opacity:.35;cursor:not-allowed;transform:none}
.iu-btn-acc{background:var(--acc)!important;border-color:var(--acc)!important;color:#fff!important}
.iu-btn-acc:hover:not(:disabled){background:var(--acc2)!important;border-color:var(--acc2)!important}
.iu-btn-dan{background:var(--dan)!important;border-color:var(--dan)!important;color:#fff!important}
.iu-btn-dan:hover:not(:disabled){filter:brightness(.85)}
.iu-btn-ok{background:var(--ok)!important;border-color:var(--ok)!important;color:#fff!important}
.iu-btn-ok:hover:not(:disabled){filter:brightness(.85)}
.iu-btn-ghost{background:transparent!important;border-color:var(--br2)!important}
.iu-btn-ghost:hover{background:var(--bg3)!important}
.iu-list-export{
  display:inline-flex;align-items:stretch;gap:.32rem;flex:0 0 auto;margin-left:.2rem;
  box-sizing:border-box;
}
.iu-btn-export{
  display:inline-flex;align-items:center;justify-content:center;
  font-weight:800;font-size:.74rem!important;letter-spacing:.03em;
  padding:0 .75rem;border-radius:9px;border:1px solid transparent;
  min-height:40px;box-sizing:border-box;
  cursor:pointer;font-family:inherit;transition:filter .12s,transform .08s;
  line-height:1;
}
.iu-btn-export:disabled{opacity:.35;cursor:not-allowed;transform:none}
.iu-btn-export:not(:disabled):active{transform:scale(.97)}
.iu-btn-export--json{
  background:linear-gradient(165deg,#0f766e,#134e4a)!important;
  color:#ecfdf5!important;border-color:rgba(45,212,191,.45)!important;
  box-shadow:0 1px 0 rgba(255,255,255,.1) inset,0 4px 14px rgba(15,118,110,.25);
}
.iu-btn-export--json:hover:not(:disabled){filter:brightness(1.08)}
.iu-btn-export--csv{
  background:linear-gradient(165deg,#1d4ed8,#1e3a8a)!important;
  color:#eff6ff!important;border-color:rgba(96,165,250,.5)!important;
  box-shadow:0 1px 0 rgba(255,255,255,.1) inset,0 4px 14px rgba(29,78,216,.28);
}
.iu-btn-export--csv:hover:not(:disabled){filter:brightness(1.08)}

/* Yan panel — tam genişlik aksiyon (ortak boyut, varyant renkleri) */
.iu-side-act-stack{
  display:flex;flex-direction:column;gap:.32rem;width:100%;align-items:stretch;box-sizing:border-box;
}
.iu-side-action{
  display:inline-flex;align-items:center;justify-content:center;gap:.4rem;
  width:100%;box-sizing:border-box;min-height:2.08rem;
  padding:0 .65rem;border-radius:7px;font-family:inherit;font-size:.78rem;font-weight:600;
  line-height:1.2;cursor:pointer;border:1px solid transparent;
  transition:background .12s,border-color .12s,color .12s,filter .12s,transform .08s;
}
.iu-side-action:active:not(:disabled){transform:scale(.985)}
.iu-side-action:disabled{opacity:.38;cursor:not-allowed;transform:none}
.iu-side-action--primary{
  background:var(--acc)!important;color:#fff!important;border-color:var(--acc)!important;
}
.iu-side-action--primary:hover:not(:disabled){background:var(--acc2)!important;border-color:var(--acc2)!important}
.iu-side-action--danger{
  background:var(--dan)!important;color:#fff!important;border-color:var(--dan)!important;
}
.iu-side-action--danger:hover:not(:disabled){filter:brightness(.92)}
.iu-side-action--outline-acc{
  background:rgba(0,149,246,.08);color:var(--acc);border-color:var(--acc);
}
.iu-side-action--outline-acc:hover:not(:disabled){background:var(--acc3);color:var(--acc)}
.iu-side-action--warn{
  background:rgba(255,214,10,.08);color:var(--warn);border-color:rgba(255,214,10,.42);
}
.iu-side-action--warn:hover:not(:disabled){background:rgba(255,214,10,.14);border-color:rgba(255,214,10,.55)}
.iu-side-action--ghost{
  background:var(--bg4);color:var(--t2);border-color:var(--br2);
}
.iu-side-action--ghost:hover:not(:disabled){background:var(--bg3);color:var(--tx);border-color:var(--br)}

/* ── INPUT & SELECT ── */
.iu-inp{
  color:var(--tx);background:var(--bg2);border:1px solid var(--br);
  border-radius:6px;padding:.3rem .55rem;font-family:inherit;font-size:.75rem;
  transition:border-color .12s;
}
.iu-inp:focus{outline:none;border-color:var(--acc);background:var(--bg3)}
.iu-inp::placeholder{color:var(--t3)}
.iu-inp-w{width:160px}
.iu-sel{
  color:var(--tx);background:var(--bg2);border:1px solid var(--br);
  border-radius:6px;padding:.3rem .5rem;font-family:inherit;font-size:.75rem;cursor:pointer;
  transition:border-color .12s;
}
.iu-sel:focus{outline:none;border-color:var(--acc)}

/* ── LAYOUT ── */
.iu-wrap{display:flex;flex-direction:column;min-height:100vh}
@media(prefers-reduced-motion:no-preference){
  .iu-wrap.iu-page-enter{opacity:0;transform:translateY(8px)}
  .iu-wrap.iu-page-enter.iu-page-enter--on{
    opacity:1;transform:none;
    transition:opacity .24s ease,transform .24s ease;
  }
}
.iu-body{
  display:flex;flex-direction:row;align-items:stretch;width:100%;
  margin-top:3.25rem;min-height:calc(100vh - 3.25rem - 3rem);
  padding-bottom:3rem;
}
.iu-body--init{
  align-items:center;justify-content:center;flex:1;min-height:calc(100vh - 3.25rem - 3rem);width:100%;
}
.iu-body--init .iu-init{
  width:100%;max-width:720px;min-height:min(72vh,580px);justify-content:center;align-items:center;
}

/* ── SIDEBAR: görünür alan = üst çubuk altı → alt nav üstü, ana içerik yüksekliğine bağlı uzamaz ── */
.iu-body:not(.iu-body--init){align-items:flex-start}
.iu-side{
  --iu-rail:3.5rem;
  position:sticky;top:3.25rem;align-self:flex-start;
  width:var(--iu-nav-cell);min-width:var(--iu-nav-cell);max-width:var(--iu-nav-cell);flex-shrink:0;
  box-sizing:border-box;
  height:calc(100vh - 3.25rem - 3rem);
  max-height:calc(100vh - 3.25rem - 3rem);
  border-right:1px solid var(--br);display:flex;flex-direction:column;
  overflow:hidden;padding:.45rem .48rem;font-size:.75rem;
  background:linear-gradient(180deg,var(--bg2) 0%,#131315 100%);
}
.iu-side:not(.iu-side-pro){font-size:.75rem}
.iu-side:not(.iu-side-pro) .iu-lbl{font-size:.74rem}
.iu-side:not(.iu-side-pro) .iu-stat td,.iu-side:not(.iu-side-pro) .iu-tbl td{font-size:.74rem}
.iu-side-pro .iu-sp{margin-bottom:.28rem}
.iu-side-pro .iu-sp-title{letter-spacing:.07em;font-size:.58rem;opacity:.95}
.iu-side-pro .iu-sp-hint{font-size:.62rem;line-height:1.4;opacity:.92}
.iu-side-pro .iu-stat-row{padding:.14rem 0;font-size:.72rem}
.iu-side-pro .iu-stat-row span:last-child{font-variant-numeric:tabular-nums}
.iu-side-inner{
  flex:1;min-height:0;display:flex;flex-direction:column;gap:.25rem;
  overflow:hidden;
}
.iu-side-scroll{
  flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;
  display:flex;flex-direction:column;gap:.22rem;
  -webkit-overflow-scrolling:touch;
  scroll-behavior:auto;
  overscroll-behavior:contain;
  font-size:.83rem;
}
.iu-side-pro > .iu-side-scroll > .iu-sp{
  width:100%;min-width:0;box-sizing:border-box;align-self:stretch;
}
.iu-side-scroll .iu-sp-title{font-size:.64rem}
.iu-side-scroll .iu-sp-sub{font-size:.62rem}
.iu-side-scroll .iu-sp-hint{font-size:.68rem}
.iu-side-pro .iu-side-scroll .iu-stat-row{font-size:.77rem}
.iu-side-scroll .iu-side-row,.iu-side-scroll .iu-stat-row{font-size:.79rem}
.iu-side-scroll .iu-lbl{font-size:.84rem}
.iu-side-scroll .iu-lbl.iu-side-row .iu-lbl-t{font-size:.82rem}
.iu-side-scroll .iu-sbtn{font-size:.80rem}
.iu-side-scroll .iu-side-row .iu-sbtn{font-size:.78rem}
/* Geçmiş / Ayarlar / Bırak yan panel — Tarama «Liste ve filtreler» ile aynı tipografi */
.iu-side-pro .iu-side-scroll .iu-inp{font-size:.84rem}
.iu-side-pro .iu-side-scroll .iu-side-msec-h{font-size:.64rem;letter-spacing:.05em}
.iu-side-pro .iu-side-scroll #mod-safe-badge{font-size:.72rem;font-weight:700;color:var(--t2);letter-spacing:.01em;display:inline;max-width:11.5rem;line-height:1.25}
.iu-side-pro .iu-side-scroll #mod-safe-badge.iu-safe-txt-on{color:var(--ok)}
.iu-side-pro .iu-side-scroll #mod-safe-badge.iu-safe-txt-off{color:var(--warn)}
.iu-side-pro .iu-side-scroll .iu-tbl,.iu-side-pro .iu-side-scroll .iu-tbl td{font-size:inherit}
.iu-side h5{
  font-size:.72rem;font-weight:700;color:var(--t3);
  margin:0 0 .35rem;text-transform:uppercase;letter-spacing:.08em;
  padding:0;
}
.iu-sp{
  margin-bottom:0;padding:.4rem .42rem;background:var(--bg3);
  border:1px solid rgba(255,255,255,.06);border-radius:9px;flex-shrink:0;
  box-shadow:0 1px 0 rgba(0,0,0,.2);
}
.iu-sp-title{
  font-size:.54rem;font-weight:700;color:var(--t3);text-transform:uppercase;
  letter-spacing:.05em;margin:0 0 .22rem;
}
.iu-sp-hint{
  font-size:.58rem;color:var(--t3);line-height:1.35;margin:-.06rem 0 .22rem;
}
.iu-sp-sub{
  font-size:.52rem;font-weight:600;color:var(--t3);text-transform:uppercase;
  letter-spacing:.06em;margin:.1rem 0 .14rem;
}
/* Yan panel alt başlıklar — tema vurgu rengi */
.iu-side .iu-sp-title,
.iu-side .iu-sp-sub{
  color:var(--acc);
  opacity:.98;
  text-shadow:0 0 14px var(--acc3);
}
.iu-side-scroll .iu-sp-sub:first-child{margin-top:0}
.iu-side-divider{
  height:1px;background:rgba(255,255,255,.07);margin:.26rem 0;border:none;
}
.iu-side-row,.iu-stat-row,.iu-lbl.iu-side-row{
  display:grid;grid-template-columns:1fr var(--iu-rail);
  align-items:center;column-gap:.3rem;padding:.12rem 0;border-bottom:1px solid rgba(255,255,255,.05);
  font-size:.66rem;
}
.iu-side-row > span:first-child{text-align:left;justify-self:start;min-width:0}
.iu-side-row > .iu-sbtn{
  justify-self:center;width:100%;max-width:var(--iu-rail);min-width:0;
  padding:.2rem .15rem;font-size:.62rem;margin:0;
}
.iu-side-row:last-child{border-bottom:none}
.iu-stat-row:last-child{border-bottom:none}
.iu-stat-row span:first-child{color:var(--t2);min-width:0;text-align:left;justify-self:start}
.iu-stat-row span:last-child{
  font-weight:600;font-variant-numeric:tabular-nums;text-align:right;justify-self:center;
  width:100%;max-width:var(--iu-rail);min-width:0;
}
.iu-div{border:none;border-top:1px solid var(--br);margin:.4rem 0}
.iu-lbl{
  display:flex;align-items:center;gap:.4rem;
  padding:.24rem .35rem;border-radius:5px;margin-bottom:.12rem;cursor:pointer;
  font-size:.72rem;color:var(--t2);transition:background .1s,color .1s;
}
.iu-lbl.iu-side-row{margin-bottom:.08rem;padding:.1rem .2rem}
.iu-lbl.iu-side-row .iu-lbl-t{min-width:0;line-height:1.2;text-align:left;justify-self:start}
.iu-lbl.iu-side-row input[type=checkbox]{justify-self:center;width:.78rem;height:.78rem;margin:0;accent-color:var(--acc)}
.iu-lbl.iu-side-row.iu-side-row--ico{grid-template-columns:1fr auto}
.iu-row-tail{display:inline-flex;align-items:center;gap:.32rem;justify-self:end;flex-shrink:0}
.iu-lbl:hover{background:var(--bg3);color:var(--tx)}
.iu-lbl input[type=checkbox]{width:.9rem;height:.9rem;accent-color:var(--acc);flex-shrink:0}
.iu-sbtn{
  width:100%;padding:.32rem .4rem;border:1px solid transparent;
  background:transparent;color:var(--t2);border-radius:5px;cursor:pointer;
  font-size:.71rem;text-align:left;transition:all .12s;font-family:inherit;
  margin-bottom:.12rem;display:flex;align-items:center;gap:.35rem;
}
.iu-side-row .iu-sbtn{width:auto;min-width:4.5rem;justify-self:end;margin:0;padding:.26rem .4rem;text-align:center;justify-content:center}
.iu-sbtn:hover{background:var(--bg3);color:var(--tx);border-color:var(--br)}
.iu-sbtn.red{color:var(--dan)}.iu-sbtn.red:hover{background:rgba(255,69,58,.08);border-color:rgba(255,69,58,.2)}
.iu-sp-grid{display:grid;grid-template-columns:1fr 1fr;gap:.2rem}
.iu-sp-grid .iu-sbtn{margin:0;font-size:.7rem;padding:.32rem .3rem;text-align:center;justify-content:center}
.iu-sbtn.acc{color:var(--acc)}.iu-sbtn.acc:hover{background:var(--acc3);border-color:var(--acc)}

/* Stat tablosu (eski / hızlı seçim) */
.iu-stat{padding:.4rem;background:var(--bg3);border-radius:6px;margin:.3rem 0;border:1px solid var(--br)}
.iu-tbl{width:100%;border-collapse:collapse;font-size:.75rem}
.iu-tbl tr{border-bottom:1px solid rgba(255,255,255,.04)}
.iu-tbl tr:last-child{border-bottom:none}
.iu-tbl td{padding:.25rem .2rem;vertical-align:middle}
.iu-tbl td:first-child{color:var(--t2);padding-right:.4rem}
.iu-tbl td:last-child{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.iu-stat-tbl{width:100%;border-collapse:collapse;font-size:.74rem}
.iu-stat-tbl tr{border-bottom:1px solid rgba(255,255,255,.04)}
.iu-stat-tbl tr:last-child{border-bottom:none}
.iu-stat-tbl td{padding:.22rem .15rem;vertical-align:middle}
.iu-stat-tbl td:first-child{color:var(--t2)}
.iu-stat-tbl td:last-child{text-align:right;font-weight:600;font-variant-numeric:tabular-nums}
.iu-qs-tbl .iu-sbtn{width:auto;min-width:4.5rem;padding:.28rem .45rem;font-size:.7rem;justify-content:center;margin:0}

/* Güvenlik skoru */
.iu-skor-bar{height:4px;border-radius:2px;background:var(--bg4);overflow:hidden;margin:.3rem 0}
.iu-skor-ic{height:100%;border-radius:2px;transition:width .4s ease}

/* Sayfalama */
.iu-pag{display:flex;align-items:center;justify-content:space-between;font-size:.78rem;margin:.3rem 0;padding:0 .2rem}
.iu-pag-btn{background:var(--bg3);border:1px solid var(--br);color:var(--t2);border-radius:4px;padding:.2rem .5rem;cursor:pointer;font-size:.78rem;font-family:inherit;transition:all .12s;line-height:1.4}
.iu-pag-btn:hover:not(:disabled){background:var(--bg4);color:var(--tx);border-color:var(--br2)}
.iu-pag-btn:disabled{opacity:.3;cursor:default}
.iu-pag-info{font-size:.72rem;color:var(--t2)}

/* Mola kutusu */
.iu-mola{
  background:linear-gradient(165deg,rgba(255,214,10,.08),rgba(0,149,246,.05));
  border:1px solid rgba(255,214,10,.22);border-radius:8px;padding:.45rem .5rem .42rem;margin:.35rem 0;text-align:center;
  box-sizing:border-box;min-height:46px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.08rem;
}
.iu-mola-cd{font-size:1.05rem;font-weight:800;color:var(--acc);font-variant-numeric:tabular-nums;line-height:1.2;letter-spacing:.02em}
.iu-mola-txt{font-size:.66rem;color:var(--t2);margin:0;line-height:1.35;font-weight:600;max-width:100%}
.iu-eta{font-size:.68rem;color:var(--t3);text-align:center;margin:.15rem 0}

/* Limit bilgi kutusu */
.iu-limit-kalan{
  padding:.35rem .4rem;border-radius:5px;font-size:.72rem;
  background:var(--acc3);border:1px solid var(--acc);color:var(--tx);
  display:flex;align-items:center;justify-content:space-between;margin:.3rem 0;
}

/* ── İÇERİK ALANI ── */
.iu-cont{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--bg)}
.iu-cont-head{flex-shrink:0;background:var(--bg2);border-bottom:1px solid var(--br)}
.iu-cont-head-main{
  display:flex;flex-wrap:wrap;align-items:stretch;justify-content:space-between;gap:.5rem .75rem;
  padding:.4rem .55rem .45rem;
}
.iu-cont-head-main .iu-tabs{
  flex:1 1 300px;min-width:0;display:flex;flex-wrap:wrap;gap:.2rem;
  padding:0;background:transparent;border:none;align-items:stretch;
}
.iu-cont-head-main .iu-list-hdr{
  flex:1 1 260px;min-width:min(100%,220px);max-width:100%;
  padding:0;margin:0;border:none;background:transparent;
  justify-content:flex-end;gap:.35rem;align-self:stretch;align-items:center;min-height:46px;
}
.iu-cont-head-main .iu-tab{
  flex:1 1 0;min-width:4.5rem;min-height:46px;box-sizing:border-box;border-radius:6px;border:1px solid var(--br2);
  border-bottom:none;background:var(--bg3);transition:border-color .15s,background .15s,box-shadow .15s;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.12rem;
  padding:.22rem .26rem .26rem;
}
.iu-cont-head-main .iu-tab-lbl{display:block;line-height:1.2}
.iu-cont-head-main .iu-tab .iu-tab-n{margin-left:0}
.iu-cont-head-main .iu-tab:hover:not(.on){
  border-color:var(--br);background:var(--bg4);color:var(--tx);
}
.iu-cont-head-main .iu-tab.on{
  border-color:var(--acc);background:var(--bg);
  box-shadow:0 0 0 1px var(--acc3);color:var(--tx);
}
.iu-cont-head-main .iu-tab:focus-visible{
  outline:2px solid var(--acc);outline-offset:2px;
}

/* Sekmeler (diğer ekranlar / yedek) */
.iu-tabs{display:flex;padding:.4rem .4rem 0;gap:.2rem;background:var(--bg2);border-bottom:1px solid var(--br)}
.iu-tab{
  flex:1;text-align:center;padding:.4rem .3rem;font-size:.75rem;
  border-radius:5px 5px 0 0;cursor:pointer;color:var(--t2);
  transition:all .12s;border:1px solid transparent;border-bottom:none;
  min-width:70px;font-weight:500;
}
.iu-tab:hover{color:var(--tx);background:var(--bg3)}
.iu-tab.on{color:var(--tx);background:var(--bg);border-color:var(--br);border-bottom-color:var(--bg)}
.iu-tab-n{
  display:inline-flex;align-items:center;justify-content:center;
  background:var(--acc);color:#fff;border-radius:10px;
  padding:0 .3rem;font-size:.58rem;font-weight:700;
  margin-left:.2rem;min-width:1.2rem;height:1.1rem;line-height:1.1rem;
}
.iu-tab-n.grn{background:var(--ok)}
.iu-tab-n.gld{background:var(--gold);color:#111}

/* Liste başlığı */
.iu-list-hdr{
  padding:.4rem .6rem;display:flex;align-items:center;gap:.45rem;
  border-bottom:1px solid var(--br);background:var(--bg2);flex-wrap:wrap;
  justify-content:space-between;
}
.iu-list-hdr-tools{display:flex;align-items:center;gap:.4rem;flex:1;flex-wrap:wrap;min-width:0;box-sizing:border-box}
.iu-cont-head-main .iu-list-hdr-tools{min-height:46px;align-self:stretch}
.iu-list-ara-wrap{
  flex:1;min-width:120px;max-width:min(100%,420px);
  display:flex;align-items:stretch;border:1px solid var(--br);border-radius:6px;background:var(--bg2);
  overflow:hidden;box-sizing:border-box;
}
.iu-list-ara-wrap:focus-within{border-color:var(--acc);background:var(--bg3)}
.iu-list-ara-meta{
  flex-shrink:0;display:flex;align-items:center;padding:.2rem .5rem;font-size:.74rem;font-weight:600;
  color:var(--acc);letter-spacing:.02em;
  border-right:1px solid var(--br);white-space:nowrap;font-variant-numeric:tabular-nums;max-width:46%;
  background:linear-gradient(180deg,rgba(0,149,246,.12),rgba(0,149,246,.04));
  text-shadow:0 0 12px var(--acc3);
}
.iu-list-ara-wrap .iu-inp{flex:1;border:none;background:transparent;min-width:0;border-radius:0;box-shadow:none}
.iu-list-ara-wrap .iu-inp:focus{outline:none;border:none;box-shadow:none}
.iu-list-hdr-tools .iu-sel{min-width:128px;flex:0 1 158px;max-width:158px}
.iu-cont-head-main .iu-list-hdr-tools .iu-list-ara-wrap{min-height:46px;align-items:stretch}
.iu-cont-head-main .iu-list-hdr-tools .iu-list-ara-meta{align-self:stretch;min-height:46px}
.iu-cont-head-main .iu-list-hdr-tools .iu-sel{
  min-height:46px;box-sizing:border-box;padding:.35rem .5rem;font-size:.78rem;
  display:flex;align-items:center;border-radius:6px;border:1px solid var(--br);background:var(--bg3);color:var(--tx);
}
.iu-cont-head-main .iu-list-hdr-tools .iu-list-export{align-self:stretch}
.iu-cont-head-main .iu-list-hdr-tools .iu-btn-export{
  min-height:46px;box-sizing:border-box;padding:0 .78rem;
  font-size:.75rem!important;
}
.iu-cont-head-main .iu-list-hdr-tools .iu-list-ara-wrap .iu-inp{min-height:46px;padding:.42rem .55rem;font-size:.78rem;box-sizing:border-box}

/* Sonuç listesi — tablo #iu-res ile tek blok (iu-res-in yok) */
.iu-res{
  flex:1;overflow-y:auto;overflow-x:hidden;min-height:0;
  display:flex;flex-direction:column;align-items:stretch;
  padding:0 0 .45rem;box-sizing:border-box;
}
#iu-res:has(> .iu-res-wait--scan){
  justify-content:center;
  flex:1;
  min-height:min(52vh,380px);
}
#iu-res:has(> .iu-res-wait--scan) > .iu-res-wait--scan{
  align-self:center;
  flex-shrink:0;
  width:100%;
}
.iu-res::-webkit-scrollbar{width:4px}
.iu-res::-webkit-scrollbar-thumb{background:var(--br2);border-radius:2px}
#iu-res > .iu-empty,#iu-res > .iu-res-wait{margin-left:auto;margin-right:auto;max-width:36rem;width:100%;box-sizing:border-box}
#iu-res > .iu-res-wait.iu-res-wait--scan{max-width:42rem}

.iu-hd-onizleme{
  flex-shrink:0;width:100%;box-sizing:border-box;margin:0 0 .75rem;padding:.35rem .45rem 0;
}
.iu-hd-inline-td{padding:0!important;vertical-align:top!important;border-bottom:1px solid var(--br)!important;background:var(--bg3)}
.iu-hd-onizleme--inline{margin:0;padding:.35rem .25rem .5rem}
.iu-hd-onizleme--inline .iu-hd-onizleme-sheet{max-width:100%;padding:0;margin:0}
.iu-hd-sheet-head{
  display:flex;align-items:center;justify-content:space-between;gap:.75rem;
  padding:.65rem 1rem .55rem;border-bottom:1px solid rgba(255,255,255,.1);
}
.iu-hd-sheet-head-txt{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;min-width:0}
.iu-hd-sheet-user{font-weight:800;font-size:.9rem;color:var(--tx);letter-spacing:.01em}
.iu-hd-sheet-head .iu-hd-onizleme-x{position:relative;top:auto;right:auto;flex-shrink:0}
.iu-hd-imgrow{
  display:flex;flex-direction:row;flex-wrap:wrap;align-items:flex-start;gap:1rem 1.25rem;
  justify-content:flex-start;width:100%;padding:.85rem 1rem 1.05rem;box-sizing:border-box;
}
.iu-hd-onizleme--inline .iu-hd-onizleme-imgwrap{
  display:flex;justify-content:flex-start;align-items:flex-start;
  flex:0 1 auto;min-width:min(100%,240px);max-width:min(100%,560px);min-height:0;padding:0;
}
.iu-hd-actions{
  flex:0 1 200px;min-width:min(100%,200px);max-width:100%;
  display:flex;flex-direction:column;gap:.55rem;align-self:stretch;
  align-items:stretch;justify-content:flex-start;
}
.iu-hd-actions--export{padding:.35rem 0 0}
.iu-hd-actions--export .iu-hd-actions-sec{
  display:flex;flex-direction:column;justify-content:flex-start;align-items:stretch;
  gap:.5rem;width:100%;max-width:14rem;margin:0;
}
.iu-hd-actions--export .iu-hd-tool--mini{width:100%;min-width:0;flex:0 0 auto}
.iu-hd-tool{
  font:inherit;font-size:.84rem;font-weight:700;
  padding:.48rem .65rem;border-radius:10px;
  border:1px solid var(--br);background:var(--bg4);color:var(--tx);
  cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;
  line-height:1.2;white-space:nowrap;text-align:center;
  transition:background .12s,border-color .12s,color .12s;
  min-height:44px;box-sizing:border-box;
}
.iu-hd-tool--mini{min-height:44px;font-size:.82rem;width:100%}
.iu-hd-tool:hover{background:var(--bg3);border-color:var(--acc);color:var(--acc)}
.iu-hd-tool--muted{opacity:.58;cursor:default;font-weight:600;border-style:dashed}
.iu-side-link-grid--dense{
  grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;width:100%;
}
.iu-sqbtn-osint{font-size:.62rem;font-weight:800;padding:.26rem .18rem;min-height:32px;letter-spacing:.02em}
.iu-sqbtn-osint-wide{grid-column:1/-1}
.iu-side-link-grid--dense .iu-sqbtn-goo{min-height:32px}
.iu-list-tr--hd-open{background:rgba(0,149,246,.06)!important;box-shadow:inset 3px 0 0 var(--acc)}
.iu-list-tr--hd-open:hover{background:rgba(0,149,246,.09)!important}
.iu-list-tbl .iu-av{cursor:pointer}
.iu-hd-onizleme-sheet{
  position:relative;margin:0 auto;max-width:min(900px,100%);
  padding:0;
  border-radius:18px;
  border:1px solid rgba(255,255,255,.12);
  background:
    radial-gradient(ellipse 90% 70% at 50% -20%,var(--acc3),transparent 55%),
    linear-gradient(180deg,var(--bg4) 0%,var(--bg2) 100%);
  box-shadow:
    0 0 0 1px rgba(0,0,0,.35),
    0 12px 40px rgba(0,0,0,.45),
    inset 0 1px 0 rgba(255,255,255,.06);
  overflow:hidden;
}
@keyframes iu-hd-sheet-in{
  from{opacity:0;transform:translateY(16px) scale(.965);filter:blur(12px)}
  to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}
}
@keyframes iu-hd-img-in{
  from{opacity:0;transform:scale(.86)}
  to{opacity:1;transform:scale(1)}
}
@media (prefers-reduced-motion:reduce){
  .iu-hd-animate .iu-hd-onizleme-sheet,.iu-hd-animate .iu-hd-onizleme-img{animation:none!important}
}
.iu-hd-animate .iu-hd-onizleme-sheet{
  animation:iu-hd-sheet-in .68s cubic-bezier(.2,.85,.22,1) both;
}
.iu-hd-animate .iu-hd-onizleme-img{
  animation:iu-hd-img-in .92s cubic-bezier(.22,.75,.15,1) .14s both;
}
.iu-hd-onizleme-x{
  width:34px;height:34px;border-radius:10px;border:1px solid var(--br);
  background:rgba(0,0,0,.35);color:var(--t2);font-size:1.15rem;line-height:1;cursor:pointer;padding:0;
  display:inline-flex;align-items:center;justify-content:center;font-family:inherit;
  backdrop-filter:blur(6px);flex-shrink:0;
}
.iu-hd-onizleme-x:hover{border-color:var(--dan);color:#fff;background:rgba(255,69,58,.25)}
.iu-hd-onizleme-imgwrap{
  display:flex;justify-content:center;align-items:flex-start;
  min-height:0;
}
.iu-hd-onizleme-img{
  display:block;width:auto;height:auto;max-width:100%;
  max-height:min(96vh,2400px);
  border-radius:14px;
  border:1px solid rgba(255,255,255,.12);
  object-fit:contain;
  object-position:center center;
  box-shadow:0 6px 28px rgba(0,0,0,.5);
}

.iu-list-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box}
#iu-res .iu-list-wrap{
  margin:0;border:1px solid var(--br);border-radius:0;overflow:hidden;
  background:var(--bg2);flex:1 1 auto;min-height:0;
}
#iu-res .iu-list-tbl{border:none;border-radius:0;background:transparent}
@keyframes iu-list-reveal{
  from{opacity:0;transform:translateY(-14px)}
  to{opacity:1;transform:translateY(0)}
}
.iu-list-wrap--enter{animation:iu-list-reveal .65s ease-out forwards}
.iu-list-tbl{
  width:100%;min-width:720px;border-collapse:collapse;font-size:.72rem;
  table-layout:auto;background:var(--bg2);border-radius:0;overflow:hidden;border:1px solid var(--br);
}
.iu-list-tbl.iu-list-grid{
  table-layout:fixed;
  width:100%;
  min-width:720px;
}
.iu-list-tbl.iu-list-grid col.iu-col-av{width:52px}
.iu-list-tbl.iu-list-grid col.iu-col-wl{width:52px}
.iu-list-tbl.iu-list-grid col.iu-col-un{width:24%}
.iu-list-tbl.iu-list-grid col.iu-col-fn{width:20%}
/* Rozet: sabit dar sütun (yüzde + min() geniş tabloda şişiyordu) */
.iu-list-tbl.iu-list-grid col.iu-col-badge{width:104px;max-width:104px}
.iu-list-tbl.iu-list-grid col.iu-col-cb{width:48px}
.iu-list-tbl.iu-list-grid td.c-un,.iu-list-tbl.iu-list-grid td.c-fn{overflow:hidden}
.iu-list-tbl.iu-list-grid td.c-un .iu-uname{display:block;overflow:hidden;text-overflow:ellipsis;min-width:0}
.iu-list-tbl.iu-list-grid .iu-cell-wrap{max-width:100%!important}
.iu-list-tbl.iu-list-grid .iu-cell-clamp{max-width:100%}
.iu-list-tbl.iu-list-center thead th,
.iu-list-tbl.iu-list-center tbody td{text-align:center;vertical-align:middle}
.iu-list-tbl.iu-list-center .c-av .iu-av-wrap{margin:0 auto}
.iu-list-tbl.iu-list-center tbody td.c-av{text-align:center!important}
.iu-list-tbl.iu-list-center td.c-av .iu-av-wrap{
  display:flex;align-items:center;justify-content:center;width:100%;min-height:46px;margin:0 auto;
}
.iu-list-tbl thead th{
  padding:.36rem .32rem;text-align:left;font-size:.66rem;font-weight:700;text-transform:uppercase;
  letter-spacing:.03em;color:var(--t2);background:var(--bg4);border-bottom:1px solid var(--br);vertical-align:middle;
}
.iu-list-tbl thead th:not(:last-child){border-right:1px solid var(--br2)}
.iu-list-tbl.iu-list-grid thead th.iu-th-col{
  background:linear-gradient(180deg,var(--bg5),var(--bg4));
  color:var(--t2);
  font-size:.7rem;font-weight:800;letter-spacing:.08em;
  border-bottom:2px solid var(--acc);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
}
.iu-list-tbl.iu-list-center thead th{text-align:center}
.iu-list-tbl thead th.c-cb{width:40px;min-width:40px;text-align:center}
.iu-list-tbl thead th.c-av{width:52px;max-width:52px;box-sizing:border-box}
.iu-list-tbl thead th.c-wl{width:48px;min-width:48px;text-align:center}
.iu-list-tbl thead th.c-un{min-width:72px;max-width:22%}
.iu-list-tbl thead th.c-fn{min-width:64px;max-width:18%}
/* Ad sütunu: başlık ve hücre içeriği ortalı (clamp korunur) */
.iu-list-tbl.iu-list-center thead th.c-fn,
.iu-list-tbl.iu-list-center tbody td.c-fn{text-align:center!important}
.iu-list-tbl.iu-list-center tbody td.c-fn .iu-cell-wrap{
  width:100%;max-width:min(10rem,100%);margin-left:auto;margin-right:auto;text-align:center!important;
}
.iu-list-tbl.iu-list-center tbody td.c-fn .iu-cell-clamp{
  text-align:center!important;
}
.iu-list-tbl thead th.c-badge{min-width:72px;width:104px;max-width:104px;box-sizing:border-box}
.iu-list-tbl.iu-list-grid thead th.c-badge{width:104px;max-width:104px}
.iu-list-tbl.iu-list-grid td.c-badge{width:104px;max-width:104px;box-sizing:border-box;overflow:visible;vertical-align:middle}
.iu-list-tbl.iu-list-center thead th.c-av,.iu-list-tbl.iu-list-center thead th.c-wl,.iu-list-tbl.iu-list-center thead th.c-cb{text-align:center!important}
.iu-list-tbl.iu-list-center td.c-wl,.iu-list-tbl.iu-list-center td.c-cb{text-align:center!important;vertical-align:middle}
.iu-list-tbl.iu-list-center td.c-wl .iu-wl-btn{margin:0 auto}
.iu-list-tbl td.c-cb .iu-cb:disabled{opacity:.35;cursor:not-allowed}
.iu-list-tbl td.c-cb.iu-cb-wl-muted{color:var(--t3)}
.iu-bt-biz{background:#3d3428;border:1px solid rgba(255,200,120,.35);color:#ffc878}
.iu-goo-svg{display:block;flex-shrink:0}
.iu-badge-chips{display:flex;flex-wrap:wrap;gap:3px;justify-content:center;align-items:center;align-content:center;max-width:100%;min-height:24px;width:100%;box-sizing:border-box}
.iu-badge-tile{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;box-sizing:border-box;flex-shrink:0}
.iu-bt-artik{background:var(--bg4);border:1px solid var(--br2);color:var(--t2);font-size:.58rem;font-weight:800;border-radius:999px;padding:0 .2rem;width:auto;min-width:22px}
.iu-bt-ver{background:#3897f0;color:#fff;border:1px solid rgba(255,255,255,.25)}
.iu-bt-ver .iu-bt-svg{display:block}
.iu-bt-lock{background:#2e2e32;color:#eee;border:1px solid var(--br2)}
.iu-bt-noph{background:var(--bg4);border:1px solid var(--br)}
.iu-bt-mut{background:rgba(48,209,88,.14);color:var(--ok);border:1px solid rgba(48,209,88,.4);font-weight:800}
.iu-bt-empty{background:rgba(255,255,255,.06);border:1px dashed rgba(255,255,255,.22);color:rgba(255,255,255,.35);font-size:.62rem;line-height:1}
.iu-bt-page{background:var(--bg4);border:1px solid rgba(0,149,246,.4);color:var(--acc)}
.iu-bt-tum{background:rgba(48,209,88,.16);border:1px solid rgba(48,209,88,.45);color:#fff}
.iu-bt-tum .iu-bt-svg{display:block}
.iu-bt-ic{display:flex;align-items:center;justify-content:center;font-size:.58rem;line-height:1}
.iu-row-tail .iu-badge-tile{flex-shrink:0;margin:0}
/* Yan panel (filtre / toplu seçim / güvenlik): karo = checkbox ile aynı 12×12 */
.iu-lbl.iu-side-row.iu-side-row--ico .iu-row-tail{gap:.26rem;align-items:center}
.iu-lbl.iu-side-row.iu-side-row--ico .iu-row-tail input[type=checkbox]{
  width:12px;height:12px;min-width:12px;min-height:12px;margin:0;padding:0;flex-shrink:0;accent-color:var(--acc);
}
.iu-lbl.iu-side-row.iu-side-row--ico .iu-row-tail .iu-badge-tile{
  width:12px;height:12px;min-width:12px;min-height:12px;border-radius:50%;box-sizing:border-box;
}
.iu-lbl.iu-side-row.iu-side-row--ico .iu-row-tail .iu-bt-ic{font-size:8px;line-height:1}
.iu-lbl.iu-side-row.iu-side-row--ico .iu-row-tail .iu-bt-ver .iu-bt-svg,
.iu-lbl.iu-side-row.iu-side-row--ico .iu-row-tail .iu-bt-tum .iu-bt-svg{width:8px;height:8px;display:block}
.iu-lbl.iu-side-row.iu-side-row--ico .iu-row-tail .iu-bt-empty{font-size:.5rem;line-height:1}
.iu-list-tbl.iu-list-center td.c-badge{text-align:center;vertical-align:middle}
.iu-sp-act .iu-mola{margin:.35rem 0 .2rem}
.iu-sp-act .iu-eta{margin:.15rem 0 0}
.iu-side-nav-actions{
  flex-shrink:0;width:100%;box-sizing:border-box;padding:.4rem 0 .15rem;margin-top:.2rem;
  border-top:1px solid var(--br);
}
.iu-side-tarama-hint{
  font-size:.73rem;font-weight:600;color:rgba(255,255,255,.94);text-align:center;
  padding:.45rem .35rem;margin:0;line-height:1.45;
  text-shadow:0 1px 3px rgba(0,0,0,.45);
}
.iu-sp-quick{flex-shrink:0;margin-top:.2rem;padding:.26rem .38rem .3rem!important;border-top:1px solid var(--br);background:linear-gradient(175deg,var(--bg4),var(--bg3))}
.iu-side-scroll > .iu-sp-quick:first-child{margin-top:0!important;border-top:none}
.iu-sp-quick .iu-sp-hint strong{color:var(--acc);font-weight:600}
.iu-side-link-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;width:100%;margin-top:.15rem}
.iu-side-link-grid--osint{grid-template-columns:repeat(2,1fr)}
.iu-side-link-grid--one{grid-template-columns:1fr;max-width:100%}
.iu-side-link-grid--one .iu-sqbtn{min-height:38px}
.iu-sqbtn{
  display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0;border-radius:6px;border:1px solid var(--br);
  background:var(--bg4);color:var(--t2);font-size:.8rem;cursor:pointer;text-decoration:none;box-sizing:border-box;font-family:inherit;
  transition:background .12s,border-color .12s,color .12s;
}
.iu-sqbtn:not(:disabled):hover{background:var(--bg3);border-color:var(--acc);color:var(--tx)}
.iu-sqbtn:disabled{opacity:.42;cursor:default}
.iu-sqbtn-goo{font-size:0;line-height:0}
.iu-sqbtn-goo .iu-goo-svg{display:block;margin:0 auto}
.iu-sqbtn-rev{font-size:0;line-height:0;display:inline-flex;align-items:center;justify-content:center}
.iu-sqbtn-rev .iu-sqbtn-rev-ic{display:block;flex-shrink:0}
.iu-sqbtn-off{display:flex;align-items:center;justify-content:center;opacity:.45;font-size:.75rem;border:1px dashed var(--br);border-radius:6px;min-height:34px;background:var(--bg2)}
.iu-list-tbl .iu-cell-ell{max-width:14rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iu-list-tbl .iu-cell-wrap{white-space:normal;word-break:break-word;max-width:16rem;line-height:1.35;display:inline-block;max-width:min(16rem,100%)}
.iu-list-tbl.iu-list-center .iu-cell-wrap{text-align:center}
.iu-list-tbl .iu-cell-clamp{
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow:hidden;max-width:min(14rem,100%);text-align:inherit;
}
.iu-list-tbl tbody tr.iu-list-tr{transition:background .1s}
.iu-list-tbl tbody tr.iu-list-tr:hover{background:var(--bg3)}
.iu-list-tbl tbody td{padding:.32rem .35rem;vertical-align:middle;border-bottom:1px solid rgba(255,255,255,.05)}
tr.iu-list-harf{cursor:pointer;user-select:none}
tr.iu-list-harf:focus{outline:none}
tr.iu-list-harf:focus-visible{outline:2px solid var(--acc);outline-offset:-2px}
.iu-list-harf td{
  padding:.4rem .5rem!important;font-size:.85rem;font-weight:700;color:var(--t2);
  background:linear-gradient(180deg,var(--bg4),var(--bg3));border-bottom:1px solid var(--br);
  text-align:left!important;
}
.iu-harf-ic{
  display:inline-block;width:1rem;color:var(--acc);text-align:center;
  transition:transform .22s ease;transform-origin:50% 55%;
}
.iu-harf-ic--kapali{transform:rotate(-90deg)}
@keyframes iu-harf-rows-in{
  from{opacity:0}
  to{opacity:1}
}
@keyframes iu-harf-rows-out{
  from{opacity:1}
  to{opacity:0}
}
tr.iu-list-tr.iu-list-tr--harf-reveal{
  animation:iu-harf-rows-in .72s ease-out forwards;
}
tr.iu-list-tr.iu-list-tr--harf-out{
  animation:iu-harf-rows-out .32s ease-out forwards;
}
.iu-harf-lbl{margin-left:.15rem}
.iu-res-wait{min-height:12rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.75rem;padding:2rem;text-align:center}
.iu-res-wait--scan{
  min-height:14rem;padding:2.35rem 1.85rem;border-radius:16px;border:1px solid var(--br2);
  background:
    radial-gradient(120% 85% at 12% -8%, var(--acc3), transparent 52%),
    radial-gradient(90% 70% at 92% 105%, rgba(48,209,88,.14), transparent 48%),
    linear-gradient(168deg, var(--bg4) 0%, var(--bg3) 48%, var(--bg2) 100%);
  box-shadow:var(--sh2), inset 0 1px 0 rgba(255,255,255,.06);
  gap:0;
}
.iu-res-wait--scan.iu-res-wait--takipci{
  border-color:rgba(48,209,88,.35);
  background:
    radial-gradient(125% 90% at 10% -5%, rgba(48,209,88,.2), transparent 55%),
    radial-gradient(95% 75% at 95% 100%, var(--acc3), transparent 45%),
    linear-gradient(168deg, var(--bg4) 0%, var(--bg3) 50%, var(--bg2) 100%);
}
.iu-res-wait-inner{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.05rem;width:100%;max-width:28rem}
.iu-res-wait-title{
  margin:0;font-size:1.28rem;font-weight:800;letter-spacing:.02em;line-height:1.3;color:var(--tx);
}
.iu-res-wait--scan.iu-res-wait--takip .iu-res-wait-title{color:var(--acc)}
.iu-res-wait--scan.iu-res-wait--takipci .iu-res-wait-title{color:var(--ok);text-shadow:0 0 20px color-mix(in srgb,var(--ok) 28%,transparent)}
.iu-res-wait-count{
  display:block;margin:0;font-size:1.12rem;font-weight:700;color:var(--t2);line-height:1.5;
  font-variant-numeric:tabular-nums;letter-spacing:.02em;
}
.iu-res-wait-count .iu-res-n1{font-size:1.42rem;font-weight:800;color:var(--acc);vertical-align:baseline}
.iu-res-wait--takipci .iu-res-wait-count .iu-res-n1{color:var(--ok)}
.iu-res-wait-count .iu-res-sep{opacity:.65;margin:0 .12em}
.iu-res-wait-count .iu-res-n2{font-size:1.18rem;font-weight:800;color:var(--prog)}
.iu-res-wait--takipci .iu-res-wait-count .iu-res-n2{color:var(--ok)}
.iu-res-wait-count .iu-res-tail{margin-left:.35em;font-size:1rem;font-weight:600;color:var(--t2)}
.iu-res-wait-hint{margin:0;font-size:.88rem;font-weight:600;color:var(--t2);line-height:1.5;opacity:.95;max-width:26rem}
.iu-res-wait--scan.iu-res-wait--takip .iu-res-wait-hint{color:color-mix(in srgb,var(--tx) 88%,var(--acc))}
.iu-res-wait--scan.iu-res-wait--takipci .iu-res-wait-hint{color:color-mix(in srgb,var(--tx) 85%,var(--ok))}

/* Alfabe başlığı (eski liste) */
.iu-harf{
  padding:.3rem .7rem;font-size:1rem;font-weight:700;
  color:var(--t3);border-bottom:1px solid var(--br);
  margin:.35rem 0 .05rem;letter-spacing:.05em;
}

/* Avatar */
.iu-av-wrap{position:relative;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;z-index:0}
.iu-av{
  width:42px;height:42px;border-radius:50%;object-fit:cover;display:block;
  border:2px solid var(--br);transition:transform .18s ease,border-radius .18s ease,border-color .15s,box-shadow .18s ease;background:var(--bg4);
}
.iu-list-tr:hover .iu-av-wrap{z-index:2}
.iu-list-tr:hover .iu-av{
  transform:scale(1.12);border-radius:8px;border-color:var(--acc);
  box-shadow:0 3px 10px rgba(0,0,0,.35);
}

/* Kullanıcı bilgi */
.iu-wl-btn{
  background:none;border:1px solid var(--br);border-radius:50%;
  width:26px;height:26px;cursor:pointer;display:flex;align-items:center;justify-content:center;
  transition:all .15s;flex-shrink:0;color:var(--t3);padding:0;
}
.iu-wl-btn svg{display:block;flex-shrink:0}
.iu-wl-btn:hover,.iu-wl-btn.on{color:var(--gold);border-color:var(--gold);background:rgba(255,215,0,.08)}
/* Tek satirli kullanici bilgisi */
.iu-uinfo{flex:1;overflow:hidden;min-width:0;padding:0 .2rem;display:flex;align-items:center;gap:.3rem;flex-wrap:nowrap}
.iu-uname{font-size:.84rem;font-weight:700;color:var(--acc);text-decoration:none;white-space:nowrap;flex-shrink:0}
.iu-uname:hover{text-decoration:underline}
.iu-ulink{color:var(--acc);font-size:.72rem;text-decoration:none;word-break:break-all}
.iu-ulink:hover{text-decoration:underline}
.iu-usep{color:var(--br2);flex-shrink:0;font-size:.72rem}
.iu-ufull{font-size:.76rem;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:1;min-width:0}

/* Rozet grubu */
.iu-badges{display:flex;gap:.25rem;align-items:center;flex-wrap:wrap;flex-shrink:1;min-width:0;justify-content:flex-end;max-width:min(100%,240px)}
.iu-badge{padding:.08rem .3rem;border-radius:6px;font-size:.58rem;font-weight:700;white-space:nowrap;letter-spacing:.01em}
.iu-bv{background:#1d6fa4;color:#fff}
.iu-bp{border:1.5px solid var(--ok);color:var(--ok)}
.iu-bn{border:1.5px solid var(--warn);color:var(--warn)}
.iu-bk{border:1.5px solid var(--acc);color:var(--acc);font-size:.55rem}
.iu-badge.iu-ic{
  min-width:1.4rem;text-align:center;padding:.1rem .26rem;font-size:.72rem;line-height:1.1;
}
.iu-bk.iu-ic{border-width:2px;font-size:.9rem;font-weight:900;padding:.06rem .32rem}

/* Aksiyon butonları (satır içi) */
.iu-row-act{display:flex;align-items:center;gap:.25rem;flex-shrink:0}
.iu-icon-btn{
  background:none;border:1px solid transparent;border-radius:4px;
  color:var(--t3);cursor:pointer;padding:.15rem .25rem;font-size:.7rem;
  transition:all .12s;flex-shrink:0;line-height:1;
}
.iu-icon-btn:hover{background:var(--bg4);border-color:var(--br);color:var(--tx)}
.iu-cb{width:1.12rem;height:1.12rem;accent-color:var(--acc);flex-shrink:0;cursor:pointer}
.iu-empty{text-align:center;padding:3rem 1rem;color:var(--t3);font-size:.82rem;line-height:1.8}
.iu-tarama-bar{
  flex-shrink:0;margin:.65rem .5rem .4rem;padding:0;border-radius:8px;
  background:var(--bg3);border:1px solid var(--br);overflow:hidden;
  box-shadow:0 2px 10px rgba(0,0,0,.2);
}
.iu-tarama-bar-in{height:4px;background:linear-gradient(90deg,var(--acc2),var(--acc));transition:width .35s ease}
.iu-tarama-bar-txt{
  display:flex;justify-content:space-between;align-items:center;
  padding:.35rem .55rem;font-size:.72rem;color:var(--t2);
}
.iu-tarama-pct{font-weight:700;color:var(--acc);font-variant-numeric:tabular-nums}
.iu-tarama-load .iu-tarama-pulse{
  width:48px;height:48px;margin:0 auto 1rem;border-radius:50%;
  border:3px solid var(--br);border-top-color:var(--acc);
  animation:iu-spin .8s linear infinite;
}
@keyframes iu-spin{to{transform:rotate(360deg)}}
.iu-tarama-load strong{color:var(--tx)}

/* ── BAŞLANGIÇ EKRANI ── */
.iu-init{display:flex;align-items:center;justify-content:center;flex:1;flex-direction:column;gap:1.75rem;padding:2rem;text-align:center}
.iu-run{
  width:140px;height:140px;border-radius:50%;
  border:2px solid var(--br2);background:var(--bg3);color:var(--t2);
  font-size:1.5rem;font-weight:700;cursor:pointer;
  transition:all .2s;font-family:inherit;letter-spacing:2px;
  box-shadow:var(--sh2);
}
.iu-run:hover{border-color:var(--acc);color:var(--acc);transform:scale(1.06);background:var(--acc3);box-shadow:0 0 0 6px var(--acc3)}
.iu-init-cards-wrap{width:100%;max-width:660px;display:flex;flex-direction:column;align-items:stretch;gap:.65rem}
.iu-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;width:100%;max-width:580px}
.iu-cards.iu-cards--init{max-width:660px;gap:.65rem}
.iu-card{padding:.55rem;background:var(--bg3);border:1px solid var(--br);border-radius:8px;text-align:center}
.iu-card .val{font-size:1.3rem;font-weight:700;color:var(--acc);font-variant-numeric:tabular-nums}
.iu-card .lbl{font-size:.64rem;color:var(--t2);margin-top:.12rem;font-weight:500}
button.iu-init-card{
  margin:0;font:inherit;color:inherit;text-align:center;
  min-height:5.5rem;padding:.78rem .6rem .65rem;border-radius:10px;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.15rem;
  border:1px solid var(--br);background:var(--bg3);
  transition:border-color .18s,background .18s,box-shadow .18s,transform .12s;
  position:relative;
}
button.iu-init-card:hover{border-color:var(--br2);background:var(--bg4);box-shadow:0 4px 14px rgba(0,0,0,.28)}
button.iu-init-card:active{transform:scale(.985)}
.iu-init-card-ic{font-size:1.05rem;line-height:1;margin-bottom:.05rem;opacity:.92}
button.iu-init-card[aria-expanded="true"]{
  border-color:var(--acc);background:var(--acc3);box-shadow:0 0 0 1px var(--acc3);
}
button.iu-init-card:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.iu-init-card .val{font-size:1.48rem;line-height:1.15;margin-top:.1rem}
.iu-init-card .lbl{font-size:.72rem;margin-top:.08rem;line-height:1.25;font-weight:600;color:var(--t2)}
.iu-init-detail{
  padding:1rem 1.05rem;border-radius:11px;border:1px solid var(--br);
  background:linear-gradient(165deg,var(--bg4) 0%,var(--bg3) 100%);
  box-shadow:0 2px 16px rgba(0,0,0,.22);
  animation:iu-init-detail-in .22s ease;
}
@keyframes iu-init-detail-in{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
.iu-init-detail h4{
  margin:0 0 .45rem;font-size:.88rem;font-weight:700;color:var(--tx);
  display:flex;align-items:flex-start;gap:.4rem;line-height:1.35;
}
.iu-init-detail h4 .iu-init-detail-ic{flex-shrink:0;font-size:1rem;line-height:1.2;opacity:.95}
.iu-init-detail p{margin:0;font-size:.78rem;color:var(--t2);line-height:1.6}

/* ── LOG (TAKİP BIRAKMA) ── */
.iu-log{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:.75rem .85rem 1.1rem;box-sizing:border-box}
.iu-log::-webkit-scrollbar{width:8px}
.iu-log::-webkit-scrollbar-thumb{background:var(--br2);border-radius:4px}
.iu-log-hero{
  display:flex;align-items:center;gap:.5rem;min-height:46px;padding:.28rem .75rem;margin-bottom:.65rem;border-radius:10px;
  border:1px solid rgba(48,209,88,.32);
  background:linear-gradient(135deg,rgba(48,209,88,.12),rgba(48,209,88,.03));
  max-width:100%;box-sizing:border-box;
}
.iu-log-hero-ic{
  width:1.55rem;height:1.55rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;
  background:rgba(48,209,88,.22);color:var(--ok);font-weight:800;font-size:.78rem;
}
.iu-log-hero-txt{display:flex;align-items:center;gap:.45rem;min-width:0;flex-wrap:wrap}
.iu-log-hero-title{font-weight:800;font-size:.86rem;color:var(--ok);line-height:1.2}
.iu-log-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.3rem}
.iu-log-row{
  display:grid;grid-template-columns:1.6rem minmax(0,1fr) auto;align-items:center;gap:.5rem;
  min-height:46px;padding:.42rem .65rem;border-radius:10px;font-size:.8rem;box-sizing:border-box;
}
.iu-log-status-ic{font-size:.78rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.iu-log-row-body{display:flex;flex-direction:column;gap:.08rem;min-width:0;overflow:hidden}
.iu-log-un{font-weight:700;color:var(--acc);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:.82rem}
a.iu-log-un:hover{text-decoration:underline}
.iu-log-no .iu-log-un{color:var(--dan)}
.iu-log-fn{font-size:.68rem;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.iu-log-fn--err{color:var(--dan)!important}
.iu-log-meta{font-size:.66rem;color:var(--t3);white-space:nowrap;font-variant-numeric:tabular-nums;flex-shrink:0;text-align:right}
.iu-log-ok{background:rgba(48,209,88,.07);border:1px solid rgba(48,209,88,.18)}
.iu-log-no{background:rgba(255,69,58,.07);border:1px solid rgba(255,69,58,.2);color:var(--tx)}
.iu-log-empty{padding:1.5rem 1rem;text-align:center;color:var(--t2);font-size:.84rem;list-style:none}

/* ── GEÇMİŞ ── */
.iu-gecmis-area{flex:1;padding:1.25rem 1.5rem;max-width:860px;margin:0 auto;width:100%}
.iu-gecmis-side-head{padding-bottom:.5rem!important}
.iu-gecmis-side-title{margin:0;font-size:.98rem;font-weight:700;line-height:1.25;color:var(--tx)}
.iu-gecmis-side-head .iu-gecmis-meta{display:block;margin-top:.28rem;font-size:.72rem;color:var(--t3);font-weight:400;font-variant-numeric:tabular-nums}
.iu-sp--settings-head .iu-gecmis-meta{display:block;margin-top:.28rem;font-size:.72rem;color:var(--t3);font-weight:400;font-variant-numeric:tabular-nums}
.iu-gecmis-rows-wrap{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:.65rem .85rem 1rem;box-sizing:border-box}
.iu-cont--gecmis,.iu-cont--settings,.iu-cont--birakma{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.iu-ayarlar-page{max-width:860px;padding-bottom:1rem}
.iu-ayarlar-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:.75rem .85rem 1.25rem;box-sizing:border-box}
.iu-ayarlar-scroll .iu-modal,
.iu-ayarlar-page .iu-modal{max-width:100%;width:100%;max-height:none;margin:0;padding:1rem 0;box-shadow:none;border:none;background:transparent}
.iu-ayarlar-scroll .iu-modal.iu-settings-main{max-width:56rem;margin:0 auto;padding:0 .35rem 1.5rem}
.iu-settings-lead{
  margin:0 0 1.1rem;padding:.55rem .65rem .55rem .85rem;font-size:.82rem;line-height:1.55;color:var(--t2);
  border-left:3px solid var(--acc);border-radius:0 10px 10px 0;background:var(--acc3);
}
.iu-settings-card{
  margin-bottom:1rem;border:1px solid var(--br);border-radius:14px;
  background:linear-gradient(175deg,var(--bg4),var(--bg3));
  box-shadow:0 6px 24px rgba(0,0,0,.22);overflow:hidden;
}
.iu-settings-card-head{
  display:flex;align-items:flex-start;gap:.65rem;padding:.8rem 1rem .55rem;border-bottom:1px solid var(--br);
  background:rgba(0,0,0,.12);
}
.iu-settings-card-ic{font-size:1.4rem;line-height:1;flex-shrink:0}
.iu-settings-card-title{margin:0;font-size:.93rem;font-weight:800;color:var(--tx);letter-spacing:.01em}
.iu-settings-card-desc{margin:.2rem 0 0;font-size:.72rem;color:var(--t3);line-height:1.4;max-width:42rem}
.iu-settings-card-body{padding:.4rem .5rem .75rem}
.iu-set-tbl--settings tbody td:first-child{white-space:normal;line-height:1.45}
.iu-set-tbl--2col thead th:nth-child(2){width:96px;text-align:center}
.iu-set-tbl--2col tbody td:nth-child(2){width:96px}
.iu-settings-warn{margin-top:.35rem}
.iu-sp--settings-head{padding-bottom:.35rem!important}
.iu-side-scroll > .iu-sp.iu-sp--settings-head{
  min-height:46px;box-sizing:border-box;display:flex;align-items:center;padding-top:.28rem!important;padding-bottom:.28rem!important;
}
.iu-side-scroll > .iu-sp.iu-sp--settings-head .iu-side-settings-title{margin:0;line-height:1.2}
.iu-side-settings-title{margin:0;font-size:.91rem;font-weight:700;line-height:1.25;color:var(--tx);padding-bottom:0;border-bottom:none}
.iu-side-settings-ver{font-size:.6rem;color:var(--t3);font-weight:400;margin-left:.2rem}
.iu-side-msec-h{margin:0 0 .32rem;font-size:.6rem;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em}
.iu-sp--theme-inline{padding:.42rem .45rem .48rem!important}
.iu-theme-inline-row{display:flex;flex-wrap:nowrap;align-items:center;gap:.5rem;justify-content:space-between;width:100%}
.iu-side-msec-h--theme{margin:0!important;flex-shrink:0;font-size:.62rem;letter-spacing:.05em}
.iu-sp--theme-inline .iu-temalar--side{flex:1;justify-content:flex-end;gap:.32rem;min-width:0}
.iu-temalar--side{justify-content:flex-start}
.iu-temalar--side .iu-tema-opt{width:24px;height:24px;font-size:.6rem}
.iu-sp-act{
  flex-shrink:0;margin-top:.35rem;padding:.45rem .42rem!important;
  background:linear-gradient(165deg,var(--bg4),var(--bg3))!important;
  border:2px solid var(--acc)!important;border-radius:9px!important;box-shadow:var(--sh);
}
.iu-side-scroll > .iu-sp-act:first-child{margin-top:0;margin-bottom:.22rem}
.iu-side-scroll > .iu-sp-quick{margin-top:.18rem!important}
.iu-sp-act .iu-pag{margin:.15rem 0;font-size:.72rem;font-weight:600;color:var(--tx)}
.iu-sp-act .iu-pag-info{color:var(--acc);font-variant-numeric:tabular-nums}
.iu-sp-act .iu-pag-btn{font-weight:700}
.iu-gecmis-row{display:flex;align-items:center;gap:.5rem;padding:.35rem .55rem;background:var(--bg2);border:1px solid var(--br);border-radius:6px;margin-bottom:.2rem;font-size:.76rem;transition:background .1s}
.iu-gecmis-row:hover{background:var(--bg3)}
.iu-gecmis-row .tarih{color:var(--t3);font-size:.65rem;margin-left:auto;white-space:nowrap;font-variant-numeric:tabular-nums}
.iu-gecmis-card{
  display:flex;align-items:center;gap:.4rem;flex-wrap:nowrap;padding:.32rem .5rem;background:var(--bg2);border:1px solid var(--br);border-radius:8px;margin-bottom:.28rem;
  transition:background .12s,border-color .12s;min-height:2rem;
}
.iu-gecmis-card:hover{background:var(--bg3);border-color:var(--br2)}
.iu-gecmis-card-ic{font-size:.95rem;line-height:1;flex-shrink:0;width:1.25rem;text-align:center}
.iu-gecmis-card a{font-weight:700;color:var(--acc);text-decoration:none;font-size:.76rem;flex-shrink:0;max-width:min(200px,28vw);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iu-gecmis-card a:hover{text-decoration:underline}
.iu-gecmis-badge{display:inline-flex;align-items:center;padding:.1rem .3rem;border-radius:999px;font-size:.56rem;font-weight:700;letter-spacing:.02em;text-transform:uppercase;flex-shrink:0}
.iu-gecmis-badge--ok{background:rgba(34,197,94,.15);color:var(--ok);border:1px solid rgba(34,197,94,.35)}
.iu-gecmis-badge--no{background:rgba(239,68,68,.12);color:var(--dan);border:1px solid rgba(239,68,68,.3)}
.iu-gecmis-tip{flex:1;min-width:0;font-size:.72rem;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iu-gecmis-card-meta{color:var(--t3);font-size:.64rem;font-variant-numeric:tabular-nums;white-space:nowrap;flex-shrink:0}
.iu-gecmis-rows-wrap .iu-list-wrap{
  margin:0;border:1px solid var(--br);border-radius:8px;overflow:hidden;
  background:var(--bg2);width:100%;box-sizing:border-box;
}
.iu-gecmis-rows-wrap .iu-list-tbl{border:none;border-radius:0;background:transparent}
.iu-gecmis-tbl.iu-list-grid{min-width:min(100%,720px)}
.iu-gecmis-tbl.iu-list-tbl thead th.iu-th-col{
  min-height:46px!important;height:auto!important;box-sizing:border-box!important;
  padding:.72rem .5rem!important;line-height:1.25!important;
  display:table-cell;vertical-align:middle!important;
}
.iu-gecmis-tbl col.iu-col-gc-st{width:88px}
.iu-gecmis-tbl col.iu-col-gc-un{width:22%}
.iu-gecmis-tbl col.iu-col-gc-fn{width:22%;min-width:120px}
.iu-gecmis-tbl col.iu-col-gc-tip{width:auto}
.iu-gecmis-tbl col.iu-col-gc-ts{width:20%;min-width:120px}
.iu-gecmis-tbl.iu-list-center tbody td.c-gec-un .iu-uname{display:block;margin:0 auto;max-width:min(16rem,100%);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;color:var(--acc);text-decoration:none;font-size:.74rem}
.iu-gecmis-tbl.iu-list-center tbody td.c-gec-fn{text-align:center!important}
.iu-gecmis-tbl tbody td.c-gec-fn{font-size:.72rem;color:var(--t2);line-height:1.35;word-break:break-word}
.iu-birakma-rows .iu-log-hero{margin-bottom:.65rem;max-width:100%}
.iu-birakma-log-tbl{margin-top:0}
.iu-gecmis-tbl.iu-list-center td.c-gec-un a:hover{text-decoration:underline}
.iu-gecmis-tbl tbody td.c-gec-tip{color:var(--t2);font-size:.72rem;line-height:1.35;word-break:break-word}
.iu-gecmis-tbl tbody td.c-gec-ts{font-size:.7rem;color:var(--t3);font-variant-numeric:tabular-nums}
.iu-lock-ic{font-size:1rem;line-height:1;display:inline-flex;align-items:center}
.iu-author-panel .iu-msec{max-width:640px;margin:0 auto}
.iu-author-hero{text-align:center;padding:1rem 0 .5rem}
.iu-author-hero h2{font-size:1.15rem;margin:0 0 .35rem;color:var(--tx)}
.iu-author-hero p{color:var(--t2);line-height:1.55;font-size:.88rem;margin:0}
.iu-author-credit{margin:0 0 .5rem;font-size:1rem;text-align:center;color:var(--tx)}
.iu-author-version{
  margin:0 0 .5rem;text-align:center;font-size:.98rem!important;font-weight:800;letter-spacing:.06em;
  color:var(--gold);text-shadow:0 0 20px rgba(255,215,0,.22);
}
.iu-author-changelog{
  margin:0 auto 1rem;font-size:.82rem;line-height:1.45;text-align:center;color:var(--t2);
  max-width:34rem;
}
.iu-author-social{display:flex;justify-content:center;gap:.65rem;flex-wrap:wrap;margin-top:1.1rem;padding-top:1rem;border-top:1px solid var(--br)}
.iu-soc{
  display:inline-flex;align-items:center;justify-content:center;width:2.35rem;height:2.35rem;border-radius:10px;
  background:var(--bg3);border:1px solid var(--br);color:var(--tx);text-decoration:none;font-size:1.1rem;
  transition:background .15s,border-color .15s,transform .12s;
}
.iu-soc:hover{background:var(--bg4);border-color:var(--acc);transform:translateY(-2px)}
.iu-soc svg{display:block;width:1.15rem;height:1.15rem;flex-shrink:0}

/* ── MODAL (ayarlar vb.) ── */
.iu-modal{
  background:var(--bg3);border:1px solid var(--br2);border-radius:14px;
  padding:1.25rem;max-width:680px;width:94%;max-height:88vh;
  overflow-y:auto;display:flex;flex-direction:column;gap:.85rem;
  box-shadow:var(--sh2);
}
.iu-modal::-webkit-scrollbar{width:4px}
.iu-modal::-webkit-scrollbar-thumb{background:var(--br2);border-radius:2px}
.iu-modal h2{text-align:center;font-size:1.1rem;font-weight:700;color:var(--tx);padding-bottom:.7rem;border-bottom:1px solid var(--br)}
.iu-modal h3{font-size:.82rem;font-weight:700;margin-bottom:.4rem;color:var(--t2);text-transform:uppercase;letter-spacing:.04em}
.iu-msec{display:flex;flex-direction:column;gap:.4rem;padding-bottom:.5rem;border-bottom:1px solid var(--br)}
.iu-msec:last-of-type{border-bottom:none}

/* Güvenlik profil kartları */
.iu-profils{display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem}
.iu-profil{padding:.5rem .4rem;border:1.5px solid var(--br);border-radius:8px;cursor:pointer;text-align:center;transition:all .15s;background:var(--bg2)}
.iu-profil:hover{border-color:var(--br2);background:var(--bg4)}
.iu-profil.on{border-color:var(--acc);background:var(--acc3)}
.iu-profil strong{display:block;font-size:.76rem;margin-bottom:.18rem;color:var(--tx)}
.iu-profil span{font-size:.63rem;color:var(--t3);line-height:1.3}

/* Ayar tablosu */
/* Ayarlar tablosu — sabit kolon genisligi */
.iu-set-tbl{width:100%;border-collapse:collapse;font-size:.78rem;table-layout:fixed}
.iu-set-tbl thead tr{border-bottom:1px solid var(--br)}
.iu-set-tbl thead th{padding:.35rem .5rem;text-align:left;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.iu-set-tbl thead th:first-child{color:var(--t3);width:auto}
.iu-set-tbl thead th:nth-child(2){color:var(--acc);text-align:center;width:120px}
.iu-set-tbl thead th:nth-child(3){color:var(--ok);text-align:center;width:110px}
.iu-set-tbl tbody tr{border-bottom:1px solid rgba(255,255,255,.04);transition:background .1s}
.iu-set-tbl tbody tr:last-child{border-bottom:none}
.iu-set-tbl tbody tr:hover{background:var(--acc3)}
.iu-set-tbl tbody td{padding:.38rem .5rem;vertical-align:middle;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iu-set-tbl tbody td:nth-child(2){text-align:center;background:var(--acc3);border-radius:4px;width:120px}
.iu-set-tbl tbody td:nth-child(3){text-align:center;color:var(--ok);font-weight:600;font-size:.72rem;width:110px}
.iu-set-inp{
  width:90px;padding:.28rem .4rem;border:1px solid var(--br);border-radius:5px;
  background:var(--bg2);color:var(--tx);font-size:.78rem;
  text-align:right;font-variant-numeric:tabular-nums;font-family:inherit;transition:all .15s;
}
.iu-set-inp:focus{outline:none;border-color:var(--acc);background:var(--bg4)}
.iu-set-inp:disabled{opacity:.4;cursor:not-allowed;background:var(--bg3)}

.iu-warn-box{padding:.6rem;background:rgba(255,69,58,.05);border:1px solid rgba(255,69,58,.15);border-radius:7px;font-size:.75rem;color:var(--warn);text-align:center;line-height:1.6}
.iu-info-box{padding:.6rem;background:var(--acc3);border:1px solid var(--acc);border-radius:7px;font-size:.75rem;color:var(--tx);line-height:1.6}
.iu-mfooter{display:flex;justify-content:center;gap:.5rem;padding-top:.7rem;border-top:1px solid var(--br);flex-wrap:wrap}
.iu-mfooter.iu-side-act-stack{flex-direction:column;align-items:stretch;justify-content:flex-start}

/* Tema seçici */
.iu-temalar{display:flex;gap:.45rem;flex-wrap:wrap;justify-content:center;align-items:center}
.iu-tema-opt{
  width:28px;height:28px;border-radius:50%;cursor:pointer;border:2px solid transparent;
  transition:all .15s;display:flex;align-items:center;justify-content:center;
  font-size:.7rem;color:#fff;font-weight:700;
}
.iu-tema-opt.on{border-color:#fff;transform:scale(1.15)}
.iu-tema-opt:hover:not(.on){transform:scale(1.08)}

/* ── TOAST — sağ alt, okunaklı; tema ile uyumlu ── */
.iu-toast{
  position:fixed;left:auto;right:max(.5rem,env(safe-area-inset-right,0px));bottom:calc(3rem + .4rem + env(safe-area-inset-bottom,0px));top:auto;
  transform:none;
  width:min(360px,calc(100vw - 1rem));max-width:min(360px,calc(100vw - 1rem));min-width:0;box-sizing:border-box;
  min-height:auto;max-height:none;  padding:.78rem 1rem .82rem 1.12rem;border-radius:14px;color:var(--tx);font-size:.84rem;
  z-index:500;display:flex;align-items:flex-start;justify-content:flex-start;
  border:1px solid rgba(255,255,255,.14);border-left:4px solid var(--toast-bar,var(--acc));outline:none;
  box-shadow:
    0 12px 40px rgba(0,0,0,.45),
    inset 0 1px 0 rgba(255,255,255,.08);
  animation:iu-toast-in .28s cubic-bezier(.2,.85,.25,1);font-weight:600;
  backdrop-filter:blur(10px);
}
.iu-toast-txt{
  flex:1;min-width:0;text-align:left;white-space:pre-line;word-break:break-word;line-height:1.48;
  max-height:min(40vh,12rem);overflow-y:auto;font-weight:600;font-size:.84rem;
  padding-right:.15rem;
}
.iu-t-info{
  background:linear-gradient(165deg,rgba(0,149,246,.22),var(--bg3));
  --toast-bar:var(--acc);
  color:var(--tx);border-left-color:var(--acc);
}
.iu-t-success{
  background:linear-gradient(165deg,rgba(48,209,88,.2),var(--bg3));
  --toast-bar:var(--ok);
  color:var(--tx);border-left-color:var(--ok);
}
.iu-t-error{
  background:linear-gradient(165deg,rgba(255,69,58,.2),var(--bg3));
  --toast-bar:var(--dan);
  color:var(--tx);border-left-color:var(--dan);
}
.iu-t-warning{
  background:linear-gradient(165deg,rgba(255,214,10,.16),var(--bg3));
  --toast-bar:#d4a017;
  color:var(--tx);border-left-color:#e6b422;
}
@keyframes iu-toast-in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}

/* Alt uygulama menüsü */
.iu-app-nav{
  position:fixed;bottom:0;left:0;right:0;height:3rem;z-index:95;
  display:flex;align-items:stretch;justify-content:flex-start;
  background:var(--bg3);border-top:1px solid var(--br);box-shadow:0 -2px 12px rgba(0,0,0,.25);
}
.iu-app-nav button{
  flex:0 0 var(--iu-nav-cell);max-width:var(--iu-nav-cell);min-width:0;box-sizing:border-box;
  border:none;background:transparent;color:var(--t2);cursor:pointer;
  font-family:inherit;font-size:.72rem;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:.18rem;padding:.25rem;line-height:1.15;
  transition:color .12s,background .12s;
}
.iu-app-nav button:not(:last-child){border-right:1px solid var(--br)}
.iu-app-nav button:hover{background:var(--bg4);color:var(--tx)}
.iu-app-nav button.on{color:var(--acc);background:rgba(0,149,246,.08)}
.iu-app-nav button span{font-size:1.06rem;line-height:1}

/* ── RESPONSIVE ── */
@media(max-width:900px){
  .iu-cont-head-main{flex-direction:column;align-items:stretch}
  .iu-cont-head-main .iu-list-hdr{justify-content:space-between}
}
@media(max-width:1100px){
  .iu-side{width:var(--iu-nav-cell);min-width:var(--iu-nav-cell);max-width:var(--iu-nav-cell)}
  .iu-inp-w{width:130px}
  .iu-cards{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:860px){
  .iu-side{width:var(--iu-nav-cell);min-width:var(--iu-nav-cell);max-width:var(--iu-nav-cell);padding:.42rem;font-size:.78rem}
  .iu-hdr-in{padding:0 .6rem;gap:.3rem}
  .iu-logo-icon svg{width:24px;height:24px}
  .iu-btn{padding:.25rem .5rem;font-size:.7rem}
  .iu-inp-w{width:110px;font-size:.7rem}
  .iu-tab{font-size:.7rem;min-width:60px;padding:.35rem .2rem}
  .iu-profils{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:640px){
  .iu-body{flex-direction:column}
  .iu-side{width:100%;min-width:unset;max-width:none;height:auto;position:static;border-right:none;border-bottom:1px solid var(--br);flex-direction:row;flex-wrap:wrap;gap:.3rem;overflow:visible;padding:.45rem}
  .iu-side h5{width:100%;margin:.3rem 0 .15rem}
  .iu-div{width:100%;margin:.25rem 0}
  .iu-stat{width:100%}
  .iu-pag{width:100%}
  .iu-lbl{flex:1;min-width:110px}
  .iu-sbtn{flex:1;min-width:110px}
  .iu-inp-w{width:90px}
  .iu-run{width:120px;height:120px;font-size:1.3rem}
  .iu-cards{grid-template-columns:repeat(2,1fr);gap:.4rem}
  .iu-modal{width:97%;padding:.9rem;max-height:92vh}
  .iu-profils{grid-template-columns:repeat(2,1fr)}
  .iu-mfooter{flex-direction:column}
  .iu-mfooter .iu-btn,.iu-mfooter .iu-side-action{width:100%;justify-content:center}
  .iu-gecmis-area{padding:.9rem}
}
@media(max-width:400px){
  .iu-hdr{height:3rem}
  .iu-body{margin-top:3rem}
  .iu-side{top:3rem}
  .iu-av{width:36px;height:36px}
  .iu-tab{font-size:.64rem;min-width:50px}
  .iu-cards{grid-template-columns:repeat(2,1fr)}
  .iu-run{width:104px;height:104px;font-size:1.1rem}
}
`;
        document.head.appendChild(s);
    }

    // ─────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────
    function render() {
        const kok = document.getElementById("iu-kok");
        if (!kok) return;
        const ekranDegisti = Ref.pageAnimHazir && Ref.prevEkran !== null && Ref.prevEkran !== D.ekran;
        const FOCUS_IDS = { "gecmis-ara": 1, "birak-ara": 1, "list-ara": 1 };
        let rid = "", ss = 0, se = 0;
        const ae = document.activeElement;
        if (ae && FOCUS_IDS[ae.id]) {
            rid = ae.id;
            if (typeof ae.selectionStart === "number") {
                ss = ae.selectionStart;
                se = ae.selectionEnd;
            }
        }
        if (D.ekran === "tarama") {
            const elSide = kok.querySelector(".iu-side-scroll");
            Ref.iuSideScrollPending = elSide ? elSide.scrollTop : null;
        } else Ref.iuSideScrollPending = null;
        kok.innerHTML = "";
        kok.appendChild(hdr());
        switch (D.ekran) {
            case "baslangic": kok.appendChild(ekranBaslangic()); break;
            case "tarama":    kok.appendChild(ekranTarama());    break;
            case "birakma":   kok.appendChild(ekranBirakma());   break;
            case "gecmis":    kok.appendChild(ekranGecmis());    break;
            case "ayarlar":   kok.appendChild(ekranAyarlar());   break;
        }
        kok.appendChild(appNavEl());
        if (rid) {
            requestAnimationFrame(() => {
                const inp = document.getElementById(rid);
                if (!inp) return;
                inp.focus();
                try { inp.setSelectionRange(ss, se); } catch (_) {}
            });
        }
        if (Ref.iuResPending !== null) {
            const st = Ref.iuResPending;
            Ref.iuResPending = null;
            requestAnimationFrame(() => {
                const el = document.getElementById("iu-res");
                if (el) el.scrollTop = st;
            });
        }
        if (Ref.iuSideScrollPending !== null) {
            const sst = Ref.iuSideScrollPending;
            Ref.iuSideScrollPending = null;
            requestAnimationFrame(() => {
                const el = document.querySelector("#iu-kok .iu-side-scroll");
                if (el) el.scrollTop = sst;
            });
        }
        Ref.pageAnimHazir = true;
        Ref.prevEkran = D.ekran;
        const wrapEl = kok.querySelector(".iu-wrap");
        if (wrapEl && ekranDegisti) {
            let pageAnimTemiz = false;
            const pageAnimBitir = () => {
                if (pageAnimTemiz) return;
                pageAnimTemiz = true;
                wrapEl.classList.remove("iu-page-enter", "iu-page-enter--on");
            };
            wrapEl.classList.add("iu-page-enter");
            requestAnimationFrame(() => {
                requestAnimationFrame(() => { wrapEl.classList.add("iu-page-enter--on"); });
            });
            wrapEl.addEventListener("transitionend", pageAnimBitir, { once: true });
            setTimeout(pageAnimBitir, 400);
        }
        hdrLogoGuncelle();
    }

    function appNavEl() {
        const nav = document.createElement("nav");
        nav.className = "iu-app-nav";
        const rows = [
            { k: "baslangic", icon: "🏠", t: "Başlangıç" },
            { k: "tarama", icon: "🔍", t: "Tarama" },
            { k: "birakma", icon: "❌", t: "Bırak" },
            { k: "gecmis", icon: "📜", t: "Geçmiş" },
            { k: "ayarlar", icon: "⚙️", t: "Ayarlar" },
        ];
        nav.innerHTML = rows.map(r => {
            const on = D.ekran === r.k;
            return `<button type="button" class="${on ? "on" : ""}" data-nav="${r.k}"><span>${r.icon}</span>${r.t}</button>`;
        }).join("");
        setTimeout(() => {
            nav.querySelectorAll("[data-nav]").forEach(btn => {
                btn.addEventListener("click", () => {
                    const k = btn.dataset.nav;
                    if (k === "ayarlar") { D.ekran = "ayarlar"; render(); return; }
                    if (k === "baslangic") {
                        if (D.ekran === "tarama" && D.yuzde < 100) {
                            if (!confirm("Tarama sürüyor. Başlangıç ekranına geçmek istiyor musunuz? (Tarama arka planda sürebilir.)")) return;
                        }
                        D.ekran = "baslangic";
                        render();
                        return;
                    }
                    if (k === "tarama") {
                        if (D.sonuclar.length === 0 && D.yuzde === 0) {
                            toast("Önce ana ekrandan TARA ile taramayı başlatın.", "warning", 3500);
                            return;
                        }
                        D.ekran = "tarama";
                        render();
                        return;
                    }
                    if (k === "birakma") {
                        if (D.ekran !== "birakma" && D.birakmaLog.length === 0) {
                            toast("Günlükte henüz kayıt yok.\nÖnce listeden seçip TAKİBİ BIRAK kullanın.", "info", 4000);
                            return;
                        }
                        D.ekran = "birakma";
                        render();
                        return;
                    }
                    if (k === "gecmis") { D.ekran = "gecmis"; render(); }
                });
            });
        }, 0);
        return nav;
    }

    // ── HEADER ──
    function hdr() {
        const h = document.createElement("header");
        h.className = "iu-hdr";
        h.innerHTML = `
<div class="iu-hdr-in">
  <div class="iu-logo" id="iu-logo" title="Ana sayfaya dön">
    <div class="iu-logo-icon" aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" rx="8" fill="var(--acc)"/>
        <circle cx="10" cy="11" r="3.5" fill="white" opacity=".9"/>
        <circle cx="18" cy="11" r="3.5" fill="white" opacity=".9"/>
        <path d="M5 20c0-2.8 2.2-5 5-5h8c2.8 0 5 2.2 5 5" stroke="white" stroke-width="2" stroke-linecap="round" fill="none" opacity=".85"/>
        <circle cx="20" cy="19" r="5" fill="var(--acc2)"/>
        <path d="M17.5 19l1.5 1.5 3-3" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="iu-logo-t">
      <span class="iu-logo-brand">InstaFollowKit</span>
      <span id="iu-logo-un" class="iu-logo-line1">…</span>
    </div>
  </div>
  <div class="iu-hdr-act" id="iu-hdr-act-wrap">
    <span class="iu-hdr-ver">v${VERSIYON}</span>
  </div>
</div>`;
        setTimeout(() => {
            document.getElementById("iu-logo")?.addEventListener("click", () => {
                if (D.ekran !== "baslangic" && D.yuzde >= 100) {
                    profilHdBlobIptal();
                    Object.assign(D, { ekran:"baslangic", sonuclar:[], takipciler:[], secili:[], yuzde:0, arama:"", profilHdOnizleme: null });
                    render();
                }
            });
        }, 0);
        return h;
    }

    // ── BAŞLANGIÇ ──
    function ekranBaslangic() {
        const el = document.createElement("div");
        el.className = "iu-wrap";
        el.innerHTML = `
<div class="iu-body iu-body--init">
  <div class="iu-init">
    <button class="iu-run" id="btn-tara">TARA</button>
    <div class="iu-init-cards-wrap">
      <div class="iu-cards iu-cards--init" id="init-cards" role="group" aria-label="Özet kartları"></div>
      <div class="iu-init-detail" id="init-card-detail" hidden role="region" aria-live="polite"></div>
    </div>
  </div>
</div>`;
        setTimeout(() => {
            document.getElementById("btn-tara")?.addEventListener("click", taramaBaslat);
            const c = document.getElementById("init-cards");
            const lim = Guvenlik.limitler(), a = Depo.ayarlar(), sk = Guvenlik.skor(a);
            const skR = sk >= 80 ? "var(--ok)" : sk >= 50 ? "var(--warn)" : "var(--dan)";
            const initKartlar = [
                { key: "skor", ic: "🛡️", val: String(sk), valStyle: `color:${skR}`, lbl: "Güvenlik Skoru",
                  ttl: "Güvenlik skoru",
                  txt: "Takip bırakma süreleri, molalar ve saatlik/günlük üst limitler birlikte değerlendirilerek 0–100 arası gösterilir. Yüksek değer, daha uzun aralıklar ve daha düşük hesap riski ile ilişkilidir." },
                { key: "saat", ic: "⏱️", val: String(lim.saatKalan), valStyle: "", lbl: "Saatlik Kalan",
                  ttl: "Saatlik kalan hak",
                  txt: `Güvenlik ayarlarındaki saatlik üst sınır (${lim.saatMax}) içinde, bu saat diliminde henüz kullanılmamış takip bırakma hakkını gösterir. Tam saat başında sayaç sıfırlanır.` },
                { key: "gun", ic: "📅", val: String(lim.gunKalan), valStyle: "", lbl: "Günlük Kalan",
                  ttl: "Günlük kalan hak",
                  txt: `Bugün için izin verilen toplam takip bırakma adedinden (${lim.gunMax} üst sınır) kalan kısım. Gün sonunda günlük sayaç yenilenir.` },
                { key: "islem", ic: "📋", val: String(Depo.gecmis().length), valStyle: "", lbl: "Toplam İşlem",
                  ttl: "Toplam işlem sayısı",
                  txt: "Bu eklenti ile kaydedilen takip bırakma işlemlerinin toplamı (Geçmiş ekranı ile aynı kayıt). Liste tarama ve okuma işlemleri bu sayıya dahil değildir." },
            ];
            if (c) {
                c.innerHTML = initKartlar.map(k => `
<button type="button" class="iu-card iu-init-card" data-init-card="${k.key}" aria-expanded="false" aria-controls="init-card-detail">
  <span class="iu-init-card-ic" aria-hidden="true">${k.ic}</span>
  <span class="val" ${k.valStyle ? `style="${k.valStyle}"` : ""}>${k.val}</span>
  <span class="lbl">${k.lbl}</span>
</button>`).join("");
                const det = document.getElementById("init-card-detail");
                const byKey = Object.fromEntries(initKartlar.map(x => [x.key, x]));
                c.querySelectorAll(".iu-init-card").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const key = btn.dataset.initCard;
                        const acik = btn.getAttribute("aria-expanded") === "true";
                        c.querySelectorAll(".iu-init-card").forEach(b => b.setAttribute("aria-expanded", "false"));
                        if (!det) return;
                        if (acik) {
                            det.hidden = true;
                            det.innerHTML = "";
                            return;
                        }
                        btn.setAttribute("aria-expanded", "true");
                        const m = byKey[key];
                        if (!m) return;
                        det.innerHTML = `<h4><span class="iu-init-detail-ic" aria-hidden="true">${m.ic}</span><span>${m.ttl}</span></h4><p>${m.txt}</p>`;
                        det.hidden = false;
                    });
                });
            }
        }, 0);
        return el;
    }

    // ─────────────────────────────────────────────────────────────────
    // TARAMA
    // ─────────────────────────────────────────────────────────────────
    async function taramaBaslat() {
        profilHdBlobIptal();
        Object.assign(D, {
            ekran:"tarama", sonuclar:[], takipciler:[], beyazListe:Depo.beyazListe(),
            secili:[], sayfa:1, arama:"", sidebarArama:"", sekme:"tumu",
            siralama:Depo.ayarlar().siralama||"az",
            yuzde:0, toplamTahmin:0, toplamTahminTakipci:0, taramaFaz:"takip_edilen", takipciYuklenen:0, taramaBaslangic:Date.now(),
            molaKalan:0, molaAciklama:"", hataSayac:0,
            topluQsSon: null,
            filtre: { takipEtmeyen:false, karsiliksiz:false, dogrulandi:false, gizli:false, fotosuz:false },
            birakmaLog: [], sonBirakilan: [], birakmaIslemToplam: 0,
            profilHdOnizleme: null,
        });
        Ref.didListRevealAnim = false;
        Ref.dur = false;
        Ref.taramaTakipciHata = false;
        render();
        await paintBirKere();

        const a = Depo.ayarlar();
        let cursor, devam = true, dongu = 0, toplanan = 0;
        let tahminTakip = 0, colTakip = 0;

        const fetchHeaders = { "accept-language":"tr-TR,tr;q=0.9", "x-ig-app-id":"936619743392459" };

        while (devam) {
            try {
                const r = await fetch(taramaURL(cursor), {
                    headers: fetchHeaders,
                    credentials: "include",
                });
                if (r.status === 429) { await molaYap(900000, "Çok fazla istek — 15 dakika bekleyin"); continue; }
                const json = await r.json();
                const ef = json.data?.user?.edge_follow;
                if (!ef) {
                    D.hataSayac++;
                    if (D.hataSayac >= 3) { await molaYap(600000, "Hata (art arda) / Güvenlik Molası", { taramaFallbackToast: false }); D.hataSayac = 0; }
                    continue;
                }
                if (!tahminTakip) tahminTakip = ef.count;
                if (!D.toplamTahmin) D.toplamTahmin = ef.count;
                devam = ef.page_info.has_next_page;
                cursor = ef.page_info.end_cursor;
                toplanan += ef.edges.length;
                colTakip += ef.edges.length;
                ef.edges.forEach(e => D.sonuclar.push(e.node));
                D.yuzde = Math.round(50 * Math.min(1, colTakip / Math.max(1, tahminTakip)));
                D.hataSayac = 0;
                render();
            } catch (err) {
                console.error("[IU] Tarama:", err);
                D.hataSayac++;
                if (D.hataSayac >= 3) { await molaYap(600000, "Hata / Bağlantı — Güvenlik Molası", { taramaFallbackToast: false }); D.hataSayac = 0; }
                else await bekle(5000);
                continue;
            }
            while (Ref.dur) await bekle(800);
            let aralik;
            if (a.referansZamanlama) aralik = Math.max(120, taramaAralikReferans(Number(a.taramaArasi) || 400));
            else if (a.insanModu) aralik = Math.max(120, rastgeleMola(a.taramaArasi));
            else aralik = Math.max(120, Number(a.taramaArasi) || 400);
            await bekle(aralik);
            dongu++;
            if (devam && dongu > 0) {
                const ref = a.referansZamanlama;
                if (ref && dongu % TARAMA_SERI_MOLA_DONGU === 0) {
                    const seri = Math.max(1000, Number(a.taramaSeriMolaMs) || REFERANS_PROFIL.taramaSeriMolaMs);
                    await molaYap(seri, `Takip listesi — her ${TARAMA_SERI_MOLA_DONGU} istekte güvenlik arası (${dongu}. istek · ~${Math.round(seri / 1000)} sn)`);
                } else if (!ref && dongu % TARAMA_MOLA_SAYFA === 0) {
                    const ms = a.insanModu ? rastgeleMola(a.taramaMola) : Number(a.taramaMola) || 3000;
                    await molaYap(ms, `Takip listesi — sayfa arası kısa bekleme (${dongu}. sayfa)`);
                }
            }
        }

        D.hataSayac = 0;
        const seenTpc = new Set();
        let cursor2, devam2 = true, dongu2 = 0, tahminTpc = 0, colTpc = 0;
        D.toplamTahminTakipci = 0;
        D.taramaFaz = "takipci";
        D.takipciYuklenen = 0;
        Ref.taramaTakipciHata = false;

        while (devam2) {
            try {
                const r2 = await fetch(taramaTakipciURL(cursor2), {
                    headers: fetchHeaders,
                    credentials: "include",
                });
                if (r2.status === 429) { await molaYap(900000, "Çok fazla istek — 15 dakika bekleyin"); continue; }
                const json2 = await r2.json();
                const efb = json2.data?.user?.edge_followed_by;
                if (!efb) {
                    Ref.taramaTakipciHata = true;
                    D.hataSayac++;
                    if (D.hataSayac >= 3) { await molaYap(600000, "Hata / Takipçi listesi — Güvenlik Molası", { taramaFallbackToast: false }); D.hataSayac = 0; }
                    devam2 = false;
                    break;
                }
                if (!tahminTpc) {
                    tahminTpc = efb.count;
                    D.toplamTahminTakipci = efb.count;
                }
                devam2 = efb.page_info.has_next_page;
                cursor2 = efb.page_info.end_cursor;
                colTpc += efb.edges.length;
                D.takipciYuklenen = colTpc;
                efb.edges.forEach(e => {
                    const n = e.node;
                    const sid = String(n.id);
                    if (!seenTpc.has(sid)) {
                        seenTpc.add(sid);
                        D.takipciler.push(n);
                    }
                });
                D.yuzde = Math.round(50 + 50 * Math.min(1, colTpc / Math.max(1, tahminTpc)));
                D.hataSayac = 0;
                render();
            } catch (err) {
                console.error("[IU] Takipçi tarama:", err);
                Ref.taramaTakipciHata = true;
                D.hataSayac++;
                if (D.hataSayac >= 3) { await molaYap(600000, "Hata / Takipçi bağlantısı — Güvenlik Molası", { taramaFallbackToast: false }); D.hataSayac = 0; devam2 = false; }
                else await bekle(5000);
                continue;
            }
            while (Ref.dur) await bekle(800);
            let aralik2;
            if (a.referansZamanlama) aralik2 = Math.max(120, taramaAralikReferans(Number(a.taramaArasi) || 400));
            else if (a.insanModu) aralik2 = Math.max(120, rastgeleMola(a.taramaArasi));
            else aralik2 = Math.max(120, Number(a.taramaArasi) || 400);
            await bekle(aralik2);
            dongu2++;
            if (devam2 && dongu2 > 0) {
                const ref = a.referansZamanlama;
                if (ref && dongu2 % TARAMA_SERI_MOLA_DONGU === 0) {
                    const seri = Math.max(1000, Number(a.taramaSeriMolaMs) || REFERANS_PROFIL.taramaSeriMolaMs);
                    await molaYap(seri, `Takipçi listesi — her ${TARAMA_SERI_MOLA_DONGU} istekte güvenlik arası (${dongu2}. istek · ~${Math.round(seri / 1000)} sn)`);
                } else if (!ref && dongu2 % TARAMA_MOLA_SAYFA === 0) {
                    const ms = a.insanModu ? rastgeleMola(a.taramaMola) : Number(a.taramaMola) || 3000;
                    await molaYap(ms, `Takipçi listesi — sayfa arası kısa bekleme (${dongu2}. sayfa)`);
                }
            }
        }

        D.yuzde = 100;
        D.taramaFaz = "bitti";
        D.sayfa = 1;
        render();
        const nTakip = D.sonuclar.length;
        const nTpc = D.takipciler.length;
        const nBir = iuBirlesikSayi();
        let tamMsg = `Tarama bitti.
Takip listeniz: ${nTakip} hesap.
Sizi takip eden: ${nTpc} hesap.
Birleşik tekil kişi (Tüm sekmesi): ${nBir}.`;
        if (Ref.taramaTakipciHata) {
            tamMsg = `Takip listesi alındı; takipçi tarafı sorunlu veya eksik.
Yalnızca takip listeniz güvenilir: ${nTakip} hesap.
Takipçi sayısı okunamadı.`;
        }
        toast(tamMsg, Ref.taramaTakipciHata ? "warning" : "success", 7200);
    }

    /**
     * @param {number} ms
     * @param {string} aciklama
     * @param {{ tickMs?: number, taramaFallbackToast?: boolean }} [opts]
     */
    async function molaYap(ms, aciklama, opts = {}) {
        const tickMs = opts.tickMs ?? 500;
        const taramaFallbackToast = opts.taramaFallbackToast !== false;
        D.molaAciklama = aciklama;
        D.molaKalan = ms;
        const adimlar = Math.ceil(ms / tickMs);
        for (let i = 0; i < adimlar; i++) {
            if (Ref.dur) { await bekle(800); i--; continue; }
            D.molaKalan = Math.max(0, ms - i * tickMs);
            const el = document.getElementById("iu-mola-box");
            if (el) {
                el.style.display = "";
                el.querySelector(".iu-mola-cd").textContent = sureFmt(D.molaKalan);
                el.querySelector(".iu-mola-txt").textContent = aciklama;
            } else if (taramaFallbackToast && i === 0 && D.ekran === "tarama" && D.yuzde < 100) {
                toast(`${aciklama} — yaklaşık ${sureFmt(ms)}`, "info", 4500);
            }
            await bekle(tickMs);
        }
        D.molaKalan = 0; D.molaAciklama = "";
        const elSon = document.getElementById("iu-mola-box");
        if (elSon) elSon.style.display = "none";
    }

    // ── TARAMA EKRANI ──
    function ekranTarama() {
        const el = document.createElement("div");
        el.className = "iu-wrap";
        const wlSet = new Set(D.beyazListe.map(k => String(k.id)));
        if (D.secili.length) D.secili = D.secili.filter(s => !wlSet.has(String(s.id)));
        const tFil  = filtrele(iuListeEkran(), D.beyazListe, D.sekme, D.arama, D.sidebarArama, D.filtre);
        const tListeOnceArama = filtrele(iuListeEkran(), D.beyazListe, D.sekme, D.arama, "", D.filtre).length;
        const tSir  = sirala(tFil, D.siralama);
        const sayf  = sayfala(tSir, D.sayfa);
        if (D.profilHdOnizleme && D.profilHdOnizleme.afterPid != null && D.profilHdOnizleme.url) {
            const ap = String(D.profilHdOnizleme.afterPid);
            if (!sayf.some(x => String(x.id) === ap)) {
                profilHdBlobIptal();
                D.profilHdOnizleme = null;
            }
        }
        const lim  = Guvenlik.limitler();

        const sayTakipEtmeyen = D.sonuclar.filter(k => !k.follows_viewer && !wlSet.has(String(k.id))).length;
        const sayKarsiliksiz  = D.sonuclar.filter(k => k.follows_viewer).length;
        const folIdSet = new Set(D.sonuclar.map(k => String(k.id)));
        const sayYalnizTakipci = D.takipciler.filter(k => !folIdSet.has(String(k.id))).length;
        const oran = D.sonuclar.length > 0 ? Math.round((sayKarsiliksiz / D.sonuclar.length) * 100) : 0;
        const sayBirlesik = iuBirlesikSayi();
        const secUnf = D.secili.filter(k => folIdSet.has(String(k.id)));
        const secTpc = D.secili.filter(k => !folIdSet.has(String(k.id)));

        const po = D.profilHdOnizleme;

        // Kullanıcı listesi (tablo) — yalnızca GraphQL tarama %100 olduktan sonra
        let listHTML = "";
        const hk = harfKapaliOku();
        if (D.yuzde >= 100 && sayf.length) {
            const harfRevealKey = Ref.harfRevealHarf;
            Ref.harfRevealHarf = null;
            const listWrapCls = "iu-list-wrap" + (!Ref.didListRevealAnim ? " iu-list-wrap--enter" : "");
            listHTML = `<div class="${listWrapCls}"><table class="iu-list-tbl iu-list-center iu-list-grid"><colgroup>
<col class="iu-col-av" /><col class="iu-col-wl" /><col class="iu-col-un" /><col class="iu-col-fn" /><col class="iu-col-badge" /><col class="iu-col-cb" />
</colgroup><thead><tr>
<th class="c-av iu-th-col">Foto</th><th class="c-wl iu-th-col">⭐</th><th class="c-un iu-th-col">Kullanıcı</th><th class="c-fn iu-th-col">Ad Soyad</th>
<th class="c-badge iu-th-col">Rozet</th><th class="c-cb iu-th-col">Seçilenler</th>
</tr></thead><tbody>`;
            let oncekiHarf = "";
            const firstInHarf = Object.create(null);
            const revealStagger = Object.create(null);
            sayf.forEach(k => {
                const harf = k.username[0].toUpperCase();
                const hId = harfIdSafe(harf);
                if (harf !== oncekiHarf) {
                    oncekiHarf = harf;
                    const kap = !!hk[harf];
                    listHTML += `<tr class="iu-list-harf" data-harf="${esc(harf)}" id="iu-harf-${hId}" role="button" tabindex="0" aria-expanded="${kap ? "false" : "true"}"><td colspan="6"><span class="iu-harf-ic${kap ? " iu-harf-ic--kapali" : ""}" aria-hidden="true">▼</span> <span class="iu-harf-lbl">${esc(harf)}</span></td></tr>`;
                    firstInHarf[harf] = false;
                }
                const closingThis = Ref.harfKapatiliyor === harf;
                const kapRow = !!hk[harf] && !closingThis;
                const revealThis = !kapRow && !closingThis && harfRevealKey && harfRevealKey === harf;
                let rowStyle = "";
                if (kapRow) rowStyle = "display:none";
                let revealCls = "";
                if (revealThis) {
                    revealCls = " iu-list-tr--harf-reveal";
                    const n = revealStagger[harf] || 0;
                    revealStagger[harf] = n + 1;
                    rowStyle += (rowStyle ? ";" : "") + `animation-delay:${Math.min(n * 0.045, 0.38)}s`;
                }
                const outCls = closingThis ? " iu-list-tr--harf-out" : "";
                const rowHide = rowStyle ? ` style="${rowStyle}"` : "";
                const isFirst = !firstInHarf[harf];
                firstInHarf[harf] = true;
                const firstAttr = isFirst ? ` id="iu-harf-${hId}-first"` : "";
                const wl  = wlSet.has(String(k.id));
                const takipta = folIdSet.has(String(k.id));
                const tpcSecilebilir = D.sekme === "takipci" || D.sekme === "tumu";
                const cbDis = wl || (!takipta && !tpcSecilebilir);
                const sec = !cbDis && D.secili.some(s => String(s.id) === String(k.id));
                const cbWlTitle = titleAttr("Beyaz listede — toplu işleme dahil edilmez");
                const cbTpcSelTitle = titleAttr("Takipte değilsiniz — “Takipçiyi kaldır” ile sizi takip etmekten çıkarabilirsiniz");
                let cbTitleAttr = "";
                if (wl) cbTitleAttr = ` title="${cbWlTitle}"`;
                else if (!takipta && tpcSecilebilir) cbTitleAttr = ` title="${cbTpcSelTitle}"`;
                const hdOpen = po && po.url && po.afterPid != null && String(po.afterPid) === String(k.id);
                const avHint = "Fotoğrafı Göster";
                listHTML += `
<tr class="iu-list-tr${revealCls}${outCls}${hdOpen ? " iu-list-tr--hd-open" : ""}" data-pid="${k.id}" data-harf-bolum="${esc(harf)}"${rowHide}${firstAttr}>
  <td class="c-av" title="Profil görseli">
    <div class="iu-av-wrap">
      <img class="iu-av" src="${k.profile_pic_url}" alt="${esc(k.username)}" loading="lazy" title="${titleAttr(avHint)}"
        onerror="this.style.background='var(--bg4)';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2242%22 height=%2242%22><rect width=%2242%22 height=%2242%22 rx=%2221%22 fill=%22%23333%22/></svg>'">
    </div>
  </td>
  <td class="c-wl">
    <button class="iu-wl-btn${wl?" on":""}" data-wl="${k.id}" title="${wl?"Beyaz listeden çıkar":"Beyaz listeye ekle"}">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
    </button>
  </td>
  <td class="c-un" title="Profil Sayfasına Git">
    <a class="iu-uname" href="/${k.username}/" target="_blank" rel="noreferrer">@${esc(k.username)}</a>
  </td>
  <td class="c-fn" title="${titleAttr((k.full_name || "") ? "Kullanıcı Adı Soyadı: " + (k.full_name || "") : "Ad Soyad yok")}"><span class="iu-cell-wrap iu-cell-clamp">${k.full_name ? esc(k.full_name) : "—"}</span></td>
  <td class="c-badge" title="Rozetler">
    ${rozetGridHtml(k)}
  </td>
  <td class="c-cb${cbDis ? " iu-cb-wl-muted" : ""}"${cbTitleAttr}><input class="iu-cb${cbDis ? " iu-cb--wl" : ""}" type="checkbox" data-sec="${k.id}"${cbDis ? ` disabled aria-disabled="true" tabindex="-1" aria-label="${wl ? cbWlTitle : cbTpcSelTitle}"` : sec ? " checked" : ""}></td>
</tr>`;
                if (hdOpen) listHTML += profilHdOnizlemeSatirHtml(po);
            });
            listHTML += `</tbody></table></div>`;
        }

        let listeAltHTML;
        if (D.yuzde < 100) {
            const fazTpc = (D.taramaFaz || "") === "takipci";
            const modCls = fazTpc ? "iu-res-wait--takipci" : "iu-res-wait--takip";
            const yukBas = fazTpc ? "2. aşama — Takipçileriniz" : "1. aşama — Takip ettikleriniz";
            const n1 = fazTpc ? (D.takipciYuklenen || 0) : D.sonuclar.length;
            const n2 = fazTpc ? (D.toplamTahminTakipci || "…") : (D.toplamTahmin || "…");
            const tail = fazTpc ? "hesap" : "hesap";
            const hint = fazTpc
                ? "Karşılaştırma için sizi takip eden hesaplar güvenli aralıklarla çekiliyor. Bu adım biraz sürebilir."
                : "Takip listesi Instagram sunucularından sayfa sayfa alınıyor; bitince otomatik olarak takipçi aşamasına geçilir.";
            const countHtml = `<span class="iu-res-wait-count"><span class="iu-res-n1">${n1}</span><span class="iu-res-sep"> / </span><span class="iu-res-n2">${n2}</span> <span class="iu-res-tail">${tail}</span></span>`;
            listeAltHTML = `<div class="iu-res-wait iu-res-wait--scan ${modCls}" role="status" aria-live="polite" aria-busy="true">
  <div class="iu-res-wait-inner">
    <p class="iu-res-wait-title">${yukBas}</p>
    ${countHtml}
    <p class="iu-res-wait-hint">${hint}</p>
  </div>
</div>`;
        } else if (listHTML) listeAltHTML = listHTML;
        else if (tFil.length === 0) {
            listeAltHTML = `<div class="iu-empty">${iuListeEkran().length > 0
                ? "Bu sekme veya filtrelerle eşleşen kullanıcı yok.<br><small>Sekmeyi değiştirin veya filtreleri gevşetin.</small>"
                : "Sonuç bulunamadı.<br><small>Filtre veya arama terimini değiştirin.</small>"}</div>`;
        } else {
            listeAltHTML = `<div class="iu-empty">Bu sayfada kayıt yok.</div>`;
        }

        el.innerHTML = `
<div class="iu-body">
  <aside class="iu-side iu-side-pro" aria-label="Liste ve filtreler">
    <div class="iu-side-scroll">
    <div class="iu-sp iu-sp--settings-head">
      <h2 class="iu-side-settings-title">🔍 Liste ve filtreler</h2>
    </div>
    <div class="iu-sp">
      <div class="iu-sp-sub">Özet Liste</div>
      <div class="iu-stat-row"><span>Sayfa Başına Gösterilen</span><span>${sayf.length}</span></div>
      <div class="iu-stat-row"><span>Takip Ettiklerim</span><span>${D.sonuclar.length}</span></div>
      <div class="iu-stat-row"><span>Beni Takip Eden</span><span>${D.takipciler.length}</span></div>
      <div class="iu-stat-row"><span>Tüm Takip İşlemleri</span><span>${sayBirlesik}</span></div>
      <div class="iu-stat-row"><span>Seçilenler</span><span style="color:var(--acc)" id="stat-secili">${D.secili.length}</span></div>
    </div>
    <div class="iu-sp">
      <div class="iu-sp-sub">Dağılım</div>
      <div class="iu-stat-row"><span>Beni Takip Etmeyen</span><span style="color:var(--dan)">${sayTakipEtmeyen}</span></div>
      <div class="iu-stat-row"><span>Karşılıklı Takipleştiğim</span><span style="color:var(--ok)">${sayKarsiliksiz} (${oran}%)</span></div>
      <div class="iu-stat-row"><span>Beni Takip eden ama Takip Etmediklerim</span><span style="color:var(--acc)">${sayYalnizTakipci}</span></div>
      <div class="iu-stat-row"><span>Beyaz liste</span><span style="color:var(--gold)">${D.beyazListe.length}</span></div>
    </div>
    <div class="iu-sp">
      <div class="iu-sp-title">Satır filtreleri</div>
      <label class="iu-lbl iu-side-row iu-side-row--ico"><span class="iu-lbl-t">Takip Etmeyenler</span><span class="iu-row-tail"><input type="checkbox" data-f="takipEtmeyen" ${D.filtre.takipEtmeyen?"checked":""}>${yanPanelRozetKaro.takipEtmeyen()}</span></label>
      <label class="iu-lbl iu-side-row iu-side-row--ico"><span class="iu-lbl-t">Karşılıklı Takipleştiğim</span><span class="iu-row-tail"><input type="checkbox" data-f="karsiliksiz"  ${D.filtre.karsiliksiz ?"checked":""}>${yanPanelRozetKaro.karsiliksiz()}</span></label>
      <label class="iu-lbl iu-side-row iu-side-row--ico"><span class="iu-lbl-t">Doğrulanmış Hesaplar</span><span class="iu-row-tail"><input type="checkbox" data-f="dogrulandi"   ${D.filtre.dogrulandi  ?"checked":""}>${yanPanelRozetKaro.dogrulandi()}</span></label>
      <label class="iu-lbl iu-side-row iu-side-row--ico"><span class="iu-lbl-t">Gizli Hesaplar</span><span class="iu-row-tail"><input type="checkbox" data-f="gizli"        ${D.filtre.gizli       ?"checked":""}>${yanPanelRozetKaro.gizli()}</span></label>
      <label class="iu-lbl iu-side-row iu-side-row--ico"><span class="iu-lbl-t">Fotoğrafsız Hesaplar</span><span class="iu-row-tail"><input type="checkbox" data-f="fotosuz"      ${D.filtre.fotosuz     ?"checked":""}>${yanPanelRozetKaro.fotosuz()}</span></label>
    </div>
    <div class="iu-sp">
      <div class="iu-sp-title">Toplu seçim</div>
      <label class="iu-lbl iu-side-row iu-side-row--ico"><span class="iu-lbl-t">Doğrulanmış Hesapları Seç</span><span class="iu-row-tail"><input type="checkbox" data-qs="dogrulandi" title="Doğrulanmışları seç" ${D.topluQsSon==="dogrulandi"?"checked":""}>${yanPanelRozetKaro.dogrulandi()}</span></label>
      <label class="iu-lbl iu-side-row iu-side-row--ico"><span class="iu-lbl-t">Gizli Hesapları Seç</span><span class="iu-row-tail"><input type="checkbox" data-qs="gizli" title="Gizli hesapları seç" ${D.topluQsSon==="gizli"?"checked":""}>${yanPanelRozetKaro.gizli()}</span></label>
      <label class="iu-lbl iu-side-row iu-side-row--ico"><span class="iu-lbl-t">Fotoğrafsız Hesapları Seç</span><span class="iu-row-tail"><input type="checkbox" data-qs="fotosuz" title="Fotoğrafsız hesapları seç" ${D.topluQsSon==="fotosuz"?"checked":""}>${yanPanelRozetKaro.fotosuz()}</span></label>
      <label class="iu-lbl iu-side-row iu-side-row--ico"><span class="iu-lbl-t">Bu Sayfadakileri Seç</span><span class="iu-row-tail"><input type="checkbox" data-qs="sayfa" ${D.topluQsSon==="sayfa"?"checked":""}>${yanPanelRozetKaro.sayfa()}</span></label>
      <label class="iu-lbl iu-side-row iu-side-row--ico"><span class="iu-lbl-t">Tümünü Seç</span><span class="iu-row-tail"><input type="checkbox" data-qs="tumunu" ${D.topluQsSon==="tumunu"?"checked":""}>${yanPanelRozetKaro.tumunu()}</span></label>
      <div class="iu-side-row"><span>Seçimi Temizle</span><button type="button" class="iu-sbtn red" id="s-sec-temizle">Temizle</button></div>
    </div>
    <div class="iu-sp iu-sp-act">
      ${D.yuzde >= 100 ? `
      <div class="iu-pag">
        <button class="iu-pag-btn" id="pag-geri" ${D.sayfa<=1?"disabled":""}>❮</button>
        <span class="iu-pag-info">${D.sayfa} / ${maxSayfa(tSir)}</span>
        <button class="iu-pag-btn" id="pag-ileri" ${D.sayfa>=maxSayfa(tSir)?"disabled":""}>❯</button>
      </div>
      <button class="iu-btn iu-btn-dan" style="width:100%;padding:.45rem;font-size:.78rem;font-weight:700;margin-top:.35rem;justify-content:center" id="s-birak" ${secUnf.length===0||lim.dolduMu?"disabled":""}>
        🚫 TAKİBİ BIRAK (${secUnf.length})
      </button>
      <button type="button" class="iu-btn" style="width:100%;padding:.4rem;font-size:.74rem;font-weight:700;margin-top:.28rem;justify-content:center;background:rgba(48,209,88,.12);border:1px solid rgba(48,209,88,.45);color:var(--ok)" id="s-tpc-kaldir" ${secTpc.length===0||lim.dolduMu?"disabled":""}>
        TAKİPÇİYİ KALDIR (${secTpc.length})
      </button>
      ${lim.dolduMu ? `<div class="iu-limit-kalan" style="background:rgba(255,69,58,.08);border-color:var(--dan);margin-top:.3rem"><span>⚠️ Limit doldu</span><span style="color:var(--t2);font-size:.62rem">${Guvenlik.saatSifirlanma()}dk sonra sıfırlanır</span></div>` : ""}
      <div class="iu-mola" id="iu-mola-box" style="${D.molaKalan>0?"":"display:none"}">
        <div class="iu-mola-cd">${D.molaKalan>0?sureFmt(D.molaKalan):"--"}</div>
        <div class="iu-mola-txt" style="font-size:.65rem;color:var(--t2);margin-top:.12rem">${D.molaAciklama}</div>
      </div>
      ` : `<p class="iu-side-tarama-hint">${(D.taramaFaz || "") === "takipci"
        ? "İlerleme ortadaki çubukta görünür. Takipçiler tamamlanınca liste açılır."
        : "İlerleme ortadaki çubukta görünür. Önce takip listeniz biter, ardından takipçiler yüklenir."}</p>`}
    </div>
    </div>
  </aside>

  <div class="iu-cont">
    <div class="iu-cont-head">
    <div class="iu-cont-head-main">
    <nav class="iu-tabs" aria-label="Liste sekmeleri">
      ${Object.entries(SEKMELER).map(([k,v]) => {
          let badge = "";
          if (k==="takipEtmeyen") badge=`<span class="iu-tab-n">${sayTakipEtmeyen}</span>`;
          if (k==="karsiliksiz")  badge=`<span class="iu-tab-n grn">${sayKarsiliksiz}</span>`;
          if (k==="takipci")      badge=`<span class="iu-tab-n">${D.takipciler.length}</span>`;
          if (k==="beyazListe")   badge=`<span class="iu-tab-n gld">${D.beyazListe.length}</span>`;
          if (k==="tumu")         badge=`<span class="iu-tab-n">${sayBirlesik}</span>`;
          return `<div class="iu-tab${D.sekme===k?" on":""}" data-sekme="${k}"><span class="iu-tab-lbl">${v}</span>${badge}</div>`;
      }).join("")}
    </nav>
    <div class="iu-list-hdr">
      <div class="iu-list-hdr-tools">
        <div class="iu-list-ara-wrap" role="search" title="Sekme ve satır filtreleri sonrası kayıt; liste araması soldaki sayıda yansır">
          <span class="iu-list-ara-meta" aria-hidden="true">${D.sidebarArama.trim() ? `${tFil.length} / ${tListeOnceArama}` : `${tListeOnceArama} sonuç`}</span>
          <input class="iu-inp" type="search" placeholder="Listede ara…" value="${esc(D.sidebarArama)}" id="list-ara" autocomplete="off" ${D.yuzde<100?"disabled":""} aria-label="Listede ara (${D.sidebarArama.trim() ? tFil.length + " eşleşme, " + tListeOnceArama + " kayıt tabanı" : tListeOnceArama + " kayıt"})">
        </div>
        <select class="iu-sel" id="list-sira" title="Sıralama" ${D.yuzde<100?"disabled":""}>
          ${Object.entries(SIRALAMALAR).map(([k,v]) => `<option value="${k}" ${D.siralama===k?"selected":""}>${v}</option>`).join("")}
        </select>
        <div class="iu-list-export" role="group" aria-label="Liste dışa aktarma">
          <button type="button" class="iu-btn iu-btn-export iu-btn-export--json" id="list-json" title="Yapılandırılmış JSON indir (${VERSIYON})" ${D.yuzde<100?"disabled":""}>JSON</button>
          <button type="button" class="iu-btn iu-btn-export iu-btn-export--csv" id="list-csv" title="Excel uyumlu CSV indir (${VERSIYON})" ${D.yuzde<100?"disabled":""}>CSV</button>
        </div>
      </div>
    </div>
    </div>
    </div>
      ${D.yuzde < 100 ? `
    <div class="iu-tarama-bar">
      <div class="iu-tarama-bar-in" style="width:${Math.max(1,D.yuzde)}%"></div>
      <div class="iu-tarama-bar-txt">
        <span>${(D.taramaFaz || "") === "takipci"
            ? `${D.takipciYuklenen || 0} / ${D.toplamTahminTakipci || "…"} takipçi`
            : `${D.sonuclar.length} / ${D.toplamTahmin || "…"} takip edilen`}</span>
        <span class="iu-tarama-pct">%${D.yuzde}</span>
      </div>
    </div>` : ""}
    <div class="iu-res" id="iu-res">${listeAltHTML}</div>
  </div>
</div>`;

        setTimeout(() => {
            etkinlikler(tSir, sayf);
            const inp = document.getElementById("list-ara");
            if (Ref.listAraAktif && inp && D.ekran === "tarama") {
                inp.focus();
                const n = D.sidebarArama.length;
                const s = Math.min(Ref.listAraSelStart ?? n, n);
                const en = Math.min(Ref.listAraSelEnd ?? n, n);
                try { inp.setSelectionRange(s, en); } catch (_) {}
            }
            if (document.querySelector("#iu-res .iu-list-wrap--enter")) {
                setTimeout(() => { Ref.didListRevealAnim = true; }, 720);
            }
        }, 0);
        return el;
    }

    function etkinlikler(tSir, sayfadakiler) {
        document.querySelectorAll("[data-f]").forEach(cb => {
            cb.addEventListener("change", () => { D.filtre[cb.dataset.f]=cb.checked; D.secili=[]; D.sayfa=1; render(); });
        });
        document.getElementById("list-sira")?.addEventListener("change", e => { D.siralama=e.target.value; D.sayfa=1; render(); });
        document.querySelectorAll("[data-sekme]").forEach(t => {
            t.addEventListener("click", () => { D.sekme=t.dataset.sekme; D.secili=[]; D.sayfa=1; D.sidebarArama=""; D.arama=""; render(); });
        });
        document.getElementById("list-ara")?.addEventListener("input", e => {
            const t = e.target;
            Ref.listAraSelStart = t.selectionStart;
            Ref.listAraSelEnd = t.selectionEnd;
            Ref.listAraAktif = true;
            D.sidebarArama = t.value;
            D.arama = t.value;
            D.sayfa = 1;
            render();
        });
        const gF = () => sirala(filtrele(iuListeEkran(), D.beyazListe, D.sekme, D.arama, D.sidebarArama, D.filtre), D.siralama);
        document.getElementById("list-json")?.addEventListener("click", () => Aktar.json(gF()));
        document.getElementById("list-csv")?.addEventListener("click", () => Aktar.csv(gF()));
        document.getElementById("list-ara")?.addEventListener("focus", () => { Ref.listAraAktif = true; });
        document.getElementById("pag-geri")?.addEventListener("click", () => { if(D.sayfa>1){D.sayfa--;render();} });
        document.getElementById("pag-ileri")?.addEventListener("click", () => { if(D.sayfa<maxSayfa(tSir)){D.sayfa++;render();} });

        // Checkbox — seçim + tam render (yan panel senkron); liste kaydırması korunur
        document.querySelectorAll("[data-sec]").forEach(cb => {
            cb.addEventListener("change", () => {
                const id = cb.dataset.sec;
                if (D.beyazListe.some(b => String(b.id) === String(id))) {
                    cb.checked = false;
                    return;
                }
                const k = iuKullaniciBul(id);
                if (!k) return;
                const tpcOk = D.sekme === "takipci" || D.sekme === "tumu";
                if (!D.sonuclar.some(x => String(x.id) === String(id)) && !tpcOk) {
                    cb.checked = false;
                    return;
                }
                if (cb.checked) { if (!D.secili.some(s => String(s.id) === String(id))) D.secili.push(k); }
                else D.secili = D.secili.filter(s => String(s.id) !== String(id));
                const elRes = document.getElementById("iu-res");
                Ref.iuResPending = elRes ? elRes.scrollTop : 0;
                render();
            });
        });

        // Beyaz liste
        document.querySelectorAll("[data-wl]").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                const id = btn.dataset.wl;
                const k = iuKullaniciBul(id);
                if (!k) return;
                const var_ = D.beyazListe.some(b => String(b.id) === String(id));
                if (var_) { D.beyazListe = D.beyazListe.filter(b => String(b.id) !== String(id)); toast(`${k.username} beyaz listeden çıkarıldı`, "info", 2000); }
                else {
                    D.beyazListe.push(k);
                    D.secili = D.secili.filter(s => String(s.id) !== String(id));
                    toast(`${k.username} beyaz listeye eklendi ⭐`, "success", 2000);
                }
                Depo.beyazListeKaydet(D.beyazListe);
                render();
            });
        });

        // Toplu seçim (data-qs) — id eşlemesi string ile (GraphQL id tipi karışık)
        const ekle = fn => {
            const wlIds = new Set(D.beyazListe.map(b => String(b.id)));
            const folIds = new Set(D.sonuclar.map(k => String(k.id)));
            const liste = sirala(filtrele(iuListeEkran(), D.beyazListe, D.sekme, D.arama, D.sidebarArama, D.filtre), D.siralama);
            const ham = liste.filter(fn);
            const hedef = ham.filter(k => {
                if (wlIds.has(String(k.id))) return false;
                if (D.sekme === "takipci" || D.sekme === "tumu") return true;
                return folIds.has(String(k.id));
            });
            const mev = new Set(D.secili.map(k => String(k.id)));
            let ek = 0;
            hedef.forEach(k => {
                const sid = String(k.id);
                if (!mev.has(sid)) { D.secili.push(k); mev.add(sid); ek++; }
            });
            if (ham.length === 0) toast("Bu kriterle eşleşen kullanıcı yok.", "warning", 2800);
            else if (hedef.length === 0) toast("Eşleşen satırlar beyaz listede veya (bu sekmede) seçime uygun değil.", "info", 3200);
            else if (ek === 0) toast("Yeni seçilecek satır yok (hepsi zaten seçili).", "info", 2200);
            else toast(`${ek} kullanıcı seçildi.`, "success", 1800);
            render();
        };
        /** Toplu seçim: yalnızca #iu-kok içindeki aside (Instagram DOM’undaki başka aside ile karışmasın). */
        document.querySelector("#iu-kok aside.iu-side")?.addEventListener("change", e => {
            const cb = e.target;
            if (!cb || typeof cb.matches !== "function" || !cb.matches("input[data-qs]")) return;
            const q = cb.dataset.qs;
            if (!cb.checked) {
                if (q === D.topluQsSon) { D.topluQsSon = null; render(); }
                return;
            }
            D.topluQsSon = q;
            if (q === "tumunu") {
                const wlIds = new Set(D.beyazListe.map(b => String(b.id)));
                const folIds = new Set(D.sonuclar.map(k => String(k.id)));
                const atlananWl = tSir.filter(k => wlIds.has(String(k.id))).length;
                const atlananTakip = tSir.filter(k => !folIds.has(String(k.id))).length;
                const tpcMod = D.sekme === "takipci" || D.sekme === "tumu";
                D.secili = tSir.filter(k => {
                    if (wlIds.has(String(k.id))) return false;
                    if (tpcMod) return true;
                    return folIds.has(String(k.id));
                });
                let msg = `Liste tamamı seçildi (${D.secili.length} kullanıcı).`;
                if (atlananWl > 0) msg += ` Beyaz listedeki ${atlananWl} satır atlandı.`;
                if (!tpcMod && atlananTakip > 0) msg += ` Takip dışı ${atlananTakip} satır seçilmedi.`;
                toast(msg, "success", 2600);
                render();
                return;
            }
            if (q === "dogrulandi") ekle(k => k.is_verified);
            else if (q === "gizli") ekle(k => k.is_private);
            else if (q === "fotosuz") ekle(k => fotosuzMu(k));
            else if (q === "sayfa") ekle(k => sayfadakiler.some(s => String(s.id) === String(k.id)));
        });
        document.getElementById("s-sec-temizle")?.addEventListener("click",()=>{ D.secili=[]; D.topluQsSon=null; render(); });
        document.getElementById("s-birak")?.addEventListener("click",()=>{
            const folIds = new Set(D.sonuclar.map(k => String(k.id)));
            const n = D.secili.filter(k => folIds.has(String(k.id))).length;
            if (n === 0) { toast("Takipten çıkarılacak seçim yok (takip listenizdekileri işaretleyin).", "warning"); return; }
            if (Guvenlik.limitler().dolduMu) { toast("Limit doldu, lütfen bekleyin.","error"); return; }
            if (!confirm(`${n} kişiyi takipten çıkarmak istiyor musunuz?\n\nGüvenli modda, aralarında bekleme süreleriyle yapılacak.`)) return;
            birakmaBaslat();
        });
        document.getElementById("s-tpc-kaldir")?.addEventListener("click", () => {
            const folIds = new Set(D.sonuclar.map(k => String(k.id)));
            const n = D.secili.filter(k => !folIds.has(String(k.id))).length;
            if (n === 0) { toast("Önce sizi takip eden (takipte olmadığınız) hesapları seçin.", "warning"); return; }
            if (Guvenlik.limitler().dolduMu) { toast("Limit doldu.", "error"); return; }
            takipciKaldirBaslat();
        });


        document.getElementById("iu-res")?.addEventListener("keydown", e => {
            const hr = e.target.closest("tr.iu-list-harf");
            if (!hr || !hr.dataset.harf) return;
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                harfBolumTiklama(hr.dataset.harf);
            }
        });

        document.getElementById("iu-res")?.addEventListener("click", e => {
            const hr = e.target.closest("tr.iu-list-harf");
            if (hr && hr.dataset.harf) {
                e.preventDefault();
                e.stopPropagation();
                harfBolumTiklama(hr.dataset.harf);
                return;
            }
        });

        if (!Ref.taramaKbd) {
            Ref.taramaKbd = true;
            document.addEventListener("keydown", e => {
                if (D.ekran !== "tarama" || D.yuzde < 100) return;
                if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
                const ae = document.activeElement?.tagName;
                if (ae === "INPUT" || ae === "TEXTAREA" || ae === "SELECT") return;
                e.preventDefault();
                const tf = filtrele(iuListeEkran(), D.beyazListe, D.sekme, D.arama, D.sidebarArama, D.filtre);
                const ts = sirala(tf, D.siralama);
                const mx = maxSayfa(ts);
                if (e.key === "ArrowLeft" && D.sayfa > 1) { D.sayfa--; render(); }
                else if (e.key === "ArrowRight" && D.sayfa < mx) { D.sayfa++; render(); }
            }, true);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // TAKİP BIRAKMA
    // ─────────────────────────────────────────────────────────────────
    async function birakmaBaslat() {
        Ref.birakmaIslem = "unfollow";
        {
            const wlIds = new Set(D.beyazListe.map(b => String(b.id)));
            D.secili = D.secili.filter(k => !wlIds.has(String(k.id)));
        }
        {
            const folIds = new Set(D.sonuclar.map(k => String(k.id)));
            D.secili = D.secili.filter(k => folIds.has(String(k.id)));
        }
        {
            const sid = new Set();
            D.secili = D.secili.filter(k => {
                const id = String(k.id);
                if (sid.has(id)) return false;
                sid.add(id);
                return true;
            });
        }
        if (D.secili.length === 0) {
            toast("Takipten çıkarılacak seçilebilir kullanıcı yok (beyaz liste hariç).", "warning", 3200);
            D.ekran = "tarama";
            render();
            return;
        }
        D.birakmaIslemToplam = D.secili.length;
        D.ekran="birakma"; D.yuzde=0; D.birakmaLog=[]; D.sonBirakilan=[];
        Ref.dur=false; render();
        const a=Depo.ayarlar(), csrf=cerez("csrftoken");
        if (!csrf) { toast("CSRF token bulunamadı. Instagram'da giriş yapın.","error",0); return; }
        let hataSayac=0;
        let batchSayac=0;
        let sonrakiBatch=rastgeleBatchEsigi();

        for (let i=0; i<D.secili.length; i++) {
            const k=D.secili[i];
            if (Guvenlik.limitler().dolduMu) { toast("Limit doldu! İşlem durduruldu.","error",10000); break; }
            while (Ref.dur) await bekle(800);
            let ok=false;
            try {
                const r = await fetch(birakURL(k.id), {
                    method: "POST",
                    headers: instagramWebFetchHeaders(csrf, `/${k.username}/`),
                    mode: "cors",
                    credentials: "include",
                });
                const { apiOk, mesaj } = await instagramFriendshipYanitOku(r);
                if (r.ok) {
                    if (apiOk) {
                        hataSayac = 0;
                        ok = true;
                        Guvenlik.islemKaydet();
                        D.sonBirakilan.push(k);
                        Depo.gecmisEkle({ tip: "birakma", kullanici: { id: k.id, username: k.username, full_name: k.full_name || "" }, basarili: true });
                    } else {
                        hataSayac++;
                        if (mesaj) console.warn("[IU] unfollow:", mesaj);
                        Depo.gecmisEkle({ tip: "birakma", kullanici: { id: k.id, username: k.username, full_name: k.full_name || "" }, basarili: false });
                    }
                } else if (r.status===429) {
                    await molaYap(900000, "Çok fazla istek — 15 dakika bekleyin", { taramaFallbackToast: false }); i--; continue;
                } else {
                    hataSayac++;
                    Depo.gecmisEkle({tip:"birakma",kullanici:{id:k.id,username:k.username,full_name:k.full_name||""},basarili:false});
                }
            } catch(err) {
                hataSayac++;
                if (a.otoDurak) await molaYap(300000, "Hata / 5 dk bekleme", { taramaFallbackToast: false });
                Depo.gecmisEkle({tip:"birakma",kullanici:{id:k.id,username:k.username,full_name:k.full_name||""},basarili:false});
            }
            if (hataSayac>=3) { await molaYap(600000, "Hata (art arda) / Güvenlik Molası", { taramaFallbackToast: false }); hataSayac=0; }
            D.birakmaLog.push({k,ok});
            D.yuzde=D.birakmaIslemToplam?Math.round(((i+1)/D.birakmaIslemToplam)*100):100;
            render();
            if (i<D.secili.length-1) {
                if (ok) {
                    batchSayac++;
                    if (batchSayac>=sonrakiBatch) {
                        const molams=a.insanModu?rastgeleMola(a.birakmaMola):a.birakmaMola;
                        await molaYap(molams, `Güvenlik molası (${batchSayac} işlem, ~${Math.round(molams/60000)} dk)`, { taramaFallbackToast: false });
                        batchSayac=0;
                        sonrakiBatch=rastgeleBatchEsigi();
                    } else {
                        await bekle(Guvenlik.bekleme(a));
                    }
                } else {
                    await bekle(Guvenlik.bekleme(a));
                }
            }
        }
        const okIds = new Set(D.birakmaLog.filter(l=>l.ok).map(l=>String(l.k.id)));
        D.sonuclar = D.sonuclar.filter(k => !okIds.has(String(k.id)));
        {
            const tFil = filtrele(iuListeEkran(), D.beyazListe, D.sekme, D.arama, D.sidebarArama, D.filtre);
            const tSir = sirala(tFil, D.siralama);
            const mx = maxSayfa(tSir);
            if (D.sayfa > mx) D.sayfa = mx;
        }
        D.yuzde=100;
        const okSay = D.birakmaLog.filter(l=>l.ok).length;
        const noSay = D.birakmaLog.filter(l=>!l.ok).length;
        toast(`Tamamlandı! ${okSay} başarılı, ${noSay} başarısız.`,"success",8000);
        D.secili=[];
        D.ekran = "birakma";
        render();
    }

    async function takipciKaldirBaslat() {
        {
            const wlIds = new Set(D.beyazListe.map(b => String(b.id)));
            D.secili = D.secili.filter(k => !wlIds.has(String(k.id)));
        }
        const folIds = new Set(D.sonuclar.map(k => String(k.id)));
        D.secili = D.secili.filter(k => !folIds.has(String(k.id)));
        {
            const sid = new Set();
            D.secili = D.secili.filter(k => {
                const id = String(k.id);
                if (sid.has(id)) return false;
                sid.add(id);
                return true;
            });
        }
        if (D.secili.length === 0) {
            toast("Takipçi kaldırma için uygun seçim yok.\nSizi takip eden ama sizin takip etmediğiniz hesapları seçin.", "warning", 4200);
            return;
        }
        if (Guvenlik.limitler().dolduMu) { toast("Limit doldu.", "error"); return; }
        if (!confirm(`Seçili ${D.secili.length} kişiyi sizi takip etmekten çıkarmak istiyor musunuz?\n\nİşlemler güvenli mod ayarlarına göre aralıklı yapılır.`)) return;

        Ref.birakmaIslem = "remove_follower";
        D.birakmaIslemToplam = D.secili.length;
        D.ekran = "birakma";
        D.yuzde = 0;
        D.birakmaLog = [];
        D.sonBirakilan = [];
        Ref.dur = false;
        render();

        const a = Depo.ayarlar();
        const csrf = cerez("csrftoken");
        if (!csrf) {
            toast("CSRF bulunamadı. Instagram’da oturum açın.", "error", 0);
            Ref.birakmaIslem = "unfollow";
            D.ekran = "tarama";
            render();
            return;
        }

        let hataSayac = 0;
        let batchSayac = 0;
        let sonrakiBatch = rastgeleBatchEsigi();
        let takipciIlkApiMesaj = true;

        for (let i = 0; i < D.secili.length; i++) {
            const k = D.secili[i];
            if (Guvenlik.limitler().dolduMu) { toast("Limit doldu; işlem durdu.", "error", 8000); break; }
            while (Ref.dur) await bekle(800);
            let ok = false;
            try {
                const { r, apiOk, mesaj } = await instagramRemoveFollowerDene(k, csrf);
                if (r.ok) {
                    if (apiOk) {
                        hataSayac = 0;
                        ok = true;
                        Guvenlik.islemKaydet();
                        Depo.gecmisEkle({ tip: "takipci_kaldir", kullanici: { id: k.id, username: k.username, full_name: k.full_name || "" }, basarili: true });
                        D.takipciler = D.takipciler.filter(u => String(u.id) !== String(k.id));
                    } else {
                        hataSayac++;
                        if (mesaj && takipciIlkApiMesaj) {
                            toast(`Instagram: ${mesaj}`, "warning", 6500);
                            takipciIlkApiMesaj = false;
                        } else if (mesaj) console.warn("[IU] remove_follower:", mesaj);
                        Depo.gecmisEkle({ tip: "takipci_kaldir", kullanici: { id: k.id, username: k.username, full_name: k.full_name || "" }, basarili: false });
                    }
                } else if (r.status === 429) {
                    await molaYap(900000, "Çok fazla istek — 15 dakika bekleyin", { taramaFallbackToast: false });
                    i--;
                    continue;
                } else {
                    hataSayac++;
                    if (mesaj && takipciIlkApiMesaj) {
                        toast(`İstek başarısız (${r.status}): ${mesaj}`, "warning", 6500);
                        takipciIlkApiMesaj = false;
                    }
                    Depo.gecmisEkle({ tip: "takipci_kaldir", kullanici: { id: k.id, username: k.username, full_name: k.full_name || "" }, basarili: false });
                }
            } catch (err) {
                hataSayac++;
                console.warn("[IU] remove_follower fetch:", err);
                Depo.gecmisEkle({ tip: "takipci_kaldir", kullanici: { id: k.id, username: k.username, full_name: k.full_name || "" }, basarili: false });
            }
            if (hataSayac >= 3) {
                await molaYap(600000, "Hata (art arda) / Güvenlik Molası", { taramaFallbackToast: false });
                hataSayac = 0;
            }
            D.birakmaLog.push({ k, ok });
            D.yuzde = D.birakmaIslemToplam ? Math.round(((i + 1) / D.birakmaIslemToplam) * 100) : 100;
            render();
            if (i < D.secili.length - 1) {
                if (ok) {
                    batchSayac++;
                    if (batchSayac >= sonrakiBatch) {
                        const molams = a.insanModu ? rastgeleMola(a.birakmaMola) : a.birakmaMola;
                        await molaYap(molams, `Güvenlik molası (${batchSayac} işlem)…`, { taramaFallbackToast: false });
                        batchSayac = 0;
                        sonrakiBatch = rastgeleBatchEsigi();
                    } else {
                        await bekle(Guvenlik.bekleme(a));
                    }
                } else {
                    await bekle(Guvenlik.bekleme(a));
                }
            }
        }

        D.yuzde = 100;
        const okSay = D.birakmaLog.filter(l => l.ok).length;
        const noSay = D.birakmaLog.filter(l => !l.ok).length;
        toast(`Takipçi kaldırma bitti.\nBaşarılı: ${okSay}.\nBaşarısız: ${noSay}.`, "success", 6500);
        D.secili = [];
        Ref.birakmaIslem = "unfollow";
        {
            const tFil = filtrele(iuListeEkran(), D.beyazListe, D.sekme, D.arama, D.sidebarArama, D.filtre);
            const tSir = sirala(tFil, D.siralama);
            const mx = maxSayfa(tSir);
            if (D.sayfa > mx) D.sayfa = mx;
        }
        D.ekran = "birakma";
        render();
    }

    async function geriAlBaslat() {
        if (!D.sonBirakilan.length) return;
        const csrf=cerez("csrftoken"); if(!csrf) return;
        const a=Depo.ayarlar();
        for (let i=0;i<D.sonBirakilan.length;i++) {
            const k=D.sonBirakilan[i];
            try {
                await fetch(takipURL(k.id), { method: "POST", headers: instagramWebFetchHeaders(csrf, `/${k.username}/`), mode: "cors", credentials: "include" });
                toast(`${k.username} tekrar takip edildi`,"success",2000);
            } catch { toast(`${k.username} takip edilemedi`,"error",2000); }
            if (i<D.sonBirakilan.length-1) await bekle(rastgeleMola(a.birakmaArasi));
        }
        D.sonBirakilan=[]; render();
    }

    // ── BİRAKMA EKRANI ──
    function ekranBirakma() {
        const el=document.createElement("div");
        el.className="iu-wrap";
        const rm = Ref.birakmaIslem === "remove_follower";
        const birakH = rm ? "Takipçiyi kaldırma" : "Takip bırakma";
        const birakIc = rm ? "🚷" : "❌";
        const ok_s=D.birakmaLog.filter(l=>l.ok).length;
        const no_s=D.birakmaLog.filter(l=>!l.ok).length;
        const payda = D.birakmaIslemToplam || D.secili.length;
        const tamam = D.birakmaIslemToplam > 0 && D.birakmaLog.length === D.birakmaIslemToplam;
        const qB=D.birakmaArama.trim().toLowerCase();
        const filtLog=D.birakmaLog.filter(l=>{
            if(!D.birakmaFiltre.basarili  && l.ok)  return false;
            if(!D.birakmaFiltre.basarisiz && !l.ok) return false;
            if(qB){
                const u=l.k.username.toLowerCase();
                const fn=String(l.k.full_name||"").toLowerCase();
                if(!u.includes(qB)&&!fn.includes(qB)) return false;
            }
            return true;
        });
        el.innerHTML=`
<div class="iu-body">
  <aside class="iu-side iu-side-pro" aria-label="${birakH}">
    <div class="iu-side-scroll">
      <div class="iu-sp iu-sp--settings-head">
        <h2 class="iu-side-settings-title">${birakIc} ${birakH}</h2>
      </div>
      <div class="iu-sp">
        <div class="iu-sp-title">Filtreler</div>
        <input class="iu-inp" type="search" placeholder="Kullanıcı ara…" value="${esc(D.birakmaArama)}" id="birak-ara" autocomplete="off" style="width:100%;margin-bottom:.35rem;box-sizing:border-box">
        <label class="iu-lbl"><input type="checkbox" data-bf="basarili"  ${D.birakmaFiltre.basarili ?"checked":""}> ✅ Başarılı (${ok_s})</label>
        <label class="iu-lbl"><input type="checkbox" data-bf="basarisiz" ${D.birakmaFiltre.basarisiz?"checked":""}> ❌ Başarısız (${no_s})</label>
      </div>
      <div class="iu-sp">
        <div class="iu-stat" style="margin:0">
          <table class="iu-tbl">
            <tr><td>📊 İlerleme</td><td>${D.birakmaLog.length}/${payda||"—"}</td></tr>
            <tr><td>✅ Başarılı</td><td style="color:var(--ok)">${ok_s}</td></tr>
            <tr><td>❌ Başarısız</td><td style="color:var(--dan)">${no_s}</td></tr>
          </table>
        </div>
      </div>
      <div class="iu-mola" id="iu-mola-box" style="${D.molaKalan>0?"":"display:none"}">
        <div class="iu-mola-cd">${D.molaKalan>0?sureFmt(D.molaKalan):"--"}</div>
        <div class="iu-mola-txt" style="font-size:.68rem;color:var(--t2);margin-top:.15rem">${D.molaAciklama}</div>
      </div>
    </div>
    <div class="iu-side-act-stack iu-side-nav-actions">
    <button type="button" class="iu-side-action iu-side-action--outline-acc" id="dur-btn">${Ref.dur?"▶ Devam et":"⏸️ Duraklat"}</button>
    ${tamam&&D.sonBirakilan.length>0?`<button type="button" class="iu-side-action iu-side-action--warn" id="geri-al-btn" title="Son ${D.sonBirakilan.length} kişi">Kişiyi Geri Al</button>`:""}
    </div>
  </aside>
  <div class="iu-cont iu-cont--birakma">
    <div class="iu-gecmis-rows-wrap iu-birakma-rows">
      ${tamam?`<div class="iu-log-hero" role="status">
        <span class="iu-log-hero-ic" aria-hidden="true">✓</span>
        <div class="iu-log-hero-txt">
          <span class="iu-log-hero-title">Seçilen işlemler tamamlandı</span>
        </div>
      </div>`:""}
      ${filtLog.length===0&&!tamam
        ?'<div class="iu-empty" style="padding:2rem 1rem">İşlemler başlatılıyor…</div>'
        :filtLog.length===0
          ?'<div class="iu-empty" style="padding:2rem 1rem">Kayıt bulunamadı</div>'
          :`<div class="iu-list-wrap">
<table class="iu-list-tbl iu-list-center iu-list-grid iu-gecmis-tbl iu-birakma-log-tbl" aria-label="İşlem satırları"><colgroup>
<col class="iu-col-gc-st" /><col class="iu-col-gc-un" /><col class="iu-col-gc-fn" /><col class="iu-col-gc-tip" /><col class="iu-col-gc-ts" />
</colgroup><thead><tr>
<th class="c-gec-st iu-th-col">Durum</th>
<th class="c-gec-un iu-th-col">Kullanıcı adı</th>
<th class="c-gec-fn iu-th-col">Ad Soyad</th>
<th class="c-gec-tip iu-th-col">İşlem</th>
<th class="c-gec-ts iu-th-col">İlerleme</th>
</tr></thead><tbody>${filtLog.map((l,i)=>{
            const ok = !!l.ok;
            const islemEt = rm
                ? (ok ? "Takipçi kaldırıldı" : "Takipçi kaldırma denemesi")
                : (ok ? "Takip bırakıldı" : "Takip bırakma denemesi");
            const fnStr = String(l.k.full_name || "").trim();
            return `
<tr class="iu-list-tr iu-gecmis-tr">
  <td class="c-gec-st"><span class="iu-gecmis-badge ${ok ? "iu-gecmis-badge--ok" : "iu-gecmis-badge--no"}">${ok ? "OK" : "Hata"}</span></td>
  <td class="c-gec-un"><a class="iu-uname" href="/${esc(l.k.username)}/" target="_blank" rel="noopener noreferrer">@${esc(l.k.username)}</a></td>
  <td class="c-gec-fn">${fnStr ? esc(fnStr) : "—"}</td>
  <td class="c-gec-tip">${esc(islemEt)}</td>
  <td class="c-gec-ts">${i + 1} / ${payda || "—"}</td>
</tr>`;
        }).join("")}</tbody></table></div>`}
    </div>
  </div>
</div>`;
        setTimeout(()=>{
            document.getElementById("birak-ara")?.addEventListener("input",e=>{D.birakmaArama=e.target.value;render();});
            document.querySelectorAll("[data-bf]").forEach(cb=>cb.addEventListener("change",()=>{D.birakmaFiltre[cb.dataset.bf]=cb.checked;render();}));
            document.getElementById("dur-btn")?.addEventListener("click",()=>{Ref.dur=!Ref.dur;render();});
            document.getElementById("geri-al-btn")?.addEventListener("click",()=>{
                if(confirm(`${D.sonBirakilan.length} kişiyi tekrar takip etmek istiyor musunuz?`)) geriAlBaslat();
            });
        },0);
        return el;
    }

    // ─────────────────────────────────────────────────────────────────
    // GEÇMİŞ
    // ─────────────────────────────────────────────────────────────────
    function ekranGecmis() {
        const el=document.createElement("div");
        el.className="iu-wrap";
        const g=Depo.gecmis();
        const q=D.gecmisArama.trim().toLowerCase();
        const filt=!q?g:g.filter(x=>{
            const un=String(x.kullanici?.username||x.username||"").toLowerCase();
            const fn=String(x.kullanici?.full_name||"").toLowerCase();
            const tip=String(x.tip||"").toLowerCase();
            return un.includes(q)||fn.includes(q)||tip.includes(q);
        });
        const ok_=g.filter(x=>x.basarili).length, no_=g.filter(x=>!x.basarili).length;
        el.innerHTML=`
<div class="iu-body">
  <aside class="iu-side iu-side-pro" aria-label="Geçmiş özeti ve işlemler">
      <div class="iu-side-scroll">
      <div class="iu-sp iu-sp--settings-head">
        <h2 class="iu-side-settings-title">📜 İşlem Geçmişi</h2>
      </div>
      <div class="iu-sp">
        <div class="iu-sp-title">Filtreler</div>
        <input class="iu-inp" type="search" placeholder="Kullanıcı adı ara…" value="${esc(D.gecmisArama)}" id="gecmis-ara" autocomplete="off" style="width:100%;margin-bottom:0;box-sizing:border-box">
      </div>
      <div class="iu-sp">
        <div class="iu-stat" style="margin:0">
          <table class="iu-tbl">
            <tr><td>📊 Toplam</td><td>${g.length}</td></tr>
            <tr><td>✅ Başarılı</td><td style="color:var(--ok)">${ok_}</td></tr>
            <tr><td>❌ Başarısız</td><td style="color:var(--dan)">${no_}</td></tr>
          </table>
        </div>
      </div>
    </div>
    <div class="iu-side-act-stack iu-side-nav-actions">
      <button type="button" class="iu-side-action iu-side-action--danger" id="gecmis-temizle" ${g.length===0?"disabled":""}>🗑️ Temizle</button>
    </div>
  </aside>
  <div class="iu-cont iu-cont--gecmis">
    <div class="iu-gecmis-rows-wrap">${filt.length===0
        ? '<div class="iu-empty" style="padding:2rem 1rem">Kayıt bulunamadı</div>'
        : `<div class="iu-list-wrap">
<table class="iu-list-tbl iu-list-center iu-list-grid iu-gecmis-tbl"><colgroup>
<col class="iu-col-gc-st" /><col class="iu-col-gc-un" /><col class="iu-col-gc-fn" /><col class="iu-col-gc-tip" /><col class="iu-col-gc-ts" />
</colgroup><thead><tr>
<th class="c-gec-st iu-th-col">Durum</th>
<th class="c-gec-un iu-th-col">Kullanıcı adı</th>
<th class="c-gec-fn iu-th-col">Ad Soyad</th>
<th class="c-gec-tip iu-th-col">İşlem</th>
<th class="c-gec-ts iu-th-col">Tarih / saat</th>
</tr></thead><tbody>${filt.map(x=>{
            const un = x.kullanici?.username || "";
            const fnStr = String(x.kullanici?.full_name || "").trim();
            const ok = !!x.basarili;
            const tipEt = x.tip === "birakma"
                ? (ok ? "Takip bırakıldı" : "Takip bırakma denemesi")
                : x.tip === "takipci_kaldir"
                    ? (ok ? "Takipçi kaldırıldı" : "Takipçi kaldırma denemesi")
                    : String(x.tip || "İşlem");
            const userEl = un
                ? `<a href="/${esc(un)}/" target="_blank" rel="noopener noreferrer" class="iu-uname">@${esc(un)}</a>`
                : `<span style="font-weight:700;color:var(--t3)">—</span>`;
            return `
<tr class="iu-list-tr iu-gecmis-tr" title="${esc(tipEt + " · " + tarihGecmisGoster(x.tarih))}">
  <td class="c-gec-st"><span class="iu-gecmis-badge ${ok ? "iu-gecmis-badge--ok" : "iu-gecmis-badge--no"}">${ok ? "OK" : "Hata"}</span></td>
  <td class="c-gec-un">${userEl}</td>
  <td class="c-gec-fn">${fnStr ? esc(fnStr) : "—"}</td>
  <td class="c-gec-tip">${esc(tipEt)}</td>
  <td class="c-gec-ts">${esc(tarihGecmisGoster(x.tarih))}</td>
</tr>`;
        }).join("")}</tbody></table></div>`}
    </div>
  </div>
</div>`;
        setTimeout(()=>{
            document.getElementById("gecmis-ara")?.addEventListener("input",e=>{D.gecmisArama=e.target.value;render();});
            document.getElementById("gecmis-temizle")?.addEventListener("click",()=>{
                if(confirm("Tüm geçmişi silmek istiyor musunuz?")){Depo.gecmisSil();toast("Geçmiş temizlendi","success",2000);render();}
            });
        },0);
        return el;
    }

    // ─────────────────────────────────────────────────────────────────
    // AYARLAR (tam sayfa)
    // ─────────────────────────────────────────────────────────────────
    function ayarlarSidebarHTML(a) {
        const temalarCanli = TEMALAR_CANLI.map(k => [k, TEMALAR[k]]).filter(([, t]) => t);
        return `
<div class="iu-sp iu-sp--settings-head">
  <h2 class="iu-side-settings-title">⚙️ Ayarlar</h2>
</div>
<div class="iu-sp iu-sp--theme-inline">
  <div class="iu-theme-inline-row">
    <h3 class="iu-side-msec-h iu-side-msec-h--theme">Tema Rengi</h3>
    <div class="iu-temalar iu-temalar--side" id="iu-tema-wrap">
    ${temalarCanli.map(([k,t])=>`
      <div class="iu-tema-opt${a.tema===k?" on":""}" data-tema="${k}" style="background:${t.acc}" title="${k}">
        ${a.tema===k?"✓":""}
      </div>`).join("")}
    </div>
  </div>
</div>
<div class="iu-sp">
  <label class="iu-lbl iu-side-row iu-side-row--ico" for="mod-safe-lock">
    <span class="iu-lbl-t"><span id="mod-safe-badge" class="iu-safe-txt-on">Güvenlik Ayarlarını Kapat</span></span>
    <span class="iu-row-tail">
      <input type="checkbox" id="mod-safe-lock" ${Depo.guvenliKilit() ? "checked" : ""} style="accent-color:var(--acc)" aria-label="Güvenlik kilidi">
      <span class="iu-badge-tile iu-bt-lock" title="Kilit durumu" aria-hidden="true"><span id="mod-safe-lock-ic" class="iu-bt-ic">🔒</span></span>
    </span>
  </label>
</div>`;
    }

    function ayarYazarHTML() {
        const svgLi = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`;
        const svgGh = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`;
        return `
<div class="iu-modal iu-author-panel">
  <div class="iu-msec">
    <div class="iu-author-hero">
      <h2>InstaFollowKit</h2>
      <p>Bu betik, takip listenizi tarayıp karşılıklı takip etmeyenleri ve yalnızca sizi takip edenleri listeler; toplu seçimle takipten çıkarma, takipçiyi kaldırma ve işlem geçmişi tutma özellikleri sunar. HD profil önizlemesi, güvenli modda sadeleştirilmiş zamanlama ve ters görsel arama bağlantıları ile hesap riskini azaltmaya yönelik davranışlar önerilir.</p>
    </div>
    <p class="iu-author-credit"><strong>Yazar:</strong> ${esc(YAZAR_GOSTERIM)}</p>
    <p class="iu-author-version">Sürüm v${esc(VERSIYON)}</p>
    <p class="iu-author-changelog">${esc(SURUM_NOTU)}</p>
    <nav class="iu-author-social" aria-label="Sosyal bağlantılar">
      <a href="https://www.linkedin.com/in/bahadir-b-bekdemir/" class="iu-soc" target="_blank" rel="noopener noreferrer" title="LinkedIn" aria-label="LinkedIn">${svgLi}</a>
      <a href="https://github.com/bahadir-b-bekdemir" class="iu-soc" target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="GitHub">${svgGh}</a>
    </nav>
  </div>
</div>`;
    }

    function ayarlarMainHTML(a, noFooter) {
        return `
<div class="iu-modal iu-settings-main">
  <p class="iu-settings-lead">Tarama hızı, molalar ve limitler; güvenli mod kapalıyken düzenlenir. Önerilen değerler hesap riskini düşürmeye yöneliktir.</p>

  <section class="iu-settings-card" aria-labelledby="set-h-zaman">
    <header class="iu-settings-card-head" id="set-h-zaman">
      <span class="iu-settings-card-ic" aria-hidden="true">⏱️</span>
      <div>
        <h3 class="iu-settings-card-title">Zamanlama</h3>
        <p class="iu-settings-card-desc">İstek aralıkları, referans bantları ve molalar</p>
      </div>
    </header>
    <div class="iu-settings-card-body">
    <table class="iu-set-tbl iu-set-tbl--settings">
      <thead><tr><th>Ayar</th><th>Değer</th><th>Birim</th></tr></thead>
      <tbody>
        <tr><td>Tarama istekleri arası</td><td><input type="number" id="ms-tar" value="${a.taramaArasi}" min="120" max="30000" class="iu-set-inp" disabled></td><td>ms</td></tr>
        <tr><td>Referans zamanlama (IU-bundle bantları + ${TARAMA_SERI_MOLA_DONGU}’lik seri mola)</td><td><input type="checkbox" id="ms-refz" ${a.referansZamanlama ? "checked" : ""} style="width:1rem;height:1rem;accent-color:var(--acc)"></td><td>aç/kapa</td></tr>
        <tr><td>Her ${TARAMA_SERI_MOLA_DONGU}. istekte seri mola (referans açıkken)</td><td><input type="number" id="ms-serim" value="${a.taramaSeriMolaMs ?? REFERANS_PROFIL.taramaSeriMolaMs}" min="1000" max="120000" class="iu-set-inp" disabled></td><td>ms</td></tr>
        <tr><td>Her ${TARAMA_MOLA_SAYFA} sayfada kısa mola (referans kapalıyken)</td><td><input type="number" id="ms-tmola" value="${a.taramaMola}" min="1000" max="600000" class="iu-set-inp" disabled></td><td>ms</td></tr>
        <tr><td>Takip bırakma arası</td><td><input type="number" id="ms-bir" value="${a.birakmaArasi}" min="3000" max="60000" class="iu-set-inp" disabled></td><td>ms</td></tr>
        <tr><td>~50 başarılı işlem sonrası uzun mola süresi</td><td><input type="number" id="ms-bmola" value="${a.birakmaMola}" min="60000" max="1800000" class="iu-set-inp" disabled></td><td>ms (≈5dk)</td></tr>
      </tbody>
    </table>
    </div>
  </section>

  <section class="iu-settings-card" aria-labelledby="set-h-limit">
    <header class="iu-settings-card-head" id="set-h-limit">
      <span class="iu-settings-card-ic" aria-hidden="true">🔒</span>
      <div>
        <h3 class="iu-settings-card-title">Güvenlik limitleri</h3>
        <p class="iu-settings-card-desc">Saatlik / günlük işlem üst sınırı ve liste sayfa boyu</p>
      </div>
    </header>
    <div class="iu-settings-card-body">
    <table class="iu-set-tbl iu-set-tbl--settings">
      <thead><tr><th>Ayar</th><th>Değer</th><th>Birim</th></tr></thead>
      <tbody>
        <tr><td>Saatlik takip bırakma limiti</td><td><input type="number" id="ms-saat" value="${a.saatlikLimit}" min="1" max="500" class="iu-set-inp" disabled></td><td>işlem/saat</td></tr>
        <tr><td>Günlük takip bırakma limiti</td><td><input type="number" id="ms-gun" value="${a.gunlukLimit}" min="1" max="300" class="iu-set-inp" disabled></td><td>işlem/gün</td></tr>
        <tr><td>Sayfa başına kullanıcı (liste hızı)</td><td><input type="number" id="ms-sayfa" value="${a.sayfaAdet}" min="12" max="50" class="iu-set-inp"></td><td>adet (en fazla 50)</td></tr>
      </tbody>
    </table>
    </div>
  </section>

  <section class="iu-settings-card" aria-labelledby="set-h-aki">
    <header class="iu-settings-card-head" id="set-h-aki">
      <span class="iu-settings-card-ic" aria-hidden="true">🤖</span>
      <div>
        <h3 class="iu-settings-card-title">Akıllı davranış</h3>
        <p class="iu-settings-card-desc">Rastgele gecikme ve hata yönetimi</p>
      </div>
    </header>
    <div class="iu-settings-card-body">
    <table class="iu-set-tbl iu-set-tbl--settings iu-set-tbl--2col">
      <thead><tr><th>Ayar</th><th>Aktif</th></tr></thead>
      <tbody>
        <tr><td>İnsan benzeri gecikme (referans kapalıyken ±%35; açıkken 1,0–1,3× / 1,0–1,2× bantları)</td><td><input type="checkbox" id="ms-insan" ${a.insanModu?"checked":""} style="width:1rem;height:1rem;accent-color:var(--acc)"></td></tr>
        <tr><td>Hata durumunda otomatik duraklatma</td><td><input type="checkbox" id="ms-otodur" ${a.otoDurak?"checked":""} style="width:1rem;height:1rem;accent-color:var(--acc)"></td></tr>
      </tbody>
    </table>
    </div>
  </section>

  <div class="iu-warn-box iu-settings-warn" id="mod-unlock-warn" style="display:none">⚠️ Zamanlama değerlerini düşürmek hesabınızın kısıtlanmasına neden olabilir.</div>

  ${noFooter ? "" : `<div class="iu-mfooter iu-side-act-stack">
    <button type="button" class="iu-side-action iu-side-action--ghost" id="mod-sifirla">Varsayılana Dön</button>
    <button type="button" class="iu-side-action iu-side-action--primary" id="mod-kaydet">Kaydet</button>
  </div>`}
</div>`;
    }

    function baglaAyarlarPanel(kok) {
        const scroll = kok.querySelector(".iu-ayarlar-scroll");
        if (scroll) {
            const kilitli = Depo.guvenliKilit();
            scroll.innerHTML = kilitli ? ayarYazarHTML() : ayarlarMainHTML(Depo.ayarlar(), true);
            scroll.removeAttribute("aria-hidden");
        }

        const safeLock = kok.querySelector("#mod-safe-lock");
        if (safeLock) safeLock.checked = Depo.guvenliKilit();

        kok.querySelectorAll("[data-tema]").forEach(opt => {
            opt.addEventListener("click", () => {
                const guncelA = { ...Depo.ayarlar(), tema: opt.dataset.tema };
                Depo.ayarlarKaydet(guncelA);
                stilEkle();
                kok.querySelectorAll(".iu-tema-opt").forEach(o => { o.classList.remove("on"); o.textContent = ""; });
                opt.classList.add("on"); opt.textContent = "✓";
                toast("Tema değiştirildi", "success", 1500);
            });
        });

        const safeBadge = kok.querySelector("#mod-safe-badge");
        const safeWarn = kok.querySelector("#mod-unlock-warn");
        const safeInps = () => kok.querySelectorAll("#ms-tar,#ms-tmola,#ms-bir,#ms-bmola,#ms-saat,#ms-gun,#ms-sayfa,#ms-serim");
        function uygulaKilit(locked) {
            safeInps().forEach(i => { i.disabled = locked; });
            ["#ms-insan", "#ms-otodur", "#ms-refz"].forEach(sel => {
                const el = kok.querySelector(sel);
                if (el) el.disabled = locked;
            });
            const lockIc = kok.querySelector("#mod-safe-lock-ic");
            if (lockIc) lockIc.textContent = locked ? "🔒" : "🔓";
            const lockInp = kok.querySelector("#mod-safe-lock");
            if (lockInp) lockInp.setAttribute("aria-label", locked ? "Güvenlik ayarlarını kapat (önerilen süreler)" : "Güvenlik ayarlarını aç (gelişmiş düzenleme)");
            if (safeBadge) {
                safeBadge.textContent = locked ? "Güvenlik Ayarlarını Kapat" : "Güvenlik Ayarlarını Aç";
                safeBadge.classList.toggle("iu-safe-txt-on", locked);
                safeBadge.classList.toggle("iu-safe-txt-off", !locked);
            }
            if (safeWarn) safeWarn.style.display = locked ? "none" : "block";
            ["#mod-kaydet", "#mod-sifirla"].forEach(sel => {
                const b = kok.querySelector(sel);
                if (b) b.disabled = locked;
            });
            if (locked) {
                const p = GUVENLI_PROFIL;
                if (kok.querySelector("#ms-tar")) kok.querySelector("#ms-tar").value = p.taramaArasi;
                if (kok.querySelector("#ms-tmola")) kok.querySelector("#ms-tmola").value = p.taramaMola;
                if (kok.querySelector("#ms-serim")) kok.querySelector("#ms-serim").value = p.taramaSeriMolaMs;
                if (kok.querySelector("#ms-bir")) kok.querySelector("#ms-bir").value = p.birakmaArasi;
                if (kok.querySelector("#ms-bmola")) kok.querySelector("#ms-bmola").value = p.birakmaMola;
                if (kok.querySelector("#ms-saat")) kok.querySelector("#ms-saat").value = p.saatlikLimit;
                if (kok.querySelector("#ms-gun")) kok.querySelector("#ms-gun").value = p.gunlukLimit;
                const rz = kok.querySelector("#ms-refz");
                if (rz) rz.checked = !!p.referansZamanlama;
            }
        }
        if (safeLock) {
            safeLock.addEventListener("change", () => {
                Depo.guvenliKilitKaydet(safeLock.checked);
                if (safeLock.checked) {
                    const cur = Depo.ayarlar();
                    Depo.ayarlarKaydet({ ...cur, ...GUVENLI_PROFIL });
                }
                render();
            });
            uygulaKilit(safeLock.checked);
        }

        const kaydetBtn = kok.querySelector("#mod-kaydet");
        if (kaydetBtn) kaydetBtn.addEventListener("click", () => {
            if (Depo.guvenliKilit()) { toast("Güvenlik kilidi açıkken ayar kaydedilemez.", "warning", 2200); return; }
            const cur = Depo.ayarlar();
            const num = (sel, def) => { const el = kok.querySelector(sel); return el && el.value !== "" ? Number(el.value) : def; };
            const chk = (sel, def) => { const el = kok.querySelector(sel); return el ? el.checked : def; };
            Depo.ayarlarKaydet({
                taramaArasi:  num("#ms-tar", cur.taramaArasi),
                taramaMola:   num("#ms-tmola", cur.taramaMola),
                taramaSeriMolaMs: num("#ms-serim", cur.taramaSeriMolaMs ?? REFERANS_PROFIL.taramaSeriMolaMs),
                birakmaArasi: num("#ms-bir", cur.birakmaArasi),
                birakmaMola:  num("#ms-bmola", cur.birakmaMola),
                saatlikLimit: num("#ms-saat", cur.saatlikLimit),
                gunlukLimit:  num("#ms-gun", cur.gunlukLimit),
                sayfaAdet:    num("#ms-sayfa", cur.sayfaAdet),
                insanModu:    chk("#ms-insan", cur.insanModu),
                otoDurak:     chk("#ms-otodur", cur.otoDurak),
                referansZamanlama: chk("#ms-refz", cur.referansZamanlama),
                tema: cur.tema,
                siralama: D.siralama,
            });
            stilEkle();
            toast("Ayarlar kaydedildi ✓", "success", 2000);
            render();
        });
        const sifirlaBtn = kok.querySelector("#mod-sifirla");
        if (sifirlaBtn) sifirlaBtn.addEventListener("click", () => {
            if (Depo.guvenliKilit()) { toast("Önce güvenlik kilidini kaldırın.", "warning", 2200); return; }
            if (confirm("Güvenli mod zamanlama ve limit değerleri sıfırlansın mı? (Tema rengi korunur.)")) {
                const cur = Depo.ayarlar();
                Depo.ayarlarKaydet({ ...cur, ...GUVENLI_PROFIL, tema: cur.tema });
                stilEkle();
                toast("Güvenli mod değerleri sıfırlandı (tema aynı)", "info", 2200);
                render();
            }
        });
    }

    function ekranAyarlar() {
        const el = document.createElement("div");
        el.className = "iu-wrap";
        const a = Depo.ayarlar();
        el.innerHTML = `
<div class="iu-body">
  <aside class="iu-side iu-side-pro" aria-label="Ayarlar işlemleri">
    <div class="iu-side-scroll">
      ${ayarlarSidebarHTML(a)}
    </div>
    <div class="iu-side-act-stack iu-side-nav-actions">
      <button type="button" class="iu-side-action iu-side-action--primary" id="mod-kaydet">Kaydet</button>
      <button type="button" class="iu-side-action iu-side-action--ghost" id="mod-sifirla">Varsayılana Dön</button>
    </div>
  </aside>
  <div class="iu-cont iu-cont--settings">
    <div class="iu-ayarlar-scroll" aria-hidden="true"></div>
  </div>
</div>`;
        setTimeout(() => {
            baglaAyarlarPanel(el);
            el.querySelectorAll(".iu-author-social a[href='#']").forEach(a => {
                a.addEventListener("click", e => e.preventDefault());
            });
        }, 0);
        return el;
    }

    function modalAyarlar() {
        D.ekran = "ayarlar";
        render();
    }

    // ─────────────────────────────────────────────────────────────────
    // BAŞLAT
    // ─────────────────────────────────────────────────────────────────
    (function basla() {
        document.title = `InstaFollowKit v${VERSIYON}`;
        document.body.innerHTML = '<div id="iu-kok" style="min-height:100vh"></div>';
        stilEkle();
        render();
        setTimeout(() => viewerProfilGuncelle(), 0);
        document.getElementById("iu-kok")?.addEventListener("click", async e => {
            if (e.target.closest("#iu-hd-onizleme-kapat")) {
                e.preventDefault();
                profilHdBlobIptal();
                D.profilHdOnizleme = null;
                const elRes = document.getElementById("iu-res");
                Ref.iuResPending = elRes ? elRes.scrollTop : 0;
                render();
                return;
            }
            const pngBtn = e.target.closest("[data-iu-hd-png]");
            if (pngBtn) {
                e.preventDefault();
                e.stopPropagation();
                profilHdGorselPngIndir(pngBtn.dataset.iuHdUn || D.profilHdOnizleme?.username || "");
                return;
            }
            const jpgBtn = e.target.closest("[data-iu-hd-jpg]");
            if (jpgBtn) {
                e.preventDefault();
                e.stopPropagation();
                profilHdGorselJpgIndir(jpgBtn.dataset.iuHdUn || D.profilHdOnizleme?.username || "");
                return;
            }
            if (e.target.closest("[data-iu-hd-copy]")) {
                e.preventDefault();
                e.stopPropagation();
                profilHdGorselPanoyaKopyala();
                return;
            }
            const avImg = e.target.closest("#iu-res img.iu-av");
            if (!avImg) return;
            const tr = avImg.closest("tr.iu-list-tr[data-pid]");
            if (!tr || !tr.dataset.pid) return;
            e.preventDefault();
            e.stopPropagation();
            if (Ref.profilHdYukleniyor) return;
            const k = iuKullaniciBul(tr.dataset.pid);
            if (!k || !k.username) return;
            Ref.profilHdYukleniyor = true;
            try {
                await profilHdOnizlemeYukle(k.username, k.profile_pic_url || "", k.id);
            } finally {
                Ref.profilHdYukleniyor = false;
            }
        });
        console.log(`%c🛡️ InstaFollowKit v${VERSIYON}`, "color:#9333ea;font-size:13px;font-weight:bold");
    })();

})();
