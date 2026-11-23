# ADR 0003 — Yayınlanmış form versiyonu değiştirilemez

- Durum: Kabul edildi
- Tarih: 2026-11-23

## Bağlam

Bir sigorta cevabı, sorulduğu soruların bağlamında anlamlıdır. Bir sorunun metni, seçenekleri ya da kuralı değiştiğinde
eski cevaplar yeni tanımla yorumlanırsa, kayıtlar sessizce bozulur. Örneğin "Hasar sayısı" önceden 3 yılı sorarken
şimdi 5 yılı soruyor olabilir; ya da bir seçenek değerinin anlamı değişmiş olabilir. Teklif ve uyuşmazlık süreçlerinde
"müşteri tam olarak neye cevap verdi?" sorusunun cevabı kaybolmamalıdır.

## Karar

- Bir form birden çok **versiyon**dan oluşur (`form_key`, `version`). Durum `DRAFT` veya `PUBLISHED`.
- Bir formun en fazla **bir taslağı** olur. Bunu veritabanı da zorlar: `CASE WHEN status = 'DRAFT' THEN form_key END`
  üzerinde unique index.
- Sadece taslak düzenlenir veya silinir. **Yayınlanmış versiyon değişmez**: güncelleme, silme ve yeniden yayınlama
  istekleri `409 Conflict` döner. Entity de aynı kuralı kendi içinde zorlar.
- Değişiklik, yayınlanmış versiyonun kopyası olan **yeni bir taslak versiyon** ile yapılır ve bir sonraki numarayı alır.
- Versiyon numarasını **sunucu** belirler; gönderilen JSON'daki `version` saklanırken düzeltilir.
- Her cevap, doldurulduğu versiyona bağlıdır (`definition_id`, `version`) ve **o versiyonun kurallarıyla** doğrulanır.
  Taslak versiyona cevap gönderilemez.
- Doldurma ekranı her zaman son yayınlanmış versiyonu açar. Yarım kalmış taslak cevaplar (localStorage) versiyon
  anahtarlıdır; tanım değişince eski taslak kullanılmaz.

## Sonuçlar

- (+) Her cevap için "hangi soruya, hangi kurallarla" sorusu kesin olarak cevaplanır.
- (+) Taslak üzerinde çalışmak canlı formu etkilemez; yayınlama tek, açık bir adımdır.
- (+) Eşzamanlı iki "yeni taslak" isteğinden birini veritabanı reddeder (`409`).
- (−) Küçük bir yazım düzeltmesi bile yeni versiyon demektir. Versiyonlar ucuz olduğu için bu kabul edilebilir.
- (−) Cevapları versiyonlar arası karşılaştırmak (ör. alan adı değişmişse) uygulama düzeyinde eşleme gerektirir.
