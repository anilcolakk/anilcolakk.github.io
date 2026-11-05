(() => {
  "use strict";

  const IS_TEST = Boolean(globalThis.__XE_TEST__);
  if (!IS_TEST && !/(^|\.)(x|twitter)\.com$/.test(location.hostname)) {
    alert("Open https://x.com first (and sign in), then paste this script again.");
    return;
  }

  const APP_ID = "xe-app";
  const VERSION = "1.1.1";
  const CLEANUP_EVENT = "xe-cleanup";
  const STYLE_ID = "xe-style";
  const STORAGE_KEY = "xe_state_v1";
  const REPORT_KEY = "xe_report_v1";
  const RESUME_TTL = 24 * 60 * 60 * 1000;
  const REPORT_TTL = 7 * 24 * 60 * 60 * 1000;

  // Public bearer token that X's own web client ships in its JavaScript bundle.
  // It identifies the web app, not you; your session comes from your own cookies.
  const FALLBACK_BEARER = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
  const OPERATIONS = ["UserTweets", "Favoriters", "Retweeters", "TweetDetail", "Followers", "SearchTimeline"];
  // Page to open once if an operation's id can't be found in the loaded scripts.
  const OPERATION_HINT = {
    UserTweets: "hintProfile",
    Favoriters: "hintLikes",
    Retweeters: "hintReposts",
    TweetDetail: "hintTweet",
    Followers: "hintFollowers",
    SearchTimeline: "hintSearch"
  };

  // Speed settings changed in version 2; older saved speed values are not reused.
  const SETTINGS_VERSION = 2;
  const DEFAULT_SETTINGS = {
    tweetCount: 100,
    includeGhosts: true,
    maxListPages: 3,
    maxMentionPages: 3,
    maxFollowers: 3000,
    requestDelayMin: 500,
    requestDelayMax: 1100,
    pauseEveryRequests: 60,
    pauseMs: 8000
  };
  const SCORE = { like: 1, repost: 2, reply: 3, quote: 4, mention: 4 };
  const TWEET_COUNTS = [50, 100, 200, 400];
  // Likes, reposts, replies, search and followers each have their own X rate limit,
  // so they run side by side. This keeps any two requests at least this far apart.
  const MIN_REQUEST_GAP_MS = 300;
  const LIST_STEPS = [
    { op: "Favoriters", kind: "like", count: "likes", part: "partLikes" },
    { op: "Retweeters", kind: "repost", count: "reposts", part: "partReposts" },
    { op: "TweetDetail", kind: "reply", count: "replies", part: "partReplies" }
  ];
  const MAX_QUOTE_PAGES = 5;
  const QUOTE_FALLBACK_TWEETS = 10;
  const SAVE_EVERY_MS = 3000;
  const IDB_NAME = "xe-db";
  const MAX_HIDDEN = 500;
  const PAUSE_JITTER_MS = 4000;
  const MAX_RETRIES = 3;
  const MAX_RATE_WAIT_MS = 20 * 60 * 1000;
  const MAX_EMPTY_PAGES = 2;
  const MAX_SCRIPTS_TO_SEARCH = 40;
  const PANEL_WIDTH = 420;
  const PANEL_MARGIN = 18;
  const PROGRESS_TITLE_ID = "xe-progress-title";
  // Circle image: you in the middle, then rings of 5, 10 and 15 people by score.
  const CIRCLE_W = 1200;
  const CIRCLE_HEADER = 170;
  const CIRCLE_H = CIRCLE_HEADER + 1200 + 70;
  const CIRCLE_CENTER = { x: CIRCLE_W / 2, y: CIRCLE_HEADER + 600 };
  const CIRCLE_RINGS = [
    { count: 5, radius: 250, size: 74, color: "#ffd400", guide: "rgba(255,212,0,0.35)" },
    { count: 10, radius: 405, size: 52, color: "#1d9bf0", guide: "rgba(29,155,240,0.30)" },
    { count: 15, radius: 535, size: 40, color: "#8b98a5", guide: "rgba(139,152,165,0.25)" }
  ];
  const CIRCLE_FONT = '"TwitterChirp", -apple-system, "Segoe UI", Roboto, sans-serif';
  const COOLDOWN_MS = { blocked: 3 * 60 * 60 * 1000, rate: 15 * 60 * 1000 };
  const ERROR_CODES = {
    rate: [88],
    session: [32, 89, 215, 239, 353],
    blocked: [64, 261, 326, 141]
  };

  const I18N = {
    en: {
      title: "X Engagement Report",
      subtitle: "Your fans, ghosts and best times",
      welcomeTitle: "See who really engages",
      welcomeBody: "Your recent posts are loaded, then who liked, reposted and replied to each one. You get your top fans, followers who never engage, and when your posts do best. Nothing on your account changes.",
      scanNotice: "Runs in this tab with your existing X session. No password, app or extension. X limits how fast data loads, so it can take a while; the panel waits out limits on its own.",
      optTweets: "Posts to analyze",
      optGhosts: "Also find ghost followers (loads your follower list)",
      startBtn: "Build report",
      showLast: "Show last report ({age})",
      resumeHint: "A previous report stopped partway. Continue from there instead of starting again.",
      resumeScan: "Resume",
      startOver: "Start over",
      stageApi: "Getting ready",
      stageTweets: "Loading your posts",
      stageInteractions: "Collecting engagement",
      countTweets: "{current} posts loaded",
      partLikes: "Likes {done}/{total}",
      partReposts: "Reposts {done}/{total}",
      partReplies: "Replies {done}/{total}",
      partSearch: "Quotes and mentions…",
      partSearchDone: "Quotes and mentions ✓",
      partFollowers: "Followers {done}/{total}",
      pillPercent: "Report {percent}%",
      paused: "Paused",
      pause: "Pause",
      resume: "Resume",
      cancel: "Cancel",
      waitPause: "Pause — {seconds}s",
      waitRetry: "Retrying in {seconds}s",
      rateWait: "One step is waiting for X's rate limit: {time}",
      keepTabVisible: "Keep this tab in front. Browsers slow down background tabs.",
      tabFans: "Top fans",
      tabGhosts: "Ghosts",
      tabPosts: "Posts",
      fansSummary: "{count} people engaged with your last {tweets} posts",
      fansNone: "No one engaged with these posts yet.",
      ghostsSummary: "{count} of {total} followers did not like, repost or reply to your last {tweets} posts",
      ghostsNone: "Every follower engaged at least once. Impressive.",
      ghostsOff: "Ghost followers were not included in this report. Turn the option on before building the next one.",
      ghostsPartial: "Ghost followers appear once the report finishes.",
      ghostsNoLikes: "Ghost followers need the list of who liked your posts. X did not give it for this report{code}, so everyone would look like a ghost; they are left out.",
      ghostsNoFollowers: "X did not give your follower list{code}, so this report has no ghost followers. Open your Followers page once in this tab, then build a new report.",
      ghostsLost: "The follower list of this report could not be saved in the browser. Build a new report to see ghost followers.",
      ghostsCapped: "Your newest {count} followers were checked. Raise the limit in Settings to check more.",
      coverageNote: "X showed {percent}% of the likes on these posts, so a few people listed as ghosts may have liked something.",
      notFollowing: "Not following you",
      onlyFollowers: "Followers only",
      noAvatar: "No profile picture",
      verified: "Verified",
      search: "Search by name or username",
      noMatches: "No users match.",
      followersCount: "{count} followers",
      likes: "likes",
      reposts: "reposts",
      replies: "replies",
      score: "score",
      statPosts: "Posts",
      statViews: "Total views",
      statAvgViews: "Avg views",
      statRate: "Engagement rate",
      statLikes: "Total likes",
      statAvgLikes: "Avg likes",
      bestHours: "Best hours",
      bestDays: "Best days",
      bestHint: "Average likes + reposts + replies per post, by when you posted (your local time).",
      bestAt: "Best: {value}",
      topPosts: "Top posts",
      noText: "(media only)",
      openPost: "Open post",
      openProfile: "Open profile",
      copy: "Copy usernames",
      copiedToast: "Copied {count} usernames",
      csv: "Download CSV",
      shareSummary: "Copy summary",
      summaryCopied: "Summary copied",
      summaryText: "My X engagement report (last {tweets} posts)\nTop fans: {fans}\nBest time to post: {hour}, {day}\nAvg views per post: {views}\nGhost followers: {ghosts}",
      newReport: "New report",
      partialTitle: "Report stopped partway",
      partialBody: "{done} of {total} posts were checked. The lists below cover those posts; resume to check the rest.",
      reportAge: "Report from {age}.",
      scanFailed: "Report failed",
      retry: "Try again",
      settings: "Settings",
      settingsTitle: "Speed settings",
      settingsBody: "Lower delays make X more likely to limit your account. Keep these conservative.",
      setListPages: "Pages of likers/reposters per post (100 each)",
      setMaxFollowers: "Max followers to check for ghosts",
      setDelayMin: "Min delay between requests (ms)",
      setDelayMax: "Max delay between requests (ms)",
      setPauseEvery: "Long pause every N requests",
      setPauseMs: "Long pause length (ms)",
      restoreDefaults: "Restore defaults",
      save: "Save",
      saved: "Settings saved",
      cookieMissing: "Could not find your X session. Make sure you are signed in on x.com.",
      csrfMissing: "Could not read the ct0 cookie. Reload x.com and try again.",
      stageWaitApi: "One step needed",
      hintProfile: "In this tab, open your profile. The panel continues on its own once it sees the page.",
      hintLikes: "In this tab, open one of your posts that has likes and click its like count to open the Likes list. The panel continues on its own.",
      hintReposts: "In this tab, open one of your posts that was reposted and open its Reposts list. The panel continues on its own.",
      hintTweet: "In this tab, open one of your posts that has replies. The panel continues on its own.",
      hintFollowers: "In this tab, open your Followers page. The panel continues on its own.",
      hintSearch: "In this tab, search for anything. The panel continues on its own.",
      seenOps: "Seen so far: {ops}",
      skipStep: "Skip this step",
      skippedNote: "Missing from this report: {kinds}.",
      apiRefused: "X did not accept the {op} request ({code}). Reload x.com, open your profile once in this tab, then paste the code again.",
      apiChanged: "X changed its web API. Reload the page and paste the script again.",
      requestFailed: "Request failed: {status}",
      tooManyRequests: "X is limiting requests for this account. Only waiting lifts it.",
      sessionExpired: "X signed you out. Sign in again, paste the script again and press Resume.",
      scanBlocked: "X temporarily refused requests for this account. Open x.com normally to check.",
      networkError: "The connection dropped. Check the network and press Resume.",
      resumeAfter: "Resume after {time}.",
      close: "Close",
      minimize: "Minimize",
      expand: "Expand",
      langSwitch: "Switch to Turkish",
      langCode: "TR",
      pillScanning: "Report {current}/{total}",
      pillDone: "{count} fans",
      pillIdle: "Open",
      quotes: "quotes",
      mentions: "mentions",
      scoreHint: "Score: like 1 · repost 2 · reply 3 · quote 4 · mention 4",
      searchOff: "X did not allow searching from here, so quotes and mentions are not counted in this report.",
      searchRate: "X's search limit was reached, so some quotes and mentions may be missing from this report.",
      setMentionPages: "Pages of mentions to check (20 each)",
      tabCircle: "Circle",
      circleTitle: "My X circle",
      circleSub: "Who engaged most with my last {tweets} posts",
      circleHint: "You are in the middle. The inner ring is your top 5, then the next 10 and 15.",
      circleRendering: "Drawing your circle…",
      circleFailed: "Could not draw the circle.",
      circleTweet: "Post it",
      circleDownload: "Download PNG",
      circleCopy: "Copy image",
      circleCopied: "Image copied",
      circleNoFans: "Your circle appears once people engage with your posts.",
      circleNoImages: "Profile pictures could not be loaded, so initials are used.",
      composerReady: "Your post is ready. Check it and press Post.",
      composerFallback: "Image copied. Paste it into the post box with Ctrl+V.",
      composerDownloaded: "Image downloaded. Attach it to the post that opened.",
      tweetText: "My X circle 🫶 The people who engage with me most: {mentions}",
      tweetTextPlain: "My X circle 🫶 The people who engage with me most",
      hideTitle: "Hide people",
      hideHint: "Click someone on the image or in the list to hide them. Hidden people are not tagged in the post.",
      hideBlur: "Show as anonymous",
      hideRemove: "Remove",
      hideBlurHint: "Hidden people keep their place, without photo or name.",
      hideRemoveHint: "Hidden people leave the circle and the next ones move in.",
      hiddenCount: "{count} hidden",
      unhideAll: "Show everyone",
      hideToggle: "Hide or show @{username}",
      days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    },
    tr: {
      title: "X Etkileşim Raporu",
      subtitle: "Hayranların, hayaletlerin ve en iyi saatlerin",
      welcomeTitle: "Kim gerçekten etkileşiyor, gör",
      welcomeBody: "Son gönderilerin yüklenir, sonra her birini kimin beğendiği, yeniden gönderdiği ve yanıtladığı kontrol edilir. En çok etkileşen takipçilerini, hiç etkileşmeyenleri ve gönderilerinin en iyi hangi saatte gittiğini görürsün. Hesabında hiçbir şey değişmez.",
      scanNotice: "Bu sekmede, mevcut X oturumunla çalışır. Şifre, uygulama veya eklenti gerekmez. X verinin yüklenme hızını sınırlar; biraz sürebilir, panel sınırları kendisi bekler.",
      optTweets: "İncelenecek gönderi",
      optGhosts: "Hayalet takipçileri de bul (takipçi listeni yükler)",
      startBtn: "Raporu oluştur",
      showLast: "Son raporu göster ({age})",
      resumeHint: "Önceki rapor yarıda kaldı. Baştan başlamak yerine oradan devam edebilirsin.",
      resumeScan: "Devam et",
      startOver: "Baştan başla",
      stageApi: "Hazırlanıyor",
      stageTweets: "Gönderilerin yükleniyor",
      stageInteractions: "Etkileşimler toplanıyor",
      countTweets: "{current} gönderi yüklendi",
      partLikes: "Beğeni {done}/{total}",
      partReposts: "Yeniden gönderi {done}/{total}",
      partReplies: "Yanıt {done}/{total}",
      partSearch: "Alıntı ve bahsetmeler…",
      partSearchDone: "Alıntı ve bahsetmeler ✓",
      partFollowers: "Takipçi {done}/{total}",
      pillPercent: "Rapor %{percent}",
      paused: "Duraklatıldı",
      pause: "Duraklat",
      resume: "Devam et",
      cancel: "İptal",
      waitPause: "Mola — {seconds} sn",
      waitRetry: "{seconds} sn sonra tekrar denenecek",
      rateWait: "Bir adım X hız sınırını bekliyor: {time}",
      keepTabVisible: "Bu sekmeyi önde tut. Tarayıcılar arka plandaki sekmeleri yavaşlatır.",
      tabFans: "Hayranlar",
      tabGhosts: "Hayaletler",
      tabPosts: "Gönderiler",
      fansSummary: "Son {tweets} gönderinle {count} kişi etkileşti",
      fansNone: "Bu gönderilerle henüz kimse etkileşmemiş.",
      ghostsSummary: "{total} takipçinden {count} kişi son {tweets} gönderini hiç beğenmedi, yeniden göndermedi, yanıtlamadı",
      ghostsNone: "Her takipçin en az bir kez etkileşmiş. Etkileyici.",
      ghostsOff: "Bu raporda hayalet takipçiler yok. Bir sonraki raporda seçeneği açman yeterli.",
      ghostsPartial: "Hayalet takipçiler rapor bitince görünür.",
      ghostsNoLikes: "Hayaletleri bulmak için gönderilerini kimin beğendiğini bilmek gerekiyor. X bu raporda bu listeyi vermedi{code}; herkes hayalet görünürdü, o yüzden hayaletler çıkarılmadı.",
      ghostsNoFollowers: "X takipçi listeni vermedi{code}, bu yüzden bu raporda hayalet yok. Bu sekmede Takipçiler sayfanı bir kez açıp yeni rapor oluştur.",
      ghostsLost: "Bu raporun takipçi listesi tarayıcıya kaydedilemedi. Hayaletleri görmek için yeni rapor oluştur.",
      ghostsCapped: "En yeni {count} takipçin kontrol edildi. Daha fazlası için Ayarlar'dan sınırı artırabilirsin.",
      coverageNote: "X bu gönderilerdeki beğenilerin %{percent} kadarını gösterdi; hayalet görünen birkaç kişi aslında bir şey beğenmiş olabilir.",
      notFollowing: "Seni takip etmiyor",
      onlyFollowers: "Sadece takipçiler",
      noAvatar: "Profil resmi yok",
      verified: "Onaylı",
      search: "İsim veya kullanıcı adı ara",
      noMatches: "Eşleşen kullanıcı yok.",
      followersCount: "{count} takipçi",
      likes: "beğeni",
      reposts: "yeniden gönderi",
      replies: "yanıt",
      score: "puan",
      statPosts: "Gönderi",
      statViews: "Toplam görüntülenme",
      statAvgViews: "Ort. görüntülenme",
      statRate: "Etkileşim oranı",
      statLikes: "Toplam beğeni",
      statAvgLikes: "Ort. beğeni",
      bestHours: "En iyi saatler",
      bestDays: "En iyi günler",
      bestHint: "Gönderi başına ortalama beğeni + yeniden gönderi + yanıt, paylaştığın saate göre (yerel saat).",
      bestAt: "En iyi: {value}",
      topPosts: "En iyi gönderiler",
      noText: "(sadece medya)",
      openPost: "Gönderiyi aç",
      openProfile: "Profili aç",
      copy: "Kullanıcı adlarını kopyala",
      copiedToast: "{count} kullanıcı adı kopyalandı",
      csv: "CSV indir",
      shareSummary: "Özeti kopyala",
      summaryCopied: "Özet kopyalandı",
      summaryText: "X etkileşim raporum (son {tweets} gönderi)\nEn çok etkileşenler: {fans}\nEn iyi paylaşım zamanı: {hour}, {day}\nGönderi başına ort. görüntülenme: {views}\nHayalet takipçi: {ghosts}",
      newReport: "Yeni rapor",
      partialTitle: "Rapor yarıda kaldı",
      partialBody: "{total} gönderiden {done} tanesi kontrol edildi. Aşağıdaki listeler bu gönderileri kapsıyor; kalanlar için devam et.",
      reportAge: "Rapor: {age}.",
      scanFailed: "Rapor oluşturulamadı",
      retry: "Tekrar dene",
      settings: "Ayarlar",
      settingsTitle: "Hız ayarları",
      settingsBody: "Düşük gecikmeler X'in hesabını kısıtlamasına neden olabilir. Yavaş tut.",
      setListPages: "Gönderi başına beğenen/yeniden gönderen sayfası (sayfa başı 100)",
      setMaxFollowers: "Hayalet kontrolünde en fazla takipçi",
      setDelayMin: "İstekler arası min gecikme (ms)",
      setDelayMax: "İstekler arası maks gecikme (ms)",
      setPauseEvery: "Her N istekte uzun mola",
      setPauseMs: "Uzun mola süresi (ms)",
      restoreDefaults: "Varsayılana dön",
      save: "Kaydet",
      saved: "Ayarlar kaydedildi",
      cookieMissing: "X oturumun bulunamadı. x.com'da giriş yaptığından emin ol.",
      csrfMissing: "ct0 çerezi okunamadı. x.com'u yenileyip tekrar dene.",
      stageWaitApi: "Bir adım gerekiyor",
      hintProfile: "Bu sekmede profilini aç. Panel sayfayı görünce kendiliğinden devam eder.",
      hintLikes: "Bu sekmede beğeni almış gönderilerinden birini aç ve beğeni sayısına tıklayıp Beğeniler listesini aç. Panel kendiliğinden devam eder.",
      hintReposts: "Bu sekmede yeniden gönderilmiş bir gönderini aç ve Yeniden gönderiler listesini aç. Panel kendiliğinden devam eder.",
      hintTweet: "Bu sekmede yanıt almış gönderilerinden birini aç. Panel kendiliğinden devam eder.",
      hintFollowers: "Bu sekmede Takipçiler sayfanı aç. Panel kendiliğinden devam eder.",
      hintSearch: "Bu sekmede herhangi bir şey arat. Panel kendiliğinden devam eder.",
      seenOps: "Şu ana kadar görülen: {ops}",
      skipStep: "Bu adımı atla",
      skippedNote: "Bu raporda eksik kalanlar: {kinds}.",
      apiRefused: "X {op} isteğini kabul etmedi ({code}). x.com'u yenile, bu sekmede profilini bir kez aç, sonra kodu yeniden yapıştır.",
      apiChanged: "X web API'sini değiştirdi. Sayfayı yenile ve kodu yeniden yapıştır.",
      requestFailed: "İstek başarısız: {status}",
      tooManyRequests: "X bu hesabın isteklerini sınırlıyor. Yalnızca beklemek işe yarar.",
      sessionExpired: "X oturumunu kapattı. Tekrar giriş yap, kodu yeniden yapıştır ve Devam et'e bas.",
      scanBlocked: "X bu hesabın isteklerini geçici olarak reddetti. x.com'u normal şekilde açıp kontrol et.",
      networkError: "Bağlantı koptu. Ağı kontrol et ve Devam et'e bas.",
      resumeAfter: "Saat {time} sonrasında devam et.",
      close: "Kapat",
      minimize: "Küçült",
      expand: "Aç",
      langSwitch: "İngilizce'ye geç",
      langCode: "EN",
      pillScanning: "Rapor {current}/{total}",
      pillDone: "{count} hayran",
      pillIdle: "Aç",
      quotes: "alıntı",
      mentions: "bahsetme",
      scoreHint: "Puan: beğeni 1 · yeniden gönderi 2 · yanıt 3 · alıntı 4 · bahsetme 4",
      searchOff: "X buradan aramaya izin vermedi; bu raporda alıntılar ve bahsetmeler sayılmadı.",
      searchRate: "X'in arama sınırına ulaşıldı; bazı alıntı ve bahsetmeler bu raporda eksik olabilir.",
      setMentionPages: "Kontrol edilecek bahsetme sayfası (sayfa başı 20)",
      tabCircle: "Çember",
      circleTitle: "X çemberim",
      circleSub: "Son {tweets} gönderimle en çok etkileşenler",
      circleHint: "Ortada sen varsın. En içteki halkada en çok etkileşen 5 kişi, dışa doğru sonraki 10 ve 15 kişi.",
      circleRendering: "Çemberin çiziliyor…",
      circleFailed: "Çember çizilemedi.",
      circleTweet: "Paylaş",
      circleDownload: "PNG indir",
      circleCopy: "Görseli kopyala",
      circleCopied: "Görsel kopyalandı",
      circleNoFans: "Gönderilerinle etkileşim olunca çemberin burada görünür.",
      circleNoImages: "Profil resimleri yüklenemedi, baş harfler kullanıldı.",
      composerReady: "Gönderin hazır. Kontrol et ve Gönder'e bas.",
      composerFallback: "Görsel kopyalandı. Gönderi kutusuna Ctrl+V ile yapıştır.",
      composerDownloaded: "Görsel indirildi. Açılan gönderiye ekle.",
      tweetText: "X çemberim 🫶 Benimle en çok etkileşenler: {mentions}",
      tweetTextPlain: "X çemberim 🫶 Benimle en çok etkileşenler",
      hideTitle: "Kişileri gizle",
      hideHint: "Gizlemek için görseldeki kişiye ya da listedeki birine tıkla. Gizlenenler paylaşımda etiketlenmez.",
      hideBlur: "Anonim göster",
      hideRemove: "Tamamen çıkar",
      hideBlurHint: "Gizlenenlerin yeri korunur, fotoğrafı ve adı görünmez.",
      hideRemoveHint: "Gizlenenler çemberden çıkar, sıradakiler yerlerine geçer.",
      hiddenCount: "{count} kişi gizli",
      unhideAll: "Hepsini göster",
      hideToggle: "@{username} gizle veya göster",
      days: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"]
    }
  };

  const SVG = {
    minimize: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3" y="7.25" width="10" height="1.5" rx="0.75" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    gear: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm6.7 2.5a6.7 6.7 0 0 0-.1-1.1l1.4-1.1-1.5-2.6-1.7.7a6.6 6.6 0 0 0-1.9-1.1L10.5 1h-3l-.4 1.8a6.6 6.6 0 0 0-1.9 1.1l-1.7-.7L1.9 5.8 3.3 6.9a6.7 6.7 0 0 0 0 2.2L1.9 10.2l1.5 2.6 1.7-.7a6.6 6.6 0 0 0 1.9 1.1L7.5 15h3l.4-1.8a6.6 6.6 0 0 0 1.9-1.1l1.7.7 1.5-2.6-1.4-1.1c.1-.4.1-.7.1-1.1z"/></svg>',
    open: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 3h7v7M13 3L6.5 9.5M9 13H3V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    heart: '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.1 5.4 3 1.8-1.9 3.3-3 5.4-3 3.6 0 5.8 3.7 4.2 7.3C19.5 16.4 12 21 12 21z"/></svg>',
    repost: '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M4 9V7a2 2 0 0 1 2-2h11l-3-3M20 15v2a2 2 0 0 1-2 2H7l3 3"/></svg>',
    reply: '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" d="M4 5h16v11H9l-5 4z"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path fill="currentColor" d="M3 20h18v2H3zM5 11h3v7H5zm5.5-5h3v12h-3zM16 14h3v4h-3z"/></svg>',
    quote: '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M4 11c0-3.3 2-5.5 5-6v2.2C7.4 7.8 6.6 9 6.5 10H9v7H4zm10 0c0-3.3 2-5.5 5-6v2.2c-1.6.6-2.4 1.8-2.5 2.8H19v7h-5z"/></svg>',
    mention: '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.6 12v1.4a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.4 6.9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    alert: '<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path fill="currentColor" d="M12 2 1 21h22L12 2zm0 6 7.5 13h-15L12 8zm-1 4v4h2v-4h-2zm0 5v2h2v-2h-2z"/></svg>'
  };

  const persisted = loadStored();
  const state = {
    mode: "idle",
    tab: "circle",
    scanPaused: false,
    scanCancelled: false,
    progress: { current: 0, total: 0, label: "stageApi", note: "" },
    waits: new Map(),
    haltError: null,
    report: null,
    error: "",
    errorDetail: "",
    search: "",
    filters: { onlyFollowers: false, hideNoAvatar: false },
    settings: loadSettings(persisted.settings, persisted.settingsVersion || 1),
    hidden: new Set(Array.isArray(persisted.hidden) ? persisted.hidden.map(String) : []),
    hideMode: persisted.hideMode === "remove" ? "remove" : "blur",
    panelPos: persisted.panelPos || null,
    minimized: Boolean(persisted.minimized),
    language: persisted.language === "en" ? "en" : "tr",
    api: null,
    rateLimits: {},
    requestCount: 0,
    skipOps: new Set(),
    useTransaction: {},
    waitingOp: "",
    circle: { key: "", base: "", url: "", blob: null, slots: [], noImages: false, failed: false, busy: false }
  };

  let countdownTimer = null;
  let toastTimer = null;
  let dialogCounter = 0;
  let closeActiveDialog = null;
  let destroyed = false;
  const sleepers = new Set();
  const activeRequests = new Set();
  const imageCache = new Map();

  // ---------- storage ----------

  function loadSettings(saved = {}, version = SETTINGS_VERSION) {
    const settings = { ...DEFAULT_SETTINGS };
    // Speed values saved by an older version were much slower; keep only the choices.
    const keys = version === SETTINGS_VERSION ? Object.keys(settings) : ["tweetCount", "includeGhosts"];
    for (const key of keys) {
      if (typeof settings[key] === "boolean" && typeof saved?.[key] === "boolean") settings[key] = saved[key];
      else if (typeof settings[key] === "number" && Number.isFinite(saved?.[key]) && saved[key] >= 0) settings[key] = saved[key];
    }
    if (!TWEET_COUNTS.includes(settings.tweetCount)) settings.tweetCount = DEFAULT_SETTINGS.tweetCount;
    settings.maxListPages = Math.min(10, Math.max(1, Math.round(settings.maxListPages)));
    settings.maxMentionPages = Math.min(10, Math.max(0, Math.round(settings.maxMentionPages)));
    settings.maxFollowers = Math.min(100000, Math.max(100, Math.round(settings.maxFollowers)));
    return settings;
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
        settings: state.settings,
        settingsVersion: SETTINGS_VERSION,
        panelPos: state.panelPos,
        minimized: state.minimized,
        language: state.language,
        hidden: [...state.hidden].slice(-MAX_HIDDEN),
        hideMode: state.hideMode
      }));
    } catch { }
  }

  function createReport(viewerId, settings) {
    return {
      viewerId: String(viewerId),
      savedAt: Date.now(),
      finishedAt: 0,
      tweetTarget: settings.tweetCount,
      includeGhosts: settings.includeGhosts,
      maxFollowers: settings.maxFollowers || DEFAULT_SETTINGS.maxFollowers,
      tweets: [],
      tweetsCursor: "",
      tweetsDone: false,
      index: 0,
      done: { Favoriters: 0, Retweeters: 0, TweetDetail: 0 },
      people: {},
      followers: [],
      followersCursor: "",
      followersDone: false,
      followersTarget: 0,
      followersCapped: false,
      followersLost: false,
      followersPageSize: 100,
      ghostsReason: "",
      failed: {},
      viewer: null,
      skipped: [],
      quotesDone: false,
      mentionsDone: false,
      searchOff: false,
      searchRate: false,
      retryAfter: 0,
      stopReason: "",
      stopDetail: ""
    };
  }

  // Reports are kept in IndexedDB: x.com fills most of localStorage itself, and a
  // follower list did not fit there, which is why ghost followers went missing.
  let dbPromise = null;

  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") return reject(new Error("no IndexedDB"));
        const request = indexedDB.open(IDB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore("kv");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("IndexedDB blocked"));
      });
      dbPromise.catch(() => { });
    }
    return dbPromise;
  }

  async function idb(mode, run) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("kv", mode);
      const request = run(tx.objectStore("kv"));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function normalizeReport(parsed) {
    if (!parsed || typeof parsed !== "object" || !parsed.viewerId || !Array.isArray(parsed.tweets)) return null;
    const age = Date.now() - Number(parsed.savedAt || 0);
    if (age > (parsed.finishedAt ? REPORT_TTL : RESUME_TTL)) return null;
    const report = { ...createReport(parsed.viewerId, DEFAULT_SETTINGS), ...parsed };
    if (!parsed.done) {
      // Saved by version 1, which checked every step of a post together.
      const index = Number(parsed.index) || 0;
      report.done = { Favoriters: index, Retweeters: index, TweetDetail: index };
      if (index > 0) report.quotesDone = true;
    }
    if (report.finishedAt && report.includeGhosts && !report.followersDone) report.followersLost = true;
    return report;
  }

  async function loadReport() {
    let parsed = null;
    let fromIdb = false;
    try {
      parsed = await idb("readonly", (store) => store.get(REPORT_KEY));
      fromIdb = Boolean(parsed);
    } catch { }
    if (!parsed) {
      try { parsed = JSON.parse(localStorage.getItem(REPORT_KEY) || "null"); } catch { }
    }
    const report = normalizeReport(parsed);
    if (report && !fromIdb) await writeReport(report);
    return report;
  }

  let pendingSave = null;
  let saveTimer = null;
  let lastSaveAt = 0;

  // Saving a big report on every request was slow, so saves are batched.
  function saveReport(report, now = false) {
    if (!report) return Promise.resolve();
    report.savedAt = Date.now();
    pendingSave = report;
    if (now || Date.now() - lastSaveAt >= SAVE_EVERY_MS) return flushSave();
    if (!saveTimer) saveTimer = setTimeout(flushSave, SAVE_EVERY_MS);
    return Promise.resolve();
  }

  function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    const report = pendingSave;
    pendingSave = null;
    if (!report) return Promise.resolve();
    lastSaveAt = Date.now();
    return writeReport(report);
  }

  async function writeReport(report) {
    try {
      await idb("readwrite", (store) => store.put(report, REPORT_KEY));
      try { localStorage.removeItem(REPORT_KEY); } catch { }
      return;
    } catch { }
    try {
      localStorage.setItem(REPORT_KEY, JSON.stringify(report));
    } catch {
      // No IndexedDB and too big for localStorage: keep the report without the follower list.
      try {
        localStorage.setItem(REPORT_KEY, JSON.stringify({ ...report, followers: [], followersCursor: "", followersDone: false, followersLost: report.followersDone }));
      } catch { }
    }
  }

  // ---------- small helpers ----------

  function t(key, vars) {
    const dict = I18N[state.language] || I18N.en;
    const template = dict[key] ?? I18N.en[key] ?? key;
    if (!vars || typeof template !== "string") return template;
    return template.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
  }

  function timeAgo(timestamp) {
    const minutes = Math.max(1, Math.round((Date.now() - Number(timestamp)) / 60000));
    const format = new Intl.RelativeTimeFormat(state.language, { numeric: "auto" });
    if (minutes < 60) return format.format(-minutes, "minute");
    if (minutes < 48 * 60) return format.format(-Math.round(minutes / 60), "hour");
    return format.format(-Math.round(minutes / 1440), "day");
  }

  function formatCount(value) {
    const number = Number(value) || 0;
    try { return number.toLocaleString(state.language === "tr" ? "tr-TR" : "en-US"); } catch { return String(number); }
  }

  function formatCompact(value) {
    const number = Number(value) || 0;
    try {
      return new Intl.NumberFormat(state.language === "tr" ? "tr-TR" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(number);
    } catch {
      return String(number);
    }
  }

  function formatPercent(value) {
    return (Number(value) * 100).toLocaleString(state.language === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 2 }) + "%";
  }

  function clockTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString(state.language === "tr" ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit" });
  }

  function hourLabel(hour) {
    return String(hour).padStart(2, "0") + ":00";
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return minutes ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}s`;
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
    const fs = readInitialState()?.featureSwitch;
    const value = fs?.user?.config?.[name]?.value ?? fs?.defaultConfig?.[name]?.value;
    return typeof value === "boolean" ? value : false;
  }

  function profileCounts(viewerId) {
    const user = readInitialState()?.entities?.users?.entities?.[viewerId];
    return { followers: Number(user?.followers_count) || 0 };
  }

  // Requests X's own web app makes carry the exact current query id, variables and
  // feature flags, so they are the best source.
  function operationFromUrl(href) {
    const match = /\/graphql\/([\w-]+)\/(\w+)(?:\?|$)/.exec(href || "");
    if (!match) return null;
    const def = { queryId: match[1], features: {}, fieldToggles: null, variables: {} };
    try {
      const url = new URL(href, location.origin);
      const toggles = url.searchParams.get("fieldToggles");
      def.features = JSON.parse(url.searchParams.get("features") || "{}");
      def.fieldToggles = toggles ? JSON.parse(toggles) : null;
      def.variables = JSON.parse(url.searchParams.get("variables") || "{}");
    } catch { }
    return { name: match[2], def };
  }

  // The browser keeps only a limited list of past requests, so on a page that has
  // been open for a while older ones are gone. Live capture below covers that.
  function apiFromPerformance() {
    const found = {};
    let entries = [];
    try { entries = performance.getEntriesByType("resource"); } catch { }
    for (const entry of entries) {
      const op = operationFromUrl(entry.name);
      if (op && OPERATIONS.includes(op.name) && !found[op.name]) found[op.name] = op.def;
    }
    return found;
  }

  const captured = {};
  const recentOps = [];
  let spy = null;

  function recordRequest(href) {
    const op = operationFromUrl(href);
    if (!op) return;
    if (!recentOps.includes(op.name)) {
      recentOps.push(op.name);
      if (recentOps.length > 8) recentOps.shift();
    }
    if (OPERATIONS.includes(op.name)) captured[op.name] = op.def;
  }

  // Some X endpoints only answer requests that carry the x-client-transaction-id
  // header X's own app adds. The last one X sent for each operation is kept and
  // reused only if a request without it is refused.
  const transactionIds = {};

  function headerValue(headers, name) {
    if (!headers) return null;
    try {
      if (typeof headers.get === "function") return headers.get(name);
      if (Array.isArray(headers)) return headers.find(([key]) => String(key).toLowerCase() === name)?.[1] ?? null;
      for (const key of Object.keys(headers)) if (key.toLowerCase() === name) return headers[key];
    } catch { }
    return null;
  }

  function recordTransaction(href, value) {
    const op = operationFromUrl(href);
    if (op && value && OPERATIONS.includes(op.name)) transactionIds[op.name] = { queryId: op.def.queryId, value: String(value) };
  }

  // Watches the requests x.com itself makes while the panel is open (read-only:
  // it only looks at each request's address and transaction header and never changes anything).
  function installRequestSpy() {
    if (spy) return;
    const originalFetch = window.fetch;
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    const wrappedFetch = function (input, init) {
      try {
        const href = typeof input === "string" ? input : input?.url;
        recordRequest(href);
        recordTransaction(href, headerValue(init?.headers, "x-client-transaction-id") || headerValue(input?.headers, "x-client-transaction-id"));
      } catch { }
      return originalFetch.apply(window, arguments);
    };
    const wrappedOpen = function (method, url) {
      try {
        this.__xeUrl = String(url);
        recordRequest(this.__xeUrl);
      } catch { }
      return originalOpen.apply(this, arguments);
    };
    const wrappedSetHeader = function (name, value) {
      try {
        if (this.__xeUrl && String(name).toLowerCase() === "x-client-transaction-id") recordTransaction(this.__xeUrl, value);
      } catch { }
      return originalSetHeader.apply(this, arguments);
    };
    window.fetch = wrappedFetch;
    XMLHttpRequest.prototype.open = wrappedOpen;
    XMLHttpRequest.prototype.setRequestHeader = wrappedSetHeader;
    spy = { originalFetch, originalOpen, originalSetHeader, wrappedFetch, wrappedOpen, wrappedSetHeader };
  }

  function removeRequestSpy() {
    if (!spy) return;
    if (window.fetch === spy.wrappedFetch) window.fetch = spy.originalFetch;
    if (XMLHttpRequest.prototype.open === spy.wrappedOpen) XMLHttpRequest.prototype.open = spy.originalOpen;
    if (XMLHttpRequest.prototype.setRequestHeader === spy.wrappedSetHeader) XMLHttpRequest.prototype.setRequestHeader = spy.originalSetHeader;
    spy = null;
  }

  // A fresh query id for op from what the page has loaded since the scan started.
  function refreshOperation(op) {
    const current = state.api?.ops?.[op]?.queryId;
    const found = captured[op] || apiFromPerformance()[op] || apiFromWebpack().ops[op];
    if (!found || found.queryId === current) return false;
    state.api.ops[op] = found;
    return true;
  }

  function transactionFor(op) {
    const saved = transactionIds[op];
    return saved && saved.queryId === state.api?.ops?.[op]?.queryId ? saved.value : null;
  }

  // X's code that the page already loaded (including parts loaded later, like the
  // Likes list) stays in memory; its query ids can be read from there directly.
  function apiFromWebpack() {
    const ops = {};
    let bearer = null;
    let keys = [];
    try { keys = Object.keys(window).filter((key) => /^webpackChunk/.test(key)); } catch { }
    for (const key of keys) {
      const chunks = window[key];
      if (!Array.isArray(chunks)) continue;
      for (const chunk of chunks) {
        const modules = chunk?.[1];
        if (!modules || typeof modules !== "object") continue;
        for (const fn of Object.values(modules)) {
          if (typeof fn !== "function") continue;
          let src;
          try { src = Function.prototype.toString.call(fn); } catch { continue; }
          if (!bearer && src.includes("AAAAAAAAAAAAAAAAAAAAA")) bearer = parseBearer(src);
          if (!src.includes("operationName")) continue;
          const parsed = parseOperationsFromBundle(src);
          for (const op of OPERATIONS) if (!ops[op] && parsed[op]) ops[op] = parsed[op];
        }
      }
    }
    return { ops, bearer };
  }

  function parseOperationsFromBundle(text) {
    const found = {};
    const names = (s) => (s || "").split(",").map((x) => x.trim().replace(/^"|"$/g, "")).filter(Boolean);
    for (const op of OPERATIONS) {
      const re = new RegExp(`queryId\\s*:\\s*"([\\w-]+)"\\s*,\\s*operationName\\s*:\\s*"${op}"[^}]*?featureSwitches\\s*:\\s*\\[([^\\]]*)\\](?:\\s*,\\s*fieldToggles\\s*:\\s*\\[([^\\]]*)\\])?`);
      const match = re.exec(text);
      if (!match) continue;
      const features = {};
      for (const name of names(match[2])) features[name] = featureValue(name);
      const toggles = names(match[3]);
      found[op] = {
        queryId: match[1],
        features,
        fieldToggles: toggles.length ? Object.fromEntries(toggles.map((name) => [name, false])) : null,
        variables: {}
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

  async function discoverApi(required) {
    const have = (ops) => required.every((op) => ops[op] || state.skipOps.has(op));
    if (state.api && have(state.api.ops)) return state.api;
    const ops = { ...(state.api?.ops || {}) };
    const merge = (found) => { for (const op of OPERATIONS) if (!ops[op] && found[op]) ops[op] = found[op]; };
    merge(captured);
    merge(apiFromPerformance());
    const fromMemory = apiFromWebpack();
    merge(fromMemory.ops);
    let bearer = fromMemory.bearer || (state.api?.bearer && state.api.bearer !== FALLBACK_BEARER ? state.api.bearer : null);
    for (const url of bundleUrls()) {
      if (destroyed || state.scanCancelled) break;
      if (have(ops) && bearer) break;
      try {
        const response = await fetch(url, { credentials: "omit" });
        if (!response.ok) continue;
        const text = await response.text();
        bearer = bearer || parseBearer(text);
        const parsed = parseOperationsFromBundle(text);
        for (const op of OPERATIONS) if (!ops[op] && parsed[op]) ops[op] = parsed[op];
      } catch (error) {
        console.warn("[xe] could not read", url, error);
      }
    }
    state.api = { bearer: bearer || FALLBACK_BEARER, ops };

    // Still missing: ask for the page that uses it and continue as soon as x.com loads it.
    let shown = "";
    let rounds = 0;
    while (true) {
      merge(captured);
      const missing = required.find((op) => !ops[op] && !state.skipOps.has(op));
      if (!missing) break;
      if (destroyed || state.scanCancelled) throw xError("cancelled", "Cancelled");
      state.waitingOp = missing;
      const note = [t(OPERATION_HINT[missing]), recentOps.length ? t("seenOps", { ops: recentOps.join(", ") }) : ""].filter(Boolean).join(" ");
      state.progress = { current: 0, total: 0, label: "stageWaitApi", note };
      if (shown !== missing) {
        shown = missing;
        console.info(`[xe] waiting for ${missing}; open the matching page in this tab`);
        renderBody();
      } else {
        updateProgressDOM();
      }
      await interruptibleSleep(700);
      rounds += 1;
      if (rounds % 4 === 0) merge(apiFromWebpack().ops);
    }
    state.waitingOp = "";
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
    const rawRemaining = headers?.get?.("x-rate-limit-remaining");
    const remaining = Number(rawRemaining);
    const reset = Number(headers?.get?.("x-rate-limit-reset"));
    return {
      remaining: rawRemaining != null && Number.isFinite(remaining) ? remaining : null,
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

  async function waitForRateReset(resetAt, noWait) {
    const wait = resetAt - Date.now();
    if (wait <= 0) return;
    if (noWait || wait > MAX_RATE_WAIT_MS) throw xError("rate", t("tooManyRequests"), 429, "", { retryAfter: resetAt });
    await sleepWithCountdown(wait + 2000, "rateWait");
  }

  // True once the scan was cancelled, the panel closed, or a parallel step failed.
  function halted() {
    return destroyed || state.scanCancelled || Boolean(state.haltError);
  }

  function abortRequests() {
    for (const controller of activeRequests) controller.abort();
    activeRequests.clear();
  }

  async function xFetch(url, key, options = {}) {
    let attempt = 0;
    let rateRetries = 0;
    while (true) {
      if (halted()) throw xError("cancelled", "Cancelled");
      const limit = state.rateLimits[key];
      if (limit && limit.remaining != null && limit.remaining <= 1 && limit.resetAt > Date.now()) {
        await waitForRateReset(limit.resetAt, options.noRateWait);
        if (halted()) throw xError("cancelled", "Cancelled");
      }

      let response;
      const controller = new AbortController();
      activeRequests.add(controller);
      try {
        const headers = apiHeaders();
        if (options.transaction) headers["x-client-transaction-id"] = options.transaction;
        response = await fetch(url, { credentials: "include", headers, signal: controller.signal });
      } catch (error) {
        if (error?.kind) throw error;
        if (halted()) throw xError("cancelled", "Cancelled");
        if (attempt >= MAX_RETRIES) throw xError("network", t("networkError"));
        await sleepWithCountdown(Math.min(30000, 3000 * Math.pow(2, attempt)), "waitRetry");
        attempt += 1;
        continue;
      } finally {
        activeRequests.delete(controller);
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
        if (rateRetries >= 2 || options.noRateWait) throw xError("rate", t("tooManyRequests"), response.status, message, { retryAfter: resetAt });
        state.rateLimits[key] = { remaining: 0, resetAt };
        rateRetries += 1;
        continue;
      }
      if (response.status === 401 || has(ERROR_CODES.session)) throw xError("session", t("sessionExpired"), response.status, message);
      if (response.status === 403 || has(ERROR_CODES.blocked)) throw xError("blocked", t("scanBlocked"), response.status, message);
      if (response.status === 400 && missingFeatures(message).length) {
        throw xError("features", t("apiChanged"), 400, message, { features: missingFeatures(message) });
      }
      if (response.status === 404) throw xError("api", t("apiChanged"), 404, message);
      if (response.status >= 500) {
        if (attempt >= MAX_RETRIES) throw xError("http", t("requestFailed", { status: response.status }), response.status, message);
        await sleepWithCountdown(Math.min(60000, 5000 * Math.pow(2, attempt)), "waitRetry");
        attempt += 1;
        continue;
      }
      if (!response.ok) throw xError("http", t("requestFailed", { status: response.status }), response.status, message);
      if (!json || typeof json !== "object") throw xError("session", t("sessionExpired"), response.status, "non-JSON reply");
      if (json.errors && !json.data) throw xError("http", t("scanFailed"), response.status, message);
      return json;
    }
  }

  function graphqlUrl(op, vars) {
    const def = state.api.ops[op];
    const template = { ...(def.variables || {}) };
    for (const key of ["cursor", "userId", "tweetId", "focalTweetId", "controller_data"]) delete template[key];
    const variables = { ...template, ...vars };
    if (!variables.cursor) delete variables.cursor;
    let url = `${location.origin}/i/api/graphql/${def.queryId}/${op}?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(def.features))}`;
    if (def.fieldToggles) url += `&fieldToggles=${encodeURIComponent(JSON.stringify(def.fieldToggles))}`;
    return url;
  }

  let nextRequestAt = 0;
  let pauseUntil = 0;

  // Waits for this request's turn: requests from parallel steps stay spaced out,
  // and the long pause every N requests holds all of them.
  async function takeTurn() {
    while (true) {
      if (halted()) throw xError("cancelled", "Cancelled");
      if (state.scanPaused) {
        await waitWhile(() => state.scanPaused && !halted());
        continue;
      }
      const now = Date.now();
      const at = Math.max(nextRequestAt, pauseUntil);
      if (at <= now) {
        nextRequestAt = now + MIN_REQUEST_GAP_MS;
        return;
      }
      await sleepWithCountdown(at - now, "waitPause");
    }
  }

  // One paced GraphQL call. Each step waits a short random delay after its request.
  async function apiGet(op, vars, options = {}) {
    let json;
    let featureTries = 0;
    let refreshed = false;
    while (true) {
      await takeTurn();
      try {
        const transaction = state.useTransaction[op] ? transactionFor(op) : null;
        json = await xFetch(graphqlUrl(op, vars), op, { ...options, transaction });
        break;
      } catch (error) {
        if (error?.kind === "features" && featureTries < 3) {
          featureTries += 1;
          for (const name of error.features) state.api.ops[op].features[name] = false;
          console.warn("[xe] added missing features:", error.features.join(", "));
          continue;
        }
        // 404: the query id may have rotated, or X wants its transaction header.
        if (error?.kind === "api" && !refreshed) {
          refreshed = true;
          if (refreshOperation(op)) {
            console.warn(`[xe] ${op}: retrying with a newer query id`);
            continue;
          }
        }
        if (error?.kind === "api" && !state.useTransaction[op] && transactionFor(op)) {
          state.useTransaction[op] = true;
          console.warn(`[xe] ${op}: retrying with X's transaction header`);
          continue;
        }
        if (error && !error.op) error.op = op;
        throw error;
      }
    }
    state.requestCount += 1;
    if (state.settings.pauseEveryRequests > 0 && state.requestCount % state.settings.pauseEveryRequests === 0) {
      const jitter = Math.random() * PAUSE_JITTER_MS * 2 - PAUSE_JITTER_MS;
      pauseUntil = Date.now() + Math.max(0, state.settings.pauseMs + jitter);
    }
    await sleepWithCountdown(randomBetween(state.settings.requestDelayMin, state.settings.requestDelayMax), "waitPause");
    return json;
  }

  // ---------- response parsing ----------

  function findInstructions(node, depth = 0) {
    if (!node || typeof node !== "object" || depth > 8) return null;
    if (Array.isArray(node.instructions)) return node.instructions;
    for (const value of Object.values(node)) {
      const found = findInstructions(value, depth + 1);
      if (found) return found;
    }
    return null;
  }

  // Calls visit(content, entryId) for every timeline entry, including items nested in modules.
  function walkEntries(json, visit) {
    const instructions = findInstructions(json?.data);
    if (!instructions) {
      throw xError("format", t("apiChanged"), 200, `no timeline in reply (${Object.keys(json?.data || json || {}).join(", ").slice(0, 80)})`);
    }
    const handle = (entryId, content) => {
      if (!content) return;
      visit(content, entryId || "");
      if (Array.isArray(content.items)) {
        for (const item of content.items) handle(item.entryId, item.item);
      }
    };
    for (const instruction of instructions) {
      if (Array.isArray(instruction?.entries)) instruction.entries.forEach((entry) => handle(entry.entryId, entry.content));
      if (Array.isArray(instruction?.moduleItems)) instruction.moduleItems.forEach((item) => handle(item.entryId, item.item));
      if (instruction?.entry) handle(instruction.entry.entryId, instruction.entry.content);
    }
  }

  function isBottomCursor(content, entryId) {
    return content.cursorType === "Bottom" || /^cursor-bottom/.test(entryId);
  }

  function normalizeUser(raw) {
    const result = raw?.__typename === "UserWithVisibilityResults" ? raw.user : raw;
    if (!result || result.__typename === "UserUnavailable") return null;
    const legacy = result.legacy || {};
    const core = result.core || {};
    const user = {
      id: String(result.rest_id || legacy.id_str || ""),
      username: String(core.screen_name || legacy.screen_name || ""),
      name: String(core.name || legacy.name || ""),
      avatar: String(result.avatar?.image_url || legacy.profile_image_url_https || ""),
      followers: Number(legacy.followers_count) || 0,
      verified: Boolean(result.is_blue_verified || result.verification?.verified || legacy.verified)
    };
    return user.id && user.username ? user : null;
  }

  function parseUserTimeline(json) {
    const users = [];
    let nextCursor = "";
    walkEntries(json, (content, entryId) => {
      if (isBottomCursor(content, entryId)) {
        nextCursor = String(content.value || "");
        return;
      }
      const user = normalizeUser(content.itemContent?.user_results?.result);
      if (user) users.push(user);
    });
    return { users, nextCursor };
  }

  function unwrapTweet(raw) {
    const result = raw?.__typename === "TweetWithVisibilityResults" ? raw.tweet : raw;
    return result && result.legacy ? result : null;
  }

  function tweetAuthorId(result) {
    return String(result.core?.user_results?.result?.rest_id || result.legacy?.user_id_str || "");
  }

  function normalizeTweet(raw, viewerId) {
    const result = unwrapTweet(raw);
    if (!result) return null;
    const legacy = result.legacy;
    if (legacy.retweeted_status_result || /^RT @/.test(legacy.full_text || "")) return null;
    if (viewerId && tweetAuthorId(result) !== String(viewerId)) return null;
    const created = Date.parse(legacy.created_at || "");
    return {
      id: String(result.rest_id || legacy.id_str || ""),
      text: String(result.note_tweet?.note_tweet_results?.result?.text || legacy.full_text || "")
        .replace(/https:\/\/t\.co\/\w+\s*$/, "").trim(),
      created: Number.isFinite(created) ? created : 0,
      likes: Number(legacy.favorite_count) || 0,
      reposts: Number(legacy.retweet_count) || 0,
      replies: Number(legacy.reply_count) || 0,
      quotes: Number(legacy.quote_count) || 0,
      bookmarks: Number(legacy.bookmark_count) || 0,
      views: Number(result.views?.count) || 0,
      likersFound: 0
    };
  }

  function parseTweetTimeline(json, viewerId) {
    const tweets = [];
    let nextCursor = "";
    let entries = 0;
    let viewer = null;
    walkEntries(json, (content, entryId) => {
      if (isBottomCursor(content, entryId)) {
        nextCursor = String(content.value || "");
        return;
      }
      const raw = content.itemContent?.tweet_results?.result;
      if (!raw) return;
      entries += 1;
      const author = unwrapTweet(raw)?.core?.user_results?.result;
      if (!viewer && author && String(author.rest_id) === String(viewerId)) viewer = normalizeUser(author);
      const tweet = normalizeTweet(raw, viewerId);
      if (tweet && tweet.id) tweets.push(tweet);
    });
    return { tweets, nextCursor, entries, viewer };
  }

  // Unique people (other than you) who replied directly to tweetId on this page.
  function parseReplies(json, tweetId, viewerId) {
    const users = new Map();
    walkEntries(json, (content) => {
      const result = unwrapTweet(content.itemContent?.tweet_results?.result);
      if (!result) return;
      if (String(result.legacy.in_reply_to_status_id_str || "") !== String(tweetId)) return;
      if (tweetAuthorId(result) === String(viewerId)) return;
      const user = normalizeUser(result.core?.user_results?.result);
      if (user) users.set(user.id, user);
    });
    return [...users.values()];
  }

  // Tweets on a search page with their author, skipping your own.
  function parseSearchTweets(json, viewerId) {
    const tweets = [];
    let nextCursor = "";
    walkEntries(json, (content, entryId) => {
      if (isBottomCursor(content, entryId)) {
        nextCursor = String(content.value || "");
        return;
      }
      const result = unwrapTweet(content.itemContent?.tweet_results?.result);
      if (!result || tweetAuthorId(result) === String(viewerId)) return;
      const user = normalizeUser(result.core?.user_results?.result);
      if (!user) return;
      tweets.push({
        id: String(result.rest_id || result.legacy.id_str || ""),
        user,
        replyTo: String(result.legacy.in_reply_to_status_id_str || ""),
        quoted: String(result.legacy.quoted_status_id_str || "")
      });
    });
    return { tweets, nextCursor };
  }

  function isDefaultAvatar(user) {
    return !user.avatar || /default_profile_images/.test(user.avatar);
  }

  // ---------- analysis ----------

  function addInteraction(people, user, kind) {
    const person = people[user.id] || (people[user.id] = {});
    Object.assign(person, user);
    for (const key of ["l", "r", "c", "q", "m"]) person[key] = person[key] || 0;
    person[{ like: "l", repost: "r", reply: "c", quote: "q", mention: "m" }[kind]] += 1;
  }

  function scoreOf(person) {
    return (person.l || 0) * SCORE.like + (person.r || 0) * SCORE.repost + (person.c || 0) * SCORE.reply
      + (person.q || 0) * SCORE.quote + (person.m || 0) * SCORE.mention;
  }

  function rankFans(people, followerIds) {
    return Object.values(people)
      .map((p) => ({ ...p, score: scoreOf(p), followsYou: followerIds ? followerIds.has(p.id) : null }))
      .sort((a, b) => b.score - a.score || b.l - a.l || a.username.localeCompare(b.username));
  }

  function findGhosts(followers, people) {
    return followers.filter((f) => !people[f.id]);
  }

  function engagementOf(tweet) {
    return tweet.likes + tweet.reposts + tweet.replies + tweet.quotes;
  }

  function computeStats(tweets) {
    const hours = Array.from({ length: 24 }, () => ({ n: 0, eng: 0 }));
    const days = Array.from({ length: 7 }, () => ({ n: 0, eng: 0 }));
    let views = 0, likes = 0, engagement = 0, viewedEngagement = 0;
    for (const tweet of tweets) {
      const eng = engagementOf(tweet);
      views += tweet.views;
      likes += tweet.likes;
      engagement += eng;
      if (tweet.views > 0) viewedEngagement += eng;
      if (tweet.created) {
        const date = new Date(tweet.created);
        hours[date.getHours()].n += 1;
        hours[date.getHours()].eng += eng;
        days[date.getDay()].n += 1;
        days[date.getDay()].eng += eng;
      }
    }
    const avg = (bucket) => (bucket.n ? bucket.eng / bucket.n : 0);
    // A slot needs at least 2 posts to count as "best", unless there is too little data.
    const best = (buckets) => {
      const minN = tweets.length >= 20 ? 2 : 1;
      let bestIndex = -1;
      buckets.forEach((b, i) => {
        if (b.n >= minN && (bestIndex < 0 || avg(b) > avg(buckets[bestIndex]))) bestIndex = i;
      });
      return bestIndex;
    };
    const n = tweets.length;
    return {
      count: n,
      views,
      likes,
      avgViews: n ? views / n : 0,
      avgLikes: n ? likes / n : 0,
      rate: views ? viewedEngagement / views : 0,
      hours: hours.map((b) => ({ n: b.n, avg: avg(b) })),
      days: days.map((b) => ({ n: b.n, avg: avg(b) })),
      bestHour: best(hours),
      bestDay: best(days),
      top: [...tweets].sort((a, b) => engagementOf(b) - engagementOf(a) || b.views - a.views).slice(0, 5)
    };
  }

  function likeCoverage(tweets) {
    let total = 0, found = 0;
    for (const tweet of tweets) {
      total += tweet.likes;
      found += Math.min(tweet.likes, tweet.likersFound || 0);
    }
    return total ? found / total : 1;
  }

  // ---------- scan ----------

  function requiredOps(report) {
    const ops = ["UserTweets", "Favoriters", "Retweeters", "TweetDetail"];
    if (report.includeGhosts) ops.push("Followers");
    return ops;
  }

  // Errors that mean X refused or changed one kind of request. A side step that hits
  // one is left out of the report instead of stopping everything.
  const SOFT_ERRORS = ["api", "format", "features", "http"];

  function activeSteps(report) {
    return LIST_STEPS.filter((step) => state.api?.ops?.[step.op] && !report?.failed?.[step.op]);
  }

  function errorCode(error) {
    return error?.kind === "format" || !error?.status ? String(error?.kind || "error") : `HTTP ${error.status}`;
  }

  async function softly(report, op, run) {
    try {
      await run();
    } catch (error) {
      if (!SOFT_ERRORS.includes(error?.kind) || halted()) throw error;
      const code = errorCode(error);
      console.warn(`[xe] ${op} failed (${code}); the report continues without it.`, error);
      report.failed[op] = code;
      // Without likes or the follower list, a ghost list would be wrong, so leave it out.
      if ((op === "Favoriters" || op === "Followers") && report.includeGhosts) {
        report.includeGhosts = false;
        report.ghostsReason = op === "Favoriters" ? "likes" : "followers";
        report.followers = [];
        report.followersCursor = "";
      }
      syncIndex(report);
      updateEngagementProgress(report);
      saveReport(report);
    }
  }

  // report.index is how many posts every step has finished.
  function syncIndex(report) {
    const steps = activeSteps(report);
    report.index = steps.length ? Math.min(...steps.map((step) => report.done[step.op] || 0)) : report.tweets.length;
  }

  async function startScan(options = {}) {
    if (destroyed || state.mode === "scanning") return;
    const previous = options.resume && state.report && !state.report.finishedAt ? state.report : null;
    if (previous?.retryAfter > Date.now()) {
      state.error = t("resumeAfter", { time: clockTime(previous.retryAfter) });
      state.mode = "idle";
      return renderBody();
    }
    Object.assign(state, { error: "", errorDetail: "", mode: "scanning", scanPaused: false, scanCancelled: false, haltError: null, search: "", tab: "circle" });
    state.progress = { current: 0, total: 0, label: "stageApi", note: visibilityNote() };
    let report = null;
    try {
      const viewerId = getViewerId();
      if (!viewerId) throw xError("session", t("cookieMissing"));
      report = previous && previous.viewerId === String(viewerId) ? previous : createReport(viewerId, state.settings);
      report.stopReason = "";
      report.stopDetail = "";
      report.retryAfter = 0;
      report.failed = {};
      state.report = report;
      renderBody();

      await discoverApi(requiredOps(report));
      if (halted()) return stopScan(report);
      report.skipped = LIST_STEPS.map((step) => step.op).filter((op) => !state.api.ops[op]);
      // Without likes or the follower list, a ghost list would be wrong, so leave it out.
      if (report.includeGhosts && (!state.api.ops.Favoriters || !state.api.ops.Followers)) {
        report.includeGhosts = false;
        report.ghostsReason = state.api.ops.Favoriters ? "followers" : "likes";
      }

      if (!report.tweetsDone) {
        await loadTweets(report, viewerId);
        if (halted()) return stopScan(report);
      }

      syncIndex(report);
      updateEngagementProgress(report);
      const tasks = activeSteps(report).map((step) => () => softly(report, step.op, () => runListStep(report, viewerId, step)));
      tasks.push(() => runSearchStep(report, viewerId));
      if (report.includeGhosts && !report.followersDone) tasks.push(() => softly(report, "Followers", () => loadFollowers(report, viewerId)));
      await runParallel(tasks);
      if (halted()) return stopScan(report);

      report.finishedAt = Date.now();
      await saveReport(report, true);
      state.mode = "results";
      toast(t("fansSummary", { count: formatCount(Object.keys(report.people).length), tweets: report.tweets.length }));
      renderBody();
    } catch (error) {
      if (destroyed) return;
      if (state.scanCancelled || error?.kind === "cancelled") return stopScan(report);
      console.error("[xe] report failed:", error);
      const retryAfter = error?.retryAfter || (COOLDOWN_MS[error?.kind] ? Date.now() + COOLDOWN_MS[error.kind] : 0);
      const refused = SOFT_ERRORS.includes(error?.kind) && error?.op;
      const message = (refused ? t("apiRefused", { op: error.op, code: errorCode(error) }) : (error?.message || String(error) || t("scanFailed")))
        + (retryAfter ? " " + t("resumeAfter", { time: clockTime(retryAfter) }) : "");
      const detail = [VERSION, error?.op, report && `tweets ${report.tweets.length} · done ${report.index}`, error?.status ? `HTTP ${error.status}` : "", error?.detail || ""].filter(Boolean).join(" · ");
      if (report) {
        report.stopReason = message;
        report.stopDetail = detail;
        report.retryAfter = retryAfter;
        saveReport(report, true);
      }
      if (report?.index > 0) {
        state.mode = "results";
        return renderBody();
      }
      state.error = message;
      state.errorDetail = detail;
      state.mode = "idle";
      renderBody();
    }
  }

  // Runs the steps side by side. If one fails, the others stop at their next request
  // and the first real error is reported.
  async function runParallel(tasks) {
    state.haltError = null;
    await Promise.allSettled(tasks.map(async (task) => {
      try {
        await task();
      } catch (error) {
        if (!state.haltError && error?.kind !== "cancelled") {
          state.haltError = error;
          abortRequests();
          wakeUp();
        }
      }
    }));
    const error = state.haltError;
    state.haltError = null;
    if (error) throw error;
  }

  function stopScan(report) {
    if (destroyed) return;
    state.scanCancelled = false;
    state.haltError = null;
    if (report) saveReport(report, true);
    state.mode = report?.index > 0 ? "results" : "idle";
    renderBody();
  }

  function setProgress(label, current, total) {
    state.progress = { current, total, label, note: visibilityNote() };
    updateProgressDOM();
  }

  function engagementParts(report) {
    const total = report.tweets.length;
    const parts = activeSteps(report).map((step) => ({ key: step.part, done: report.done[step.op] || 0, total }));
    parts.push({ key: report.quotesDone && report.mentionsDone ? "partSearchDone" : "partSearch", done: (report.quotesDone ? 1 : 0) + (report.mentionsDone ? 1 : 0), total: 2 });
    if (report.includeGhosts) {
      const target = Math.max(report.followersTarget || 0, report.followers.length);
      parts.push({ key: "partFollowers", done: report.followers.length, total: report.followersDone ? report.followers.length : target, finished: report.followersDone });
    }
    return parts;
  }

  function updateEngagementProgress(report) {
    const parts = engagementParts(report);
    const share = (part) => (part.finished ? 1 : part.total ? Math.min(1, part.done / part.total) : 0);
    const percent = Math.round((parts.reduce((sum, part) => sum + share(part), 0) / parts.length) * 100);
    state.progress = { current: percent, total: 100, label: "stageInteractions", note: visibilityNote(), parts };
    updateProgressDOM();
  }

  async function loadTweets(report, viewerId) {
    const known = new Set(report.tweets.map((tw) => tw.id));
    const seen = new Set();
    let cursor = report.tweetsCursor || "";
    let emptyRun = 0;
    setProgress("stageTweets", report.tweets.length, report.tweetTarget);
    while (report.tweets.length < report.tweetTarget) {
      if (halted()) return;
      const { tweets, nextCursor, entries, viewer } = parseTweetTimeline(await apiGet("UserTweets", {
        userId: String(viewerId), count: 40, includePromotedContent: false, withVoice: true, cursor
      }), viewerId);
      if (halted()) return;
      if (viewer && !report.viewer) report.viewer = viewer;
      for (const tweet of tweets) {
        if (known.has(tweet.id) || report.tweets.length >= report.tweetTarget) continue;
        known.add(tweet.id);
        report.tweets.push(tweet);
      }
      emptyRun = entries ? 0 : emptyRun + 1;
      const finished = !nextCursor || seen.has(nextCursor) || emptyRun >= MAX_EMPTY_PAGES;
      report.tweetsCursor = finished ? "" : nextCursor;
      saveReport(report);
      setProgress("stageTweets", report.tweets.length, report.tweetTarget);
      if (finished) break;
      seen.add(nextCursor);
      cursor = nextCursor;
    }
    report.tweetsCursor = "";
    report.tweetsDone = true;
    saveReport(report, true);
  }

  // Likers or reposters of one post. Stops as soon as everyone X counted was seen,
  // instead of asking for an empty extra page.
  async function loadEngagers(op, tweet, expected) {
    const users = new Map();
    const seen = new Set();
    let cursor = "";
    for (let page = 0; page < state.settings.maxListPages; page += 1) {
      if (halted()) break;
      const { users: batch, nextCursor } = parseUserTimeline(await apiGet(op, {
        tweetId: tweet.id, count: 100, includePromotedContent: false, cursor
      }));
      const before = users.size;
      batch.forEach((user) => users.set(user.id, user));
      if (users.size >= expected || users.size === before || !nextCursor || /^0\|/.test(nextCursor) || seen.has(nextCursor)) break;
      seen.add(nextCursor);
      cursor = nextCursor;
    }
    return users;
  }

  async function loadRepliers(tweet, viewerId) {
    const json = await apiGet("TweetDetail", {
      focalTweetId: tweet.id, with_rux_injections: false, rankingMode: "Relevance",
      includePromotedContent: false, withCommunity: true, withBirdwatchNotes: true, withVoice: true
    });
    return new Map(parseReplies(json, tweet.id, viewerId).map((user) => [user.id, user]));
  }

  // One kind of interaction (likes, reposts or replies) for every post, in order.
  // A post's result is committed together with its counter, so a stop never double counts.
  async function runListStep(report, viewerId, step) {
    const total = report.tweets.length;
    let failedInARow = 0;
    while ((report.done[step.op] || 0) < total) {
      if (halted()) return;
      const index = report.done[step.op] || 0;
      const tweet = report.tweets[index];
      if (tweet[step.count] > 0) {
        let users;
        try {
          users = step.op === "TweetDetail"
            ? await loadRepliers(tweet, viewerId)
            : await loadEngagers(step.op, tweet, tweet[step.count]);
          failedInARow = 0;
        } catch (error) {
          // One odd post (deleted, restricted) is skipped; several in a row means X refuses the step.
          if (error?.kind !== "format" || failedInARow >= 2) throw error;
          failedInARow += 1;
          console.warn(`[xe] ${step.op}: skipped post ${tweet.id}`, error);
          users = new Map();
        }
        if (halted()) return;
        users.delete(String(viewerId));
        users.forEach((user) => addInteraction(report.people, user, step.kind));
        if (step.op === "Favoriters") tweet.likersFound = users.size;
      }
      report.done[step.op] = index + 1;
      syncIndex(report);
      saveReport(report);
      updateEngagementProgress(report);
    }
  }

  // Search is the only way to find quotes and mentions. X sometimes refuses it from
  // scripts, and its limit is low; the report then carries on without them.
  async function searchTweets(report, query, maxPages, onTweets) {
    if (report.searchOff || !state.api?.ops?.SearchTimeline) {
      report.searchOff = true;
      return;
    }
    let cursor = "";
    const seen = new Set();
    for (let page = 0; page < maxPages; page += 1) {
      if (halted()) return;
      let parsed;
      try {
        parsed = parseSearchTweets(await apiGet("SearchTimeline", {
          rawQuery: query, count: 20, querySource: "typed_query", product: "Latest", cursor
        }, { noRateWait: true }), report.viewerId);
      } catch (error) {
        if (!["api", "http", "format", "features", "rate"].includes(error?.kind)) throw error;
        console.warn("[xe] search unavailable, skipping the rest of quotes and mentions:", error);
        report.searchOff = true;
        if (error.kind === "rate") report.searchRate = true;
        return;
      }
      onTweets(parsed.tweets);
      if (!parsed.tweets.length || !parsed.nextCursor || seen.has(parsed.nextCursor)) return;
      seen.add(parsed.nextCursor);
      cursor = parsed.nextCursor;
    }
  }

  function searchSince(report) {
    const oldest = Math.min(...report.tweets.map((tw) => tw.created || Date.now()));
    return new Date(oldest).toISOString().slice(0, 10);
  }

  async function runSearchStep(report, viewerId) {
    if (!report.quotesDone) {
      await loadQuotes(report, viewerId);
      if (halted()) return;
    }
    updateEngagementProgress(report);
    if (!report.mentionsDone) await loadMentions(report, viewerId);
    updateEngagementProgress(report);
  }

  // All quotes of your posts with one search, instead of one search per post.
  // Each person counts once per quoted post.
  async function loadQuotes(report, viewerId) {
    const own = new Set(report.tweets.map((tw) => tw.id));
    if (!report.tweets.some((tw) => tw.quotes > 0)) {
      report.quotesDone = true;
      return;
    }
    const quotes = new Map();
    const take = (quotedId, user) => quotes.set(`${quotedId}:${user.id}`, user);
    await searchTweets(report, `quoted_user_id:${viewerId} since:${searchSince(report)}`, MAX_QUOTE_PAGES, (items) => {
      items.forEach((item) => { if (own.has(item.quoted)) take(item.quoted, item.user); });
    });
    if (!quotes.size && !report.searchOff && !halted()) {
      // That search found nothing: ask post by post, only for the most quoted posts.
      const top = report.tweets.filter((tw) => tw.quotes > 0).sort((a, b) => b.quotes - a.quotes).slice(0, QUOTE_FALLBACK_TWEETS);
      for (const tweet of top) {
        if (halted() || report.searchOff) break;
        await searchTweets(report, `quoted_tweet_id:${tweet.id}`, 1, (items) => {
          items.forEach((item) => { if (!item.quoted || item.quoted === tweet.id) take(tweet.id, item.user); });
        });
      }
    }
    if (halted()) return;
    quotes.forEach((user) => addInteraction(report.people, user, "quote"));
    report.quotesDone = true;
    saveReport(report);
  }

  // Posts by others that mention you within the report's time window. Replies to and
  // quotes of the analyzed posts are skipped because they are already counted.
  async function loadMentions(report, viewerId) {
    const username = report.viewer?.username || readInitialState()?.entities?.users?.entities?.[viewerId]?.screen_name;
    if (!username || !report.tweets.length || state.settings.maxMentionPages < 1) {
      report.mentionsDone = true;
      return;
    }
    const own = new Set(report.tweets.map((tw) => tw.id));
    const found = new Map();
    await searchTweets(report, `@${username} -from:${username} since:${searchSince(report)}`, state.settings.maxMentionPages, (tweets) => {
      for (const item of tweets) {
        if (own.has(item.replyTo) || own.has(item.quoted)) continue;
        found.set(item.id, item.user);
      }
    });
    if (halted()) return;
    found.forEach((user) => addInteraction(report.people, user, "mention"));
    report.mentionsDone = true;
    saveReport(report);
  }

  // Your newest followers, up to the limit in Settings. X lists the newest first.
  async function loadFollowers(report, viewerId) {
    const known = new Set(report.followers.map((f) => f.id));
    const seen = new Set();
    const cap = report.maxFollowers || state.settings.maxFollowers;
    const count = report.viewer?.followers || profileCounts(viewerId).followers;
    report.followersTarget = count ? Math.min(count, cap) : cap;
    let cursor = report.followersCursor || "";
    let emptyRun = 0;
    updateEngagementProgress(report);
    while (true) {
      if (halted() || !report.includeGhosts) return;
      let json;
      try {
        json = await apiGet("Followers", { userId: String(viewerId), count: report.followersPageSize || 100, includePromotedContent: false, cursor });
      } catch (error) {
        // If X refuses the larger page size, fall back to its usual 50.
        if (["http", "format"].includes(error?.kind) && (report.followersPageSize || 100) > 50) {
          report.followersPageSize = 50;
          continue;
        }
        throw error;
      }
      if (halted()) return;
      const { users, nextCursor } = parseUserTimeline(json);
      for (const user of users) {
        if (known.has(user.id) || report.followers.length >= cap) continue;
        known.add(user.id);
        report.followers.push(user);
      }
      emptyRun = users.length ? 0 : emptyRun + 1;
      const capped = report.followers.length >= cap;
      const finished = capped || !nextCursor || /^0\|/.test(nextCursor) || seen.has(nextCursor) || emptyRun >= MAX_EMPTY_PAGES;
      report.followersCursor = finished ? "" : nextCursor;
      report.followersCapped = capped && (count ? count > cap : true);
      saveReport(report);
      updateEngagementProgress(report);
      if (finished) break;
      seen.add(nextCursor);
      cursor = nextCursor;
    }
    report.followersDone = true;
    saveReport(report);
    updateEngagementProgress(report);
  }

  // ---------- mount / unmount ----------

  function cleanupExisting() {
    document.dispatchEvent(new Event(CLEANUP_EVENT));
    if (typeof window.__xeCleanup === "function") {
      try { window.__xeCleanup(); } catch { }
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
    window.__xeCleanup = unmount;
    installRequestSpy();
    document.addEventListener(CLEANUP_EVENT, unmount);
    document.addEventListener("visibilitychange", onVisibilityChange);
    renderShell();
    loadReport().then((report) => {
      if (destroyed || !report || state.report || state.mode !== "idle") return;
      state.report = report;
      renderBody();
    });
  }

  function unmount() {
    if (destroyed) return;
    destroyed = true;
    state.scanCancelled = true;
    state.scanPaused = false;
    flushSave();
    abortRequests();
    wakeUp();
    stopCountdown();
    document.removeEventListener(CLEANUP_EVENT, unmount);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    removeRequestSpy();
    closeActiveDialog?.();
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    document.getElementById(APP_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    if (window.__xeCleanup === unmount) window.__xeCleanup = null;
  }

  // ---------- shell ----------

  function renderShell() {
    const root = document.getElementById(APP_ID);
    if (!root) return;
    if (state.minimized) {
      root.innerHTML = `
        <button class="xe-pill" data-action="expand" type="button" aria-label="${escapeAttr(t("expand"))}">
          <span class="xe-pill-dot ${state.mode === "scanning" ? "xe-pill-dot--active" : ""}"></span>
          <span data-pill-label>${escapeHTML(pillLabel())}</span>
        </button>`;
      root.querySelector("[data-action='expand']")?.addEventListener("click", () => setMinimized(false));
      applyPanelPosition();
      return;
    }
    root.innerHTML = `
      <section class="xe-panel" role="dialog" aria-label="${escapeAttr(t("title"))}">
        <header class="xe-header" data-drag>
          <div class="xe-brand">
            <span class="xe-brand-mark" aria-hidden="true">𝕏</span>
            <div class="xe-brand-text">
              <strong>${escapeHTML(t("title"))}</strong>
              <span>v${VERSION} · ${escapeHTML(t("subtitle"))}</span>
            </div>
          </div>
          <div class="xe-header-actions">
            <button type="button" data-action="settings" aria-label="${escapeAttr(t("settings"))}" title="${escapeAttr(t("settings"))}">${SVG.gear}</button>
            <button type="button" data-action="language" aria-label="${escapeAttr(t("langSwitch"))}" title="${escapeAttr(t("langSwitch"))}"><span aria-hidden="true">${escapeHTML(t("langCode"))}</span></button>
            <button type="button" data-action="minimize" aria-label="${escapeAttr(t("minimize"))}" title="${escapeAttr(t("minimize"))}">${SVG.minimize}</button>
            <button type="button" data-action="close" aria-label="${escapeAttr(t("close"))}" title="${escapeAttr(t("close"))}">${SVG.close}</button>
          </div>
        </header>
        <div class="xe-body" data-body></div>
      </section>`;
    root.querySelector("[data-action='close']")?.addEventListener("click", () => unmount());
    root.querySelector("[data-action='minimize']")?.addEventListener("click", () => setMinimized(true));
    root.querySelector("[data-action='settings']")?.addEventListener("click", showSettings);
    root.querySelector("[data-action='language']")?.addEventListener("click", () => {
      state.language = state.language === "tr" ? "en" : "tr";
      persist();
      renderShell();
    });
    bindDrag(root.querySelector("[data-drag]"));
    applyPanelPosition();
    renderBody();
  }

  function applyPanelPosition() {
    const root = document.getElementById(APP_ID);
    const node = root?.querySelector(".xe-panel") || root?.querySelector(".xe-pill");
    if (!node) return;
    const pos = state.panelPos;
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      const rect = node.getBoundingClientRect();
      node.style.left = clamp(pos.x, 0, Math.max(0, window.innerWidth - rect.width)) + "px";
      node.style.top = clamp(pos.y, 0, Math.max(0, window.innerHeight - rect.height)) + "px";
      node.style.right = "auto";
      node.style.bottom = "auto";
    } else {
      node.style.left = "auto";
      node.style.top = "auto";
      node.style.right = PANEL_MARGIN + "px";
      node.style.bottom = PANEL_MARGIN + "px";
    }
  }

  function bindDrag(handle) {
    const panel = handle?.closest(".xe-panel");
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
      Object.assign(panel.style, { left: originX + "px", top: originY + "px", right: "auto", bottom: "auto" });
      handle.setPointerCapture(event.pointerId);
      handle.classList.add("xe-dragging");
    });
    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const rect = panel.getBoundingClientRect();
      panel.style.left = clamp(originX + (event.clientX - startX), 0, Math.max(0, window.innerWidth - rect.width)) + "px";
      panel.style.top = clamp(originY + (event.clientY - startY), 0, Math.max(0, window.innerHeight - rect.height)) + "px";
    });
    const stop = (event) => {
      if (!dragging) return;
      dragging = false;
      handle.releasePointerCapture?.(event.pointerId);
      handle.classList.remove("xe-dragging");
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
    if (state.mode === "scanning" && state.progress.label === "stageInteractions") {
      return t("pillPercent", { percent: state.progress.current });
    }
    if (state.mode === "scanning") {
      return t("pillScanning", { current: formatCount(state.progress.current), total: state.progress.total ? formatCount(state.progress.total) : "?" });
    }
    if (state.mode === "results" && state.report) return t("pillDone", { count: formatCount(Object.keys(state.report.people).length) });
    return t("pillIdle");
  }

  // ---------- views ----------

  function renderBody() {
    const body = document.querySelector(`#${APP_ID} [data-body]`);
    if (!body) return;
    // Keep the list where it was when the same tab is drawn again (e.g. after hiding someone).
    const scrollKey = state.mode + ":" + state.tab;
    const scrollTop = body.dataset.scrollKey === scrollKey ? body.querySelector("[data-tab-body]")?.scrollTop || 0 : 0;
    if (state.mode === "scanning") body.innerHTML = renderScanView();
    else if (state.mode === "results" && state.report) body.innerHTML = renderResultsView();
    else body.innerHTML = renderIdleView();
    body.dataset.scrollKey = scrollKey;
    const tabBody = body.querySelector("[data-tab-body]");
    if (tabBody && scrollTop) tabBody.scrollTop = scrollTop;
    bindBody(body);
    if (state.mode === "results" && state.tab === "circle") ensureCircle();
    if (state.mode === "scanning") startCountdown();
    else stopCountdown();
  }

  function renderIdleView() {
    const report = state.report;
    const resumable = report && !report.finishedAt && report.tweets.length;
    if (state.error) {
      return `
        <div class="xe-welcome">
          <div class="xe-welcome-icon xe-welcome-icon--error">${SVG.alert}</div>
          <h2>${escapeHTML(t("scanFailed"))}</h2>
          <p>${escapeHTML(state.error)}</p>
          ${state.errorDetail ? `<p class="xe-detail">${escapeHTML(state.errorDetail)}</p>` : ""}
          <div class="xe-welcome-actions">
            ${resumable ? `<button type="button" class="xe-btn xe-btn--primary" data-action="resume">${escapeHTML(t("resumeScan"))}</button>` : ""}
            <button type="button" class="xe-btn ${resumable ? "xe-btn--ghost" : "xe-btn--primary"}" data-action="${resumable ? "restart" : "start"}">${escapeHTML(resumable ? t("startOver") : t("retry"))}</button>
          </div>
        </div>`;
    }
    if (resumable) {
      return `
        <div class="xe-welcome">
          <div class="xe-welcome-icon">${SVG.sparkle}</div>
          <h2>${escapeHTML(t("welcomeTitle"))}</h2>
          <p>${escapeHTML(t("resumeHint"))}</p>
          ${report.stopReason ? `<p>${escapeHTML(report.stopReason)}</p>` : ""}
          <div class="xe-welcome-actions">
            <button type="button" class="xe-btn xe-btn--primary xe-btn--lg" data-action="resume">${escapeHTML(t("resumeScan"))}</button>
            <button type="button" class="xe-btn xe-btn--ghost" data-action="restart">${escapeHTML(t("startOver"))}</button>
          </div>
        </div>`;
    }
    const options = TWEET_COUNTS.map((n) => `<option value="${n}" ${n === state.settings.tweetCount ? "selected" : ""}>${n}</option>`).join("");
    return `
      <div class="xe-welcome">
        <div class="xe-welcome-icon">${SVG.sparkle}</div>
        <h2>${escapeHTML(t("welcomeTitle"))}</h2>
        <p>${escapeHTML(t("welcomeBody"))}</p>
        <div class="xe-options">
          <label class="xe-option-row" for="xe-count">
            <span>${escapeHTML(t("optTweets"))}</span>
            <select id="xe-count" data-option="tweetCount">${options}</select>
          </label>
          <label class="xe-option-row xe-option-check" for="xe-ghosts">
            <input type="checkbox" id="xe-ghosts" data-option="includeGhosts" ${state.settings.includeGhosts ? "checked" : ""}>
            <span>${escapeHTML(t("optGhosts"))}</span>
          </label>
        </div>
        <p class="xe-small">${escapeHTML(t("scanNotice"))}</p>
        <div class="xe-welcome-actions">
          <button type="button" class="xe-btn xe-btn--primary xe-btn--lg" data-action="start">${escapeHTML(t("startBtn"))}</button>
          ${report?.finishedAt ? `<button type="button" class="xe-btn xe-btn--ghost" data-action="show-last">${escapeHTML(t("showLast", { age: timeAgo(report.finishedAt) }))}</button>` : ""}
        </div>
      </div>`;
  }

  function progressCounter() {
    const { current, total, label } = state.progress;
    if (label === "stageInteractions" && state.progress.parts) {
      return state.progress.parts.map((part) => t(part.key, { done: formatCount(part.done), total: formatCount(part.total) })).join(" · ");
    }
    return label === "stageTweets" ? t("countTweets", { current: formatCount(current) }) : "";
  }

  function renderScanView() {
    const { current, total, label, note } = state.progress;
    const percent = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
    const counter = progressCounter();
    return `
      <div class="xe-progress">
        <div class="xe-progress-head">
          <h2 id="${PROGRESS_TITLE_ID}" data-progress-label>${escapeHTML(state.scanPaused ? t("paused") : t(label))}</h2>
          <p data-progress-note>${escapeHTML(note)}</p>
        </div>
        <div class="xe-bar" role="progressbar" aria-labelledby="${PROGRESS_TITLE_ID}" aria-valuemin="0" aria-valuemax="100" ${total ? `aria-valuenow="${percent}"` : ""} aria-valuetext="${escapeAttr(counter)}" data-bar>
          <span data-progress-bar style="width:${percent}%"></span>
        </div>
        <div class="xe-progress-meta">
          <span data-progress-counter>${escapeHTML(counter)}</span>
          <span data-countdown class="xe-muted"></span>
        </div>
        <div class="xe-progress-actions">
          <button type="button" class="xe-btn" data-action="pause">${escapeHTML(t(state.scanPaused ? "resume" : "pause"))}</button>
          <button type="button" class="xe-btn xe-btn--ghost" data-action="cancel">${escapeHTML(t("cancel"))}</button>
          ${label === "stageWaitApi" && state.waitingOp !== "UserTweets" ? `<button type="button" class="xe-btn xe-btn--ghost" data-action="skip-op">${escapeHTML(t("skipStep"))}</button>` : ""}
        </div>
      </div>`;
  }

  function reportView() {
    const report = state.report;
    const done = report.index;
    const tweets = report.tweets.slice(0, done);
    const complete = Boolean(report.finishedAt);
    const followerIds = report.followersDone ? new Set(report.followers.map((f) => f.id)) : null;
    const fans = rankFans(report.people, followerIds);
    const ghosts = complete && report.followersDone ? findGhosts(report.followers, report.people) : null;
    return { report, tweets, complete, fans, ghosts, stats: computeStats(report.tweets) };
  }

  function renderResultsView() {
    const view = reportView();
    const { report, complete, fans, ghosts } = view;
    const tabs = [
      ["circle", t("tabCircle"), null],
      ["fans", t("tabFans"), fans.length],
      ["ghosts", t("tabGhosts"), ghosts ? ghosts.length : null],
      ["posts", t("tabPosts"), report.tweets.length]
    ];
    const notice = !complete ? `
      <div class="xe-notice" role="status">
        <strong>${escapeHTML(t("partialTitle"))}</strong>
        <p>${escapeHTML(t("partialBody", { done: formatCount(report.index), total: formatCount(report.tweets.length) }))}</p>
        ${report.stopReason ? `<p class="xe-notice-reason">${escapeHTML(report.stopReason)}</p>` : ""}
        ${report.stopDetail ? `<p class="xe-detail">${escapeHTML(report.stopDetail)}</p>` : ""}
        <div class="xe-notice-actions">
          <button type="button" class="xe-btn xe-btn--primary xe-btn--small" data-action="resume">${escapeHTML(t("resumeScan"))}</button>
          <button type="button" class="xe-btn xe-btn--ghost xe-btn--small" data-action="restart">${escapeHTML(t("startOver"))}</button>
        </div>
      </div>` : "";
    let content = "";
    if (state.tab === "circle") content = renderCircleTab(view);
    else if (state.tab === "ghosts") content = renderGhostsTab(view);
    else if (state.tab === "posts") content = renderPostsTab(view);
    else content = renderFansTab(view);
    return `
      <div class="xe-results">
        ${notice}
        <div class="xe-tabs" role="tablist">
          ${tabs.map(([key, label, count]) => `
            <button type="button" role="tab" class="xe-tab ${state.tab === key ? "xe-tab--on" : ""}" data-tab="${key}" aria-selected="${state.tab === key}">
              ${escapeHTML(label)}${count == null ? "" : ` <span class="xe-tab-count">${escapeHTML(formatCompact(count))}</span>`}
            </button>`).join("")}
        </div>
        <div class="xe-tab-body" data-tab-body>${content}</div>
        <div class="xe-actionbar">
          <button type="button" class="xe-btn xe-btn--small xe-btn--ghost" data-action="new">${escapeHTML(t("newReport"))}</button>
          <div class="xe-actionbar-right">
            ${state.tab === "fans" || state.tab === "ghosts" ? `<button type="button" class="xe-btn xe-btn--small" data-action="copy">${escapeHTML(t("copy"))}</button>` : ""}
            ${state.tab !== "circle" ? `<button type="button" class="xe-btn xe-btn--small" data-action="csv">${escapeHTML(t("csv"))}</button>` : ""}
            ${complete ? `<button type="button" class="xe-btn xe-btn--small xe-btn--primary" data-action="summary">${escapeHTML(t("shareSummary"))}</button>` : ""}
          </div>
        </div>
      </div>`;
  }

  function searchAndFilters(chips) {
    return `
      <div class="xe-search-row">
        <input class="xe-search" id="xe-search" type="search" data-search placeholder="${escapeAttr(t("search"))}" value="${escapeAttr(state.search)}" autocomplete="off" spellcheck="false">
      </div>
      <div class="xe-filters">
        ${chips.map(([key, label]) => `
          <button type="button" class="xe-chip ${state.filters[key] ? "xe-chip--on" : ""}" data-filter="${key}" aria-pressed="${state.filters[key]}">${escapeHTML(label)}</button>`).join("")}
      </div>`;
  }

  function matchesSearch(user) {
    const query = state.search.trim().toLowerCase();
    if (state.filters.hideNoAvatar && isDefaultAvatar(user)) return false;
    return !query || (user.username + " " + (user.name || "")).toLowerCase().includes(query);
  }

  function displayedFans(view) {
    return view.fans.filter((f) => matchesSearch(f) && (!state.filters.onlyFollowers || f.followsYou !== false));
  }

  function displayedGhosts(view) {
    return (view.ghosts || []).filter(matchesSearch).sort((a, b) => b.followers - a.followers);
  }

  function renderFansTab(view) {
    if (!view.fans.length) return `<div class="xe-empty">${escapeHTML(t("fansNone"))}</div>`;
    const chips = [];
    if (view.report.followersDone) chips.push(["onlyFollowers", t("onlyFollowers")]);
    chips.push(["hideNoAvatar", t("noAvatar")]);
    return `
      <div class="xe-summary">${escapeHTML(t("fansSummary", { count: formatCount(view.fans.length), tweets: formatCount(view.tweets.length) }))}</div>
      <div class="xe-score-hint">${escapeHTML(t("scoreHint"))}</div>
      ${view.report.searchOff ? `<div class="xe-note">${escapeHTML(t(view.report.searchRate ? "searchRate" : "searchOff"))}</div>` : ""}
      ${missingKinds(view.report) ? `<div class="xe-note">${escapeHTML(t("skippedNote", { kinds: missingKinds(view.report) }))}</div>` : ""}
      ${searchAndFilters(chips)}
      <div class="xe-list" data-list>${renderFanRows(displayedFans(view), view)}</div>`;
  }

  function missingKinds(report) {
    const label = { Favoriters: "likes", Retweeters: "reposts", TweetDetail: "replies" };
    const kinds = (report.skipped || []).map((op) => t(label[op]));
    for (const [op, code] of Object.entries(report.failed || {})) if (label[op]) kinds.push(`${t(label[op])} (${code})`);
    return kinds.join(", ");
  }

  function renderFanRows(fans, view) {
    if (!fans.length) return `<div class="xe-empty">${escapeHTML(t("noMatches"))}</div>`;
    const rank = new Map(view.fans.map((f, i) => [f.id, i + 1]));
    return fans.slice(0, 500).map((fan) => `
      <div class="xe-row">
        <span class="xe-rank ${rank.get(fan.id) <= 3 ? "xe-rank--top" : ""}">${rank.get(fan.id)}</span>
        ${avatarHTML(fan)}
        <div class="xe-row-text">
          <div class="xe-row-name">
            <a href="${escapeAttr(profileUrl(fan))}" target="_blank" rel="noopener noreferrer">@${escapeHTML(fan.username)}</a>
            ${fan.followsYou === false ? `<span class="xe-tag">${escapeHTML(t("notFollowing"))}</span>` : ""}
          </div>
          <div class="xe-row-stats">
            <span class="xe-stat-like" title="${escapeAttr(t("likes"))}">${SVG.heart}${fan.l}</span>
            <span class="xe-stat-repost" title="${escapeAttr(t("reposts"))}">${SVG.repost}${fan.r}</span>
            <span class="xe-stat-reply" title="${escapeAttr(t("replies"))}">${SVG.reply}${fan.c}</span>
            ${fan.q ? `<span class="xe-stat-quote" title="${escapeAttr(t("quotes"))}">${SVG.quote}${fan.q}</span>` : ""}
            ${fan.m ? `<span class="xe-stat-mention" title="${escapeAttr(t("mentions"))}">${SVG.mention}${fan.m}</span>` : ""}
          </div>
        </div>
        <span class="xe-score" title="${escapeAttr(t("score"))}">${fan.score}</span>
      </div>`).join("");
  }

  function renderGhostsTab(view) {
    const { report } = view;
    if (!report.includeGhosts) {
      const reason = { likes: "ghostsNoLikes", followers: "ghostsNoFollowers" }[report.ghostsReason] || "ghostsOff";
      const code = report.failed?.[report.ghostsReason === "likes" ? "Favoriters" : "Followers"];
      return `<div class="xe-empty">${escapeHTML(t(reason, { code: code ? ` (${code})` : "" }))}</div>`;
    }
    if (!view.ghosts) {
      return `<div class="xe-empty">${escapeHTML(t(view.complete && report.followersLost ? "ghostsLost" : "ghostsPartial"))}</div>`;
    }
    if (!view.ghosts.length) return `<div class="xe-empty">${escapeHTML(t("ghostsNone"))}</div>`;
    const coverage = likeCoverage(report.tweets);
    return `
      <div class="xe-summary">${escapeHTML(t("ghostsSummary", { count: formatCount(view.ghosts.length), total: formatCount(report.followers.length), tweets: formatCount(report.tweets.length) }))}</div>
      ${report.followersCapped ? `<div class="xe-note">${escapeHTML(t("ghostsCapped", { count: formatCount(report.followers.length) }))}</div>` : ""}
      ${coverage < 0.95 ? `<div class="xe-note">${escapeHTML(t("coverageNote", { percent: Math.round(coverage * 100) }))}</div>` : ""}
      ${searchAndFilters([["hideNoAvatar", t("noAvatar")]])}
      <div class="xe-list" data-list>${renderGhostRows(displayedGhosts(view))}</div>`;
  }

  function renderGhostRows(ghosts) {
    if (!ghosts.length) return `<div class="xe-empty">${escapeHTML(t("noMatches"))}</div>`;
    return ghosts.slice(0, 1000).map((ghost) => `
      <div class="xe-row xe-row--ghost">
        ${avatarHTML(ghost)}
        <div class="xe-row-text">
          <div class="xe-row-name">
            <a href="${escapeAttr(profileUrl(ghost))}" target="_blank" rel="noopener noreferrer">@${escapeHTML(ghost.username)}</a>
            ${ghost.verified ? `<span class="xe-tag xe-tag--blue">${escapeHTML(t("verified"))}</span>` : ""}
          </div>
          <div class="xe-row-sub">${escapeHTML(ghost.name)} · ${escapeHTML(t("followersCount", { count: formatCompact(ghost.followers) }))}</div>
        </div>
        <a class="xe-icon-btn" href="${escapeAttr(profileUrl(ghost))}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(t("openProfile"))}" aria-label="${escapeAttr(t("openProfile"))}">${SVG.open}</a>
      </div>`).join("");
  }

  function renderBars(buckets, labels, bestIndex) {
    const max = Math.max(...buckets.map((b) => b.avg), 1);
    return `
      <div class="xe-bars" style="grid-template-columns: repeat(${buckets.length}, 1fr)">
        ${buckets.map((b, i) => `
          <div class="xe-bar-col" title="${escapeAttr(`${labels[i]} · ${b.n} · ${b.avg.toFixed(1)}`)}">
            <span class="xe-bar-fill ${i === bestIndex ? "xe-bar-fill--best" : ""} ${b.n ? "" : "xe-bar-fill--empty"}" style="height:${Math.max(b.n ? 6 : 2, Math.round((b.avg / max) * 100))}%"></span>
          </div>`).join("")}
      </div>
      <div class="xe-bar-labels" style="grid-template-columns: repeat(${buckets.length}, 1fr)">
        ${labels.map((label, i) => `<span>${buckets.length > 12 ? (i % 6 === 0 ? escapeHTML(label) : "") : escapeHTML(label)}</span>`).join("")}
      </div>`;
  }

  function renderPostsTab(view) {
    const s = view.stats;
    const hourLabels = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
    const dayLabels = t("days");
    const stat = (label, value) => `<div class="xe-statbox"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`;
    return `
      <div class="xe-posts">
        <div class="xe-stats">
          ${stat(t("statPosts"), formatCount(s.count))}
          ${stat(t("statViews"), formatCompact(s.views))}
          ${stat(t("statAvgViews"), formatCompact(Math.round(s.avgViews)))}
          ${stat(t("statRate"), formatPercent(s.rate))}
          ${stat(t("statLikes"), formatCompact(s.likes))}
          ${stat(t("statAvgLikes"), formatCount(Math.round(s.avgLikes * 10) / 10))}
        </div>
        <div class="xe-chart">
          <div class="xe-chart-head"><h3>${escapeHTML(t("bestHours"))}</h3>${s.bestHour >= 0 ? `<span>${escapeHTML(t("bestAt", { value: hourLabel(s.bestHour) }))}</span>` : ""}</div>
          ${renderBars(s.hours, hourLabels, s.bestHour)}
        </div>
        <div class="xe-chart">
          <div class="xe-chart-head"><h3>${escapeHTML(t("bestDays"))}</h3>${s.bestDay >= 0 ? `<span>${escapeHTML(t("bestAt", { value: dayLabels[s.bestDay] }))}</span>` : ""}</div>
          ${renderBars(s.days, dayLabels, s.bestDay)}
          <p class="xe-small">${escapeHTML(t("bestHint"))}</p>
        </div>
        <div class="xe-chart">
          <div class="xe-chart-head"><h3>${escapeHTML(t("topPosts"))}</h3></div>
          ${s.top.map((tw) => `
            <a class="xe-post" href="https://x.com/i/status/${escapeAttr(tw.id)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(t("openPost"))}">
              <span class="xe-post-text">${escapeHTML(tw.text || t("noText"))}</span>
              <span class="xe-post-stats">
                <span class="xe-stat-like">${SVG.heart}${formatCompact(tw.likes)}</span>
                <span class="xe-stat-repost">${SVG.repost}${formatCompact(tw.reposts)}</span>
                <span class="xe-stat-reply">${SVG.reply}${formatCompact(tw.replies)}</span>
                <span class="xe-muted">${escapeHTML(formatCompact(tw.views))} 👁</span>
              </span>
            </a>`).join("")}
        </div>
      </div>`;
  }

  function avatarHTML(user) {
    return `<img class="xe-avatar" src="${escapeAttr(user.avatar || "")}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
  }

  function profileUrl(user) {
    return `https://x.com/${encodeURIComponent(user.username)}`;
  }

  function bindBody(body) {
    body.querySelector("[data-action='start']")?.addEventListener("click", () => {
      state.report = null;
      startScan();
    });
    body.querySelector("[data-action='show-last']")?.addEventListener("click", () => {
      state.mode = "results";
      state.tab = "circle";
      renderBody();
    });
    body.querySelectorAll("[data-action='resume']").forEach((el) => el.addEventListener("click", () => startScan({ resume: true })));
    body.querySelectorAll("[data-action='restart']").forEach((el) => el.addEventListener("click", () => {
      state.report = null;
      startScan();
    }));
    body.querySelector("[data-action='new']")?.addEventListener("click", () => {
      state.mode = "idle";
      state.error = "";
      renderBody();
    });
    body.querySelectorAll("[data-option]").forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.getAttribute("data-option");
        state.settings[key] = input.type === "checkbox" ? input.checked : Number(input.value);
        persist();
      });
    });
    body.querySelector("[data-action='pause']")?.addEventListener("click", () => {
      state.scanPaused = !state.scanPaused;
      const btn = body.querySelector("[data-action='pause']");
      if (btn) btn.textContent = t(state.scanPaused ? "resume" : "pause");
      updateProgressDOM();
      wakeUp();
    });
    body.querySelector("[data-action='skip-op']")?.addEventListener("click", () => {
      if (state.waitingOp) state.skipOps.add(state.waitingOp);
      wakeUp();
    });
    body.querySelector("[data-action='cancel']")?.addEventListener("click", () => {
      state.scanCancelled = true;
      state.scanPaused = false;
      abortRequests();
      wakeUp();
    });
    body.querySelectorAll("[data-tab]").forEach((el) => el.addEventListener("click", () => {
      state.tab = el.getAttribute("data-tab");
      state.search = "";
      renderBody();
    }));
    body.querySelectorAll("[data-filter]").forEach((el) => el.addEventListener("click", () => {
      const key = el.getAttribute("data-filter");
      state.filters[key] = !state.filters[key];
      renderBody();
    }));
    body.querySelector("[data-search]")?.addEventListener("input", (event) => {
      state.search = event.target.value;
      const list = body.querySelector("[data-list]");
      if (!list) return;
      const view = reportView();
      list.innerHTML = state.tab === "ghosts" ? renderGhostRows(displayedGhosts(view)) : renderFanRows(displayedFans(view), view);
    });
    body.querySelector("[data-action='copy']")?.addEventListener("click", copyUsernames);
    body.querySelector("[data-action='csv']")?.addEventListener("click", downloadCSV);
    body.querySelector("[data-action='summary']")?.addEventListener("click", copySummary);
    body.querySelector("[data-action='circle-post']")?.addEventListener("click", postCircle);
    body.querySelector("[data-action='circle-copy']")?.addEventListener("click", async () => {
      if (state.circle.blob && await copyImage(state.circle.blob)) toast(t("circleCopied"));
    });
    body.querySelector("[data-action='circle-download']")?.addEventListener("click", () => {
      if (state.circle.blob) downloadBlob(state.circle.blob, `x-circle-${new Date().toISOString().slice(0, 10)}.png`);
    });
    bindCircle(body);
  }

  // ---------- export ----------

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { }
      ta.remove();
      return ok;
    }
  }

  async function copyUsernames() {
    const view = reportView();
    const users = state.tab === "ghosts" ? displayedGhosts(view) : displayedFans(view);
    if (!users.length) return;
    if (await copyText(users.map((u) => "@" + u.username).join("\n"))) toast(t("copiedToast", { count: users.length }));
  }

  function summaryText(view) {
    const fans = visibleFans(view.fans).slice(0, 5).map((f) => "@" + f.username).join(", ") || "-";
    const s = view.stats;
    return t("summaryText", {
      tweets: view.tweets.length,
      fans,
      hour: s.bestHour >= 0 ? hourLabel(s.bestHour) : "-",
      day: s.bestDay >= 0 ? t("days")[s.bestDay] : "-",
      views: formatCount(Math.round(s.avgViews)),
      ghosts: view.ghosts ? formatCount(view.ghosts.length) : "-"
    });
  }

  async function copySummary() {
    if (await copyText(summaryText(reportView()))) toast(t("summaryCopied"));
  }

  function toCSV(rows) {
    return rows.map((row) => row.map((cell) => {
      const value = String(cell ?? "");
      return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(",")).join("\n");
  }

  function csvRows(view, tab) {
    if (tab === "ghosts") {
      return [["username", "name", "followers", "verified", "profile"],
        ...displayedGhosts(view).map((g) => [g.username, g.name, g.followers, g.verified, profileUrl(g)])];
    }
    if (tab === "posts") {
      return [["id", "date", "text", "views", "likes", "reposts", "replies", "quotes", "bookmarks", "url"],
        ...view.report.tweets.map((tw) => [tw.id, tw.created ? new Date(tw.created).toISOString() : "", tw.text, tw.views, tw.likes, tw.reposts, tw.replies, tw.quotes, tw.bookmarks, `https://x.com/i/status/${tw.id}`])];
    }
    return [["rank", "username", "name", "score", "likes", "reposts", "replies", "quotes", "mentions", "follows_you", "profile"],
      ...view.fans.map((f, i) => [i + 1, f.username, f.name, f.score, f.l, f.r, f.c, f.q || 0, f.m || 0, f.followsYou == null ? "" : f.followsYou, profileUrl(f)])];
  }

  function downloadCSV() {
    const view = reportView();
    const blob = new Blob(["\ufeff" + toCSV(csvRows(view, state.tab))], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `x-${state.tab}-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- circle image ----------

  function circleLayout(fanCount) {
    const slots = [];
    let rank = 0;
    CIRCLE_RINGS.forEach((ring, r) => {
      const n = Math.min(ring.count, Math.max(0, fanCount - rank));
      for (let i = 0; i < n; i += 1) {
        // Middle ring is turned half a step so its avatars sit between the others.
        const angle = -Math.PI / 2 + (i / n) * Math.PI * 2 + (r === 1 ? Math.PI / n : 0);
        slots.push({ rank, ring: r, x: CIRCLE_CENTER.x + Math.cos(angle) * ring.radius, y: CIRCLE_CENTER.y + Math.sin(angle) * ring.radius, size: ring.size });
        rank += 1;
      }
    });
    return slots;
  }

  const CIRCLE_CAPACITY = CIRCLE_RINGS.reduce((sum, ring) => sum + ring.count, 0);

  // The people drawn on the circle, in slot order. Hidden people are either drawn
  // as an anonymous placeholder in their own spot or left out so the next ones move up.
  function circleFans(fans) {
    if (state.hideMode === "remove") return fans.filter((f) => !state.hidden.has(f.id)).slice(0, CIRCLE_CAPACITY);
    return fans.slice(0, CIRCLE_CAPACITY).map((f) => (state.hidden.has(f.id) ? { ...f, hidden: true } : f));
  }

  // People listed under the circle for hiding: everyone on it, plus hidden ones that were taken off.
  function hideCandidates(fans) {
    if (state.hideMode !== "remove") return fans.slice(0, CIRCLE_CAPACITY);
    const list = [];
    let shown = 0;
    for (const fan of fans) {
      if (shown >= CIRCLE_CAPACITY) break;
      list.push(fan);
      if (!state.hidden.has(fan.id)) shown += 1;
    }
    return list;
  }

  function visibleFans(fans) {
    return fans.filter((f) => !state.hidden.has(f.id));
  }

  function circleBase(report) {
    return [report.viewerId, report.finishedAt || report.index, Object.keys(report.people).length].join(":");
  }

  function circleKey(report, fans) {
    const drawn = circleFans(fans || reportView().fans).map((f) => f.id + (f.hidden ? "h" : "")).join(",");
    return [circleBase(report), state.language, state.hideMode, drawn].join(":");
  }

  function viewerProfile(report) {
    if (report.viewer) return report.viewer;
    const user = readInitialState()?.entities?.users?.entities?.[report.viewerId];
    return user ? { username: user.screen_name || "", name: user.name || "", avatar: user.profile_image_url_https || "" } : { username: "", name: "", avatar: "" };
  }

  // Pictures are cached so the circle redraws quickly when someone is hidden.
  function loadImage(url) {
    if (!url) return Promise.resolve(null);
    if (imageCache.has(url)) return imageCache.get(url);
    const promise = new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => resolve(null), 8000);
      img.crossOrigin = "anonymous";
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = url.replace(/_normal(\.\w+)$/, "_400x400$1");
    });
    imageCache.set(url, promise);
    return promise;
  }

  function colorFor(text) {
    let hash = 0;
    for (const ch of String(text)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    return `hsl(${Math.abs(hash) % 360}, 55%, 42%)`;
  }

  function fitText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let cut = text;
    while (cut.length > 1 && ctx.measureText(cut + "…").width > maxWidth) cut = cut.slice(0, -1);
    return cut + "…";
  }

  function drawSilhouette(ctx, x, y, r) {
    ctx.fillStyle = "#2f3336";
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = "#5b6167";
    ctx.beginPath();
    ctx.arc(x, y - r * 0.18, r * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.78, r * 0.68, r * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAvatar(ctx, img, user, x, y, r, ringColor, ringWidth, glow) {
    ctx.save();
    if (glow && !user.hidden) {
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = 28;
    }
    ctx.beginPath();
    ctx.arc(x, y, r + ringWidth, 0, Math.PI * 2);
    ctx.fillStyle = user.hidden ? "#3e4144" : ringColor;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    if (user.hidden) {
      drawSilhouette(ctx, x, y, r);
    } else if (img) {
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = colorFor(user.username || "?");
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${Math.round(r * 0.9)}px ${CIRCLE_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((user.username || "?").charAt(0).toUpperCase(), x, y + 2);
    }
    ctx.restore();
  }

  // fans: the people to draw, in slot order (see circleFans). Returns the slots with ids.
  function drawCircle(canvas, view, viewer, fans, images) {
    const ctx = canvas.getContext("2d");
    const { x: cx, y: cy } = CIRCLE_CENTER;
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, CIRCLE_H * 0.7);
    bg.addColorStop(0, "#132b4a");
    bg.addColorStop(0.55, "#08111f");
    bg.addColorStop(1, "#000000");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CIRCLE_W, CIRCLE_H);

    CIRCLE_RINGS.forEach((ring, i) => {
      ctx.beginPath();
      ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
      ctx.strokeStyle = ring.guide;
      ctx.lineWidth = i === 0 ? 3 : 2;
      ctx.setLineDash(i === 0 ? [] : [6, 12]);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    const slots = circleLayout(fans.length);
    for (const slot of [...slots].reverse()) {
      const ring = CIRCLE_RINGS[slot.ring];
      const fan = fans[slot.rank];
      drawAvatar(ctx, fan.hidden ? null : images[slot.rank + 1], fan, slot.x, slot.y, slot.size, ring.color, slot.ring === 0 ? 6 : 4, slot.ring === 0);
    }
    for (const slot of slots.filter((s) => s.ring === 0)) {
      const fan = fans[slot.rank];
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      if (!fan.hidden) {
        ctx.font = `700 24px ${CIRCLE_FONT}`;
        ctx.fillStyle = "#e7e9ea";
        ctx.fillText(fitText(ctx, "@" + fan.username, 210), slot.x, slot.y + slot.size + 14);
      }
      const bx = slot.x + slot.size * 0.74;
      const by = slot.y - slot.size * 0.74;
      ctx.beginPath();
      ctx.arc(bx, by, 22, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd400";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#08111f";
      ctx.stroke();
      ctx.fillStyle = "#0f1419";
      ctx.font = `800 24px ${CIRCLE_FONT}`;
      ctx.textBaseline = "middle";
      ctx.fillText(String(slot.rank + 1), bx, by + 1);
    }
    drawAvatar(ctx, images[0], viewer, cx, cy, 112, "#ffffff", 8, true);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 58px ${CIRCLE_FONT}`;
    ctx.fillText(t("circleTitle"), 56, 92);
    ctx.fillStyle = "#8b98a5";
    ctx.font = `500 28px ${CIRCLE_FONT}`;
    ctx.fillText(t("circleSub", { tweets: view.tweets.length }), 56, 138);

    ctx.font = `700 26px ${CIRCLE_FONT}`;
    ctx.fillStyle = "#e7e9ea";
    if (viewer.username) ctx.fillText("@" + viewer.username, 56, CIRCLE_H - 32);
    ctx.textAlign = "right";
    ctx.fillStyle = "#8b98a5";
    ctx.font = `500 22px ${CIRCLE_FONT}`;
    ctx.fillText(new Date(view.report.finishedAt || Date.now()).toLocaleDateString(state.language === "tr" ? "tr-TR" : "en-US", { day: "numeric", month: "long", year: "numeric" }), CIRCLE_W - 56, CIRCLE_H - 32);
    return slots.map((slot) => ({ id: fans[slot.rank].id, x: slot.x, y: slot.y, size: slot.size }));
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("empty image"))), "image/png");
      } catch (error) {
        reject(error);
      }
    });
  }

  async function renderCircleImage(view) {
    const fans = circleFans(view.fans);
    const viewer = viewerProfile(view.report);
    // A hidden person's picture is never even loaded.
    const images = await Promise.all([viewer.avatar, ...fans.map((f) => (f.hidden ? "" : f.avatar))].map(loadImage));
    const make = () => {
      const canvas = document.createElement("canvas");
      canvas.width = CIRCLE_W;
      canvas.height = CIRCLE_H;
      return canvas;
    };
    const shown = images.slice(1).filter((_, i) => !fans[i].hidden);
    try {
      const canvas = make();
      const slots = drawCircle(canvas, view, viewer, fans, images);
      return { blob: await canvasBlob(canvas), slots, noImages: shown.length > 0 && shown.every((img) => !img) };
    } catch {
      // A picture served without CORS headers blocks export; redraw with initials.
      const canvas = make();
      const slots = drawCircle(canvas, view, viewer, fans, images.map(() => null));
      return { blob: await canvasBlob(canvas), slots, noImages: true };
    }
  }

  async function ensureCircle() {
    const report = state.report;
    if (!report || state.circle.busy) return;
    const view = reportView();
    const key = circleKey(report, view.fans);
    if (state.circle.key === key && (state.circle.url || state.circle.failed)) return;
    if (!view.fans.length) return;
    state.circle.busy = true;
    let next;
    try {
      const { blob, slots, noImages } = await renderCircleImage(view);
      next = { key, base: circleBase(report), blob, slots, url: URL.createObjectURL(blob), noImages, failed: false, busy: false };
    } catch (error) {
      console.error("[xe] circle failed:", error);
      next = { key, base: circleBase(report), blob: null, slots: [], url: "", noImages: false, failed: true, busy: false };
    }
    if (state.circle.url) URL.revokeObjectURL(state.circle.url);
    state.circle = next;
    if (!destroyed && state.mode === "results" && state.tab === "circle") renderBody();
  }

  function toggleHidden(id) {
    if (!id) return;
    if (state.hidden.has(id)) state.hidden.delete(id);
    else state.hidden.add(id);
    persist();
    renderBody();
  }

  function renderCircleTab(view) {
    if (!view.fans.length) return `<div class="xe-empty">${escapeHTML(t("circleNoFans"))}</div>`;
    const current = state.circle.key === circleKey(view.report, view.fans);
    const ready = current && state.circle.url;
    // While a new version is drawn, the previous picture stays up (dimmed) instead of a blank box.
    const stale = !current && state.circle.url && state.circle.base === circleBase(view.report);
    const preview = ready || stale
      ? `<img src="${escapeAttr(state.circle.url)}" alt="${escapeAttr(t("circleTitle"))}" ${ready ? "data-circle-img" : `class="xe-circle-stale"`}>`
      : `<div class="xe-circle-loading">${escapeHTML(current && state.circle.failed ? t("circleFailed") : t("circleRendering"))}</div>`;
    const candidates = hideCandidates(view.fans);
    const hiddenHere = candidates.filter((f) => state.hidden.has(f.id)).length;
    const anyHidden = view.fans.some((f) => state.hidden.has(f.id));
    const chips = candidates.map((fan) => {
      const off = state.hidden.has(fan.id);
      return `
        <button type="button" class="xe-hide-chip ${off ? "xe-hide-chip--off" : ""}" data-hide-id="${escapeAttr(fan.id)}" aria-pressed="${off}" title="${escapeAttr(t("hideToggle", { username: fan.username }))}">
          ${avatarHTML(fan)}<span>@${escapeHTML(fan.username)}</span>
        </button>`;
    }).join("");
    return `
      <div class="xe-circle">
        <div class="xe-circle-preview">${preview}</div>
        <p class="xe-small">${escapeHTML(t("circleHint"))}</p>
        ${ready && state.circle.noImages ? `<p class="xe-small">${escapeHTML(t("circleNoImages"))}</p>` : ""}
        <div class="xe-circle-actions">
          <button type="button" class="xe-btn xe-btn--primary" data-action="circle-post" ${ready ? "" : "disabled"}>${escapeHTML(t("circleTweet"))}</button>
          <button type="button" class="xe-btn" data-action="circle-copy" ${ready ? "" : "disabled"}>${escapeHTML(t("circleCopy"))}</button>
          <button type="button" class="xe-btn" data-action="circle-download" ${ready ? "" : "disabled"}>${escapeHTML(t("circleDownload"))}</button>
        </div>
        <div class="xe-hide">
          <div class="xe-hide-head">
            <strong>${escapeHTML(t("hideTitle"))}</strong>
            ${hiddenHere ? `<span class="xe-muted">${escapeHTML(t("hiddenCount", { count: hiddenHere }))}</span>` : ""}
          </div>
          <p class="xe-small">${escapeHTML(t("hideHint"))}</p>
          <div class="xe-seg" role="group" aria-label="${escapeAttr(t("hideTitle"))}">
            <button type="button" data-hide-mode="blur" aria-pressed="${state.hideMode === "blur"}">${escapeHTML(t("hideBlur"))}</button>
            <button type="button" data-hide-mode="remove" aria-pressed="${state.hideMode === "remove"}">${escapeHTML(t("hideRemove"))}</button>
          </div>
          <p class="xe-small">${escapeHTML(t(state.hideMode === "remove" ? "hideRemoveHint" : "hideBlurHint"))}</p>
          <div class="xe-hide-list">${chips}</div>
          ${anyHidden ? `<button type="button" class="xe-btn xe-btn--ghost xe-btn--small" data-action="unhide-all">${escapeHTML(t("unhideAll"))}</button>` : ""}
        </div>
      </div>`;
  }

  function bindCircle(body) {
    const img = body.querySelector("[data-circle-img]");
    img?.addEventListener("click", (event) => {
      const rect = img.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * CIRCLE_W;
      const y = ((event.clientY - rect.top) / rect.height) * CIRCLE_H;
      const slot = state.circle.slots.find((s) => Math.hypot(s.x - x, s.y - y) <= s.size + 8);
      if (slot) toggleHidden(slot.id);
    });
    img?.addEventListener("mousemove", (event) => {
      const rect = img.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * CIRCLE_W;
      const y = ((event.clientY - rect.top) / rect.height) * CIRCLE_H;
      img.style.cursor = state.circle.slots.some((s) => Math.hypot(s.x - x, s.y - y) <= s.size + 8) ? "pointer" : "";
    });
    body.querySelectorAll("[data-hide-id]").forEach((el) => el.addEventListener("click", () => toggleHidden(el.getAttribute("data-hide-id"))));
    body.querySelectorAll("[data-hide-mode]").forEach((el) => el.addEventListener("click", () => {
      state.hideMode = el.getAttribute("data-hide-mode") === "remove" ? "remove" : "blur";
      persist();
      renderBody();
    }));
    body.querySelector("[data-action='unhide-all']")?.addEventListener("click", () => {
      state.hidden.clear();
      persist();
      renderBody();
    });
  }

  async function copyImage(blob) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return true;
    } catch {
      return false;
    }
  }

  function waitForElement(selector, timeout) {
    return new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - started > timeout) return resolve(null);
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  // Opens X's own post box with the image attached and the text filled in.
  // You still review it and press Post yourself.
  async function fillComposer(blob, text) {
    const button = document.querySelector('a[data-testid="SideNav_NewTweet_Button"]');
    if (!button) return false;
    button.click();
    const input = await waitForElement('[role="dialog"] input[data-testid="fileInput"]', 6000);
    if (!input) return false;
    try {
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], "x-circle.png", { type: "image/png" }));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const editor = await waitForElement('[role="dialog"] [data-testid="tweetTextarea_0"]', 3000);
      if (editor) {
        editor.focus();
        document.execCommand("insertText", false, text);
      }
      return true;
    } catch (error) {
      console.warn("[xe] could not fill the post box:", error);
      return false;
    }
  }

  // Hidden people are never tagged.
  function circlePostText(fans) {
    const tags = circleFans(fans).filter((f) => !f.hidden).slice(0, 5).map((f) => "@" + f.username);
    return tags.length ? t("tweetText", { mentions: tags.join(" ") }) : t("tweetTextPlain");
  }

  async function postCircle() {
    const blob = state.circle.blob;
    if (!blob) return;
    const text = circlePostText(reportView().fans);
    const copied = await copyImage(blob);
    setMinimized(true);
    if (await fillComposer(blob, text)) {
      toast(t("composerReady"));
      return;
    }
    if (!copied) downloadBlob(blob, `x-circle-${new Date().toISOString().slice(0, 10)}.png`);
    const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
    if (!window.open(intent, "_blank", "noopener")) location.assign(intent);
    toast(t(copied ? "composerFallback" : "composerDownloaded"));
  }

  // ---------- settings dialog ----------

  function showSettings() {
    const fields = [
      ["maxListPages", "setListPages", 1, 1, 10],
      ["maxMentionPages", "setMentionPages", 1, 0, 10],
      ["maxFollowers", "setMaxFollowers", 100, 100, 100000],
      ["requestDelayMin", "setDelayMin", 100, 0],
      ["requestDelayMax", "setDelayMax", 100, 0],
      ["pauseEveryRequests", "setPauseEvery", 1, 0],
      ["pauseMs", "setPauseMs", 1000, 0]
    ];
    const formHTML = fields.map(([key, label, step, min, max]) => `
      <label class="xe-field" for="xe-set-${key}">
        <span>${escapeHTML(t(label))}</span>
        <input id="xe-set-${key}" type="number" min="${min}"${max ? ` max="${max}"` : ""} step="${step}" data-setting="${key}" value="${Number(state.settings[key])}">
      </label>`).join("");
    showDialog({
      title: t("settingsTitle"),
      body: t("settingsBody"),
      contentHTML: `<div class="xe-form">${formHTML}</div>`,
      confirmLabel: t("save"),
      extraLabel: t("restoreDefaults"),
      onConfirm: (dialog) => {
        dialog.querySelectorAll("[data-setting]").forEach((input) => {
          const key = input.getAttribute("data-setting");
          const val = Number(input.value);
          const max = input.max ? Number(input.max) : Infinity;
          if (Number.isFinite(val) && val >= Number(input.min || 0) && val <= max) state.settings[key] = val;
        });
        persist();
        toast(t("saved"));
      },
      onExtra: (dialog) => {
        dialog.querySelectorAll("[data-setting]").forEach((input) => {
          input.value = DEFAULT_SETTINGS[input.getAttribute("data-setting")];
        });
      }
    });
  }

  function showDialog({ title, body, contentHTML, confirmLabel, extraLabel, onConfirm, onExtra }) {
    dialogCounter += 1;
    const titleId = `${APP_ID}-dialog-title-${dialogCounter}`;
    const previouslyFocused = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "xe-overlay";
    overlay.innerHTML = `
      <div class="xe-dialog" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
        <h3 id="${titleId}">${escapeHTML(title)}</h3>
        ${body ? `<p>${escapeHTML(body)}</p>` : ""}
        ${contentHTML || ""}
        <div class="xe-dialog-actions">
          ${extraLabel ? `<button type="button" class="xe-btn xe-btn--ghost xe-btn--small" data-extra>${escapeHTML(extraLabel)}</button>` : ""}
          <button type="button" class="xe-btn xe-btn--small" data-cancel>${escapeHTML(t("cancel"))}</button>
          <button type="button" class="xe-btn xe-btn--small xe-btn--primary" data-confirm>${escapeHTML(confirmLabel)}</button>
        </div>
      </div>`;
    document.getElementById(APP_ID).appendChild(overlay);
    const dialog = overlay.querySelector(".xe-dialog");
    const close = () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (closeActiveDialog === close) closeActiveDialog = null;
      overlay.remove();
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = [...dialog.querySelectorAll("button, input")].filter((el) => !el.disabled);
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
    if (extraLabel && onExtra) overlay.querySelector("[data-extra]").addEventListener("click", () => onExtra(dialog));
    (dialog.querySelector("input") || dialog).focus();
  }

  // ---------- timing ----------

  // Several steps can sleep at once; wakeUp() wakes all of them (pause, cancel, skip).
  function interruptibleSleep(ms) {
    return new Promise((resolve) => {
      let timer = null;
      const finish = (expired) => {
        if (!sleepers.has(finish)) return;
        sleepers.delete(finish);
        clearTimeout(timer);
        resolve(expired);
      };
      sleepers.add(finish);
      timer = setTimeout(() => finish(true), Math.max(0, ms));
    });
  }

  function wakeUp() {
    for (const finish of [...sleepers]) finish(false);
  }

  async function waitWhile(predicate, interval = 1000) {
    while (predicate()) await interruptibleSleep(interval);
  }

  let waitCounter = 0;

  async function sleepWithCountdown(ms, reasonKey) {
    const id = ++waitCounter;
    let remaining = Math.max(0, ms);
    try {
      while (remaining > 0) {
        if (halted()) break;
        if (state.scanPaused) {
          state.waits.delete(id);
          updateCountdownDOM();
          await waitWhile(() => state.scanPaused && !halted());
          continue;
        }
        state.waits.set(id, { until: Date.now() + remaining, reason: reasonKey });
        updateCountdownDOM();
        const before = Date.now();
        const expired = await interruptibleSleep(remaining);
        remaining = expired ? 0 : Math.max(0, remaining - (Date.now() - before));
      }
    } finally {
      state.waits.delete(id);
      updateCountdownDOM();
    }
  }

  // The longest wait worth showing; short gaps between requests would only flicker.
  function currentWait() {
    const now = Date.now();
    let shown = null;
    for (const wait of state.waits.values()) {
      const ms = wait.until - now;
      if (ms <= 0 || (wait.reason === "waitPause" && ms < 3000)) continue;
      if (!shown || wait.until > shown.until) shown = wait;
    }
    return shown;
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
    const node = document.querySelector?.(`#${APP_ID} [data-countdown]`);
    if (!node) return;
    const wait = currentWait();
    if (!wait) {
      node.textContent = "";
      return;
    }
    const ms = Math.max(0, wait.until - Date.now());
    node.textContent = t(wait.reason || "waitPause", { seconds: Math.ceil(ms / 1000), time: formatDuration(ms) });
  }

  function updateProgressDOM() {
    const root = document.querySelector?.(`#${APP_ID}`);
    if (!root) return;
    const pill = root.querySelector("[data-pill-label]");
    if (pill) pill.textContent = pillLabel();
    const body = root.querySelector("[data-body]");
    if (!body) return;
    const { current, total, label, note } = state.progress;
    const percent = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
    const counter = progressCounter();
    const bar = body.querySelector("[data-progress-bar]");
    if (bar) bar.style.width = percent + "%";
    const box = body.querySelector("[data-bar]");
    if (box) {
      if (total) box.setAttribute("aria-valuenow", String(percent));
      else box.removeAttribute("aria-valuenow");
      box.setAttribute("aria-valuetext", counter);
    }
    const counterEl = body.querySelector("[data-progress-counter]");
    if (counterEl) counterEl.textContent = counter;
    const labelEl = body.querySelector("[data-progress-label]");
    if (labelEl) labelEl.textContent = state.scanPaused ? t("paused") : t(label);
    const noteEl = body.querySelector("[data-progress-note]");
    if (noteEl) noteEl.textContent = note || "";
  }

  function toast(message) {
    const root = document.getElementById?.(APP_ID);
    if (!root) return;
    root.querySelector(".xe-toast")?.remove();
    if (toastTimer) clearTimeout(toastTimer);
    const node = document.createElement("div");
    node.className = "xe-toast";
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
  --xe-bg: #000000; --xe-bg-2: #16181c; --xe-bg-3: #202327;
  --xe-line: rgba(231,233,234,0.12); --xe-line-strong: rgba(231,233,234,0.24);
  --xe-text: #e7e9ea; --xe-muted: #71767b;
  --xe-accent: #1d9bf0; --xe-accent-2: #4cb3f5;
  --xe-like: #f91880; --xe-repost: #00ba7c; --xe-reply: #1d9bf0; --xe-gold: #ffd400;
  position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;
  color: var(--xe-text); color-scheme: dark;
  font: 14px/1.45 "TwitterChirp", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
}
#${APP_ID} > * { pointer-events: auto; }
#${APP_ID} :focus-visible { outline: 2px solid var(--xe-accent); outline-offset: 2px; }
#${APP_ID} button, #${APP_ID} input, #${APP_ID} select, #${APP_ID} a { font: inherit; color: inherit; }
#${APP_ID} a { text-decoration: none; }
#${APP_ID} button { cursor: pointer; }
#${APP_ID} .xe-list, #${APP_ID} .xe-tab-body { scrollbar-width: thin; scrollbar-color: var(--xe-line-strong) transparent; }
#${APP_ID} .xe-panel {
  position: absolute; width: ${PANEL_WIDTH}px; max-width: calc(100vw - 24px); max-height: calc(100vh - 24px);
  display: flex; flex-direction: column; background: var(--xe-bg); border: 1px solid var(--xe-line-strong);
  border-radius: 16px; box-shadow: 0 0 15px rgba(255,255,255,0.12), 0 24px 60px rgba(0,0,0,0.6);
  overflow: hidden; animation: xe-pop 0.18s ease-out;
}
@keyframes xe-pop { from { opacity: 0; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: none; } }
#${APP_ID} .xe-header { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 12px 12px 14px; border-bottom: 1px solid var(--xe-line); cursor: grab; user-select: none; }
#${APP_ID} .xe-header.xe-dragging { cursor: grabbing; }
#${APP_ID} .xe-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
#${APP_ID} .xe-brand-mark { font-size: 20px; font-weight: 700; line-height: 1; }
#${APP_ID} .xe-brand-text { min-width: 0; }
#${APP_ID} .xe-brand-text strong { display: block; font-size: 15px; font-weight: 700; }
#${APP_ID} .xe-brand-text span { display: block; font-size: 11px; color: var(--xe-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${APP_ID} .xe-header-actions { display: flex; gap: 4px; flex-shrink: 0; }
#${APP_ID} .xe-header-actions button { width: 30px; height: 30px; display: grid; place-items: center; border: none; background: transparent; border-radius: 999px; color: var(--xe-muted); font-size: 11px; font-weight: 700; }
#${APP_ID} .xe-header-actions button:hover { background: var(--xe-bg-3); color: var(--xe-text); }
#${APP_ID} .xe-body { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
#${APP_ID} .xe-welcome { padding: 26px 22px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; overflow-y: auto; }
#${APP_ID} .xe-welcome-icon { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; background: rgba(29,155,240,0.15); color: var(--xe-accent); }
#${APP_ID} .xe-welcome-icon--error { background: rgba(244,33,46,0.15); color: #f4212e; }
#${APP_ID} .xe-welcome h2 { margin: 0; font-size: 18px; font-weight: 700; }
#${APP_ID} .xe-welcome p { margin: 0; color: var(--xe-muted); font-size: 13px; max-width: 340px; }
#${APP_ID} .xe-welcome-actions { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 4px; }
#${APP_ID} .xe-options { width: 100%; display: flex; flex-direction: column; gap: 8px; margin-top: 4px; padding: 12px 14px; background: var(--xe-bg-2); border-radius: 12px; text-align: left; }
#${APP_ID} .xe-option-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; }
#${APP_ID} .xe-option-row select { background: var(--xe-bg); border: 1px solid var(--xe-line-strong); border-radius: 8px; padding: 4px 8px; }
#${APP_ID} .xe-option-check { justify-content: flex-start; cursor: pointer; }
#${APP_ID} .xe-option-check input { accent-color: var(--xe-accent); width: 16px; height: 16px; margin: 0; flex-shrink: 0; }
#${APP_ID} .xe-small { color: var(--xe-muted); font-size: 12px !important; }
#${APP_ID} .xe-detail { font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace !important; color: var(--xe-muted); overflow-wrap: anywhere; user-select: all; }
#${APP_ID} .xe-notice { margin: 12px 16px 0; padding: 12px 14px; border: 1px solid rgba(255,212,0,0.4); border-radius: 12px; background: rgba(255,212,0,0.08); font-size: 13px; }
#${APP_ID} .xe-notice strong { display: block; margin-bottom: 4px; }
#${APP_ID} .xe-notice p { margin: 0; color: var(--xe-muted); font-size: 12px; }
#${APP_ID} .xe-notice-reason { margin-top: 6px !important; color: var(--xe-text) !important; }
#${APP_ID} .xe-notice-actions { display: flex; gap: 8px; margin-top: 10px; }
#${APP_ID} .xe-btn { border: 1px solid var(--xe-line-strong); background: transparent; color: var(--xe-text); padding: 8px 16px; border-radius: 999px; font-size: 13px; font-weight: 700; }
#${APP_ID} .xe-btn:hover:not(:disabled) { background: rgba(231,233,234,0.1); }
#${APP_ID} .xe-btn--primary { background: var(--xe-text); border-color: var(--xe-text); color: #0f1419; }
#${APP_ID} .xe-btn--primary:hover:not(:disabled) { background: #d7dbdc; }
#${APP_ID} .xe-btn--ghost { border-color: transparent; color: var(--xe-accent); }
#${APP_ID} .xe-btn--lg { padding: 11px 24px; font-size: 15px; }
#${APP_ID} .xe-btn--small { padding: 6px 12px; font-size: 12px; }
#${APP_ID} .xe-progress { padding: 22px 20px; display: flex; flex-direction: column; gap: 14px; }
#${APP_ID} .xe-progress-head h2 { margin: 0; font-size: 15px; font-weight: 700; }
#${APP_ID} .xe-progress-head p { margin: 4px 0 0; color: var(--xe-muted); font-size: 12px; min-height: 1em; }
#${APP_ID} .xe-bar { height: 6px; border-radius: 3px; background: var(--xe-bg-3); overflow: hidden; }
#${APP_ID} .xe-bar > span { display: block; height: 100%; background: var(--xe-accent); transition: width 0.3s ease; }
#${APP_ID} .xe-bar:not([aria-valuenow]) > span { width: 30% !important; animation: xe-slide 1.6s ease-in-out infinite; }
@keyframes xe-slide { from { transform: translateX(-100%); } to { transform: translateX(340%); } }
#${APP_ID} .xe-progress-meta { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
#${APP_ID} .xe-progress-actions { display: flex; gap: 8px; }
#${APP_ID} .xe-results { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
#${APP_ID} .xe-tabs { flex-shrink: 0; display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid var(--xe-line); margin-top: 6px; }
#${APP_ID} .xe-tab { border: 0; background: transparent; padding: 12px 6px 10px; color: var(--xe-muted); font-weight: 700; font-size: 13px; border-bottom: 3px solid transparent; }
#${APP_ID} .xe-tab:hover { background: rgba(231,233,234,0.05); }
#${APP_ID} .xe-tab--on { color: var(--xe-text); border-bottom-color: var(--xe-accent); }
#${APP_ID} .xe-tab-count { font-weight: 500; color: var(--xe-muted); font-size: 12px; }
#${APP_ID} .xe-tab-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; max-height: 58vh; }
#${APP_ID} .xe-summary { padding: 12px 16px 4px; font-size: 13px; color: var(--xe-muted); }
#${APP_ID} .xe-note { margin: 6px 16px 0; font-size: 12px; color: var(--xe-muted); padding: 8px 10px; border-radius: 8px; background: var(--xe-bg-2); }
#${APP_ID} .xe-search-row { padding: 8px 16px; }
#${APP_ID} .xe-search { width: 100%; height: 36px; padding: 0 14px; border: 1px solid transparent; border-radius: 999px; background: var(--xe-bg-3); color: var(--xe-text); outline: none; }
#${APP_ID} .xe-search:focus { border-color: var(--xe-accent); background: var(--xe-bg); }
#${APP_ID} .xe-filters { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 10px; }
#${APP_ID} .xe-chip { padding: 4px 10px; border: 1px solid var(--xe-line-strong); border-radius: 999px; background: transparent; color: var(--xe-muted); font-size: 12px; }
#${APP_ID} .xe-chip--on { background: rgba(29,155,240,0.12); border-color: rgba(29,155,240,0.5); color: var(--xe-accent-2); }
#${APP_ID} .xe-list { border-top: 1px solid var(--xe-line); }
#${APP_ID} .xe-empty { padding: 34px 20px; text-align: center; color: var(--xe-muted); font-size: 13px; }
#${APP_ID} .xe-row { display: grid; grid-template-columns: 26px 40px 1fr auto; gap: 10px; padding: 8px 16px; align-items: center; border-bottom: 1px solid var(--xe-line); }
#${APP_ID} .xe-row--ghost { grid-template-columns: 40px 1fr auto; }
#${APP_ID} .xe-row:hover { background: rgba(231,233,234,0.03); }
#${APP_ID} .xe-rank { font: 700 13px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--xe-muted); text-align: right; font-variant-numeric: tabular-nums; }
#${APP_ID} .xe-rank--top { color: var(--xe-gold); }
#${APP_ID} .xe-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: var(--xe-bg-3); }
#${APP_ID} .xe-row-text { min-width: 0; }
#${APP_ID} .xe-row-name { display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; font-size: 13px; font-weight: 700; }
#${APP_ID} .xe-row-name > a { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
#${APP_ID} .xe-row-name a:hover { text-decoration: underline; }
#${APP_ID} .xe-row-sub { font-size: 12px; color: var(--xe-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${APP_ID} .xe-row-stats, #${APP_ID} .xe-post-stats { display: flex; gap: 12px; font-size: 12px; font-variant-numeric: tabular-nums; margin-top: 2px; }
#${APP_ID} .xe-row-stats span, #${APP_ID} .xe-post-stats span { display: inline-flex; align-items: center; gap: 4px; }
#${APP_ID} .xe-stat-like { color: var(--xe-like); }
#${APP_ID} .xe-stat-repost { color: var(--xe-repost); }
#${APP_ID} .xe-stat-reply { color: var(--xe-reply); }
#${APP_ID} .xe-stat-quote { color: #ffad1f; }
#${APP_ID} .xe-stat-mention { color: #c084fc; }
#${APP_ID} .xe-score-hint { padding: 2px 16px 4px; font-size: 11px; color: var(--xe-muted); }
#${APP_ID} .xe-circle { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
#${APP_ID} .xe-circle p { margin: 0; }
#${APP_ID} .xe-circle-preview { border-radius: 12px; overflow: hidden; background: var(--xe-bg-2); aspect-ratio: ${CIRCLE_W} / ${CIRCLE_H}; display: grid; place-items: center; }
#${APP_ID} .xe-circle-preview img { width: 100%; height: 100%; display: block; }
#${APP_ID} .xe-circle-loading { color: var(--xe-muted); font-size: 13px; }
#${APP_ID} .xe-circle-actions { display: flex; gap: 8px; flex-wrap: wrap; }
#${APP_ID} .xe-circle-stale { opacity: 0.55; transition: opacity 0.2s; }
#${APP_ID} .xe-hide { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; padding-top: 12px; border-top: 1px solid var(--xe-line); }
#${APP_ID} .xe-hide-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
#${APP_ID} .xe-seg { display: inline-flex; align-self: flex-start; padding: 3px; border-radius: 999px; background: var(--xe-bg-3); }
#${APP_ID} .xe-seg button { border: 0; background: transparent; padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; color: var(--xe-muted); }
#${APP_ID} .xe-seg button[aria-pressed="true"] { background: var(--xe-text); color: #0f1419; }
#${APP_ID} .xe-hide-list { display: flex; flex-wrap: wrap; gap: 6px; }
#${APP_ID} .xe-hide-chip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 3px 10px 3px 3px; border: 1px solid var(--xe-line-strong); border-radius: 999px; background: transparent; font-size: 12px; font-weight: 700; }
#${APP_ID} .xe-hide-chip:hover { background: rgba(231,233,234,0.06); }
#${APP_ID} .xe-hide-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px; }
#${APP_ID} .xe-hide-chip .xe-avatar { width: 22px; height: 22px; }
#${APP_ID} .xe-hide-chip--off { border-style: dashed; color: var(--xe-muted); }
#${APP_ID} .xe-hide-chip--off span { text-decoration: line-through; }
#${APP_ID} .xe-hide-chip--off .xe-avatar { filter: grayscale(1) blur(1.5px); opacity: 0.5; }
#${APP_ID} .xe-btn:disabled { opacity: 0.4; cursor: not-allowed; }
#${APP_ID} .xe-score { min-width: 34px; text-align: center; padding: 3px 8px; border-radius: 999px; background: var(--xe-bg-3); font-weight: 700; font-size: 12px; font-variant-numeric: tabular-nums; }
#${APP_ID} .xe-tag { flex-shrink: 0; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; background: var(--xe-bg-3); color: var(--xe-muted); text-transform: uppercase; letter-spacing: 0.02em; }
#${APP_ID} .xe-tag--blue { background: rgba(29,155,240,0.15); color: var(--xe-accent-2); }
#${APP_ID} .xe-icon-btn { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 999px; color: var(--xe-muted); }
#${APP_ID} .xe-icon-btn:hover { background: rgba(29,155,240,0.1); color: var(--xe-accent); }
#${APP_ID} .xe-posts { padding: 14px 16px; display: flex; flex-direction: column; gap: 16px; }
#${APP_ID} .xe-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
#${APP_ID} .xe-statbox { background: var(--xe-bg-2); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
#${APP_ID} .xe-statbox span { font-size: 11px; color: var(--xe-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${APP_ID} .xe-statbox strong { font-size: 17px; font-variant-numeric: tabular-nums; }
#${APP_ID} .xe-chart { display: flex; flex-direction: column; gap: 8px; }
#${APP_ID} .xe-chart-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
#${APP_ID} .xe-chart-head h3 { margin: 0; font-size: 14px; }
#${APP_ID} .xe-chart-head span { font-size: 12px; color: var(--xe-gold); font-weight: 700; }
#${APP_ID} .xe-bars { display: grid; gap: 3px; height: 72px; align-items: end; }
#${APP_ID} .xe-bar-col { height: 100%; display: flex; align-items: flex-end; }
#${APP_ID} .xe-bar-fill { width: 100%; border-radius: 3px 3px 0 0; background: rgba(29,155,240,0.55); }
#${APP_ID} .xe-bar-fill--best { background: var(--xe-gold); }
#${APP_ID} .xe-bar-fill--empty { background: var(--xe-bg-3); }
#${APP_ID} .xe-bar-labels { display: grid; gap: 3px; font-size: 10px; color: var(--xe-muted); }
#${APP_ID} .xe-bar-labels span { white-space: nowrap; }
#${APP_ID} .xe-post { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border: 1px solid var(--xe-line); border-radius: 12px; }
#${APP_ID} .xe-post:hover { background: rgba(231,233,234,0.03); }
#${APP_ID} .xe-post-text { font-size: 13px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
#${APP_ID} .xe-actionbar { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--xe-line); flex-wrap: wrap; }
#${APP_ID} .xe-actionbar-right { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
#${APP_ID} .xe-muted { color: var(--xe-muted); font-size: 12px; }
#${APP_ID} .xe-overlay { position: fixed; inset: 0; background: rgba(91,112,131,0.4); display: grid; place-items: center; padding: 20px; z-index: 1; }
#${APP_ID} .xe-dialog { width: 100%; max-width: 400px; background: var(--xe-bg); border-radius: 16px; padding: 20px; box-shadow: 0 30px 80px rgba(0,0,0,0.55); }
#${APP_ID} .xe-dialog h3 { margin: 0 0 8px; font-size: 17px; }
#${APP_ID} .xe-dialog p { margin: 0 0 14px; color: var(--xe-muted); font-size: 13px; }
#${APP_ID} .xe-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
#${APP_ID} .xe-dialog-actions [data-extra] { margin-right: auto; }
#${APP_ID} .xe-form { display: grid; gap: 8px; }
#${APP_ID} .xe-field { display: grid; grid-template-columns: 1fr 100px; align-items: center; gap: 10px; font-size: 12px; color: var(--xe-muted); }
#${APP_ID} .xe-field input { height: 32px; padding: 0 10px; border: 1px solid var(--xe-line-strong); border-radius: 6px; background: var(--xe-bg-2); color: var(--xe-text); }
#${APP_ID} .xe-toast { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); padding: 10px 16px; background: var(--xe-accent); color: #fff; border-radius: 6px; font-size: 13px; pointer-events: none; animation: xe-pop 0.18s ease-out; }
#${APP_ID} .xe-pill { position: absolute; display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; background: var(--xe-bg); border: 1px solid var(--xe-line-strong); color: var(--xe-text); border-radius: 999px; box-shadow: 0 0 12px rgba(255,255,255,0.12); font-size: 12px; font-weight: 700; }
#${APP_ID} .xe-pill-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--xe-muted); }
#${APP_ID} .xe-pill-dot--active { background: var(--xe-accent); animation: xe-pulse 1.4s infinite; }
@keyframes xe-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
@media (max-width: 480px) {
  #${APP_ID} .xe-panel { width: calc(100vw - 16px) !important; left: 8px !important; right: 8px !important; top: 8px !important; bottom: 8px !important; max-height: calc(100vh - 16px) !important; }
  #${APP_ID} .xe-tab-body { max-height: none; }
}
@media (prefers-reduced-motion: reduce) {
  #${APP_ID} *, #${APP_ID} *::before, #${APP_ID} *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
`;

  if (IS_TEST) {
    globalThis.__XE_TEST__({
      parseTweetTimeline, parseUserTimeline, parseReplies, normalizeTweet, normalizeUser, addInteraction,
      rankFans, findGhosts, computeStats, likeCoverage, toCSV, summaryText, parseOperationsFromBundle,
      graphqlUrl, createReport, loadSettings, renderIdleView, renderScanView, renderResultsView, state, t, I18N,
      parseSearchTweets, operationFromUrl, recordRequest, captured, apiFromWebpack, circleLayout, drawCircle, CIRCLE_RINGS, CIRCLE_W, CIRCLE_H, CIRCLE_CENTER,
      circleFans, hideCandidates, circlePostText, renderCircleTab, normalizeReport, runListStep, runSearchStep, loadFollowers, LIST_STEPS,
      runParallel, syncIndex, engagementParts, progressCounter, sleepWithCountdown, interruptibleSleep, wakeUp, currentWait,
      CSS, APP_ID, recordTransaction, softly, setApi: (api) => { state.api = api; }
    });
    return;
  }

  cleanupExisting();
  injectStyles();
  mount();
})();
