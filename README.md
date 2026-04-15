<div align="center">

# InstaFollowKit

### Instagram Takip Analiz Aracı

[![Sürüm](https://img.shields.io/badge/sürüm-v1.0.0-ea580c?style=flat-square)](https://github.com/bahadir-b-bekdemir/insta-follow-kit)
[![Dil](https://img.shields.io/badge/dil-JavaScript-f7df1e?style=flat-square&logo=javascript)](https://github.com/bahadir-b-bekdemir/insta-follow-kit)
[![Platform](https://img.shields.io/badge/platform-Tarayıcı%20Konsolu-4ade80?style=flat-square)](https://github.com/bahadir-b-bekdemir/insta-follow-kit)
[![Lisans](https://img.shields.io/badge/lisans-MIT-60a5fa?style=flat-square)](LICENSE)

**Tarayıcı konsoluna bir kez yapıştırın. Takip listenizi tam gücüyle analiz edin.**

**Depo:** [github.com/bahadir-b-bekdemir/insta-follow-kit](https://github.com/bahadir-b-bekdemir/insta-follow-kit)

</div>

---

## İçindekiler

- [Nedir?](#nedir)
- [Özellikler](#özellikler)
- [Kurulum](#kurulum)
- [Kullanım](#kullanım) — tarama, liste, toplu işlem, HD, beyaz liste, geçmiş, ayarlar, dışa aktarma
- [Teknik yapı](#teknik-yapı)
- [Güvenlik ve sorumluluk](#güvenlik-ve-sorumluluk)
- [Sık sorulan sorular](#sık-sorulan-sorular)
- [Lisans](#lisans)

---

## Nedir?

**InstaFollowKit**, Instagram takip listenizi tarayıp karşılıklı takip etmeyenleri, yalnızca sizi takip edenleri ve tüm takipçilerinizi sekmeli bir tablo hâlinde sunan bir tarayıcı betik aracıdır. Üçüncü taraf uygulama, eklenti ya da şifre paylaşımı gerektirmez. Instagram'ın kendi oturumunuz üzerinde çalışır.

Araç sıfırdan tasarlanmış, bağımsız bir JavaScript IIFE'dir — framework ya da dışa bağımlılık yoktur.

**Platform:** `www.instagram.com` · masaüstü tarayıcı · oturum açık sekme  
**Mobil tarayıcılar desteklenmez.**

---

## Özellikler

### Liste ve analiz
| Özellik | Açıklama |
|---|---|
| Sekmeli görünüm | Takip Etmeyenler · Karşılıklı · Takipçi · Tüm Liste · ⭐ Beyaz Liste |
| Canlı arama | Sekmede anlık kullanıcı adı filtresi |
| Sıralama | A→Z, Z→A, Doğrulanmış Önce, Gizli Önce, Fotoğrafsız Önce |
| Rozet kartları | Onaylı ✓, İşletme 🏢, Gizli 🔒, Fotoğrafsız 👤, Karşılıklı ⇄ |
| Harf bölümleri | Listeyi harfe göre daralt / genişlet |

### Toplu işlem
| Özellik | Açıklama |
|---|---|
| Toplu takipten çıkarma | Seçili kullanıcıları güvenli aralıklarla bırakır |
| Toplu takipçi kaldırma | Sizi takip edeni listeden çıkarır |
| Geri alma | Son işlem grubunu tek tıkla geri al |
| ⭐ Beyaz liste | Korunan kişiler yanlışlıkla seçilemiyor |

### Güvenli mod
| Özellik | Açıklama |
|---|---|
| Akıllı zamanlama | Instagram rate-limit bantlarına uyumlu referans süreler |
| İnsan modu | Rastgele bekleme süreleri (bot davranışını maskeler) |
| Seri molalar | Her 7 istekte seri mola, her ~50 işlemde uzun mola |
| Saatlik/günlük limit | Yapılandırılabilir istek sınırı; aşılınca otomatik dur |
| Güvenlik kilidi | Varsayılan olarak açık; kaldırmak için bilinçli onay gerekir |

### HD profil önizleme
| Özellik | Açıklama |
|---|---|
| HD görsel | Avatara tıkla → tam boyut profil fotoğrafı |
| PNG / JPG indirme | Görseli doğrudan indir |
| Panoya kopyalama | Blob URL ile tek tıkla kopyala |
| Yumuşak animasyon | Blur + scale ile yavaş açılış efekti |

### Dışa aktarma
| Format | İçerik |
|---|---|
| **JSON** | `{ _meta: { surum, tarih, kayitSayisi }, kullanicilar: [...] }` |
| **CSV** | UTF-8 BOM, Excel uyumlu, açıklamalı başlık bloku |
| **Pano** | Kullanıcı adı listesini metin olarak kopyala |

### Arayüz
- **7 canlı tema:** mor, mavi, pembe, turuncu, cam, kırmızı, altın
- Karanlık mod tasarım, responsive yan panel
- Sayfalama, işlem geçmişi (tarih/saat damgalı)

---

## Kurulum

1. [`insta-follow-kit.js`](insta-follow-kit.js) dosyasının **tamamını** kopyalayın. GitHub’da [depo kökündeki dosyayı](https://github.com/bahadir-b-bekdemir/insta-follow-kit/blob/main/insta-follow-kit.js) açıp **Raw** görünümünden `Ctrl+A` → `Ctrl+C` en pratik yöntemdir (veya ham bağlantı: `https://github.com/bahadir-b-bekdemir/insta-follow-kit/raw/main/insta-follow-kit.js`).
2. Tarayıcıda `https://www.instagram.com` adresine gidin ve **oturum açın** (ana sayfa yeterlidir; profil sayfasında olmanız şart değildir).
3. **Geliştirici konsolunu** açın:

| Tarayıcı | Kısayol |
|---|---|
| Chrome / Edge | `F12` veya `Ctrl + Shift + J` |
| Firefox | `F12` veya `Ctrl + Shift + K` |
| Brave | `F12` veya `Ctrl + Shift + J` |
| Safari | `Cmd + Option + C` (Geliştirici menüsü açık olmalı) |

4. **Console** sekmesini seçin, konsola tıklayın, kodu yapıştırın (`Ctrl+V` / `Cmd+V`) ve **Enter**’a basın.

Araç birkaç saniye içinde kendi arayüzünü açar.

> Bazı tarayıcılar konsolda yapıştırmayı kısıtlar. Chrome’da uyarı çıkarsa kutuya tam olarak `allow pasting` yazıp Enter’a basın, ardından kodu tekrar yapıştırın.

---

## Kullanım

### Tarama başlatma

Başlangıç ekranında **TARAMAYI BAŞLAT** butonuna tıklayın. Tarama iki aşamadır: önce takip listeniz, sonra takipçiler yüklenir. İlerleme ortadaki çubukta görünür.

> Tarama sırasında sekmeyi kapatmayın; pencereyi küçültmek sorun değildir.

### Liste ekranı

Tarama bitince sekmeler, arama, sıralama ve rozetler kullanılabilir. Liste başlığında **JSON** ve **CSV** ile dışa aktarım vardır; tarama bitmeden bu butonlar pasif kalır.

**Sekmeler:** Takip Etmeyenler · Karşılıklı · Takipçi · Tüm Takipçiler · ⭐ Beyaz Liste  

**Rozet özeti:** onaylı, işletme, gizli, fotoğrafsız, karşılıklı (satırda rozetler; çoklu ise `+N` ile özetlenir).

### Takipten çıkarma ve takipçi kaldırma

Satır seçim kutularıyla seçin; yan panelden **TAKİBİ BIRAK** veya **TAKİPÇİYİ KALDIR** ile işlemi başlatın. İşlem ekranında tablo, filtreler ve duraklat / geri al seçenekleri vardır. Güvenli mod açıkken işlemler arası bekleme süreleri uygulanır.

### HD profil önizleme

Listede **profile fotoğrafına** tıklayın; açılan panelde **PNG**, **JPG**, **Kopyala** ve kapatma vardır. Aynı avatara yeniden tıklamak önizlemeyi kapatır.

### Beyaz liste

Satırdaki **⭐** ile ekleyip çıkarırsınız. Beyaz listedekiler toplu seçimde işaretlenemez. Veriler `localStorage`’da saklanır.

### İşlem geçmişi

**Geçmiş** sekmesinde tabloda durum, kullanıcı adı, ad soyad (yeni kayıtlarda), işlem türü ve tarih/saat görünür. Arama ile süzebilir; **Temizle** tüm geçmişi siler. En fazla **500** kayıt tutulur.

### Ayarlar ve güvenli mod

**Ayarlar**dan tema (7 renk) ve güvenlik kilidi yönetilir. Kilit açıkken önerilen zamanlama korunur; gelişmiş değerler için kilidi bilinçli olarak kaldırmanız gerekir. Kilit açıkken yazar bilgi paneli görünebilir.

| Ayar | Varsayılan (referans) | Açıklama |
|---|---|---|
| Tarama istekleri arası | 1000 ms | İki istek arası bekleme |
| Referans zamanlama | Açık | Bant uyumu |
| Seri mola | 10 000 ms | Her 7 istekte ek mola |
| Her 25 sayfada mola | 3000 ms | Klasik mod |
| Takip bırakma arası | 4000 ms | |
| Uzun mola | 300 000 ms | ~50 işlem sonrası |
| Saatlik / günlük limit | 200 / 4800 | Aşılınca durur |

### Dışa aktarma

**JSON** örnek yapı:

```json
{
  "_meta": {
    "arac": "InstaFollowKit",
    "surum": "1.0.0",
    "olusturulmaIso": "2026-04-14T08:39:10.000Z",
    "olusturulmaYerel": "14.04.2026 11:39:10",
    "kayitSayisi": 87
  },
  "kullanicilar": [ ]
}
```

Dosya adı örneği: `instagram_analiz_v1_0_0.json`

**CSV:** UTF-8 BOM; dosya adı örneği `instagram_analiz_v1_0_0.csv`

---

## Teknik yapı

```
insta-follow-kit.js
├── Sabitler & Profiller     — VERSIYON, VARSAYILAN, GUVENLI_PROFIL, TEMALAR
├── Yardımcılar              — esc(), toast(), bekle(), rastgeleMola()
├── Instagram API            — cozHdProfilPicUrl(), tarama istekleri
├── Depo (localStorage)      — ayarlar, beyazListe, gecmis, sayaçlar
├── Güvenlik                 — Guvenlik{}, limit kontrolleri
├── Render Motoru            — ekranTarama(), ekranBirakma(), ekranGecmis()...
├── Etkinlikler              — etkinlikler(), baglaAyarlarPanel()
├── Dışa Aktarma             — Aktar.json(), Aktar.csv(), Aktar.pano()
└── Başlatıcı                — basla() → stilEkle() → render()
```

| | |
|---|---|
| **Dil** | Saf JavaScript (ES2020+) |
| **Bağımlılık** | Yok — tarayıcıda doğrudan çalışır |
| **Depolama** | `localStorage` |
| **Boyut** | ~4.1k satır, tek dosya |

---

## Güvenlik ve sorumluluk

> ⚠️ Bu araç Instagram kullanım koşullarıyla çelişebilir. Yalnızca **kendi hesabınızda**, **kendi riskinizle** kullanın.

- Şifre veya üçüncü tarafa veri gönderilmez; yalnızca mevcut oturum çerezleri kullanılır.
- İşlemler tarayıcıda yerel kalır.
- Güvenli mod ve limitler hesap kısıtlaması riskini azaltmaya yöneliktir; garanti vermez.
- Saatlik (**200**) ve günlük (**4800**) limitleri aşmayın; günde çok yüksek sayıda takipten çıkma işleminden kaçının.
- Güvenli modu kapatırsanız riski bilerek üstlenmiş olursunuz.
- Uzun işlemler sırasında sekmeyi kapatmayın.
- Hesabınız kısıtlandıysa bir süre işlem yapmayın.

---

## Sık sorulan sorular

**Şifrem güvende mi?** Evet; araç yalnızca açık tarayıcı oturumunuzu kullanır, şifre istemez ve veriyi dışarı göndermez.

**Tarama ne kadar sürer?** Takip ve takipçi sayısına bağlıdır; güvenli modda bekleme süreleri uzatabilir.

**Tarama yarıda kesildi.** Sekmeyi kapatmayın. Gerekirse sayfayı yenileyip betiği konsoldan yeniden çalıştırın.

**Güvenli modu kapatmalı mıyım?** Genelde hayır; varsayılanlar güvenlik için önerilir.

**Geçmiş kayboldu.** `localStorage` temizlenirse silinir; önemli listeleri düzenli JSON/CSV ile yedekleyin.

**Araç açılmıyor.** Instagram oturumunuzun geçerli olduğundan emin olun; `F5` ile sayfayı yenileyip betiği tekrar yapıştırın.

---

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.

---

<div align="center">

Yazar: **Bahadır B. Bekdemir**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/bahadir-b-bekdemir/)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/bahadir-b-bekdemir/insta-follow-kit)

*InstaFollowKit v1.0.0*

</div>
