# ADR 0001 — Kurallar için kendi ifade dilimiz ve parser'ımız

- Durum: Kabul edildi
- Tarih: 2026-11-23

## Bağlam

Form tanımındaki `visibleWhen`, `requiredWhen`, `disabledWhen` ve `computed.expression` kuralları ürün ekibi
tarafından yazılır ve **iki yerde** çalışmalıdır:

1. Tarayıcıda, kullanıcı yazarken (alan göster/gizle, hesaplanan değer).
2. Sunucuda, cevap kaydedilirken: istemciye güvenilmez, aynı kurallar yeniden uygulanır.

İki tarafın aynı girdiye aynı sonucu vermesi şarttır; aksi halde tarayıcıda geçerli görünen bir cevap sunucuda reddedilir
ya da tersi olur.

## Seçenekler

| Seçenek | Neden olmadı |
|---|---|
| JavaScript `eval` / `new Function` | Tanımı yazan kişi tarayıcıda keyfi kod çalıştırabilir. Sunucuda karşılığı yok (Java'da JS motoru gömmek ağır ve ayrı bir güvenlik yüzeyi). |
| JSONLogic gibi JSON tabanlı kural formatı | Güvenli ve iki dilde kütüphanesi var, ama `{"==": [{"var": "hasLpg"}, true]}` ürün ekibinin elle yazacağı bir şey değil; tasarımcıda okunaklı gösterimi de zor. Kütüphanelerin uç durum davranışları (null, tip dönüşümü) birebir aynı değil. |
| Spring Expression Language (SpEL) | Sadece Java tarafı; ayrıca tip erişimi ve metot çağrısı gibi, kısıtlanması gereken güçlü özellikleri var. |
| **Küçük, kendi dilimiz** | Seçildi. |

## Karar

`hasLpg == true && modelYear >= 2015` gibi okunaklı, küçük bir dil: karşılaştırma, `&& || !`, aritmetik ve 12 sabit
fonksiyon. Her iki tarafta **tokenizer → recursive descent parser → AST yorumlayıcı** (TypeScript: `engine/rules`,
Java: `forms/expression`). Dinamik kod çalıştırma yok.

Dil **totaldir**: geçerli bir ifade hiçbir veriyle istisna fırlatmaz; tip uyuşmazlığı, sıfıra bölme, geçersiz tarih
`null` üretir. Bu, iki dilin farklı istisna davranışlarını eşitlemenin en basit yolu ve formun eksik veriyle çökmemesini
sağlar.

İki motorun eşitliği **ortak fixture** ile korunur: `fixtures/expression-cases.json` (değerlendirme sonuçları, hata
mesajları ve satır/sütunları, bağımlılık listeleri). Java ve TypeScript testleri aynı dosyayı okur; yeni bir dil
özelliği önce oraya vaka olarak eklenir.

## Sonuçlar

- (+) Güvenli: AST'de olmayan hiçbir şey çalışmaz; fonksiyon listesi kapalıdır.
- (+) Hata mesajları iki tarafta birebir aynı ve satır/sütunlu; tasarımcıdaki anlık kontrol, backend'in vereceği hatayı
  gösterir.
- (+) Değişkenler sinyallerden okunduğu için Angular `computed()` bağımlılık grafiğini kendiliğinden kurar; kısa devre
  edilen dal bağımlılık oluşturmaz.
- (−) İki implementasyonun bakımı: her değişiklik iki dilde yapılmalı. Fixture bunu zorunlu ve görünür kılar.
- (−) Sayılar her iki tarafta da IEEE double; `0.1 + 0.2` gibi durumlar iki tarafta aynı (yanlış) sonucu verir.
  Para hesapları için `round()` kullanılır.
