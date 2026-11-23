# Kural İfade Dili

`visibleWhen`, `requiredWhen`, `disabledWhen` ve `computed` alanların `expression` anahtarı bu dille yazılır.
Dil küçük, yan etkisiz ve **totaldir**: geçerli bir ifade hiçbir veri için istisna fırlatmaz; anlamsız
işlemler `null` üretir. Böylece eksik veya beklenmedik veri formu çökertmez.

Aynı dil iki yerde çalışır:

| Taraf    | Kod                                              | Kullanım |
|----------|--------------------------------------------------|----------|
| Frontend | `frontend/src/app/engine/rules`                  | Anlık görünürlük, zorunluluk, hesaplama |
| Backend  | `backend/.../forms/expression`                   | Tanım doğrulama, gönderilen cevabı yeniden doğrulama |

İki tarafın aynı sonucu verdiği **ortak fixture** ile test edilir: [`fixtures/expression-cases.json`](../fixtures/expression-cases.json).
Java ve TypeScript testleri bu dosyayı okur; yeni bir dil özelliği önce oraya vaka olarak eklenir.
`eval`, `new Function` veya benzeri hiçbir dinamik kod çalıştırma kullanılmaz: tokenizer → recursive descent parser → AST yorumlayıcı.

## Sözdizimi

```text
expression  = or
or          = and ( "||" and )*
and         = equality ( "&&" equality )*
equality    = comparison ( ( "==" | "!=" ) comparison )*
comparison  = additive ( ( "<" | "<=" | ">" | ">=" ) additive )*
additive    = multiplicative ( ( "+" | "-" ) multiplicative )*
multiplicative = unary ( ( "*" | "/" | "%" ) unary )*
unary       = ( "!" | "-" ) unary | primary
primary     = number | string | "true" | "false" | "null"
            | identifier "(" [ expression ( "," expression )* ] ")"
            | identifier
            | "(" expression ")"
number      = digit+ [ "." digit+ ]
string      = "'" … "'" | '"' … '"'        kaçış: \\  \'  \"  \n  \t
identifier  = [A-Za-z_] [A-Za-z0-9_]*
```

Önce bütün girdi token'lara ayrılır (karakter hataları önce raporlanır), sonra parse edilir. Bir isimden hemen sonra
`(` geliyorsa fonksiyon çağrısıdır; fonksiyon adı `(` görüldüğünde, argüman sayısı `)` görüldüğünde kontrol edilir.
Fonksiyon adıyla aynı isimde bir alan olabilir (`age(birthDate) > age` geçerlidir).

Öncelik düşükten yükseğe: `||`, `&&`, `== !=`, `< <= > >=`, `+ -`, `* / %`, tekli `! -`. Aynı seviyedeki ikili
operatörler soldan sağa bağlanır. Boşluk ve satır sonu serbesttir.

## Değerler

`number` (çift duyarlıklı kayan nokta), `string`, `boolean`, `null`, liste (multiselect değeri, repeater satırları)
ve nesne (repeater satırı). Tarih ayrı bir tip değildir: `YYYY-MM-DD` metnidir; bu biçim sözlük sırasıyla
karşılaştırıldığında doğru sıralanır (`startDate >= today()`).

Değişken = alan id'si. Değeri olmayan veya **gizli** alan `null` okunur.

## Anlam

| İşlem | Kural |
|-------|-------|
| `a + b` | İki sayı → toplam. İki metin → birleştirme. Diğer her durum → `null`. |
| `- * / %` | İki sayı → sonuç; sıfıra bölme / mod → `null`. Diğer → `null`. `%` kalanın işareti bölünenin işaretidir. |
| `-a` | Sayı → negatifi, diğer → `null`. |
| `a == b`, `a != b` | Katı eşitlik: tipler farklıysa eşit değildir (`1 == '1'` yanlış). `null == null` doğru. Listeler ve nesneler derin karşılaştırılır. |
| `< <= > >=` | İki sayı veya iki metin (UTF-16 kod birimi sırası) karşılaştırılır; diğer her durum **yanlış**. |
| `&& \|\| !` | Kısa devre; sonuç her zaman `boolean`. |

**Doğruluk:** `null`, `false`, `0`, `''` ve boş liste yanlış sayılır; diğer her şey doğrudur. `visibleWhen` vb. kurallar
sonucu bu kurala göre yorumlar.

## Fonksiyonlar

`today` değerlendirme bağlamından gelir (test edilebilirlik için saat enjekte edilir).

