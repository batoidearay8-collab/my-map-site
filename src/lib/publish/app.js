(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // Prefer i18nObj[lang] if present; otherwise fall back to base field.
  // (Export normalizes default-lang text into base fields.)
  function pickI18n(primary, i18nObj, lang) {
    var base = (primary == null ? "" : String(primary)).trim();
    if (i18nObj && typeof i18nObj === "object" && lang) {
      var v = i18nObj[lang];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return base;
  }

  function resolvePublic(url) {
    if (!url) return "";
    if (/^(https?:|data:|blob:)/.test(url)) return url;
    return "./" + String(url).replace(/^\.\//, "").replace(/^\/+/, "");
  }

  function readPreferredTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem("mapsite_theme");
    } catch {}
    if (saved === "light" || saved === "dark") return saved;
    var prefersDark = false;
    try {
      prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {}
    return prefersDark ? "dark" : "light";
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("mapsite_theme", theme);
    } catch {}
  }

  function uniq(arr) {
    var set = new Set();
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      if (!set.has(arr[i])) {
        set.add(arr[i]);
        out.push(arr[i]);
      }
    }
    return out;
  }

  function sortCategories(cats) {
    return (cats || []).slice().sort(function (a, b) {
      var ao = typeof a.order === "number" ? a.order : 9999;
      var bo = typeof b.order === "number" ? b.order : 9999;
      if (ao !== bo) return ao - bo;
      return String(a.category || "").localeCompare(String(b.category || ""));
    });
  }

  // ---------- Business hours / holidays (outdoor only) ----------
  var DAY_ALIASES = [
    { idx: 0, tokens: ["sun", "sunday", "日", "日曜", "日曜日"] },
    { idx: 1, tokens: ["mon", "monday", "月", "月曜", "月曜日"] },
    { idx: 2, tokens: ["tue", "tues", "tuesday", "火", "火曜", "火曜日"] },
    { idx: 3, tokens: ["wed", "wednesday", "水", "水曜", "水曜日"] },
    { idx: 4, tokens: ["thu", "thur", "thurs", "thursday", "木", "木曜", "木曜日"] },
    { idx: 5, tokens: ["fri", "friday", "金", "金曜", "金曜日"] },
    { idx: 6, tokens: ["sat", "saturday", "土", "土曜", "土曜日"] },
  ];

  function norm(s) {
    return String(s || "").trim().toLowerCase().replaceAll("　", " ");
  }

  function parseTimeMin(hhmm) {
    var m = String(hhmm || "").trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (!m) return null;
    var h = Number(m[1]);
    var mi = Number(m[2] || "0");
    if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
    if (h < 0 || h > 48) return null;
    if (mi < 0 || mi >= 60) return null;
    return h * 60 + mi;
  }

  function parseIntervals(part) {
    var s = norm(part)
      .replaceAll("〜", "-")
      .replaceAll("~", "-")
      .replaceAll("–", "-")
      .replaceAll("―", "-")
      .replaceAll("−", "-");
    var pieces = s.split(/\s*(?:,|、|\/|\n|;|；)\s*/g).filter(Boolean);
    var out = [];
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      var mm = p.match(/(\d{1,2}:\d{2}|\d{1,2})\s*-\s*(\d{1,2}:\d{2}|\d{1,2})/);
      if (!mm) continue;
      var a = parseTimeMin(mm[1]);
      var b = parseTimeMin(mm[2]);
      if (a == null || b == null) continue;
      out.push([a, b]);
    }
    return out;
  }

  function parseClosedDays(input) {
    var s = norm(input);
    var days = new Set();
    if (!s) return { days: days, irregular: false, hasAny: false };
    var irregular = /(不定|irregular|varies)/i.test(s);

    // ranges like 月-金 / Mon-Fri
    var rangeRe = /(日|月|火|水|木|金|土|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\s*(?:-|〜|~)\s*(日|月|火|水|木|金|土|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)/gi;
    var rm;
    while ((rm = rangeRe.exec(s))) {
      var aTok = norm(rm[1]);
      var bTok = norm(rm[2]);
      var a = DAY_ALIASES.find(function (d) { return d.tokens.some(function (t) { return norm(t) === aTok; }); });
      var b = DAY_ALIASES.find(function (d) { return d.tokens.some(function (t) { return norm(t) === bTok; }); });
      if (!a || !b) continue;
      var cur = a.idx;
      for (var j = 0; j < 7; j++) {
        days.add(cur);
        if (cur === b.idx) break;
        cur = (cur + 1) % 7;
      }
    }

    DAY_ALIASES.forEach(function (d) {
      for (var i = 0; i < d.tokens.length; i++) {
        var tok = d.tokens[i];
        if (!tok) continue;
        if (s.includes(norm(tok))) { days.add(d.idx); break; }
      }
    });

    var hasAny = days.size > 0 || irregular;
    return { days: days, irregular: irregular, hasAny: hasAny };
  }

  function parseHoursSchedule(input) {
    var s = norm(input);
    var byDay = new Map();
    if (!s) return { byDay: byDay, hasAny: false };
    if (/(24\s*h|24時間|24hour)/i.test(s)) {
      for (var i = 0; i < 7; i++) byDay.set(i, [[0, 1440]]);
      return { byDay: byDay, hasAny: true };
    }

    var hasWeekday = DAY_ALIASES.some(function (d) { return d.tokens.some(function (tok) { return tok && s.includes(norm(tok)); }); });
    if (hasWeekday) {
      var chunks = s.split(/\s*(?:;|；|\n)\s*/g).filter(Boolean);
      for (var c = 0; c < chunks.length; c++) {
        var chunk = chunks[c];
        var days = [];
        var range = chunk.match(/(日|月|火|水|木|金|土|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\s*(?:-|〜|~)\s*(日|月|火|水|木|金|土|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)/i);
        if (range) {
          var aTok = norm(range[1]);
          var bTok = norm(range[2]);
          var a = DAY_ALIASES.find(function (d) { return d.tokens.some(function (t) { return norm(t) === aTok; }); });
          var b = DAY_ALIASES.find(function (d) { return d.tokens.some(function (t) { return norm(t) === bTok; }); });
          if (a && b) {
            var cur = a.idx;
            for (var j = 0; j < 7; j++) {
              days.push(cur);
              if (cur === b.idx) break;
              cur = (cur + 1) % 7;
            }
          }
        }
        if (!days.length) {
          DAY_ALIASES.forEach(function (d) {
            if (d.tokens.some(function (tok) { return tok && chunk.includes(norm(tok)); })) days.push(d.idx);
          });
        }
        var intervals = parseIntervals(chunk);
        if (!intervals.length) continue;
        var applyDays = days.length ? days : [0,1,2,3,4,5,6];
        applyDays.forEach(function (di) {
          var cur = byDay.get(di) || [];
          cur = cur.concat(intervals);
          byDay.set(di, cur);
        });
      }
      if (byDay.size) return { byDay: byDay, hasAny: true };
    }

    var intervals = parseIntervals(s);
    if (!intervals.length) return { byDay: byDay, hasAny: false };
    for (var i = 0; i < 7; i++) byDay.set(i, intervals);
    return { byDay: byDay, hasAny: true };
  }

  function isNowInIntervals(nowMin, intervals) {
    for (var i = 0; i < intervals.length; i++) {
      var a = intervals[i][0], b = intervals[i][1];
      if (a === b) continue;
      if (a < b) { if (nowMin >= a && nowMin < b) return true; }
      else { if (nowMin >= a || nowMin < b) return true; }
    }
    return false;
  }

  function hasBizInfo(poi) {
    return !!String((poi && poi.hours) || "").trim() || !!String((poi && poi.closed) || "").trim();
  }

  /*
   * ⚠️  SYNC WARNING: This business-hours parser is duplicated from
   *     src/lib/openStatus.ts. Keep both in sync when modifying.
   */
  function getOpenStatus(poi, now) {
    var hours = String((poi && poi.hours) || "").trim();
    var closed = String((poi && poi.closed) || "").trim();

    var hp = parseHoursSchedule(hours);
    var cp = parseClosedDays(closed);
    if (!hp.hasAny && !cp.hasAny) return "unknown";
    var day = now.getDay();
    if (cp.days.has(day)) return "closed";
    if (cp.irregular && !hp.hasAny) return "unknown";
    if (!hp.hasAny) return "unknown";
    var intervals = hp.byDay.get(day) || [];
    if (!intervals.length) return "closed";
    var nowMin = now.getHours() * 60 + now.getMinutes();
    return isNowInIntervals(nowMin, intervals) ? "open" : "closed";
  }

  function statusEmoji(st) {
    if (st === "open") return "🟢";
    if (st === "closed") return "🔴";
    return "⏰";
  }

  function statusLabel(st, lang) {
    if (st === "open") return (lang === "ja") ? "営業中" : "Open now";
    if (st === "closed") return (lang === "ja") ? "営業時間外" : "Closed now";
    return (lang === "ja") ? "営業時間不明" : "Hours unknown";
  }

  function hoursLabel(lang) { return (lang === "ja") ? "営業時間" : "Hours"; }
  function closedLabel(lang) { return (lang === "ja") ? "休業日" : "Closed"; }

  function buildMarkerHtml(cat, st) {
    var icon = (cat && cat.icon) ? String(cat.icon) : "📍";
    var color = (cat && cat.markerColor) ? String(cat.markerColor) : "var(--accent)";
    var status = st ? String(st) : "";
    var closedClass = (status === "closed") ? " isClosed" : "";
    var badge = status ? ('<div class="mStatus mStatus--' + escapeHtml(status) + '" aria-hidden="true"></div>') : "";
    return (
      '<div class="mWrap">' +
        '<div class="m' + closedClass + '" style="--mc:' + escapeHtml(color) + '">' +
          '<div class="mDot"></div>' +
          '<div class="mIcon">' + escapeHtml(icon) + '</div>' +
        '</div>' +
        badge +
      '</div>'
    );
  }

  function buildMarkerIcon(cat, st) {
    return L.divIcon({
      className: "poiIcon",
      html: buildMarkerHtml(cat, st),
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  function setSheet(open) {
    var sheet = $("sheet");
    if (!sheet) return;
    if (open) sheet.classList.remove("hidden");
    else sheet.classList.add("hidden");
  }

  function renderSheet(title, bodyHtml) {
    var t = $("sheetTitle");
    var b = $("sheetBody");
    if (t) t.textContent = title || "";
    if (b) b.innerHTML = bodyHtml || "";
    setSheet(true);
  }

  function wireSheetClose() {
    var close = $("sheetClose");
    var back = $("sheetBackdrop");
    if (close) close.addEventListener("click", function () { setSheet(false); });
    if (back) back.addEventListener("click", function () { setSheet(false); });
  }

  function makePoiCard(poi, cfg, lang, defaultLang) {
    var name = pickI18n(poi.name, poi.nameI18n, lang) || "";
    var desc = pickI18n(poi.description, poi.descriptionI18n, lang) || "";

    var stIcon = "";
    if (cfg && cfg.mode !== "indoor" && hasBizInfo(poi)) {
      var st = getOpenStatus(poi, new Date());
      stIcon = statusEmoji(st);
    }

    var html = '';
    html += '<div class="poiCard" data-poi="' + escapeHtml(poi.id) + '">';
    html += '<div class="poiLine">';
    html += '<div class="poiMain">';
    html += '<div class="poiName"><span class="statusIcon" data-status aria-hidden="true">' + (stIcon ? escapeHtml(stIcon) + ' ' : '') + '</span>' + escapeHtml(name) + '</div>';
    if (desc) html += '<div class="poiDesc">' + escapeHtml(desc) + '</div>';
    // Multi-floor: show floor badge
    if (cfg && cfg.mode === "indoor" && floors.length >= 2 && poi.floor) {
      var floorLabel = poi.floor;
      for (var fi3 = 0; fi3 < floors.length; fi3++) {
        if (floors[fi3].id === poi.floor) {
          floorLabel = pickI18n(floors[fi3].label, floors[fi3].labelI18n, lang) || floors[fi3].id;
          break;
        }
      }
      html += '<div class="poiFloor">' + escapeHtml(floorLabel) + '</div>';
    }
    html += '</div>';
    html += '</div>';

    var img = poi.image ? resolvePublic(poi.image) : "";
    if (img) {
      html += '<img class="poiImg" src="' + escapeHtml(img) + '" alt="" loading="lazy" />';
    }

    html += '</div>';
    return html;
  }

  function makePoiSheetHtml(poi, cat, cfg, lang, defaultLang) {
    var desc = pickI18n(poi.description, poi.descriptionI18n, lang) || "";
    var img = poi.image ? resolvePublic(poi.image) : "";
    var url = (poi.url || "").trim();

    var html = '';
    if (img) {
      html += '<img class="sheetImg" src="' + escapeHtml(img) + '" alt="" loading="lazy" />';
    }
    if (desc) {
      html += '<div class="sheetText">' + escapeHtml(desc) + '</div>';
    }
    if (url) {
      var safeUrl = escapeHtml(url);
      html += '<div class="sheetLink"><a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' + safeUrl + '</a></div>';
    }

    // Outdoor-only: business-hours indicator (🟢/🔴) + hours/closed notes
    if (cfg && cfg.mode !== "indoor" && hasBizInfo(poi)) {
      var st = getOpenStatus(poi, new Date());
      html += '<div class="sheetMeta">' + escapeHtml(statusEmoji(st) + ' ' + statusLabel(st, lang)) + '</div>';
      var hours = String((poi.hours || "")).trim();
      var closed = String((poi.closed || "")).trim();
      if (hours) html += '<div class="sheetMeta"><strong>' + escapeHtml(hoursLabel(lang)) + '</strong>: ' + escapeHtml(hours) + '</div>';
      if (closed) html += '<div class="sheetMeta"><strong>' + escapeHtml(closedLabel(lang)) + '</strong>: ' + escapeHtml(closed) + '</div>';
    }

    // Category label (no icon)
    if (cat) {
      var catLabel = pickI18n(cat.label, cat.labelI18n, lang) || cat.category || "";
      if (catLabel) html += '<div class="sheetMeta">' + escapeHtml(catLabel) + '</div>';
    }

    return html;
  }

  async function main() {
    // Theme
    setTheme(readPreferredTheme());
    var themeToggle = $("themeToggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", function () {
        var cur = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
        setTheme(cur === "dark" ? "light" : "dark");
      });
    }

    // Share / Copy URL
    function copyText(text) {
      // returns Promise<boolean>
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return false; });
        }
      } catch {}
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        var ok = document.execCommand("copy");
        ta.remove();
        return Promise.resolve(!!ok);
      } catch {
        return Promise.resolve(false);
      }
    }
    function flashBtn(btn, ok) {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = ok ? "✓" : "!";
      window.setTimeout(function () { btn.textContent = old; }, 1200);
    }

    var copyBtn = $("copyUrl");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        copyText(window.location.href).then(function (ok) { flashBtn(copyBtn, ok); });
      });
    }

    var shareBtn = $("nativeShare");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        var url = window.location.href;
        try {
          if (navigator.share) {
            navigator.share({ title: document.title, url: url }).catch(function () {
              copyText(url).then(function (ok) { flashBtn(shareBtn, ok); });
            });
            return;
          }
        } catch {}
        copyText(url).then(function (ok) { flashBtn(shareBtn, ok); });
      });
    }

    // Map-only display (toggles CSS + URL ?map=1)
    var mapOnlyBtn = $("mapOnlyToggle");
    function setMapOnly(on) {
      document.body.classList.toggle("mapOnly", !!on);
      if (mapOnlyBtn) mapOnlyBtn.classList.toggle("active", !!on);
      // Keep the state in the URL (use replace so it doesn't spam history)
      try {
        var sp = new URLSearchParams(window.location.search);
        if (on) sp.set("map", "1");
        else sp.delete("map");
        var qs = sp.toString();
        var nextUrl = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
        window.history.replaceState(null, "", nextUrl);
      } catch {}
            // Move Leaflet zoom +/- away from the top-left UI when map-only is enabled
      try {
        if (map && map.zoomControl && map.zoomControl.setPosition) {
          map.zoomControl.setPosition(on ? "bottomleft" : "topleft");
        }
      } catch {}

// If Leaflet map is already initialized, re-calc size
      try {
        if (map && map.invalidateSize) window.setTimeout(function () { map.invalidateSize(true); }, 80);
      } catch {}
    }
    // Initialize from URL once
    try {
      var initSp = new URLSearchParams(window.location.search);
      setMapOnly(initSp.get("map") === "1");
    } catch {}
    if (mapOnlyBtn) {
      mapOnlyBtn.addEventListener("click", function () {
        setMapOnly(!document.body.classList.contains("mapOnly"));
      });
    }

    wireSheetClose();

    // Load data
    var cfg = await fetch(resolvePublic("data/config.json")).then(function (r) { return r.json(); });
    var cats = await fetch(resolvePublic("data/categories.json")).then(function (r) { return r.json(); });
    var pois = await fetch(resolvePublic("data/pois.json")).then(function (r) { return r.json(); });
    cats = sortCategories(cats);

    var poiById = new Map();
    (pois || []).forEach(function (p) { if (p && p.id) poiById.set(p.id, p); });

    // Browser tab title (not localized)
    var tabTitle = (cfg && cfg.ui && cfg.ui.tabTitle) ? String(cfg.ui.tabTitle) : "AtlasKobo — 地図サイト制作キット";
    document.title = tabTitle;

    // Language
    var supported = (cfg.i18n && cfg.i18n.supportedLangs) ? cfg.i18n.supportedLangs : ["ja", "en"];
    supported = uniq(supported.filter(function (x) { return !!x; }));
    if (!supported.length) supported = ["ja", "en"];
    var defaultLang = (cfg.i18n && cfg.i18n.defaultLang) ? cfg.i18n.defaultLang : supported[0];

    var lang = defaultLang;
    try {
      var savedLang = localStorage.getItem("mapsite_lang");
      if (savedLang && supported.includes(savedLang)) lang = savedLang;
    } catch {}

    var langSelect = $("langSelect");
    if (langSelect) {
      langSelect.innerHTML = "";
      supported.forEach(function (l) {
        var opt = document.createElement("option");
        opt.value = l;
        opt.textContent = l;
        langSelect.appendChild(opt);
      });
      langSelect.value = lang;
      langSelect.addEventListener("change", function () {
        lang = langSelect.value;
        try { localStorage.setItem("mapsite_lang", lang); } catch {}
        renderAll();
      });
    }

    
