(() => {
  "use strict";

  const IS_TEST = Boolean(globalThis.__XU_TEST__);
  if (!IS_TEST && !/(^|\.)(x|twitter)\.com$/.test(location.hostname)) {
    alert("Open https://x.com first (and sign in), then paste this script again.");
    return;
  }

  const APP_ID = "xu-app";
  const VERSION = "1.0.0";
  const CLEANUP_EVENT = "xu-cleanup";
  const STYLE_ID = "xu-style";
  const STORAGE_KEY = "xu_state_v1";
  const CHECKPOINT_KEY = "xu_scan_v1";
  const LAST_SCAN_KEY = "xu_last_scan_v1";
  const CHECKPOINT_TTL = 24 * 60 * 60 * 1000;

  // Public bearer token that X's own web client ships in its JavaScript bundle.
  // It identifies the web app, not you; your session comes from your own cookies.
  const FALLBACK_BEARER = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
  const OPERATIONS = ["Following", "Followers"];

  const DEFAULT_TIMINGS = {
    scanDelayMin: 1500,
    scanDelayMax: 3000,
    scanPauseEveryPages: 7,
    scanPauseMs: 15000,
    usersPerRequest: 50,
    unfollowDelayMin: 6000,
    unfollowDelayMax: 10000,
    unfollowPauseEvery: 10,
    unfollowPauseMs: 300000
  };
  const SCAN_PAUSE_JITTER_MS = 5000;
  const MAX_RETRIES = 3;
  const MAX_RATE_WAIT_MS = 20 * 60 * 1000;
  const MAX_EMPTY_PAGES = 2;
  const MAX_SCRIPTS_TO_SEARCH = 40;
  const PROGRESS_TITLE_ID = "xu-progress-title";
  const PANEL_WIDTH = 380;
  const PANEL_MARGIN = 18;
  const COOLDOWN_MS = { blocked: 3 * 60 * 60 * 1000, rate: 15 * 60 * 1000 };

  const ERROR_CODES = {
    rate: [88],
    session: [32, 89, 215, 239, 353],
    blocked: [64, 261, 326, 141, 162]
  };

  const I18N = {
    en: {
      title: "X Unfollower",
      subtitle: "See who doesn't follow you back",
      welcomeTitle: "Ready when you are",
      welcomeBody: "Everyone you follow is loaded and checked for whether they follow you back. Non-followers appear as they are found. Nothing on your account changes during the scan.",
      scanNotice: "Runs in this tab with your existing X session. No password, app or extension. X limits how fast lists load, so large accounts can take a while; the panel waits out limits on its own.",
      scanBtn: "Scan now",
      loadingApi: "Getting ready",
      loadingFollowing: "Checking the people you follow",
      loadingFollowers: "Extra step: loading your followers",
      followersNeeded: "X did not include follow-back info in your following list, so your followers are loaded too.",
      liveFound: "Found so far: {count}",
      liveWaiting: "Non-followers will appear here as they are found.",
      liveHint: "You can select accounts now. Unfollowing opens when the scan finishes.",
      showLastScan: "Show last result ({count}, {age})",
      lastScanNotice: "This list is from a scan {age}. Rescan for the current state.",
      rescan: "Rescan",
      paused: "Paused",
      pause: "Pause",
      resume: "Resume",
      cancel: "Cancel",
      ofTotal: "{current} of {total}",
      ofUnknown: "{current} so far",
      countFollowers: "{current} followers loaded",
      countFollowing: "{current} accounts checked",
      scanCompletedToast: "{count} non-followers found",
      scanFailed: "Scan failed",
      retry: "Try again",
      goBack: "Back to results",
      search: "Search by name or username",
      filterVerified: "Verified",
      filterProtected: "Protected",
      filterNoAvatar: "No profile picture",
      filterShowHidden: "Hidden users",
      foundCount: "{count} non-followers",
      foundOne: "1 non-follower",
      foundNone: "Nice — everyone you follow follows you back.",
      noMatches: "No users match your filters.",
      hide: "Hide",
      unhide: "Unhide",
      hideTooltip: "Hide from this list",
      unhideTooltip: "Show again",
      openProfile: "Open profile",
      copy: "Copy",
      copyAll: "Copy all",
      copiedToast: "Copied {count} usernames",
      selectAll: "Select all",
      selectNone: "Clear",
      selectedCount: "{count} selected",
      unfollow: "Unfollow",
      unfollowConfirmTitle: "Unfollow {count} users?",
      unfollowConfirmBody: "This runs slowly to protect your account. You can pause at any time, but unfollows that already happened cannot be undone from this tool.",
      unfollowConfirmBtn: "Yes, unfollow {count}",
      unfollowing: "Unfollowing",
      currently: "Currently",
      nextActionIn: "Next action in {seconds}s",
      cooldownIn: "Cooldown — {seconds}s",
      scanPause: "Pause — {seconds}s",
      rateWait: "X rate limit — continuing in {time}",
      unfollowDoneTitle: "Done",
      unfollowDoneBody: "{ok} unfollowed, {fail} failed",
      unfollowBlocked: "X refused this action, so {count} remaining users were skipped. Wait a few hours before trying again.",
      settings: "Settings",
      settingsTitle: "Timing settings",
      settingsBody: "Lower delays make X more likely to limit or lock your account. Keep these conservative.",
      minScanDelay: "Min scan delay (ms)",
      maxScanDelay: "Max scan delay (ms)",
      scanPauseEvery: "Long pause every N pages",
      scanPauseLength: "Long pause length (ms)",
      usersPerRequest: "Users requested per page",
      minUnfollowDelay: "Min unfollow delay (ms)",
      maxUnfollowDelay: "Max unfollow delay (ms)",
      unfollowPauseEvery: "Cooldown every N unfollows",
      unfollowPauseLength: "Cooldown length (ms)",
      restoreDefaults: "Restore defaults",
      save: "Save",
      saved: "Settings saved",
      cookieMissing: "Could not find your X session. Make sure you are signed in on x.com.",
      csrfMissing: "Could not read the ct0 cookie. Reload x.com and try again.",
      apiMissing: "Could not find X's list API on this page. Open your profile's Following page once, then paste the script again.",
      apiChanged: "X changed its web API. Reload the page and paste the script again; if it keeps happening, open your Following page once first.",
      requestFailed: "Request failed: {status}",
      tooManyRequests: "X is limiting requests for this account. Only waiting lifts it.",
      sessionExpired: "X signed you out. Sign in again, paste the script again and press Resume. The scan continues where it stopped.",
      scanBlocked: "X temporarily refused requests for this account (it may be locked or restricted). Open x.com normally to check.",
      networkError: "The connection dropped. Check the network and press Resume.",
      keepTabVisible: "Keep this tab in front. Browsers slow down background tabs.",
      resumeAfter: "Resume after {time}.",
      resumeScan: "Resume scan",
      startOver: "Start over",
      resumeHint: "A previous scan stopped partway. Continue from there instead of starting again.",
      partialTitle: "Scan stopped partway",
      partialBody: "{loaded} of the accounts you follow were checked. The non-followers below are confirmed; resume to check the rest. Your progress is saved.",
      gapNotice: "X returned noticeably fewer followers ({loaded}) than your profile shows ({total}), so someone here may actually follow you. Unfollowing is off for this scan.",
      close: "Close",
      langSwitch: "Switch to Turkish",
      minimize: "Minimize",
      expand: "Expand",
      langCode: "TR",
      pillScanning: "Scanning {current}/{total}",
      pillUnfollowing: "Unfollowing {current}/{total}",
      pillResults: "{count} non-followers",
      pillIdle: "Open"
    },
    tr: {
      title: "X Takip Etmeyenler",
      subtitle: "Geri takip etmeyenleri gör",
      welcomeTitle: "Hazır olduğunda başlat",
      welcomeBody: "Takip ettiğin herkes yüklenir ve seni geri takip edip etmediği kontrol edilir. Takip etmeyenler bulundukça listede belirir. Tarama sırasında hesabında hiçbir şey değişmez.",
      scanNotice: "Bu sekmede, mevcut X oturumunla çalışır. Şifre, uygulama veya eklenti gerekmez. X listelerin yüklenme hızını sınırlar; büyük hesaplarda biraz sürebilir, panel sınırları kendisi bekler.",
      scanBtn: "Taramayı başlat",
      loadingApi: "Hazırlanıyor",
      loadingFollowing: "Takip ettiklerin kontrol ediliyor",
      loadingFollowers: "Ek adım: takipçilerin yükleniyor",
      followersNeeded: "X, takip listende geri takip bilgisini göndermedi; bu yüzden takipçilerin de yükleniyor.",
      liveFound: "Şu ana kadar bulunan: {count}",
      liveWaiting: "Takip etmeyenler bulundukça burada belirecek.",
      liveHint: "Hesapları şimdiden seçebilirsin. Takibi bırakma tarama bitince açılır.",
      showLastScan: "Son sonucu göster ({count} kişi, {age})",
      lastScanNotice: "Bu liste {age} yapılan taramadan. Güncel durum için yeniden tara.",
      rescan: "Yeniden tara",
      paused: "Duraklatıldı",
      pause: "Duraklat",
      resume: "Devam et",
      cancel: "İptal",
      ofTotal: "{current} / {total}",
      ofUnknown: "Şu ana kadar {current}",
      countFollowers: "{current} takipçi yüklendi",
      countFollowing: "{current} hesap kontrol edildi",
      scanCompletedToast: "{count} takip etmeyen bulundu",
      scanFailed: "Tarama başarısız",
      retry: "Tekrar dene",
      goBack: "Sonuçlara dön",
      search: "İsim veya kullanıcı adı ara",
      filterVerified: "Onaylı",
      filterProtected: "Korumalı",
      filterNoAvatar: "Profil resmi yok",
      filterShowHidden: "Gizlenen kullanıcılar",
      foundCount: "{count} takip etmeyen",
      foundOne: "1 takip etmeyen",
      foundNone: "Harika — takip ettiğin herkes seni takip ediyor.",
      noMatches: "Filtrelerinle eşleşen kullanıcı yok.",
      hide: "Gizle",
      unhide: "Göster",
      hideTooltip: "Bu listeden gizle",
      unhideTooltip: "Tekrar göster",
      openProfile: "Profili aç",
      copy: "Kopyala",
      copyAll: "Tümünü kopyala",
      copiedToast: "{count} kullanıcı adı kopyalandı",
      selectAll: "Tümünü seç",
      selectNone: "Temizle",
      selectedCount: "{count} seçili",
      unfollow: "Takibi bırak",
      unfollowConfirmTitle: "{count} kullanıcının takibi bırakılsın mı?",
      unfollowConfirmBody: "Hesabını korumak için işlem yavaş çalışır. İstediğin zaman duraklatabilirsin, ama tamamlanan işlemler bu araçtan geri alınamaz.",
      unfollowConfirmBtn: "Evet, {count} kişiyi bırak",
      unfollowing: "Takip bırakılıyor",
      currently: "Şu an",
      nextActionIn: "Sonraki işlem {seconds} sn sonra",
      cooldownIn: "Mola — {seconds} sn",
      scanPause: "Mola — {seconds} sn",
      rateWait: "X hız sınırı — {time} sonra devam",
      unfollowDoneTitle: "Tamamlandı",
      unfollowDoneBody: "{ok} başarılı, {fail} başarısız",
      unfollowBlocked: "X bu işlemi reddetti, kalan {count} kişi atlandı. Tekrar denemeden önce birkaç saat bekle.",
      settings: "Ayarlar",
      settingsTitle: "Hız ayarları",
      settingsBody: "Düşük gecikmeler X'in hesabını kısıtlamasına veya kilitlemesine neden olabilir. Yavaş tut.",
      minScanDelay: "Min tarama gecikmesi (ms)",
      maxScanDelay: "Maks tarama gecikmesi (ms)",
      scanPauseEvery: "Her N sayfada uzun mola",
      scanPauseLength: "Uzun mola süresi (ms)",
      usersPerRequest: "Sayfa başına istenen kullanıcı",
      minUnfollowDelay: "Min takip bırakma gecikmesi (ms)",
      maxUnfollowDelay: "Maks takip bırakma gecikmesi (ms)",
      unfollowPauseEvery: "Her N takip bırakmada mola",
      unfollowPauseLength: "Mola süresi (ms)",
      restoreDefaults: "Varsayılana dön",
      save: "Kaydet",
      saved: "Ayarlar kaydedildi",
      cookieMissing: "X oturumun bulunamadı. x.com'da giriş yaptığından emin ol.",
      csrfMissing: "ct0 çerezi okunamadı. x.com'u yenileyip tekrar dene.",
      apiMissing: "Bu sayfada X'in liste API'si bulunamadı. Profilindeki Takip edilenler sayfasını bir kez aç, sonra kodu yeniden yapıştır.",
      apiChanged: "X web API'sini değiştirdi. Sayfayı yenile ve kodu yeniden yapıştır; tekrarlarsa önce Takip edilenler sayfanı bir kez aç.",
      requestFailed: "İstek başarısız: {status}",
      tooManyRequests: "X bu hesabın isteklerini sınırlıyor. Yalnızca beklemek işe yarar.",
      sessionExpired: "X oturumunu kapattı. Tekrar giriş yap, kodu yeniden yapıştır ve Devam et'e bas. Tarama kaldığı yerden sürer.",
      scanBlocked: "X bu hesabın isteklerini geçici olarak reddetti (hesap kilitli veya kısıtlı olabilir). x.com'u normal şekilde açıp kontrol et.",
      networkError: "Bağlantı koptu. Ağı kontrol et ve Devam et'e bas.",
      keepTabVisible: "Bu sekmeyi önde tut. Tarayıcılar arka plandaki sekmeleri yavaşlatır.",
      resumeAfter: "Saat {time} sonrasında devam et.",
      resumeScan: "Taramaya devam et",
      startOver: "Baştan başla",
      resumeHint: "Önceki tarama yarıda kaldı. Baştan başlamak yerine oradan devam edebilirsin.",
      partialTitle: "Tarama yarıda kaldı",
      partialBody: "Takip ettiğin hesaplardan {loaded} tanesi kontrol edildi. Aşağıdakiler kesin olarak seni takip etmiyor; kalanlar için taramaya devam et. İlerlemen kaydedildi.",
      gapNotice: "X, profilinde görünenden ({total}) belirgin şekilde az takipçi ({loaded}) döndürdü; burada görünen biri seni aslında takip ediyor olabilir. Bu taramada takibi bırakma kapalı.",
      close: "Kapat",
      langSwitch: "İngilizce'ye geç",
      minimize: "Küçült",
      expand: "Aç",
      langCode: "EN",
      pillScanning: "Taranıyor {current}/{total}",
      pillUnfollowing: "Bırakılıyor {current}/{total}",
      pillResults: "{count} takip etmeyen",
      pillIdle: "Aç"
    }
  };

  const SVG = {
    minimize: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3" y="7.25" width="10" height="1.5" rx="0.75" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    gear: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm6.7 2.5a6.7 6.7 0 0 0-.1-1.1l1.4-1.1-1.5-2.6-1.7.7a6.6 6.6 0 0 0-1.9-1.1L10.5 1h-3l-.4 1.8a6.6 6.6 0 0 0-1.9 1.1l-1.7-.7L1.9 5.8 3.3 6.9a6.7 6.7 0 0 0 0 2.2L1.9 10.2l1.5 2.6 1.7-.7a6.6 6.6 0 0 0 1.9 1.1L7.5 15h3l.4-1.8a6.6 6.6 0 0 0 1.9-1.1l1.7.7 1.5-2.6-1.4-1.1c.1-.4.1-.7.1-1.1z"/></svg>',
    open: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 3h7v7M13 3L6.5 9.5M9 13H3V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path fill="currentColor" d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2zm6 11l1 2.8L22 17l-3 .8L18 21l-1-3.2L14 17l3-1.2 1-2.8z"/></svg>',
    alert: '<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path fill="currentColor" d="M12 2 1 21h22L12 2zm0 6 7.5 13h-15L12 8zm-1 4v4h2v-4h-2zm0 5v2h2v-2h-2z"/></svg>',
    check: '<svg viewBox="0 0 16 16" width="36" height="36" aria-hidden="true"><path fill="currentColor" d="M14 4.5L6 12.5l-4-4L3 7.5l3 3 7-7z"/></svg>'
  };

  const persisted = loadStored();
  const state = {
    mode: "idle",
    scanPaused: false,
    scanCancelled: false,
    unfollowPaused: false,
    unfollowCancelled: false,
    unfollowBlocked: 0,
    progress: { current: 0, total: 0, label: "loadingApi", note: "" },
    waitUntil: 0,
    waitReason: "",
    users: [],
    selected: new Set(),
    hidden: new Set(persisted.hidden || []),
    log: [],
    search: "",
    filters: persisted.filters || { verified: true, protected: true, noAvatar: true, showHidden: false },
    timings: loadTimings(persisted.timings),
    panelPos: persisted.panelPos || null,
    minimized: Boolean(persisted.minimized),
    language: persisted.language === "en" ? "en" : "tr",
    error: "",
    errorDetail: "",
    checkpoint: loadCheckpoint(),
    partial: false,
    coverage: "",
    unverified: "",
    api: null,
    rateLimits: {}
  };

  let countdownTimer = null;
  let toastTimer = null;
  let dialogCounter = 0;
  let closeActiveDialog = null;
  let wakeSleep = null;
  let destroyed = false;
  let activeRequest = null;

  // ---------- storage ----------

  function loadTimings(saved = {}) {
    const timings = { ...DEFAULT_TIMINGS };
    for (const key of Object.keys(timings)) {
      if (Number.isFinite(saved?.[key]) && saved[key] >= 0) timings[key] = saved[key];
    }
    timings.usersPerRequest = Math.min(100, Math.max(1, Math.round(timings.usersPerRequest)));
    return timings;
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        hidden: [...state.hidden],
        timings: state.timings,
        filters: state.filters,
        panelPos: state.panelPos,
        minimized: state.minimized,
        language: state.language
      }));
    } catch { }
  }

  function createCheckpoint(viewerId) {
    return {
      viewerId: String(viewerId),
      savedAt: Date.now(),
      following: [],
      followingCursor: "",
      followingDone: false,
      needFollowers: false,
      followerIds: [],
      followersCursor: "",
      followersDone: false,
      followersGap: false,
      followersTotal: 0,
      retryAfter: 0,
      stopReason: "",
      stopDetail: ""
    };
  }

  function loadCheckpoint() {
    try {
      const raw = localStorage.getItem(CHECKPOINT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.viewerId) return null;
      if (!Array.isArray(parsed.following) || !Array.isArray(parsed.followerIds)) return null;
      if (Date.now() - Number(parsed.savedAt || 0) > CHECKPOINT_TTL) return null;
      if (!parsed.following.length && !parsed.followerIds.length) return null;
      return { ...createCheckpoint(parsed.viewerId), ...parsed };
    } catch {
      return null;
    }
  }

  function saveCheckpoint(checkpoint) {
    if (!checkpoint) return;
    checkpoint.savedAt = Date.now();
    try { localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint)); } catch { }
  }

  function clearCheckpoint() {
    state.checkpoint = null;
    state.partial = false;
    try { localStorage.removeItem(CHECKPOINT_KEY); } catch { }
  }

  function saveLastScan(savedAt = Date.now()) {
    try {
      localStorage.setItem(LAST_SCAN_KEY, JSON.stringify({
        viewerId: getViewerId(),
        savedAt,
        users: state.users.filter((u) => u.follows_viewer === false),
        unverified: state.unverified
      }));
    } catch { }
  }

  function loadLastScan() {
    try {
      const saved = JSON.parse(localStorage.getItem(LAST_SCAN_KEY) || "null");
      if (!saved || !Array.isArray(saved.users) || !saved.viewerId) return null;
      if (String(saved.viewerId) !== String(getViewerId())) return null;
      if (Date.now() - Number(saved.savedAt || 0) > CHECKPOINT_TTL) return null;
      return saved;
    } catch {
      return null;
    }
  }

  function showLastScan() {
    const saved = loadLastScan();
    if (!saved) return renderBody();
    state.users = saved.users.map((user) => ({ ...user, follows_viewer: false }));
    state.unverified = typeof saved.unverified === "string" ? saved.unverified : "";
    state.selected.clear();
    state.partial = false;
    state.coverage = t("lastScanNotice", { age: timeAgo(saved.savedAt) });
    state.mode = "results";
    renderBody();
  }

  // ---------- small helpers ----------

  function timeAgo(timestamp) {
    const minutes = Math.max(1, Math.round((Date.now() - Number(timestamp)) / 60000));
    const format = new Intl.RelativeTimeFormat(state.language, { numeric: "auto" });
    return minutes < 60 ? format.format(-minutes, "minute") : format.format(-Math.round(minutes / 60), "hour");
  }

  function formatCount(value) {
    const number = Number(value) || 0;
    try { return number.toLocaleString(state.language === "tr" ? "tr-TR" : "en-US"); } catch { return String(number); }
  }

  function clockTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString(state.language === "tr" ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return minutes ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}s`;
  }

  function t(key, vars) {
    const dict = I18N[state.language] || I18N.en;
    const template = dict[key] ?? I18N.en[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp("(^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function getViewerId() {
    const twid = getCookie("twid") || "";
    return /u=(\d+)/.exec(twid)?.[1] || /(\d+)/.exec(twid)?.[1] || null;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function randomBetween(min, max) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return Math.floor(Math.random() * (hi - lo)) + lo;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }

  function xError(kind, message, status = 0, detail = "", extra = {}) {
    const error = new Error(message);
    error.kind = kind;
    error.status = status;
    error.detail = detail;
    Object.assign(error, extra);
    return error;
  }

  // ---------- X API discovery ----------

  function readInitialState() {
    try {
      if (window.__INITIAL_STATE__ && typeof window.__INITIAL_STATE__ === "object") return window.__INITIAL_STATE__;
    } catch { }
    return null;
  }

  function featureValue(name) {
    const initial = readInitialState();
    const fs = initial?.featureSwitch;
    const value = fs?.user?.config?.[name]?.value ?? fs?.defaultConfig?.[name]?.value;
    return typeof value === "boolean" ? value : false;
  }

  function profileCounts(viewerId) {
    const user = readInitialState()?.entities?.users?.entities?.[viewerId];
    return {
      following: Number(user?.friends_count) || 0,
      followers: Number(user?.followers_count) || 0
    };
  }

  // Requests X's own web app already made (e.g. when you opened your Following page)
  // carry the exact current query id and feature flags.
  function apiFromPerformance() {
    const found = {};
    let entries = [];
    try { entries = performance.getEntriesByType("resource"); } catch { }
    for (const entry of entries) {
      const match = /\/graphql\/([\w-]+)\/(Following|Followers)\?/.exec(entry.name || "");
      if (!match || found[match[2]]) continue;
      try {
        const url = new URL(entry.name);
        found[match[2]] = {
          queryId: match[1],
          features: JSON.parse(url.searchParams.get("features") || "{}"),
          fieldToggles: url.searchParams.get("fieldToggles") ? JSON.parse(url.searchParams.get("fieldToggles")) : null
        };
      } catch { }
    }
    return found;
  }

  function parseOperationsFromBundle(text) {
    const found = {};
    for (const op of OPERATIONS) {
      const re = new RegExp(`queryId:"([\\w-]+)",operationName:"${op}"[^}]*?featureSwitches:\\[([^\\]]*)\\](?:,fieldToggles:\\[([^\\]]*)\\])?`);
      const match = re.exec(text);
      if (!match) continue;
      const names = (s) => (s || "").split(",").map((x) => x.trim().replace(/^"|"$/g, "")).filter(Boolean);
      const features = {};
      for (const name of names(match[2])) features[name] = featureValue(name);
      const toggles = names(match[3]);
      found[op] = {
        queryId: match[1],
        features,
        fieldToggles: toggles.length ? Object.fromEntries(toggles.map((name) => [name, false])) : null
      };
    }
    return found;
  }

  function parseBearer(text) {
    return /"(AAAAAAAAAAAAAAAAAAAAA[\w%]{40,})"/.exec(text)?.[1] || null;
  }

  function bundleUrls() {
    const urls = new Set();
    for (const script of document.querySelectorAll("script[src]")) urls.add(script.src);
    try {
      for (const entry of performance.getEntriesByType("resource")) {
        if (/\.js(\?|$)/.test(entry.name)) urls.add(entry.name);
      }
    } catch { }
    return [...urls]
      .filter((url) => /abs\.twimg\.com\/responsive-web\//.test(url))
      .sort((a, b) => Number(/\/main\.[\w]+\.js/.test(b)) - Number(/\/main\.[\w]+\.js/.test(a)))
      .slice(0, MAX_SCRIPTS_TO_SEARCH);
  }

  async function discoverApi() {
    if (state.api?.ops?.Following) return state.api;
    const ops = apiFromPerformance();
    let bearer = null;
    for (const url of bundleUrls()) {
      if (destroyed || state.scanCancelled) break;
      if (ops.Following && ops.Followers && bearer) break;
      try {
        const response = await fetch(url, { credentials: "omit" });
        if (!response.ok) continue;
        const text = await response.text();
        bearer = bearer || parseBearer(text);
        const parsed = parseOperationsFromBundle(text);
        for (const op of OPERATIONS) if (!ops[op] && parsed[op]) ops[op] = parsed[op];
      } catch (error) {
        console.warn("[xu] could not read", url, error);
      }
    }
    if (!ops.Following) throw xError("api", t("apiMissing"), 0, "Following queryId not found");
    state.api = { bearer: bearer || FALLBACK_BEARER, ops };
    return state.api;
  }

  function apiHeaders() {
    const csrf = getCookie("ct0");
    if (!csrf) throw xError("session", t("csrfMissing"));
    return {
      authorization: "Bearer " + (state.api?.bearer || FALLBACK_BEARER),
      "x-csrf-token": csrf,
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": document.documentElement.lang || "en"
    };
  }

  // ---------- requests ----------

  function readRateHeaders(headers) {
    const remaining = Number(headers?.get?.("x-rate-limit-remaining"));
    const reset = Number(headers?.get?.("x-rate-limit-reset"));
    return {
      remaining: Number.isFinite(remaining) && headers?.get?.("x-rate-limit-remaining") != null ? remaining : null,
      resetAt: Number.isFinite(reset) && reset > 0 ? reset * 1000 : 0
    };
  }

  function errorCodes(json) {
    return Array.isArray(json?.errors) ? json.errors.map((e) => Number(e?.code)).filter(Number.isFinite) : [];
  }

  function errorMessage(json, body) {
    if (Array.isArray(json?.errors)) return json.errors.map((e) => e?.message).filter(Boolean).join("; ").slice(0, 200);
    return json ? "" : String(body || "").slice(0, 120);
  }

  function missingFeatures(message) {
    const match = /features cannot be null:\s*([^"]+)/i.exec(message || "");
    return match ? match[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
  }

  async function waitForRateReset(resetAt) {
    const wait = resetAt - Date.now();
    if (wait <= 0) return;
    if (wait > MAX_RATE_WAIT_MS) throw xError("rate", t("tooManyRequests"), 429, "", { retryAfter: resetAt });
    await sleepWithCountdown(wait + 2000, "rateWait");
  }

  async function xFetch(url, init = {}, key = "default") {
    let attempt = 0;
    let rateRetries = 0;
    while (true) {
      if (destroyed || state.scanCancelled) throw xError("cancelled", "Cancelled");
      const limit = state.rateLimits[key];
      if (limit && limit.remaining != null && limit.remaining <= 1 && limit.resetAt > Date.now()) {
        await waitForRateReset(limit.resetAt);
        if (destroyed || state.scanCancelled) throw xError("cancelled", "Cancelled");
      }

      let response;
      const controller = new AbortController();
      activeRequest = controller;
      try {
        response = await fetch(url, {
          ...init,
          credentials: "include",
          headers: { ...apiHeaders(), ...(init.headers || {}) },
          signal: controller.signal
        });
      } catch (error) {
        if (error?.kind) throw error;
        if (destroyed || state.scanCancelled) throw xError("cancelled", "Cancelled");
        if (attempt >= MAX_RETRIES) throw xError("network", t("networkError"));
        await sleepWithCountdown(Math.min(30000, 3000 * Math.pow(2, attempt)), "cooldownIn");
        attempt += 1;
        continue;
      } finally {
        if (activeRequest === controller) activeRequest = null;
      }

      const rate = readRateHeaders(response.headers);
      if (rate.remaining != null) state.rateLimits[key] = rate;

      const body = await response.text();
      let json = null;
      try { json = JSON.parse(body); } catch { }
      const codes = errorCodes(json);
      const message = errorMessage(json, body);
      const has = (list) => codes.some((code) => list.includes(code));

      if (response.status === 429 || has(ERROR_CODES.rate)) {
        const resetAt = rate.resetAt || Date.now() + 5 * 60 * 1000;
        if (rateRetries >= 2) throw xError("rate", t("tooManyRequests"), response.status, message, { retryAfter: resetAt });
        state.rateLimits[key] = { remaining: 0, resetAt };
        rateRetries += 1;
        continue;
      }
      if (response.status === 401 || has(ERROR_CODES.session)) {
        throw xError("session", t("sessionExpired"), response.status, message);
      }
      if (response.status === 403 || has(ERROR_CODES.blocked)) {
        throw xError("blocked", t("scanBlocked"), response.status, message);
      }
      if (response.status === 400 && missingFeatures(message).length) {
        throw xError("features", t("apiChanged"), 400, message, { features: missingFeatures(message) });
      }
      if (response.status === 404) {
        throw xError("api", t("apiChanged"), 404, message);
      }
      if (response.status >= 500) {
        if (attempt >= MAX_RETRIES) throw xError("http", t("requestFailed", { status: response.status }), response.status, message);
        await sleepWithCountdown(Math.min(60000, 5000 * Math.pow(2, attempt)), "cooldownIn");
        attempt += 1;
        continue;
      }
      if (!response.ok) throw xError("http", t("requestFailed", { status: response.status }), response.status, message);
      if (!json || typeof json !== "object") throw xError("session", t("sessionExpired"), response.status, "non-JSON reply");
      if (json.errors && !json.data) throw xError("http", t("scanFailed"), response.status, message);
      return json;
    }
  }

  function timelineUrl(op, userId, cursor, count) {
    const def = state.api.ops[op];
    const variables = { userId: String(userId), count, includePromotedContent: false };
    if (cursor) variables.cursor = cursor;
    let url = `${location.origin}/i/api/graphql/${def.queryId}/${op}?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(def.features))}`;
    if (def.fieldToggles) url += `&fieldToggles=${encodeURIComponent(JSON.stringify(def.fieldToggles))}`;
    return url;
  }

  async function fetchTimelinePage(op, userId, cursor) {
    const count = Math.min(100, Math.max(1, Math.round(state.timings.usersPerRequest)));
    for (let tries = 0; ; tries += 1) {
      try {
        return parseTimeline(await xFetch(timelineUrl(op, userId, cursor, count), {}, op));
      } catch (error) {
        if (error?.kind !== "features" || tries >= 3) throw error;
        for (const name of error.features) state.api.ops[op].features[name] = false;
        console.warn("[xu] added missing features:", error.features.join(", "));
      }
    }
  }

  // ---------- response parsing ----------

  function parseTimeline(json) {
    const instructions = json?.data?.user?.result?.timeline?.timeline?.instructions
      || json?.data?.user?.result?.timeline_v2?.timeline?.instructions;
    if (!Array.isArray(instructions)) {
      throw xError("format", t("apiChanged"), 200, `no timeline in reply (${Object.keys(json?.data?.user?.result || json?.data || json || {}).join(", ").slice(0, 80)})`);
    }
    const users = [];
    let nextCursor = "";
    const visit = (entry) => {
      const content = entry?.content;
      if (!content) return;
      if (content.cursorType === "Bottom" || /^cursor-bottom/.test(entry.entryId || "")) {
        nextCursor = String(content.value || "");
        return;
      }
      const result = content.itemContent?.user_results?.result;
      if (result) {
        const user = normalizeUser(result);
        if (user.id && user.username) users.push(user);
      }
      if (Array.isArray(content.items)) {
        for (const item of content.items) visit({ entryId: item.entryId, content: item.item });
      }
    };
    for (const instruction of instructions) {
      if (Array.isArray(instruction?.entries)) instruction.entries.forEach(visit);
      if (instruction?.entry) visit(instruction.entry);
    }
    return { users, nextCursor };
  }

  // Returns rel: true/false when X said whether this user follows you, null when unknown.
  function normalizeUser(raw) {
    const result = raw?.__typename === "UserWithVisibilityResults" ? raw.user : raw;
    if (!result || result.__typename === "UserUnavailable") return { id: "", username: "" };
    const legacy = result.legacy || {};
    const core = result.core || {};
    const perspectives = result.relationship_perspectives;
    let rel = null;
    if (perspectives && typeof perspectives === "object") rel = Boolean(perspectives.followed_by);
    else if (typeof legacy.followed_by === "boolean") rel = legacy.followed_by;
    else if (typeof legacy.following === "boolean") rel = false;
    return {
      id: String(result.rest_id || legacy.id_str || ""),
      username: String(core.screen_name || legacy.screen_name || ""),
      full_name: String(core.name || legacy.name || ""),
      profile_pic_url: String(result.avatar?.image_url || legacy.profile_image_url_https || ""),
      is_verified: Boolean(result.is_blue_verified || result.verification?.verified || legacy.verified),
      is_protected: Boolean(result.privacy?.protected ?? legacy.protected),
      rel
    };
  }

  function dedupe(list) {
    const seen = new Set();
    return list.filter((u) => {
      if (!u.id || seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
  }

  function addFollowBackStatus(following, followerIds) {
    const followers = followerIds ? new Set(followerIds.map(String)) : null;
    return following.map((user) => ({
      ...user,
      follows_viewer: user.rel != null ? user.rel : followers ? followers.has(String(user.id)) : null
    }));
  }

  // If no one in the list is marked as following you, X probably left the field out
  // rather than you having zero mutuals, so the per-user value is not trusted.
  function relationshipTrusted(following) {
    return following.some((u) => u.rel === true);
  }

  function usersFromCheckpoint(checkpoint) {
    const trusted = relationshipTrusted(checkpoint.following);
    const following = trusted ? checkpoint.following : checkpoint.following.map((u) => ({ ...u, rel: null }));
    return addFollowBackStatus(following, checkpoint.followersDone ? checkpoint.followerIds : null);
  }

  function isDefaultAvatar(user) {
    return !user.profile_pic_url || /default_profile_images/.test(user.profile_pic_url);
  }

  function evaluateUnfollowResponse(status, bodyText) {
    let payload = null;
    try { payload = JSON.parse(bodyText || ""); } catch { }
    const codes = errorCodes(payload);
    const message = errorMessage(payload, bodyText);
    const has = (list) => codes.some((code) => list.includes(code));
    if (status === 401 || status === 403 || status === 429 || has(ERROR_CODES.rate) || has(ERROR_CODES.session) || has(ERROR_CODES.blocked)) {
      return { ok: false, blocked: true, reason: message || `HTTP ${status}` };
    }
    if (status < 200 || status >= 300) return { ok: false, blocked: false, reason: message || `HTTP ${status}` };
    if (!payload || codes.length) return { ok: false, blocked: false, reason: message || "unexpected response" };
    if (!payload.id_str && !payload.id) return { ok: false, blocked: false, reason: "unexpected response" };
    return { ok: true, blocked: false, reason: "" };
  }

  // ---------- mount / unmount ----------

  function cleanupExisting() {
    document.dispatchEvent(new Event(CLEANUP_EVENT));
    if (typeof window.__xuCleanup === "function") {
      try { window.__xuCleanup(); } catch { }
    }
    document.getElementById(APP_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function mount() {
    const root = document.createElement("div");
    root.id = APP_ID;
    document.body.appendChild(root);
    window.__xuCleanup = unmount;
    document.addEventListener(CLEANUP_EVENT, unmount);
    document.addEventListener("visibilitychange", onVisibilityChange);
    renderShell();
  }

  function unmount() {
    if (destroyed) return;
    destroyed = true;
    state.scanCancelled = true;
    state.unfollowCancelled = true;
    state.scanPaused = false;
    state.unfollowPaused = false;
    activeRequest?.abort();
    wakeUp();
    stopCountdown();
    document.removeEventListener(CLEANUP_EVENT, unmount);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    closeActiveDialog?.();
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    document.getElementById(APP_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    if (window.__xuCleanup === unmount) window.__xuCleanup = null;
  }

  // ---------- shell ----------

  function renderShell() {
    const root = document.getElementById(APP_ID);
    if (!root) return;
    if (state.minimized) {
      root.innerHTML = `
        <button class="xu-pill" data-action="expand" type="button" aria-label="${escapeAttr(t("expand"))}">
          <span class="xu-pill-dot ${pillStateClass()}"></span>
          <span data-pill-label>${escapeHTML(pillLabel())}</span>
        </button>`;
      root.querySelector("[data-action='expand']")?.addEventListener("click", () => setMinimized(false));
      applyPanelPosition();
      return;
    }
    root.innerHTML = `
      <section class="xu-panel" role="dialog" aria-label="${escapeAttr(t("title"))}">
        <header class="xu-header" data-drag>
          <div class="xu-brand">
            <span class="xu-brand-mark" aria-hidden="true">𝕏</span>
            <div class="xu-brand-text">
              <strong>${escapeHTML(t("title"))}</strong>
              <span>v${VERSION} · ${escapeHTML(t("subtitle"))}</span>
            </div>
          </div>
          <div class="xu-header-actions">
            <button type="button" data-action="settings" aria-label="${escapeAttr(t("settings"))}" title="${escapeAttr(t("settings"))}">${SVG.gear}</button>
            <button type="button" data-action="language" aria-label="${escapeAttr(t("langSwitch"))}" title="${escapeAttr(t("langSwitch"))}"><span aria-hidden="true">${escapeHTML(t("langCode"))}</span></button>
            <button type="button" data-action="minimize" aria-label="${escapeAttr(t("minimize"))}" title="${escapeAttr(t("minimize"))}">${SVG.minimize}</button>
            <button type="button" data-action="close" aria-label="${escapeAttr(t("close"))}" title="${escapeAttr(t("close"))}">${SVG.close}</button>
          </div>
        </header>
        <div class="xu-body" data-body></div>
      </section>`;
    root.querySelector("[data-action='close']")?.addEventListener("click", () => unmount());
    root.querySelector("[data-action='minimize']")?.addEventListener("click", () => setMinimized(true));
    root.querySelector("[data-action='settings']")?.addEventListener("click", showSettings);
    root.querySelector("[data-action='language']")?.addEventListener("click", toggleLanguage);
    bindDrag(root.querySelector("[data-drag]"));
    applyPanelPosition();
    renderBody();
  }

  function applyPanelPosition() {
    const root = document.getElementById(APP_ID);
    if (!root) return;
    const node = root.querySelector(".xu-panel") || root.querySelector(".xu-pill");
    if (!node) return;
    const pos = state.panelPos;
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      const max = panelBounds(node);
      node.style.left = clamp(pos.x, 0, max.x) + "px";
      node.style.top = clamp(pos.y, 0, max.y) + "px";
      node.style.right = "auto";
      node.style.bottom = "auto";
    } else {
      node.style.left = "auto";
      node.style.top = "auto";
      node.style.right = PANEL_MARGIN + "px";
      node.style.bottom = PANEL_MARGIN + "px";
    }
  }

  function panelBounds(node) {
    const rect = node.getBoundingClientRect();
    return { x: Math.max(0, window.innerWidth - rect.width), y: Math.max(0, window.innerHeight - rect.height) };
  }

  function bindDrag(handle) {
    if (!handle) return;
    const panel = handle.closest(".xu-panel");
    if (!panel) return;
    let startX = 0, startY = 0, originX = 0, originY = 0, dragging = false;
    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      startX = event.clientX;
      startY = event.clientY;
      panel.style.left = originX + "px";
      panel.style.top = originY + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      handle.setPointerCapture(event.pointerId);
      handle.classList.add("xu-dragging");
    });
    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const max = panelBounds(panel);
      panel.style.left = clamp(originX + (event.clientX - startX), 0, max.x) + "px";
      panel.style.top = clamp(originY + (event.clientY - startY), 0, max.y) + "px";
    });
    const stop = (event) => {
      if (!dragging) return;
      dragging = false;
      handle.releasePointerCapture?.(event.pointerId);
      handle.classList.remove("xu-dragging");
      const rect = panel.getBoundingClientRect();
      state.panelPos = { x: rect.left, y: rect.top };
      persist();
    };
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  function setMinimized(value) {
    state.minimized = Boolean(value);
    persist();
    renderShell();
  }

  function pillLabel() {
    if (state.mode === "scanning") {
      return t("pillScanning", { current: formatCount(state.progress.current), total: state.progress.total ? formatCount(state.progress.total) : "?" });
    }
    if (state.mode === "unfollowing") return t("pillUnfollowing", { current: state.progress.current, total: state.progress.total });
    if (state.mode === "results" && state.users.length) return t("pillResults", { count: liveUsers().length });
    return t("pillIdle");
  }

  function pillStateClass() {
    if (state.mode === "scanning" || state.mode === "unfollowing") return "xu-pill-dot--active";
    if (state.error) return "xu-pill-dot--error";
    return "";
  }

  function toggleLanguage() {
    state.language = state.language === "tr" ? "en" : "tr";
    persist();
    renderShell();
  }

  // ---------- views ----------

  function renderBody() {
    const body = document.querySelector(`#${APP_ID} [data-body]`);
    if (!body) return;
    if (state.mode === "scanning") {
      body.innerHTML = renderScanView();
      bindScan(body);
    } else if (state.mode === "results") {
      body.innerHTML = renderResultsView();
      bindResults(body);
    } else if (state.mode === "unfollowing" || state.mode === "unfollowDone") {
      body.innerHTML = renderUnfollowView();
      bindUnfollow(body);
    } else {
      body.innerHTML = renderIdleView();
      bindIdle(body);
    }
    if (state.mode === "scanning" || state.mode === "unfollowing") startCountdown();
    else stopCountdown();
  }

  function renderIdleView() {
    const checkpoint = state.checkpoint;
    const resumeActions = checkpoint ? `
      <div class="xu-welcome-actions">
        <button type="button" class="xu-btn xu-btn--primary xu-btn--lg" data-action="resume-scan">${escapeHTML(t("resumeScan"))}</button>
        <button type="button" class="xu-btn xu-btn--ghost" data-action="restart-scan">${escapeHTML(t("startOver"))}</button>
      </div>` : "";
    if (state.error) {
      return `
        <div class="xu-welcome">
          <div class="xu-welcome-icon xu-welcome-icon--error">${SVG.alert}</div>
          <h2>${escapeHTML(t("scanFailed"))}</h2>
          <p>${escapeHTML(state.error)}</p>
          ${state.errorDetail ? `<p class="xu-detail">${escapeHTML(state.errorDetail)}</p>` : ""}
          ${checkpoint ? resumeActions : `<button type="button" class="xu-btn xu-btn--primary" data-action="scan">${escapeHTML(t("retry"))}</button>`}
        </div>`;
    }
    if (checkpoint) {
      return `
        <div class="xu-welcome">
          <div class="xu-welcome-icon">${SVG.sparkle}</div>
          <h2>${escapeHTML(t("welcomeTitle"))}</h2>
          <p>${escapeHTML(t("resumeHint"))}</p>
          ${checkpoint.stopReason ? `<p>${escapeHTML(checkpoint.stopReason)}</p>` : ""}
          ${checkpoint.stopDetail ? `<p class="xu-detail">${escapeHTML(checkpoint.stopDetail)}</p>` : ""}
          ${resumeActions}
        </div>`;
    }
    const last = loadLastScan();
    return `
      <div class="xu-welcome">
        <div class="xu-welcome-icon">${SVG.sparkle}</div>
        <h2>${escapeHTML(t("welcomeTitle"))}</h2>
        <p>${escapeHTML(t("welcomeBody"))}</p>
        <p>${escapeHTML(t("scanNotice"))}</p>
        <div class="xu-welcome-actions">
          <button type="button" class="xu-btn xu-btn--primary xu-btn--lg" data-action="scan">${escapeHTML(t("scanBtn"))}</button>
          ${last ? `<button type="button" class="xu-btn xu-btn--ghost" data-action="show-last">${escapeHTML(t("showLastScan", { count: formatCount(last.users.length), age: timeAgo(last.savedAt) }))}</button>` : ""}
        </div>
      </div>`;
  }

  function bindIdle(body) {
    body.querySelector("[data-action='scan']")?.addEventListener("click", () => startScan());
    body.querySelector("[data-action='show-last']")?.addEventListener("click", showLastScan);
    bindScanResume(body);
  }

  function bindScanResume(body) {
    body.querySelector("[data-action='resume-scan']")?.addEventListener("click", () => startScan({ resume: true }));
    body.querySelector("[data-action='restart-scan']")?.addEventListener("click", () => {
      clearCheckpoint();
      startScan();
    });
  }

  function renderBar(percent, valueText, known) {
    const now = known ? ` aria-valuenow="${percent}"` : "";
    return `
      <div class="xu-bar" role="progressbar" aria-labelledby="${PROGRESS_TITLE_ID}" aria-valuemin="0" aria-valuemax="100"${now} aria-valuetext="${escapeAttr(valueText)}" data-bar>
        <span data-progress-bar style="width:${percent}%"></span>
      </div>`;
  }

  function renderScanView() {
    const { current, total, label, note } = state.progress;
    const percent = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
    const counter = progressCounter(current, total);
    return `
      <div class="xu-results">
        <div class="xu-progress">
          <div class="xu-progress-head">
            <h2 id="${PROGRESS_TITLE_ID}" data-progress-label>${escapeHTML(state.scanPaused ? t("paused") : t(label))}</h2>
            <p data-progress-note>${escapeHTML(note)}</p>
          </div>
          ${renderBar(percent, counter, Boolean(total))}
          <div class="xu-progress-meta">
            <span data-progress-counter>${escapeHTML(counter)}</span>
            <span data-countdown class="xu-muted"></span>
          </div>
          <div class="xu-progress-actions">
            <button type="button" class="xu-btn" data-action="pause-scan">${escapeHTML(t(state.scanPaused ? "resume" : "pause"))}</button>
            <button type="button" class="xu-btn xu-btn--ghost" data-action="cancel-scan">${escapeHTML(t("cancel"))}</button>
          </div>
        </div>
        ${renderLiveResults()}
      </div>`;
  }

  function liveUsers() {
    return state.users.filter((u) => u.follows_viewer === false && !state.hidden.has(u.id));
  }

  function renderLiveResults() {
    const found = liveUsers();
    if (!found.length && state.progress.label === "loadingApi") {
      return `<div class="xu-results-summary">${escapeHTML(t("liveWaiting"))}</div>`;
    }
    return `
      <div class="xu-results-summary"><strong data-live-count>${escapeHTML(t("liveFound", { count: formatCount(found.length) }))}</strong> · ${escapeHTML(t("liveHint"))}</div>
      <div class="xu-list" data-live-list>${found.map(renderUserRow).join("")}</div>`;
  }

  function updateLiveResults() {
    const list = document.querySelector(`#${APP_ID} [data-live-list]`);
    if (!list) return renderBody();
    const found = liveUsers();
    const shownIds = new Set([...list.querySelectorAll("[data-row]")].map((row) => row.getAttribute("data-row")));
    const fresh = found.filter((u) => !shownIds.has(u.id));
    if (fresh.length) list.insertAdjacentHTML("beforeend", fresh.map(renderUserRow).join(""));
    const count = document.querySelector(`#${APP_ID} [data-live-count]`);
    if (count) count.textContent = t("liveFound", { count: formatCount(found.length) });
  }

  function bindScan(body) {
    bindRows(body);
    body.querySelector("[data-action='pause-scan']")?.addEventListener("click", () => {
      state.scanPaused = !state.scanPaused;
      const btn = body.querySelector("[data-action='pause-scan']");
      if (btn) btn.textContent = t(state.scanPaused ? "resume" : "pause");
      const label = body.querySelector("[data-progress-label]");
      if (label) label.textContent = state.scanPaused ? t("paused") : t(state.progress.label);
      wakeUp();
    });
    body.querySelector("[data-action='cancel-scan']")?.addEventListener("click", () => {
      state.scanCancelled = true;
      state.scanPaused = false;
      activeRequest?.abort();
      wakeUp();
    });
  }

  function renderPartialNotice() {
    const checkpoint = state.checkpoint;
    if (!state.partial || !checkpoint) return "";
    return `
      <div class="xu-notice" role="status">
        <strong>${escapeHTML(t("partialTitle"))}</strong>
        <p>${escapeHTML(t("partialBody", { loaded: formatCount(checkpoint.following.length) }))}</p>
        ${checkpoint.stopReason ? `<p class="xu-notice-reason">${escapeHTML(checkpoint.stopReason)}</p>` : ""}
        ${checkpoint.stopDetail ? `<p class="xu-detail">${escapeHTML(checkpoint.stopDetail)}</p>` : ""}
        <div class="xu-notice-actions">
          <button type="button" class="xu-btn xu-btn--primary xu-btn--small" data-action="resume-scan">${escapeHTML(t("resumeScan"))}</button>
          <button type="button" class="xu-btn xu-btn--ghost xu-btn--small" data-action="restart-scan">${escapeHTML(t("startOver"))}</button>
        </div>
      </div>`;
  }

  function renderResultsView() {
    const display = getDisplayUsers();
    const total = liveUsers().length;
    const allSelected = display.length > 0 && display.every((u) => state.selected.has(u.id));
    const summary = total === 0 ? t("foundNone") : total === 1 ? t("foundOne") : t("foundCount", { count: formatCount(total) });
    return `
      <div class="xu-results">
        ${renderPartialNotice()}
        ${state.unverified ? `<div class="xu-notice" role="status"><p>${escapeHTML(state.unverified)}</p></div>` : ""}
        ${state.coverage ? `<div class="xu-notice" role="status"><p>${escapeHTML(state.coverage)}</p>
          <div class="xu-notice-actions"><button type="button" class="xu-btn xu-btn--small" data-action="scan">${escapeHTML(t("rescan"))}</button></div></div>` : ""}
        <div class="xu-results-summary">${escapeHTML(summary)}</div>
        <div class="xu-search-row">
          <input class="xu-search" type="search" data-search placeholder="${escapeAttr(t("search"))}" value="${escapeAttr(state.search)}" autocomplete="off" spellcheck="false">
        </div>
        <div class="xu-filters">
          ${filterChip("verified", t("filterVerified"))}
          ${filterChip("protected", t("filterProtected"))}
          ${filterChip("noAvatar", t("filterNoAvatar"))}
          ${filterChip("showHidden", t("filterShowHidden"), state.hidden.size > 0 || state.filters.showHidden)}
        </div>
        <div class="xu-list" data-list>${renderUserList(display)}</div>
        <div class="xu-actionbar">
          <div class="xu-actionbar-left">
            <button type="button" class="xu-btn xu-btn--small" data-action="select-all" ${display.length ? "" : "disabled"}>${escapeHTML(allSelected ? t("selectNone") : t("selectAll"))}</button>
            <span class="xu-muted" data-selected-label>${escapeHTML(t("selectedCount", { count: state.selected.size }))}</span>
          </div>
          <div class="xu-actionbar-right">
            <button type="button" class="xu-btn xu-btn--small" data-action="copy" ${display.length ? "" : "disabled"}>${escapeHTML(state.selected.size ? t("copy") : t("copyAll"))}</button>
            <button type="button" class="xu-btn xu-btn--danger xu-btn--small" data-action="unfollow" ${canUnfollow() ? "" : "disabled"}>${escapeHTML(unfollowLabel())}</button>
          </div>
        </div>
      </div>`;
  }

  function canUnfollow() {
    return state.selected.size > 0 && !state.unverified;
  }

  function unfollowLabel() {
    return t("unfollow") + (state.selected.size ? " (" + state.selected.size + ")" : "");
  }

  function filterChip(key, label, visible = true) {
    if (!visible) return "";
    const active = state.filters[key];
    return `
      <button type="button" class="xu-chip ${active ? "xu-chip--on" : ""}" data-filter="${escapeAttr(key)}" aria-pressed="${active ? "true" : "false"}">
        <span class="xu-chip-tick">${active ? SVG.check : ""}</span>${escapeHTML(label)}
      </button>`;
  }

  function renderUserList(display) {
    if (!display.length) return `<div class="xu-list-empty">${escapeHTML(t("noMatches"))}</div>`;
    return display.map(renderUserRow).join("");
  }

  function profileUrl(user) {
    return `https://x.com/${encodeURIComponent(user.username)}`;
  }

  function renderUserRow(user) {
    const hidden = state.hidden.has(user.id);
    const checked = state.selected.has(user.id);
    const tags = [];
    if (user.is_verified) tags.push(`<span class="xu-tag xu-tag--blue">${escapeHTML(t("filterVerified"))}</span>`);
    if (user.is_protected) tags.push(`<span class="xu-tag">${escapeHTML(t("filterProtected"))}</span>`);
    return `
      <div class="xu-row ${hidden ? "xu-row--hidden" : ""} ${checked ? "xu-row--selected" : ""}" data-row="${escapeAttr(user.id)}" role="button" tabindex="0">
        <input type="checkbox" class="xu-row-check" data-select="${escapeAttr(user.id)}" ${checked ? "checked" : ""} aria-label="${escapeAttr(user.username)}">
        <img class="xu-avatar" src="${escapeAttr(user.profile_pic_url || "")}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
        <div class="xu-row-text">
          <div class="xu-row-name">
            <a href="${escapeAttr(profileUrl(user))}" target="_blank" rel="noopener noreferrer" data-stop>@${escapeHTML(user.username)}</a>
            ${tags.join(" ")}
          </div>
          <div class="xu-row-sub">${escapeHTML(user.full_name || "")}</div>
        </div>
        <div class="xu-row-actions">
          <a class="xu-icon-btn" href="${escapeAttr(profileUrl(user))}" target="_blank" rel="noopener noreferrer" data-stop title="${escapeAttr(t("openProfile"))}" aria-label="${escapeAttr(t("openProfile"))}">${SVG.open}</a>
          <button type="button" class="xu-icon-btn xu-text-btn" data-hide="${escapeAttr(user.id)}" data-stop title="${escapeAttr(hidden ? t("unhideTooltip") : t("hideTooltip"))}">${escapeHTML(hidden ? t("unhide") : t("hide"))}</button>
        </div>
      </div>`;
  }

  function bindResults(body) {
    body.querySelector("[data-search]")?.addEventListener("input", (event) => {
      state.search = event.target.value;
      const list = body.querySelector("[data-list]");
      if (list) list.innerHTML = renderUserList(getDisplayUsers());
      updateActionBar(body);
    });
    body.querySelectorAll("[data-filter]").forEach((el) => {
      el.addEventListener("click", () => {
        const key = el.getAttribute("data-filter");
        state.filters[key] = !state.filters[key];
        pruneSelectionToDisplayed();
        persist();
        renderBody();
      });
    });
    bindRows(body);
    body.querySelector("[data-action='select-all']")?.addEventListener("click", () => {
      const display = getDisplayUsers();
      const allSelected = display.length && display.every((u) => state.selected.has(u.id));
      if (allSelected) display.forEach((u) => state.selected.delete(u.id));
      else display.forEach((u) => state.selected.add(u.id));
      renderBody();
    });
    body.querySelector("[data-action='copy']")?.addEventListener("click", copyUsernames);
    body.querySelector("[data-action='unfollow']")?.addEventListener("click", confirmUnfollow);
    body.querySelector("[data-action='scan']")?.addEventListener("click", () => startScan());
    bindScanResume(body);
  }

  function bindRows(body) {
    if (body.xuRowsBound) return;
    body.xuRowsBound = true;
    body.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-select]");
      if (!checkbox) return;
      const id = checkbox.getAttribute("data-select");
      if (checkbox.checked) state.selected.add(id);
      else state.selected.delete(id);
      checkbox.closest("[data-row]")?.classList.toggle("xu-row--selected", checkbox.checked);
      updateActionBar(body);
    });
    body.addEventListener("click", (event) => {
      const hideBtn = event.target.closest("[data-hide]");
      if (hideBtn) {
        event.preventDefault();
        event.stopPropagation();
        const id = hideBtn.getAttribute("data-hide");
        if (state.hidden.has(id)) state.hidden.delete(id);
        else {
          state.hidden.add(id);
          state.selected.delete(id);
        }
        persist();
        renderBody();
        return;
      }
      if (event.target.closest("[data-stop]")) {
        event.stopPropagation();
        return;
      }
      const row = event.target.closest("[data-row]");
      if (!row || event.target.closest(".xu-row-check")) return;
      const id = row.getAttribute("data-row");
      const checkbox = row.querySelector("[data-select]");
      if (!checkbox) return;
      if (state.selected.has(id)) state.selected.delete(id);
      else state.selected.add(id);
      checkbox.checked = state.selected.has(id);
      row.classList.toggle("xu-row--selected", checkbox.checked);
      updateActionBar(body);
    });
    body.addEventListener("keydown", (event) => {
      if (event.key !== " " && event.key !== "Enter") return;
      const row = event.target.closest("[data-row]");
      if (!row || ["INPUT", "A", "BUTTON"].includes(event.target.tagName)) return;
      event.preventDefault();
      row.click();
    });
  }

  function updateActionBar(body) {
    const root = body || document.querySelector(`#${APP_ID} [data-body]`);
    if (!root) return;
    const display = getDisplayUsers();
    const allSelected = display.length > 0 && display.every((u) => state.selected.has(u.id));
    const selectAllBtn = root.querySelector("[data-action='select-all']");
    if (selectAllBtn) {
      selectAllBtn.disabled = display.length === 0;
      selectAllBtn.textContent = allSelected ? t("selectNone") : t("selectAll");
    }
    const copyBtn = root.querySelector("[data-action='copy']");
    if (copyBtn) {
      copyBtn.disabled = display.length === 0;
      copyBtn.textContent = state.selected.size ? t("copy") : t("copyAll");
    }
    const label = root.querySelector("[data-selected-label]");
    if (label) label.textContent = t("selectedCount", { count: state.selected.size });
    const unfollowBtn = root.querySelector("[data-action='unfollow']");
    if (unfollowBtn) {
      unfollowBtn.disabled = !canUnfollow();
      unfollowBtn.textContent = unfollowLabel();
    }
  }

  function renderUnfollowView() {
    const { current: done, total } = state.progress;
    const percent = total ? Math.round((done / total) * 100) : 0;
    const last = state.log[state.log.length - 1];
    const summary = unfollowSummary();
    return `
      <div class="xu-progress">
        <div class="xu-progress-head">
          <h2 id="${PROGRESS_TITLE_ID}" data-progress-label>${escapeHTML(unfollowTitle())}</h2>
          <p data-progress-note>${escapeHTML(state.progress.note || "")}</p>
        </div>
        ${renderBar(percent, summary, Boolean(total))}
        <div class="xu-progress-meta">
          <span data-progress-counter>${escapeHTML(summary)}</span>
          <span data-countdown class="xu-muted"></span>
        </div>
        <div class="xu-current" data-current ${last ? "" : "hidden"}>
          <span class="xu-muted">${escapeHTML(t("currently"))}</span>
          <strong data-current-user>${last ? "@" + escapeHTML(last.user.username) : ""}</strong>
          <span class="xu-tag ${last && !last.ok ? "xu-tag--red" : "xu-tag--green"}" data-current-tag title="${escapeAttr(last?.reason || "")}">${last && !last.ok ? "✕" : "✓"}</span>
        </div>
        ${state.unfollowBlocked ? `<div class="xu-blocked">${escapeHTML(t("unfollowBlocked", { count: state.unfollowBlocked }))}</div>` : ""}
        <div class="xu-progress-actions">
          ${state.mode === "unfollowing" ? `
            <button type="button" class="xu-btn" data-action="pause-unfollow">${escapeHTML(t(state.unfollowPaused ? "resume" : "pause"))}</button>
            <button type="button" class="xu-btn xu-btn--ghost" data-action="cancel-unfollow">${escapeHTML(t("cancel"))}</button>
          ` : `
            <button type="button" class="xu-btn xu-btn--primary" data-action="back-results">${escapeHTML(t("goBack"))}</button>
          `}
        </div>
      </div>`;
  }

  function unfollowTitle() {
    if (state.mode === "unfollowDone") return t("unfollowDoneTitle");
    return state.unfollowPaused ? t("paused") : t("unfollowing");
  }

  function unfollowSummary() {
    if (state.mode === "unfollowDone") {
      return t("unfollowDoneBody", { ok: state.log.filter((e) => e.ok).length, fail: state.log.filter((e) => !e.ok).length });
    }
    return t("ofTotal", { current: state.progress.current, total: state.progress.total });
  }

  function bindUnfollow(body) {
    body.querySelector("[data-action='pause-unfollow']")?.addEventListener("click", () => {
      state.unfollowPaused = !state.unfollowPaused;
      const btn = body.querySelector("[data-action='pause-unfollow']");
      if (btn) btn.textContent = t(state.unfollowPaused ? "resume" : "pause");
      const label = body.querySelector("[data-progress-label]");
      if (label) label.textContent = unfollowTitle();
      wakeUp();
    });
    body.querySelector("[data-action='cancel-unfollow']")?.addEventListener("click", () => {
      state.unfollowCancelled = true;
      state.unfollowPaused = false;
      wakeUp();
    });
    body.querySelector("[data-action='back-results']")?.addEventListener("click", () => {
      state.mode = "results";
      state.log = [];
      state.unfollowCancelled = false;
      renderBody();
    });
  }

  // ---------- scan ----------

  async function startScan(options = {}) {
    if (destroyed || state.mode === "scanning" || state.mode === "unfollowing") return;
    if (options.resume && state.checkpoint?.retryAfter > Date.now()) {
      state.error = t("resumeAfter", { time: clockTime(state.checkpoint.retryAfter) });
      state.mode = "idle";
      return renderBody();
    }
    Object.assign(state, {
      error: "", errorDetail: "", unverified: "", mode: "scanning",
      scanPaused: false, scanCancelled: false, unfollowCancelled: false,
      partial: false, coverage: "", users: [], log: []
    });
    state.selected.clear();
    state.progress = { current: 0, total: 0, label: "loadingApi", note: visibilityNote() };
    let checkpoint = null;
    try {
      const viewerId = getViewerId();
      if (!viewerId) throw xError("session", t("cookieMissing"));
      const previous = options.resume ? state.checkpoint : null;
      checkpoint = previous && previous.viewerId === String(viewerId) ? previous : createCheckpoint(viewerId);
      checkpoint.stopReason = "";
      checkpoint.stopDetail = "";
      checkpoint.retryAfter = 0;
      state.checkpoint = checkpoint;
      state.users = usersFromCheckpoint(checkpoint);
      renderBody();

      await discoverApi();
      if (state.scanCancelled || destroyed) return stopScan(checkpoint);
      const counts = profileCounts(viewerId);

      if (!checkpoint.followingDone) {
        await scanList(checkpoint, viewerId, "Following", counts.following);
        if (state.scanCancelled || destroyed) return stopScan(checkpoint);
        checkpoint.followingCursor = "";
        checkpoint.followingDone = true;
        checkpoint.needFollowers = !relationshipTrusted(checkpoint.following) || checkpoint.following.some((u) => u.rel == null);
        saveCheckpoint(checkpoint);
      }

      if (checkpoint.needFollowers && !checkpoint.followersDone) {
        if (!state.api.ops.Followers) throw xError("api", t("apiMissing"), 0, "Followers queryId not found");
        checkpoint.followersTotal = counts.followers;
        await scanList(checkpoint, viewerId, "Followers", counts.followers);
        if (state.scanCancelled || destroyed) return stopScan(checkpoint);
        checkpoint.followersCursor = "";
        checkpoint.followersDone = true;
        const loaded = checkpoint.followerIds.length;
        checkpoint.followersGap = counts.followers > 0 && loaded < counts.followers * 0.9;
        saveCheckpoint(checkpoint);
      }

      showResults(checkpoint, true);
      clearCheckpoint();
    } catch (error) {
      if (destroyed) return;
      if (state.scanCancelled || error?.kind === "cancelled") return stopScan(checkpoint);
      console.error("[xu] scan failed:", error);
      const retryAfter = error?.retryAfter || (COOLDOWN_MS[error?.kind] ? Date.now() + COOLDOWN_MS[error.kind] : 0);
      const message = (error?.message || String(error) || t("scanFailed")) + (retryAfter ? " " + t("resumeAfter", { time: clockTime(retryAfter) }) : "");
      const detail = scanErrorDetail(error, checkpoint);
      state.errorDetail = detail;
      if (checkpoint) {
        checkpoint.stopReason = message;
        checkpoint.stopDetail = detail;
        checkpoint.retryAfter = retryAfter;
        saveCheckpoint(checkpoint);
      }
      if (checkpoint?.following.length) return showResults(checkpoint, false);
      state.error = message;
      state.mode = "idle";
      renderBody();
    }
  }

  function scanErrorDetail(error, checkpoint) {
    const list = checkpoint && `following ${checkpoint.following.length}` + (checkpoint.needFollowers ? ` · followers ${checkpoint.followerIds.length}` : "");
    return [VERSION, list, error?.status ? `HTTP ${error.status}` : "", error?.detail || ""].filter(Boolean).join(" · ");
  }

  function stopScan(checkpoint) {
    if (destroyed) return;
    state.scanCancelled = false;
    if (checkpoint?.following.length) {
      saveCheckpoint(checkpoint);
      return showResults(checkpoint, false);
    }
    state.mode = "idle";
    state.users = [];
    state.error = "";
    renderBody();
  }

  function showResults(checkpoint, complete) {
    state.users = usersFromCheckpoint(checkpoint);
    state.coverage = "";
    state.partial = !complete;
    state.unverified = checkpoint.followersGap
      ? t("gapNotice", { loaded: formatCount(checkpoint.followerIds.length), total: formatCount(checkpoint.followersTotal) })
      : "";
    state.mode = "results";
    if (complete) {
      saveLastScan();
      toast(t("scanCompletedToast", { count: liveUsers().length }));
    }
    renderBody();
  }

  async function scanList(checkpoint, viewerId, op, total) {
    const isFollowing = op === "Following";
    const cursorKey = isFollowing ? "followingCursor" : "followersCursor";
    const label = isFollowing ? "loadingFollowing" : "loadingFollowers";
    const note = () => [isFollowing ? "" : t("followersNeeded"), visibilityNote()].filter(Boolean).join(" ");
    const known = new Set(isFollowing ? checkpoint.following.map((u) => u.id) : checkpoint.followerIds);
    const loadedCount = () => (isFollowing ? checkpoint.following.length : checkpoint.followerIds.length);
    const progress = () => {
      state.progress = { current: loadedCount(), total: Math.max(total || 0, loadedCount()), label, note: note() };
      updateProgressDOM();
    };

    let cursor = checkpoint[cursorKey] || "";
    const seenCursors = new Set(cursor ? [cursor] : []);
    let emptyRun = 0;
    let page = 0;
    progress();

    while (true) {
      if (state.scanPaused) await waitWhile(() => state.scanPaused && !state.scanCancelled);
      if (state.scanCancelled || destroyed) return;

      let pageResult;
      try {
        pageResult = await fetchTimelinePage(op, viewerId, cursor);
      } catch (error) {
        // A saved cursor from an older session can be rejected; restart that list once.
        if (error?.kind !== "http" || error?.status !== 400 || !cursor || page > 0) throw error;
        console.warn(`[xu] stored ${op} cursor was rejected, restarting that list`);
        cursor = "";
        seenCursors.clear();
        if (isFollowing) checkpoint.following = [];
        else checkpoint.followerIds = [];
        known.clear();
        continue;
      }
      if (state.scanCancelled || destroyed) return;

      const { users, nextCursor } = pageResult;
      for (const user of users) {
        if (known.has(user.id)) continue;
        known.add(user.id);
        if (isFollowing) checkpoint.following.push(user);
        else checkpoint.followerIds.push(user.id);
      }
      if (users.length) emptyRun = 0;
      else emptyRun += 1;

      const looped = Boolean(nextCursor) && seenCursors.has(nextCursor);
      const finished = !nextCursor || /^0\|/.test(nextCursor) || looped || emptyRun >= MAX_EMPTY_PAGES;
      checkpoint[cursorKey] = finished ? "" : nextCursor;
      saveCheckpoint(checkpoint);
      if (isFollowing) {
        state.users = usersFromCheckpoint(checkpoint);
        updateLiveResults();
      }
      progress();
      if (finished) return;

      seenCursors.add(nextCursor);
      cursor = nextCursor;
      page += 1;
      await waitBeforeNextScanPage(page);
    }
  }

  async function waitBeforeNextScanPage(page) {
    await sleepWithCountdown(randomBetween(state.timings.scanDelayMin, state.timings.scanDelayMax), "scanPause");
    if (state.timings.scanPauseEveryPages > 0 && page % state.timings.scanPauseEveryPages === 0) {
      const jitter = Math.random() * SCAN_PAUSE_JITTER_MS * 2 - SCAN_PAUSE_JITTER_MS;
      await sleepWithCountdown(Math.max(0, state.timings.scanPauseMs + jitter), "scanPause");
    }
  }

  // ---------- unfollow ----------

  function confirmUnfollow() {
    if (destroyed || !canUnfollow()) return;
    const count = state.selected.size;
    showDialog({
      title: t("unfollowConfirmTitle", { count }),
      body: t("unfollowConfirmBody"),
      confirmLabel: t("unfollowConfirmBtn", { count }),
      destructive: true,
      onConfirm: () => startUnfollow()
    });
  }

  async function startUnfollow() {
    if (destroyed || !canUnfollow() || state.mode === "scanning" || state.mode === "unfollowing") return;
    const targets = state.users.filter((u) => u.follows_viewer === false && state.selected.has(u.id));
    if (!targets.length) return;
    if (!getCookie("ct0")) return toast(t("csrfMissing"));

    state.mode = "unfollowing";
    state.unfollowPaused = false;
    state.unfollowCancelled = false;
    state.unfollowBlocked = 0;
    state.log = [];
    state.progress = { current: 0, total: targets.length, label: "unfollowing", note: "" };
    renderBody();

    for (let i = 0; i < targets.length; i += 1) {
      await waitWhile(() => state.unfollowPaused && !state.unfollowCancelled);
      if (state.unfollowCancelled || destroyed) break;
      const user = targets[i];
      let outcome;
      try {
        outcome = await unfollowUser(user);
      } catch (error) {
        console.error("[xu] unfollow failed for", user.username, error);
        outcome = { ok: false, blocked: false, reason: error?.message || "" };
      }
      if (destroyed) return;
      state.log.push({ user, ok: outcome.ok, reason: outcome.reason });
      if (outcome.ok) {
        state.selected.delete(user.id);
        user.unfollowed = true;
        const ref = state.users.find((u) => u.id === user.id);
        if (ref) ref.unfollowed = true;
      }
      state.progress = { current: i + 1, total: targets.length, label: "unfollowing", note: outcome.ok ? "" : outcome.reason };
      updateUnfollowDOM();
      if (outcome.blocked) {
        state.unfollowBlocked = targets.length - (i + 1);
        console.warn("[xu] X refused the unfollow action:", outcome.reason);
        break;
      }
      if (i < targets.length - 1) {
        await sleepWithCountdown(randomBetween(state.timings.unfollowDelayMin, state.timings.unfollowDelayMax), "nextActionIn");
        if (state.timings.unfollowPauseEvery > 0 && (i + 1) % state.timings.unfollowPauseEvery === 0) {
          await sleepWithCountdown(state.timings.unfollowPauseMs, "cooldownIn");
        }
      }
    }

    state.users = state.users.filter((u) => !u.unfollowed);
    if (state.partial && state.checkpoint) {
      const kept = new Set(state.users.map((u) => u.id));
      state.checkpoint.following = state.checkpoint.following.filter((u) => kept.has(u.id));
      saveCheckpoint(state.checkpoint);
    } else {
      const last = loadLastScan();
      if (last) saveLastScan(last.savedAt);
    }
    state.mode = "unfollowDone";
    state.waitUntil = 0;
    state.waitReason = "";
    renderBody();
  }

  async function unfollowUser(user) {
    if (destroyed || state.unfollowCancelled) return { ok: false, blocked: true, reason: "Cancelled" };
    let response;
    try {
      response = await fetch(`${location.origin}/i/api/1.1/friendships/destroy.json`, {
        method: "POST",
        credentials: "include",
        headers: { ...apiHeaders(), "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ user_id: String(user.id) }).toString()
      });
    } catch (error) {
      return { ok: false, blocked: false, reason: error?.message || "network error" };
    }
    return evaluateUnfollowResponse(response.status, await response.text().catch(() => ""));
  }

  // ---------- misc UI ----------

  async function copyUsernames() {
    const display = getDisplayUsers();
    const target = state.selected.size ? display.filter((u) => state.selected.has(u.id)) : display;
    if (!target.length) return;
    const text = target.map((u) => u.username).sort().join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast(t("copiedToast", { count: target.length }));
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        toast(t("copiedToast", { count: target.length }));
      } catch { }
      ta.remove();
    }
  }

  function showSettings() {
    const fields = [
      ["scanDelayMin", "minScanDelay", 100, 0],
      ["scanDelayMax", "maxScanDelay", 100, 0],
      ["scanPauseEveryPages", "scanPauseEvery", 1, 0],
      ["scanPauseMs", "scanPauseLength", 1000, 0],
      ["usersPerRequest", "usersPerRequest", 1, 1, 100],
      ["unfollowDelayMin", "minUnfollowDelay", 1000, 0],
      ["unfollowDelayMax", "maxUnfollowDelay", 1000, 0],
      ["unfollowPauseEvery", "unfollowPauseEvery", 1, 0],
      ["unfollowPauseMs", "unfollowPauseLength", 1000, 0]
    ];
    const formHTML = fields.map(([key, label, step, min, max]) => `
      <label class="xu-field">
        <span>${escapeHTML(t(label))}</span>
        <input type="number" min="${min}"${max ? ` max="${max}"` : ""} step="${step}" data-setting="${escapeAttr(key)}" value="${Number(state.timings[key])}">
      </label>`).join("");
    showDialog({
      title: t("settingsTitle"),
      body: t("settingsBody"),
      contentHTML: `<div class="xu-form">${formHTML}</div>`,
      confirmLabel: t("save"),
      extraButton: { label: t("restoreDefaults") },
      onConfirm: (dialog) => {
        dialog.querySelectorAll("[data-setting]").forEach((input) => {
          const key = input.getAttribute("data-setting");
          const val = Number(input.value);
          const min = Number(input.min || 0);
          const max = input.max ? Number(input.max) : Infinity;
          if (Number.isFinite(val) && val >= min && val <= max) state.timings[key] = val;
        });
        persist();
        toast(t("saved"));
      },
      onExtra: (dialog) => {
        Object.assign(state.timings, DEFAULT_TIMINGS);
        dialog.querySelectorAll("[data-setting]").forEach((input) => {
          input.value = state.timings[input.getAttribute("data-setting")];
        });
      }
    });
  }

  function showDialog({ title, body, contentHTML, confirmLabel, destructive, extraButton, onConfirm, onExtra }) {
    dialogCounter += 1;
    const titleId = `${APP_ID}-dialog-title-${dialogCounter}`;
    const previouslyFocused = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "xu-overlay";
    overlay.innerHTML = `
      <div class="xu-dialog" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
        <h3 id="${titleId}">${escapeHTML(title)}</h3>
        ${body ? `<p>${escapeHTML(body)}</p>` : ""}
        ${contentHTML || ""}
        <div class="xu-dialog-actions">
          ${extraButton ? `<button type="button" class="xu-btn xu-btn--ghost xu-btn--small" data-extra>${escapeHTML(extraButton.label)}</button>` : ""}
          <button type="button" class="xu-btn xu-btn--small" data-cancel>${escapeHTML(t("cancel"))}</button>
          <button type="button" class="xu-btn xu-btn--small ${destructive ? "xu-btn--danger" : "xu-btn--primary"}" data-confirm>${escapeHTML(confirmLabel)}</button>
        </div>
      </div>`;
    document.getElementById(APP_ID).appendChild(overlay);
    const dialog = overlay.querySelector(".xu-dialog");
    const close = () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (closeActiveDialog === close) closeActiveDialog = null;
      overlay.remove();
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
    const focusables = () => Array.from(dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.disabled && el.getClientRects().length > 0);
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    closeActiveDialog = close;
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-cancel]").addEventListener("click", close);
    overlay.querySelector("[data-confirm]").addEventListener("click", () => {
      try { onConfirm?.(dialog); } finally { close(); }
    });
    if (extraButton && onExtra) overlay.querySelector("[data-extra]").addEventListener("click", () => onExtra(dialog));
    (dialog.querySelector("input") || (destructive ? dialog.querySelector("[data-cancel]") : dialog)).focus();
  }

  function getDisplayUsers() {
    const query = state.search.trim().toLowerCase();
    return state.users
      .filter((u) => u.follows_viewer === false)
      .filter((u) => (state.filters.showHidden ? state.hidden.has(u.id) : !state.hidden.has(u.id)))
      .filter((u) => state.filters.verified || !u.is_verified)
      .filter((u) => state.filters.protected || !u.is_protected)
      .filter((u) => state.filters.noAvatar || !isDefaultAvatar(u))
      .filter((u) => !query || (u.username + " " + (u.full_name || "")).toLowerCase().includes(query))
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  function pruneSelectionToDisplayed() {
    if (!state.selected.size) return;
    const visible = new Set(getDisplayUsers().map((u) => u.id));
    state.selected.forEach((id) => { if (!visible.has(id)) state.selected.delete(id); });
  }

  // ---------- timing ----------

  function interruptibleSleep(ms) {
    return new Promise((resolve) => {
      let timer = null;
      let settled = false;
      const finish = (expired) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (wakeSleep === finish) wakeSleep = null;
        resolve(expired);
      };
      wakeSleep = finish;
      timer = setTimeout(() => finish(true), Math.max(0, ms));
    });
  }

  function wakeUp() {
    if (typeof wakeSleep === "function") wakeSleep(false);
  }

  async function waitWhile(predicate, interval = 1000) {
    while (predicate()) await interruptibleSleep(interval);
  }

  async function sleepWithCountdown(ms, reasonKey) {
    state.waitReason = reasonKey;
    let remaining = Math.max(0, ms);
    while (remaining > 0) {
      if (state.scanCancelled || state.unfollowCancelled || destroyed) break;
      if (state.scanPaused || state.unfollowPaused) {
        state.waitUntil = 0;
        updateCountdownDOM();
        await waitWhile(() => (state.scanPaused || state.unfollowPaused) && !state.scanCancelled && !state.unfollowCancelled);
        continue;
      }
      state.waitUntil = Date.now() + remaining;
      updateCountdownDOM();
      const before = Date.now();
      const expired = await interruptibleSleep(remaining);
      remaining = expired ? 0 : Math.max(0, remaining - (Date.now() - before));
    }
    state.waitUntil = 0;
    state.waitReason = "";
    updateCountdownDOM();
  }

  function visibilityNote() {
    return typeof document !== "undefined" && document.hidden ? t("keepTabVisible") : "";
  }

  function onVisibilityChange() {
    if (state.mode !== "scanning") return;
    state.progress.note = visibilityNote();
    updateProgressDOM();
  }

  function startCountdown() {
    if (!countdownTimer) countdownTimer = setInterval(updateCountdownDOM, 500);
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function updateCountdownDOM() {
    const node = document.querySelector(`#${APP_ID} [data-countdown]`);
    if (!node) return;
    if (!state.waitUntil) {
      node.textContent = "";
      return;
    }
    const ms = Math.max(0, state.waitUntil - Date.now());
    const reason = state.waitReason || "nextActionIn";
    node.textContent = t(reason, { seconds: Math.ceil(ms / 1000), time: formatDuration(ms) });
  }

  function progressCounter(current, total) {
    if (total) return t("ofTotal", { current: formatCount(current), total: formatCount(total) });
    const key = { loadingFollowers: "countFollowers", loadingFollowing: "countFollowing" }[state.progress.label] || "ofUnknown";
    return t(key, { current: formatCount(current) });
  }

  function setBar(root, percent, valueText, known) {
    const bar = root.querySelector("[data-progress-bar]");
    if (bar) bar.style.width = percent + "%";
    const box = root.querySelector("[data-bar]");
    if (!box) return;
    if (known) box.setAttribute("aria-valuenow", String(percent));
    else box.removeAttribute("aria-valuenow");
    box.setAttribute("aria-valuetext", valueText);
  }

  function updatePillDOM() {
    if (!state.minimized) return;
    const el = document.querySelector(`#${APP_ID} [data-pill-label]`);
    if (el) el.textContent = pillLabel();
  }

  function updateProgressDOM() {
    const root = document.querySelector(`#${APP_ID} [data-body]`);
    if (!root) return;
    const { current, total, label, note } = state.progress;
    const percent = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
    const counter = progressCounter(current, total);
    setBar(root, percent, counter, Boolean(total));
    const counterEl = root.querySelector("[data-progress-counter]");
    if (counterEl) counterEl.textContent = counter;
    const labelEl = root.querySelector("[data-progress-label]");
    if (labelEl) labelEl.textContent = state.scanPaused ? t("paused") : t(label);
    const noteEl = root.querySelector("[data-progress-note]");
    if (noteEl) noteEl.textContent = note || "";
    updatePillDOM();
  }

  function updateUnfollowDOM() {
    const root = document.querySelector(`#${APP_ID} [data-body]`);
    if (!root) return;
    const { current, total, note } = state.progress;
    const percent = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
    const summary = unfollowSummary();
    setBar(root, percent, summary, Boolean(total));
    const counterEl = root.querySelector("[data-progress-counter]");
    if (counterEl) counterEl.textContent = summary;
    const labelEl = root.querySelector("[data-progress-label]");
    if (labelEl) labelEl.textContent = unfollowTitle();
    const noteEl = root.querySelector("[data-progress-note]");
    if (noteEl) noteEl.textContent = note || "";
    const last = state.log[state.log.length - 1];
    const currentEl = root.querySelector("[data-current]");
    if (currentEl) {
      currentEl.hidden = !last;
      if (last) {
        const userEl = currentEl.querySelector("[data-current-user]");
        if (userEl) userEl.textContent = "@" + last.user.username;
        const tagEl = currentEl.querySelector("[data-current-tag]");
        if (tagEl) {
          tagEl.textContent = last.ok ? "✓" : "✕";
          tagEl.title = last.reason || "";
          tagEl.classList.toggle("xu-tag--green", last.ok);
          tagEl.classList.toggle("xu-tag--red", !last.ok);
        }
      }
    }
    updatePillDOM();
  }

  function toast(message) {
    const root = document.getElementById(APP_ID);
    if (!root) return;
    root.querySelector(".xu-toast")?.remove();
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    const node = document.createElement("div");
    node.className = "xu-toast";
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    node.textContent = message;
    root.appendChild(node);
    toastTimer = setTimeout(() => {
      node.remove();
      toastTimer = null;
    }, 3500);
  }

  const CSS = `
#${APP_ID}, #${APP_ID} * { box-sizing: border-box; }
#${APP_ID} {
  --xu-bg: #000000; --xu-bg-2: #16181c; --xu-bg-3: #202327;
  --xu-line: rgba(231,233,234,0.12); --xu-line-strong: rgba(231,233,234,0.24);
  --xu-text: #e7e9ea; --xu-muted: #71767b;
  --xu-accent: #1d9bf0; --xu-accent-2: #4cb3f5;
  --xu-danger: #c4232f; --xu-danger-text: #f4212e; --xu-success: #00ba7c;
  position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;
  color: var(--xu-text); color-scheme: dark;
  font: 14px/1.45 "TwitterChirp", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
}
#${APP_ID} > * { pointer-events: auto; }
#${APP_ID} :focus-visible { outline: 2px solid var(--xu-accent); outline-offset: 2px; }
#${APP_ID} button, #${APP_ID} input, #${APP_ID} a { font: inherit; color: inherit; }
#${APP_ID} a { text-decoration: none; }
#${APP_ID} button { cursor: pointer; }
#${APP_ID} [hidden] { display: none !important; }
#${APP_ID} .xu-list, #${APP_ID} .xu-form { scrollbar-width: thin; scrollbar-color: var(--xu-line-strong) transparent; }
#${APP_ID} .xu-panel {
  position: absolute; width: ${PANEL_WIDTH}px; max-width: calc(100vw - 24px); max-height: calc(100vh - 24px);
  display: flex; flex-direction: column; background: var(--xu-bg); border: 1px solid var(--xu-line-strong);
  border-radius: 16px; box-shadow: 0 0 15px rgba(255,255,255,0.12), 0 24px 60px rgba(0,0,0,0.6);
  overflow: hidden; animation: xu-pop 0.18s ease-out;
}
@keyframes xu-pop { from { opacity: 0; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: none; } }
#${APP_ID} .xu-header {
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 12px 12px 14px; border-bottom: 1px solid var(--xu-line); cursor: grab; user-select: none;
}
#${APP_ID} .xu-header.xu-dragging { cursor: grabbing; }
#${APP_ID} .xu-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
#${APP_ID} .xu-brand-mark { font-size: 20px; font-weight: 700; line-height: 1; }
#${APP_ID} .xu-brand-text { min-width: 0; }
#${APP_ID} .xu-brand-text strong { display: block; font-size: 15px; font-weight: 700; }
#${APP_ID} .xu-brand-text span { display: block; font-size: 11px; color: var(--xu-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${APP_ID} .xu-header-actions { display: flex; gap: 4px; flex-shrink: 0; }
#${APP_ID} .xu-header-actions button {
  width: 30px; height: 30px; display: grid; place-items: center; border: none; background: transparent;
  border-radius: 999px; color: var(--xu-muted); font-size: 11px; font-weight: 700; transition: background 0.15s, color 0.15s;
}
#${APP_ID} .xu-header-actions button:hover { background: var(--xu-bg-3); color: var(--xu-text); }
#${APP_ID} .xu-body { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
#${APP_ID} .xu-welcome { padding: 28px 22px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
#${APP_ID} .xu-welcome-icon { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; background: rgba(29,155,240,0.15); color: var(--xu-accent); margin-bottom: 4px; }
#${APP_ID} .xu-welcome-icon--error { background: rgba(244,33,46,0.15); color: var(--xu-danger-text); }
#${APP_ID} .xu-welcome h2 { margin: 0; font-size: 18px; font-weight: 700; }
#${APP_ID} .xu-welcome p { margin: 0; color: var(--xu-muted); font-size: 13px; max-width: 310px; }
#${APP_ID} .xu-welcome-actions { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 6px; }
#${APP_ID} .xu-notice { margin: 12px 16px 0; padding: 12px 14px; border: 1px solid rgba(255,212,0,0.4); border-radius: 12px; background: rgba(255,212,0,0.08); font-size: 13px; }
#${APP_ID} .xu-notice strong { display: block; margin-bottom: 4px; }
#${APP_ID} .xu-notice p { margin: 0; color: var(--xu-muted); font-size: 12px; }
#${APP_ID} .xu-notice-reason { margin-top: 6px !important; color: var(--xu-text) !important; }
#${APP_ID} .xu-detail { margin-top: 6px !important; font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace !important; color: var(--xu-muted) !important; overflow-wrap: anywhere; user-select: all; }
#${APP_ID} .xu-notice-actions { display: flex; gap: 8px; margin-top: 10px; }
#${APP_ID} .xu-btn {
  border: 1px solid var(--xu-line-strong); background: transparent; color: var(--xu-text);
  padding: 8px 16px; border-radius: 999px; font-size: 13px; font-weight: 700; transition: background 0.15s, transform 0.05s;
}
#${APP_ID} .xu-btn:hover:not(:disabled) { background: rgba(231,233,234,0.1); }
#${APP_ID} .xu-btn:active:not(:disabled) { transform: scale(0.98); }
#${APP_ID} .xu-btn:disabled { opacity: 0.4; cursor: not-allowed; }
#${APP_ID} .xu-btn--primary { background: var(--xu-text); border-color: var(--xu-text); color: #0f1419; }
#${APP_ID} .xu-btn--primary:hover:not(:disabled) { background: #d7dbdc; }
#${APP_ID} .xu-btn--danger { background: var(--xu-danger); border-color: var(--xu-danger); color: #fff; }
#${APP_ID} .xu-btn--danger:hover:not(:disabled) { background: #a51d27; }
#${APP_ID} .xu-btn--ghost { border-color: transparent; color: var(--xu-accent); }
#${APP_ID} .xu-btn--lg { padding: 11px 24px; font-size: 15px; margin-top: 8px; }
#${APP_ID} .xu-btn--small { padding: 6px 12px; font-size: 12px; }
#${APP_ID} .xu-progress { padding: 22px 20px; display: flex; flex-direction: column; gap: 14px; }
#${APP_ID} .xu-progress-head h2 { margin: 0; font-size: 15px; font-weight: 700; }
#${APP_ID} .xu-progress-head p { margin: 4px 0 0; color: var(--xu-muted); font-size: 12px; min-height: 1em; }
#${APP_ID} .xu-bar { height: 6px; border-radius: 3px; background: var(--xu-bg-3); overflow: hidden; }
#${APP_ID} .xu-bar > span { display: block; height: 100%; background: var(--xu-accent); transition: width 0.3s ease; }
#${APP_ID} .xu-bar:not([aria-valuenow]) > span { width: 30% !important; animation: xu-slide 1.6s ease-in-out infinite; }
@keyframes xu-slide { from { transform: translateX(-100%); } to { transform: translateX(340%); } }
#${APP_ID} .xu-progress-meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; }
#${APP_ID} .xu-progress-actions { display: flex; gap: 8px; }
#${APP_ID} .xu-current { display: flex; align-items: center; gap: 8px; padding: 10px; background: var(--xu-bg-2); border-radius: 10px; font-size: 12px; }
#${APP_ID} .xu-blocked { padding: 10px; border-radius: 10px; font-size: 12px; color: #fecaca; background: rgba(244,33,46,0.12); border: 1px solid rgba(244,33,46,0.35); }
#${APP_ID} .xu-results { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
#${APP_ID} .xu-results-summary { padding: 12px 16px 4px; font-size: 13px; color: var(--xu-muted); }
#${APP_ID} .xu-results-summary strong { color: var(--xu-text); }
#${APP_ID} .xu-search-row { padding: 8px 16px; }
#${APP_ID} .xu-search { width: 100%; height: 38px; padding: 0 14px; border: 1px solid transparent; border-radius: 999px; background: var(--xu-bg-3); color: var(--xu-text); outline: none; }
#${APP_ID} .xu-search:focus { border-color: var(--xu-accent); background: var(--xu-bg); }
#${APP_ID} .xu-filters { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 10px; }
#${APP_ID} .xu-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border: 1px solid var(--xu-line-strong); border-radius: 999px; background: transparent; color: var(--xu-muted); font-size: 12px; }
#${APP_ID} .xu-chip--on { background: rgba(29,155,240,0.12); border-color: rgba(29,155,240,0.5); color: var(--xu-accent-2); }
#${APP_ID} .xu-chip-tick { display: inline-grid; place-items: center; width: 12px; height: 12px; }
#${APP_ID} .xu-chip-tick svg { width: 12px; height: 12px; }
#${APP_ID} .xu-list { flex: 1 1 auto; min-height: 100px; max-height: 50vh; overflow-y: auto; overscroll-behavior: contain; border-top: 1px solid var(--xu-line); border-bottom: 1px solid var(--xu-line); }
#${APP_ID} .xu-list-empty { padding: 30px 20px; text-align: center; color: var(--xu-muted); font-size: 13px; }
#${APP_ID} .xu-row { display: grid; grid-template-columns: 18px 40px 1fr auto; gap: 10px; padding: 8px 16px; align-items: center; cursor: pointer; border-bottom: 1px solid var(--xu-line); transition: background 0.1s; }
#${APP_ID} .xu-row:hover { background: rgba(231,233,234,0.03); }
#${APP_ID} .xu-row:last-child { border-bottom: none; }
#${APP_ID} .xu-row--selected { background: rgba(29,155,240,0.12); box-shadow: inset 3px 0 0 var(--xu-accent); }
#${APP_ID} .xu-row--hidden { opacity: 0.55; }
#${APP_ID} .xu-row-check { width: 16px; height: 16px; accent-color: var(--xu-accent); cursor: pointer; margin: 0; }
#${APP_ID} .xu-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: var(--xu-bg-3); }
#${APP_ID} .xu-row-text { min-width: 0; }
#${APP_ID} .xu-row-name { display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; font-size: 13px; font-weight: 700; }
#${APP_ID} .xu-row-name > a { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
#${APP_ID} .xu-row-name a:hover { text-decoration: underline; }
#${APP_ID} .xu-row-sub { font-size: 12px; color: var(--xu-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${APP_ID} .xu-row-actions { display: flex; gap: 4px; align-items: center; }
#${APP_ID} .xu-icon-btn { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 999px; border: none; background: transparent; color: var(--xu-muted); }
#${APP_ID} .xu-icon-btn:hover { background: rgba(29,155,240,0.1); color: var(--xu-accent); }
#${APP_ID} .xu-text-btn { width: auto; padding: 0 8px; font-size: 11px; font-weight: 700; }
#${APP_ID} .xu-tag { display: inline-flex; flex-shrink: 0; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; background: var(--xu-bg-3); color: var(--xu-muted); text-transform: uppercase; letter-spacing: 0.02em; }
#${APP_ID} .xu-tag--blue { background: rgba(29,155,240,0.15); color: var(--xu-accent-2); }
#${APP_ID} .xu-tag--green { background: rgba(0,186,124,0.15); color: var(--xu-success); }
#${APP_ID} .xu-tag--red { background: rgba(244,33,46,0.15); color: var(--xu-danger-text); }
#${APP_ID} .xu-actionbar { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 16px; }
#${APP_ID} .xu-actionbar-left, #${APP_ID} .xu-actionbar-right { display: flex; align-items: center; gap: 8px; min-width: 0; }
#${APP_ID} .xu-muted { color: var(--xu-muted); font-size: 12px; }
#${APP_ID} .xu-overlay { position: fixed; inset: 0; background: rgba(91,112,131,0.4); display: grid; place-items: center; padding: 20px; z-index: 1; }
#${APP_ID} .xu-dialog { width: 100%; max-width: 380px; background: var(--xu-bg); border-radius: 16px; padding: 20px; box-shadow: 0 30px 80px rgba(0,0,0,0.55); }
#${APP_ID} .xu-dialog h3 { margin: 0 0 8px; font-size: 17px; }
#${APP_ID} .xu-dialog p { margin: 0 0 14px; color: var(--xu-muted); font-size: 13px; }
#${APP_ID} .xu-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
#${APP_ID} .xu-dialog-actions [data-extra] { margin-right: auto; }
#${APP_ID} .xu-form { display: grid; gap: 8px; max-height: 50vh; overflow-y: auto; padding-right: 4px; }
#${APP_ID} .xu-field { display: grid; grid-template-columns: 1fr 110px; align-items: center; gap: 10px; font-size: 12px; color: var(--xu-muted); }
#${APP_ID} .xu-field input { height: 32px; padding: 0 10px; border: 1px solid var(--xu-line-strong); border-radius: 6px; background: var(--xu-bg-2); color: var(--xu-text); }
#${APP_ID} .xu-field input:focus { border-color: var(--xu-accent); outline: none; }
#${APP_ID} .xu-toast { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); padding: 10px 16px; background: var(--xu-accent); color: #fff; border-radius: 6px; font-size: 13px; pointer-events: none; animation: xu-pop 0.18s ease-out; }
#${APP_ID} .xu-pill { position: absolute; display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; background: var(--xu-bg); border: 1px solid var(--xu-line-strong); color: var(--xu-text); border-radius: 999px; box-shadow: 0 0 12px rgba(255,255,255,0.12); font-size: 12px; font-weight: 700; cursor: pointer; }
#${APP_ID} .xu-pill:hover { background: var(--xu-bg-2); }
#${APP_ID} .xu-pill-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--xu-muted); }
#${APP_ID} .xu-pill-dot--active { background: var(--xu-accent); animation: xu-pulse 1.4s infinite; }
#${APP_ID} .xu-pill-dot--error { background: var(--xu-danger-text); }
@keyframes xu-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
@media (max-width: 480px) {
  #${APP_ID} .xu-panel { width: calc(100vw - 16px) !important; left: 8px !important; right: 8px !important; top: 8px !important; bottom: 8px !important; max-height: calc(100vh - 16px) !important; }
  #${APP_ID} .xu-list { max-height: none; }
}
@media (prefers-reduced-motion: reduce) {
  #${APP_ID} *, #${APP_ID} *::before, #${APP_ID} *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
`;

  if (IS_TEST) {
    globalThis.__XU_TEST__({
      parseTimeline, normalizeUser, addFollowBackStatus, usersFromCheckpoint, relationshipTrusted, evaluateUnfollowResponse,
      parseOperationsFromBundle, parseBearer, readRateHeaders, missingFeatures, getViewerId,
      isDefaultAvatar, createCheckpoint, loadTimings, dedupe, state, t, I18N
    });
    return;
  }

  cleanupExisting();
  injectStyles();
  mount();
})();