| Fonksiyon | Argüman | Sonuç |
|-----------|---------|-------|
| `currentYear()` | 0 | Bugünün yılı. |
| `today()` | 0 | Bugün, `YYYY-MM-DD`. |
| `age(date)` | 1 | `date`'ten bugüne tamamlanmış yıl. Geçersiz tarih → `null`. |
| `daysBetween(from, to)` | 2 | `to - from` gün farkı (negatif olabilir). Geçersiz tarih → `null`. |
| `len(text)` | 1 | Metin uzunluğu veya liste eleman sayısı; `null` → `0`; diğer → `null`. |
| `count(list)` | 1 | Liste eleman sayısı; `null` → `0`; diğer → `null`. |
| `contains(x, value)` | 2 | Liste ise `value`'ya eşit eleman var mı; metin ise alt metin mi; `null` → `false`. |
| `isEmpty(value)` | 1 | `null`, boşluktan ibaret metin veya boş liste → `true`. |
| `round(n, digits?)` | 1–2 | Yarım yukarı (sıfırdan uzağa) yuvarlama; `digits` 0–10 tam sayı, varsayılan 0. |
| `min(a, b, …)` / `max(a, b, …)` | ≥ 2 | Hepsi sayıysa en küçük / en büyük, değilse `null`. |
| `abs(n)` | 1 | Mutlak değer. |

Geçerli tarih: `YYYY-MM-DD` biçiminde ve takvimde var olan bir gün (`2025-02-30` geçersiz).

## Hatalar

Parse hataları 1 tabanlı **satır ve sütunla** raporlanır; mesajlar iki tarafta birebir aynıdır.

| Örnek | Mesaj | Konum |
|-------|-------|-------|
| `''` | İfade boş | 1:1 |
| `age >` | Değer bekleniyordu, ifade bitti | 1:6 |
| `age = 18` | '=' yerine '==' kullanın | 1:5 |
| `a & b` | '&' yerine '&&' kullanın | 1:3 |
| `(a > 1` | ')' bekleniyordu, ifade bitti | 1:7 |
| `a b` | Beklenmeyen 'b' | 1:3 |
| `a # b` | Beklenmeyen karakter '#' | 1:3 |
| `name == 'abc` | Kapanmamış metin | 1:9 |
| `sqrt(x)` | Bilinmeyen fonksiyon 'sqrt' | 1:1 |
| `age(a, b)` | 'age' fonksiyonu 1 argüman alır, 2 verildi | 1:1 |
| `a > 1 &&`⏎`b <` | Değer bekleniyordu, ifade bitti | 2:4 |

Tam liste fixture dosyasındadır.

## Örnekler

| İfade | Değişkenler | Sonuç |
|-------|-------------|-------|
| `currentYear() - modelYear` | `modelYear = 2018`, bugün `2026-03-15` | `8` |
| `hasLpg == true` | `hasLpg = null` | `false` |
| `fuelType == 'gasoline' && !hasLpg` | `fuelType = 'gasoline'`, `hasLpg = false` | `true` |
| `count(extras) > 0 && !contains(extras, 'none')` | `extras = ['glass']` | `true` |
| `round(weightKg / ((heightCm / 100) * (heightCm / 100)), 1)` | `weightKg = 80`, `heightCm = 180` | `24.7` |
| `daysBetween(departureDate, returnDate) + 1` | `2026-07-01` → `2026-07-10` | `10` |
| `modelYear + 1` | `modelYear = '2018'` | `null` |
| `10 / 0` | — | `null` |

## Bağımlılıklar ve yeniden hesaplama

Frontend her kuralı bir Angular `computed()` sinyaline çevirir. Değerlendirici değişkenleri sinyallerden okuduğu için
bağımlılık grafiği kendiliğinden oluşur: bir alan değişince **yalnızca o alanı okuyan** kurallar yeniden hesaplanır;
kısa devre nedeniyle okunmayan dal bağımlılık da oluşturmaz.

Gizli alan `null` okunduğundan bir alanın değeri, kendi `visibleWhen` kuralına (ve adımının kuralına) bağlıdır.
Bu yüzden backend doğrulayıcısı döngüyü `expression` ve `visibleWhen` kenarlarının birlikte oluşturduğu
grafikte arar (`CIRCULAR_DEPENDENCY`): `a` görünürlüğü `b`'ye, `b` görünürlüğü `a`'ya bağlıysa tanım reddedilir.
