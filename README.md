# X araçları

**Site: https://anilcolakk.github.io** — iki araç, kısa anlatım ve kopyalanabilir kod.
The site lives in `docs/` (GitHub Pages). After changing a script, run `node build-web.js` to copy it into `docs/`.

# X Unfollower

Finds the accounts you follow on X (Twitter) that don't follow you back. You can optionally unfollow them, slowly.
It needs no app, no extension and no third-party login. It runs in your own x.com tab using the session you're already signed in with, and it only talks to x.com.

## Kullanım (TR)
1. Bilgisayarda Chrome / Edge / Firefox ile **https://x.com** adresini aç ve giriş yap.
2. **F12** tuşuna bas → **Console** sekmesine geç.
3. Chrome yapıştırmayı engellerse önce `allow pasting` yazıp Enter'a bas.
4. `x-unfollower.js` dosyasının tamamını kopyala, konsola yapıştır, Enter'a bas.
5. Sağ altta açılan panelde **Taramayı başlat**'a bas. Tarama bitene kadar sekmeyi önde tut.

Hata alırsan profilindeki **Takip edilenler** sayfasını bir kez açıp kodu yeniden yapıştır.

## Usage (EN)
1. Open **https://x.com** on a desktop browser and sign in.
2. Press **F12** and open the **Console** tab.
3. If Chrome blocks pasting, type `allow pasting` and press Enter.
4. Paste the whole `x-unfollower.js` and press Enter.
5. Click **Scan now** in the panel (bottom right). Keep the tab in front while it runs.

If it says it can't find the API, open your profile's **Following** page once, then paste the script again.

## How it works
- Loads your **Following** list through the same internal API x.com itself uses. Each entry says whether that person follows you, so usually one list is enough.
- If X leaves that field out, it also loads your **Followers** list and compares the two.
- It reads X's own rate-limit headers and waits until the limit resets instead of pushing through.
- Progress is saved in your browser for 24 hours, so an interrupted scan can resume where it stopped.
- **Unfollow** only runs after you confirm. It waits 6–10 s between unfollows, takes a 5-minute break every 10, and stops right away if X pushes back. You can change the timings in ⚙ Settings.

## Safety notes
- Scanning is read-only and is similar to scrolling your lists by hand.
- This uses X's private web API, which X doesn't officially allow for automation. Bulk unfollowing can get an account temporarily limited, so keep the delays slow and unfollow in small batches.
- Only paste code you've read or trust. Never paste anything into the console that someone sends you and asks you to "just run".

---

# X Etkileşim Raporu / X Engagement Report (`x-engagement.js`)

Tek araçta dört bölüm:
- **Çember:** Ortada sen, en içteki halkada en çok etkileşen 5 kişi, dışa doğru sonraki 10 ve 15 kişi. Paylaşmalık bir görsel olarak çizilir. **Paylaş** düğmesi X'in gönderi kutusunu görsel ve metin eklenmiş şekilde açar; sen kontrol edip Gönder'e basarsın. Ayrıca **PNG indir** ve **Görseli kopyala** düğmeleri var. Paylaşmadan önce istediğin kişileri gizleyebilirsin: görselde ya da altındaki listede kişiye tıkla. **Anonim göster** seçiliyken gizlenen kişinin yeri kalır ama fotoğrafı ve adı görünmez. **Tamamen çıkar** seçiliyken gizlenen kişi çemberden çıkar ve sıradaki kişi onun yerine geçer. Gizlenenler paylaşım metninde etiketlenmez.
- **Hayranlar:** Son 50–400 gönderinle kimin, nasıl etkileştiği. Puanlama: beğeni 1, yeniden gönderi 2, yanıt 3, alıntı 4, bahsetme 4. Seni takip etmeyen hayranlar işaretlenir.
- **Hayaletler:** Seni takip edip bu gönderilerle hiç etkileşmeyen takipçiler. Varsayılan olarak en yeni 3.000 takipçin kontrol edilir; bu sınırı ⚙ Ayarlar'dan değiştirebilirsin.
- **Gönderiler:** Toplam ve ortalama görüntülenme, etkileşim oranı, en iyi saat ve gün, en iyi 5 gönderi.

Kullanımı unfollower ile aynı: x.com'da konsola yapıştır, gönderi sayısını seç, **Raporu oluştur**'a bas. Listeler kopyalanabilir ve CSV olarak indirilebilir. **Özeti kopyala** ile paylaşmalık kısa bir metin alırsın.

Notlar:
- X beğenileri gizli tuttuğu için sadece **kendi** gönderilerini kimin beğendiğini görebilirsin. Araç da yalnızca kendi hesabın için çalışır.
- Beğeni, yeniden gönderi, yanıt, arama ve takipçi adımları aynı anda çalışır. X'in her biri için ayrı bir hız sınırı var, ve istekler arasında yine en az 0,3 sn bırakılır. 100 gönderilik bir rapor genelde birkaç dakika sürer.
- Her gönderiden en fazla 300 beğenen ve yeniden gönderen, ilk sayfadaki yanıtlar sayılır. X'in gösterdiği sayıya ulaşılınca fazladan sayfa istenmez. Bu sınırı ⚙ Ayarlar'dan değiştirebilirsin.
- Alıntılar ve bahsetmeler X araması ile bulunur. Tüm alıntılar tek bir aramayla bulunur, her gönderi için ayrı arama yapılmaz. X aramaya izin vermezse ya da arama sınırı dolarsa rapor bunlar olmadan tamamlanır ve bunu bir notla belirtir.
- Sadece okur, hesabında hiçbir şey değiştirmez. Rapor tarayıcının IndexedDB deposunda 7 gün saklanır. Büyük takipçi listeleri de buraya sığar. Yarıda kalan rapor kaldığı yerden devam eder.
- Panel X'in bir sayfasını henüz göremediyse "Bir adım gerekiyor" der ve hangi sayfayı açman gerektiğini yazar (ör. bir gönderinin Beğeniler listesi). O sayfayı **aynı sekmede** açman yeterli; kodu yeniden yapıştırmana gerek yok, panel kendiliğinden devam eder. Gerekirse "Bu adımı atla" ile geçebilirsin; atlanan etkileşim türü o raporda sayılmaz.
- X bir adımı (ör. takipçi listesi) reddederse rapor durmaz: o adım atlanır, rapor geri kalanıyla tamamlanır ve neyin eksik kaldığı HTTP koduyla birlikte yazılır. Rapor yalnızca gönderilerin hiç yüklenemezse durur.