// Open-only filter (toggles URL ?open=1)
var openOnlyBtn = $("openOnlyToggle");
var openOnly = false;
try {
  var spOpenInit = new URLSearchParams(window.location.search);
  openOnly = spOpenInit.get("open") === "1";
} catch {}
function applyOpenOnlyBtnText() {
  if (!openOnlyBtn) return;
  var isJa = (lang === "ja");
  openOnlyBtn.title = isJa ? "営業中だけ表示" : "Open now only";
  openOnlyBtn.setAttribute("aria-label", isJa ? "営業中だけ表示" : "Open now only");
  openOnlyBtn.setAttribute("aria-pressed", openOnly ? "true" : "false");
}
function setOpenOnly(on) {
  openOnly = !!on;
  if (openOnlyBtn) openOnlyBtn.classList.toggle("active", openOnly);
  applyOpenOnlyBtnText();
  // Keep the state in the URL (use replace so it doesn't spam history)
  try {
    var sp = new URLSearchParams(window.location.search);
    if (openOnly) sp.set("open", "1");
    else sp.delete("open");
    var qs = sp.toString();
    var nextUrl = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
    window.history.replaceState(null, "", nextUrl);
  } catch {}
  // Re-render to apply the filter (safe even if called before initial renderAll)
  try { renderAll(); } catch {}
}
if (openOnlyBtn) {
  openOnlyBtn.classList.toggle("active", openOnly);
  openOnlyBtn.addEventListener("click", function () { setOpenOnly(!openOnly); });
}

