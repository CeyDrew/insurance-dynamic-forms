# ADR 0004 — Doğrulama iki tarafta, aynı kurallarla; sunucu belirleyici

- Durum: Kabul edildi
- Tarih: 2026-11-23

## Bağlam

Form motorunun değeri kuralları tek yerde tanımlamasıdır. Ama tarayıcı kontrol edilemez: istemci kodu atlanabilir,
API doğrudan çağrılabilir. Kullanıcı deneyimi anlık geri bildirim ister; veri bütünlüğü ise sunucu kontrolü gerektirir.

## Karar

- **İstemci doğrulaması kullanıcı deneyimi içindir:** zorunluluk, görünürlük, validator'lar ve hesaplamalar `FormRules`
  (Angular sinyalleri) ve reactive form validator'larıyla anlık çalışır. Gizlenen alanın değeri temizlenir.
- **Sunucu doğrulaması belirleyicidir:** `SubmissionValidator` aynı tanımı ve aynı ifade dilini (Java motoru) kullanarak
  görünürlüğü, zorunluluğu, tipleri, seçenekleri (uzak lookup'lar dahil) ve validator'ları yeniden uygular. İstemcinin
  gönderdiği hesaplanan değerler yok sayılır ve yeniden hesaplanır; gizli alanlara gelen değerler atılır; tanımda
  olmayan alanlar reddedilir.
- Hata mesajları iki tarafta aynıdır. Sunucu hataları `{ field, code, message }` listesiyle döner (`field`:
  `drivers[0].driverName` gibi); renderer bunları ilgili kontrole yerleştirir ve hatanın olduğu adıma gider.
- Parite iki ortak fixture ile korunur: `fixtures/expression-cases.json` (ifade motoru) ve
  `fixtures/example-answers.json` (4 örnek formun tam cevapları iki tarafta da geçerli).
- Tanım doğrulaması (form tanımının kendisi) tek yerde, backend'de yapılır; tasarımcı aynı uç noktayı
  (`POST /api/definitions/validate`) çağırır.

## Sonuçlar

- (+) Kullanıcı hatayı yazarken görür; API'yi doğrudan çağıran biri kuralı atlayamaz.
- (+) Saklanan veri her zaman kuralların sonucudur; raporlar ve JSON sorguları buna güvenebilir.
- (−) Kural semantiği iki kez implemente edilir; fixture'lar ve aynı mesaj metinleri bu maliyeti kontrol altında tutar.
- (−) "Bugün"ün iki tarafta aynı olması gerekir (gece yarısı sınırında fark edebilir); sunucu `Europe/Istanbul` saat
  dilimini kullanır.