// Header title/subtitle (localized)
    var titleEl = $("siteTitle");
    var subtitleEl = $("siteSubtitle");

    function applyHeaderText() {
      if (titleEl) titleEl.textContent = pickI18n(cfg.title, cfg.titleI18n, lang) || "";
      if (subtitleEl) subtitleEl.textContent = pickI18n(cfg.subtitle, cfg.subtitleI18n, lang) || "";
    }

    // Map init
    var map;
    var markers = new Map();
    var didAutoFit = false;

    // Multi-floor (indoor)
    var activeFloor = "";
    var floorOverlay = null;
    var floors = (cfg && cfg.indoor && cfg.indoor.floors) ? cfg.indoor.floors : [];
    if (floors.length >= 2 && !activeFloor) activeFloor = floors[0].id;

    // Outdoor-only: "My location" (GPS)
    var locateCtrlAdded = false;
    var locateBtnEl = null;
    var myPosMarker = null;
    var myPosCircle = null;

    function locateLabel() {
      return (lang === "ja") ? "現在地へ" : "My location";
    }

    function locateNotSupportedMsg() {
      return (lang === "ja")
        ? "このブラウザでは位置情報（GPS）が使えません。"
        : "Geolocation is not supported in this browser.";
    }

    function locateDeniedMsg() {
      return (lang === "ja")
        ? "位置情報の利用が許可されていません。ブラウザの設定で許可してください。"
        : "Location permission denied. Please allow it in your browser settings.";
    }

    function locateFailedMsg() {
      return (lang === "ja")
        ? "位置情報を取得できませんでした。電波状況や設定を確認してください。"
        : "Could not get your location. Check signal or settings.";
    }

    function buildMyPosIcon() {
      return L.divIcon({
        className: "myPosIcon",
        html: '<div class="myPosDot" aria-hidden="true"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
    }

    function clearMyPos() {
      try { if (myPosMarker) myPosMarker.remove(); } catch {}
      try { if (myPosCircle) myPosCircle.remove(); } catch {}
      myPosMarker = null;
      myPosCircle = null;
    }

    function locateNow() {
      if (!map) return;
      if (cfg.mode === "indoor") return;
      if (!navigator.geolocation) {
        alert(locateNotSupportedMsg());
        return;
      }

      // Visual busy state
      if (locateBtnEl) locateBtnEl.classList.add("isBusy");
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          if (locateBtnEl) locateBtnEl.classList.remove("isBusy");
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;
          var acc = Math.max(0, pos.coords.accuracy || 0);

          clearMyPos();

          var zoom = Math.max(map.getZoom(), 16);
          map.setView([lat, lng], zoom);

          myPosMarker = L.marker([lat, lng], { icon: buildMyPosIcon() }).addTo(map);
          if (isFinite(acc) && acc > 0) {
            myPosCircle = L.circle([lat, lng], {
              radius: acc,
              color: "var(--accent)",
              fillColor: "var(--accent)",
              fillOpacity: 0.12,
              weight: 2,
            }).addTo(map);
          }
        },
        function (err) {
          if (locateBtnEl) locateBtnEl.classList.remove("isBusy");
          if (err && err.code === 1) alert(locateDeniedMsg());
          else alert(locateFailedMsg());
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }

    function updateLocateUi() {
      if (!locateBtnEl) return;
      locateBtnEl.title = locateLabel();
      locateBtnEl.setAttribute("aria-label", locateLabel());

      // Hide/disable for indoor
      if (cfg.mode === "indoor") {
        locateBtnEl.setAttribute("disabled", "disabled");
        locateBtnEl.classList.add("isDisabled");
      } else {
        locateBtnEl.removeAttribute("disabled");
        locateBtnEl.classList.remove("isDisabled");
      }
    }

    function ensureLocateControl() {
      if (!map) return;
      if (locateCtrlAdded) return;
      if (cfg.mode === "indoor") return;

      var ctrl = L.control({ position: "topright" });
      ctrl.onAdd = function () {
        // IMPORTANT: add `leaflet-control` so the button is clickable (Leaflet sets pointer-events:none on the corners)
        var wrap = L.DomUtil.create("div", "leaflet-control locateCtrl");
        var btn = L.DomUtil.create("button", "locateBtn", wrap);
        btn.type = "button";
        btn.textContent = "📍";
        locateBtnEl = btn;

        // Prevent map drag/zoom when touching the button
        L.DomEvent.disableClickPropagation(wrap);
        L.DomEvent.disableScrollPropagation(wrap);
        L.DomEvent.on(btn, "click", function (e) {
          L.DomEvent.stop(e);
          locateNow();
        });

        return wrap;
      };
      ctrl.addTo(map);
      locateCtrlAdded = true;
      updateLocateUi();
    }

    function catByKey(key) {
      for (var i = 0; i < cats.length; i++) {
        if (cats[i].category === key) return cats[i];
      }
      return null;
    }

    function poiLatLng(p) {
      if (cfg.mode === "indoor") {
        var w = cfg.indoor && cfg.indoor.imageWidthPx ? cfg.indoor.imageWidthPx : 1000;
        var h = cfg.indoor && cfg.indoor.imageHeightPx ? cfg.indoor.imageHeightPx : 1000;
        // Multi-floor: use floor-specific dimensions if available
        if (floors.length >= 2) {
          var poiFloor = (p.floor || "").trim() || (floors[0] ? floors[0].id : "");
          for (var fi = 0; fi < floors.length; fi++) {
            if (floors[fi].id === poiFloor) {
              w = floors[fi].imageWidthPx || w;
              h = floors[fi].imageHeightPx || h;
              break;
            }
          }
        }
        var x = (typeof p.x === "number" ? p.x : 0.5);
        var y = (typeof p.y === "number" ? p.y : 0.5);
        return L.latLng(y * h, x * w);
      }
      var lat = (typeof p.lat === "number") ? p.lat : 0;
      var lng = (typeof p.lng === "number") ? p.lng : 0;
      return L.latLng(lat, lng);
    }

    function initMapOnce() {
      if (map) return;
      var mapEl = $("map");
      if (!mapEl) throw new Error("#map missing");

      if (cfg.mode === "indoor") {
        map = L.map(mapEl, {
          crs: L.CRS.Simple,
          zoomControl: true,
          attributionControl: false,
        });

        try {
          if (map && map.zoomControl && map.zoomControl.setPosition) {
            map.zoomControl.setPosition(document.body.classList.contains("mapOnly") ? "bottomleft" : "topleft");
          }
        } catch {}

        var w = cfg.indoor && cfg.indoor.imageWidthPx ? cfg.indoor.imageWidthPx : 1000;
        var h = cfg.indoor && cfg.indoor.imageHeightPx ? cfg.indoor.imageHeightPx : 1000;
        var bounds = [[0, 0], [h, w]];
        var imgUrl = resolvePublic((cfg.indoor && cfg.indoor.imageUrl) ? cfg.indoor.imageUrl : "");

        // Multi-floor: use active floor image if available
        if (floors.length >= 2 && activeFloor) {
          for (var fi2 = 0; fi2 < floors.length; fi2++) {
            if (floors[fi2].id === activeFloor && floors[fi2].imageUrl) {
              imgUrl = resolvePublic(floors[fi2].imageUrl);
              w = floors[fi2].imageWidthPx || w;
              h = floors[fi2].imageHeightPx || h;
              bounds = [[0, 0], [h, w]];
              break;
            }
          }
        }

        if (imgUrl) {
          floorOverlay = L.imageOverlay(imgUrl, bounds).addTo(map);
        }
        map.fitBounds(bounds);
      } else {
        map = L.map(mapEl, { zoomControl: true });

        try {
          if (map && map.zoomControl && map.zoomControl.setPosition) {
            map.zoomControl.setPosition(document.body.classList.contains("mapOnly") ? "bottomleft" : "topleft");
          }
        } catch {}
        var center = (cfg.outdoor && cfg.outdoor.center) ? cfg.outdoor.center : [35.681236, 139.767125];
        var zoom = (cfg.outdoor && typeof cfg.outdoor.zoom === "number") ? cfg.outdoor.zoom : 15;
        map.setView(center, zoom);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        // Outdoor-only GPS button
        ensureLocateControl();
      }
    }

    // Initial map view: if the exported config still has the default (Tokyo) center,
    // automatically focus the map to the actual POI bounds.
    function isValidLatLng(lat, lng) {
      return (
        typeof lat === "number" && typeof lng === "number" &&
        isFinite(lat) && isFinite(lng) &&
        Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
        !(lat === 0 && lng === 0)
      );
    }

    function isDefaultTokyoCenter(center) {
      if (!Array.isArray(center) || center.length < 2) return true;
      var lat = Number(center[0]);
      var lng = Number(center[1]);
      // Default used in this template
      return Math.abs(lat - 35.681236) < 1e-6 && Math.abs(lng - 139.767125) < 1e-6;
    }

    function autoFitToPoisOnce(list) {
      if (didAutoFit) return;
      if (!map) return;
      if (!cfg || cfg.mode === "indoor") return;

      // Only auto-fit when config center is not explicitly set (or remains at default Tokyo)
      var center = (cfg.outdoor && cfg.outdoor.center) ? cfg.outdoor.center : null;
      if (center && !isDefaultTokyoCenter(center)) {
        didAutoFit = true;
        return;
      }

      var pts = [];
      (list || []).forEach(function (p) {
        if (isValidLatLng(p.lat, p.lng)) pts.push([p.lat, p.lng]);
      });
      if (!pts.length) { didAutoFit = true; return; }

      // Delay a bit to ensure the map size is settled (esp. on mobile)
      window.setTimeout(function () {
        try {
          if (!map) return;
          if (pts.length === 1) {
            var z = (cfg.outdoor && typeof cfg.outdoor.zoom === "number") ? cfg.outdoor.zoom : 15;
            map.setView(pts[0], Math.max(z, 16));
          } else {
            var b = L.latLngBounds(pts);
            map.fitBounds(b, { padding: [28, 28] });
          }
        } catch {}
      }, 60);

      didAutoFit = true;
    }

    // Filters
    var activeCat = "";
    var query = "";

    var searchInput = $("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        query = searchInput.value || "";
        renderAll();
      });
    }

    function renderChips() {
      var chips = $("chips");
      if (!chips) return;
      chips.innerHTML = "";

      var makeBtn = function (key, label, icon, color) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (activeCat === key ? " active" : "");
        if (color) b.style.setProperty("--chip", color);
        b.textContent = (icon ? icon + " " : "") + label;
        b.addEventListener("click", function () {
          activeCat = key;
          renderAll();
        });
        chips.appendChild(b);
      };

      makeBtn("", (lang === "ja") ? "すべて" : "All", "", "");
      cats.forEach(function (c) {
        var label = pickI18n(c.label, c.labelI18n, lang) || c.category || "";
        makeBtn(c.category, label, c.icon || "", c.markerColor || "");
      });
    }

    function applyFilters(list) {
      var q = (query || "").trim().toLowerCase();
      var now = null;
      return list.filter(function (p) {
        if (openOnly) {
          if (!cfg || cfg.mode === "indoor") return false;
          if (!hasBizInfo(p)) return false;
          if (!now) now = new Date();
          var st2 = getOpenStatus(p, now);
          if (st2 !== "open") return false;
        }
        // Multi-floor filter
        if (cfg && cfg.mode === "indoor" && floors.length >= 2 && activeFloor) {
          var poiFloor = (p.floor || "").trim() || (floors[0] ? floors[0].id : "");
          if (poiFloor !== activeFloor) return false;
        }
        if (activeCat && p.category !== activeCat) return false;
        if (!q) return true;
        var n = (pickI18n(p.name, p.nameI18n, lang) || "").toLowerCase();
        var id = String(p.id || "").toLowerCase();
        return n.includes(q) || id.includes(q);
      });
    }

    function clearMarkers() {
      if (!map) return;
      markers.forEach(function (m) { try { m.remove(); } catch {} });
      markers.clear();
    }

    function addMarkers(list) {
      if (!map) return;
      list.forEach(function (p) {
        var cat = catByKey(p.category);
        var st = null;
        if (cfg && cfg.mode !== "indoor" && hasBizInfo(p)) {
          st = getOpenStatus(p, new Date());
        }
        var m = L.marker(poiLatLng(p), { icon: buildMarkerIcon(cat, st) }).addTo(map);
        try { m.__st = st; } catch {}
        m.on("click", function () {
          var name = pickI18n(p.name, p.nameI18n, lang) || "";
          renderSheet(name, makePoiSheetHtml(p, cat, cfg, lang, defaultLang));
        });
        markers.set(p.id, m);
      });
    }

    function updateStatusDom() {
      if (!cfg || cfg.mode === "indoor") return;
      var now = new Date();
      var listEl = $("list");
      if (listEl) listEl.querySelectorAll(".poiCard").forEach(function (card) {
        var poiId = card.getAttribute("data-poi");
        if (!poiId) return;
        var p = poiById.get(poiId);
        var el = card.querySelector(".statusIcon");
        if (!el) return;
        if (!p || !hasBizInfo(p)) {
          el.textContent = "";
          el.title = "";
          return;
        }
        var st = getOpenStatus(p, now);
        el.textContent = statusEmoji(st) + " ";
        el.title = statusLabel(st, lang);
      });

      // Update marker badges + dimming too (map-only mode has no list, so keep markers fresh).
      markers.forEach(function (m, poiId) {
        var p = poiById.get(poiId);
        if (!p) return;
        var next = null;
        if (hasBizInfo(p)) next = getOpenStatus(p, now);
        try {
          if (m.__st === next) return;
        } catch {}
        var cat = catByKey(p.category);
        try { m.setIcon(buildMarkerIcon(cat, next)); } catch {}
        try { m.__st = next; } catch {}
      });
    }

    function renderList(list) {
      var listEl = $("list");
      if (!listEl) return;
      if (!list.length) {
        listEl.innerHTML = '<div class="empty">' + escapeHtml(lang === "ja" ? "一致する地点がありません" : "No results") + '</div>';
        return;
      }

      var html = "";
      list.forEach(function (p) {
        html += makePoiCard(p, cfg, lang, defaultLang);
      });
      listEl.innerHTML = html;
      updateStatusDom();

      listEl.querySelectorAll(".poiCard").forEach(function (card) {
        card.addEventListener("click", function () {
          var poiId = card.getAttribute("data-poi");
          var p = pois.find(function (x) { return x.id === poiId; });
          if (!p) return;
          var cat = catByKey(p.category);
          var ll = poiLatLng(p);
          if (map) {
            if (cfg.mode === "indoor") map.panTo(ll);
            else map.setView(ll, Math.max(map.getZoom(), 17));
          }
          var name = pickI18n(p.name, p.nameI18n, lang) || "";
          renderSheet(name, makePoiSheetHtml(p, cat, cfg, lang, defaultLang));
        });
      });
    }

    // ── Reco (おすすめ) ──────────────────────────────────────────
    // config.reco = { needs: ["駅", "お土産"], rules: { "駅": { category: "transport" } } }
    // needs ごとにセクションを表示。rules があればそれで絞り込み、なければカテゴリ名 fallback。

    function getRecoPoiForNeed(need, rules) {
      var rule = rules && rules[need];
      if (rule && rule.category) {
        // ルールあり：カテゴリIDで絞り込み
        return pois.filter(function (p) { return p.category === rule.category; });
      }
      // fallback：カテゴリラベル or カテゴリIDがneedを含む
      var needle = norm(need);
      return pois.filter(function (p) {
        var cat = catByKey(p.category);
        var label = cat ? norm(pickI18n(cat.label, cat.labelI18n, lang)) : "";
        var catKey = norm(p.category || "");
        return label.includes(needle) || catKey.includes(needle);
      });
    }

    function renderReco() {
      var el = $("recoSection");
      if (!el) return;

      var reco = cfg && cfg.reco;
      var needs = reco && Array.isArray(reco.needs) && reco.needs.length ? reco.needs : null;
      if (!needs) { el.style.display = "none"; return; }

      var rules = (reco && reco.rules) ? reco.rules : {};
      var html = '<div class="recoTitle">' + escapeHtml(lang === "ja" ? "おすすめ" : "Recommended") + '</div>';
      var hasAny = false;

      needs.forEach(function (need) {
        var matched = getRecoPoiForNeed(need, rules);
        if (!matched.length) return;
        hasAny = true;
        html += '<div class="recoGroup">';
        html += '<div class="recoLabel">' + escapeHtml(need) + '</div>';
        html += '<div class="recoScroll">';
        matched.slice(0, 6).forEach(function (p) {
          var cat = catByKey(p.category);
          var icon = (cat && cat.icon) ? cat.icon : "📍";
          var name = pickI18n(p.name, p.nameI18n, lang) || "";
          var st = null;
          if (cfg && cfg.mode !== "indoor" && hasBizInfo(p)) {
            st = getOpenStatus(p, new Date());
          }
          var stBadge = st ? '<span class="recoSt recoSt--' + escapeHtml(st) + '"></span>' : "";
          html += '<button type="button" class="recoChip" data-reco-id="' + escapeHtml(p.id) + '">';
          html += '<span class="recoIcon">' + escapeHtml(icon) + '</span>';
          html += '<span class="recoName">' + escapeHtml(name) + '</span>';
          html += stBadge;
          html += '</button>';
        });
        html += '</div>';
        html += '</div>';
      });

      if (!hasAny) { el.style.display = "none"; return; }

      el.innerHTML = html;
      el.style.display = "";

      // クリックで地点を開く
      el.querySelectorAll(".recoChip").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var poiId = btn.getAttribute("data-reco-id");
          var p = poiById.get(poiId);
          if (!p) return;
          var cat = catByKey(p.category);
          var ll = poiLatLng(p);
          if (map) {
            if (cfg.mode === "indoor") map.panTo(ll);
            else map.setView(ll, Math.max(map.getZoom(), 17));
          }
          var name = pickI18n(p.name, p.nameI18n, lang) || "";
          renderSheet(name, makePoiSheetHtml(p, cat, cfg, lang, defaultLang));
        });
      });
    }
    // ────────────────────────────────────────────────────────────

    // Multi-floor: switch floor image overlay and re-render
    function switchFloor(floorId) {
      if (!map || !cfg || cfg.mode !== "indoor") return;
      if (floorId === activeFloor) return;
      activeFloor = floorId;

      // Remove old overlay
      if (floorOverlay) {
        try { floorOverlay.remove(); } catch {}
        floorOverlay = null;
      }

      // Find floor def
      var floorDef = null;
      for (var i = 0; i < floors.length; i++) {
        if (floors[i].id === floorId) { floorDef = floors[i]; break; }
      }

      var w = (floorDef && floorDef.imageWidthPx) || cfg.indoor.imageWidthPx || 1000;
      var h = (floorDef && floorDef.imageHeightPx) || cfg.indoor.imageHeightPx || 1000;
      var bounds = [[0, 0], [h, w]];
      var imgUrl = "";
      if (floorDef && floorDef.imageUrl) {
        imgUrl = resolvePublic(floorDef.imageUrl);
      } else {
        imgUrl = resolvePublic(cfg.indoor.imageUrl || "");
      }

      if (imgUrl) {
        floorOverlay = L.imageOverlay(imgUrl, bounds).addTo(map);
        // Move overlay to back so markers are on top
        try { floorOverlay.bringToBack(); } catch {}
      }

      // Re-render markers and list for new floor
      var filtered = applyFilters(pois);
      clearMarkers();
      addMarkers(filtered);
      renderList(filtered);
      renderFloorSelector();
    }

    // Render floor selector buttons
    function renderFloorSelector() {
      if (!cfg || cfg.mode !== "indoor" || floors.length < 2) return;

      var container = document.getElementById("floorSelector");
      if (!container) {
        // Create container and insert into the map area
        container = document.createElement("div");
        container.id = "floorSelector";
        container.className = "floorSelector";
        var mapEl = $("map");
        if (mapEl && mapEl.parentNode) {
          mapEl.parentNode.style.position = "relative";
          mapEl.parentNode.appendChild(container);
        }
      }

      var html = "";
      for (var i = 0; i < floors.length; i++) {
        var f = floors[i];
        var label = pickI18n(f.label, f.labelI18n, lang) || f.id;
        var cls = "floorBtn" + (f.id === activeFloor ? " active" : "");
        html += '<button type="button" class="' + cls + '" data-floor="' + escapeHtml(f.id) + '">';
        html += escapeHtml(label);
        html += '</button>';
      }
      container.innerHTML = html;

      // Bind click events
      container.querySelectorAll(".floorBtn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var fid = btn.getAttribute("data-floor");
          if (fid) switchFloor(fid);
        });
      });
    }

    function renderAll() {
      // Open-only button text + availability
      applyOpenOnlyBtnText();
      if (cfg && cfg.mode === "indoor") {
        // Open-only makes sense only for outdoor maps
        openOnly = false;
        if (openOnlyBtn) {
          openOnlyBtn.classList.remove("active");
          openOnlyBtn.style.display = "none";
        }
      } else {
        if (openOnlyBtn) openOnlyBtn.style.display = "";
      }

      applyHeaderText();
      updateLocateUi();
      renderReco();
      renderChips();
      var filtered = applyFilters(pois);
      initMapOnce();
      renderFloorSelector();
      clearMarkers();
      addMarkers(filtered);
      // Auto focus map to POIs on first render (prevents the default Tokyo view)
      autoFitToPoisOnce(filtered);
      renderList(filtered);
    }

    renderAll();
    if (cfg && cfg.mode !== "indoor") {
      window.setInterval(function () {
        if (openOnly) renderAll();
        else updateStatusDom();
      }, 60_000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { main().catch(console.error); });
  } else {
    main().catch(console.error);
  }
})();
