# ADR 0002 — Tanımlar ve cevaplar Oracle'da JSON kolonlarda

- Durum: Kabul edildi
- Tarih: 2026-11-23

## Bağlam

Form tanımları ürün ekibinin elinde sürekli değişir: yeni alan, yeni kural, yeni adım. Her ürünün (kasko, konut, sağlık,
seyahat) soru seti farklıdır ve repeater gibi iç içe yapılar içerir. Cevapların da aynı esneklikte saklanması ve yine de
sorgulanabilmesi gerekir ("LPG'li araçlar", "25 yaş altı sürücüler").

## Seçenekler

| Seçenek | Değerlendirme |
|---|---|
| Her alan için kolon (form başına tablo) | Yeni soru = migration = deploy. Ürünün varlık sebebiyle çelişir. |
| EAV (`submission_id, field_id, value`) | Esnek ama repeater satırları, tipler ve "bir cevabın tamamını oku" sorguları zahmetli; satır sayısı hızla büyür. |
| Ayrı doküman veritabanı | Ana proje de Oracle kullanıyor; ikinci bir veritabanı işletme yükü getirir. |
| **Oracle'da JSON kolon** | Seçildi. |

## Karar

`form_definition.definition` ve `form_submission.answers`, `CHECK (... IS JSON)` kısıtlı `CLOB` kolonlarda saklanır.
Kimlik ve sorgulamada kullanılan alanlar (`form_key`, `version`, `status`, tarih) ayrıca normal kolonlardır.

Sorgular Oracle'ın SQL/JSON fonksiyonlarıyla, saklanan JSON üzerinde doğrudan yapılır:

- `JSON_EXISTS(answers, '$.hasLpg?(@ == true)')`: cevaba göre filtre; çoklu seçim dizilerinde herhangi bir eleman
  eşleşir.
- `JSON_TABLE(answers, '$.drivers[*]' COLUMNS (...))`: repeater satırlarını SQL satırlarına açar (bütün kasko
  cevaplarındaki bütün sürücüler).

JSON path içine alan adı yazılması gerektiği (path bind edilemez) için yalnızca `^[a-zA-Z][a-zA-Z0-9_]*$` biçimindeki
adlar kabul edilir; değerler bind değişkeniyle geçer. Kaçış denemesinin 400 döndüğünü gösteren entegrasyon testi var.

Saklanan cevap **kanonik**tir: sunucu doğrulamasından geçmiş, gizli alanları `null`, hesaplanan alanları sunucuda
yeniden hesaplanmış hali. Böylece sorgular istemcinin gönderdiğine değil, kuralların sonucuna bakar.

`JSON` veri tipi (23ai) yerine `CLOB + IS JSON` seçildi: Hibernate eşlemesi sade (`@Lob String`), aynı SQL/JSON
fonksiyonları çalışır ve eski Oracle sürümlerine taşınabilir.

## Sonuçlar

- (+) Yeni soru için şema değişikliği yok; tanım yayınlandığı anda doldurulabilir.
- (+) Cevap, doldurulduğu versiyonun yapısını olduğu gibi korur.
- (+) Oracle/SQL yetkinliği (SQL/JSON fonksiyonları) doğrudan görünür.
- (−) Alan bazlı sık sorgular için fonksiyon tabanlı indeks veya `JSON_TABLE` materialized view gerekir (şu an demo
  ölçeğinde gerekmedi).
- (−) Referans bütünlüğü (ör. seçilen değerin lookup'ta olması) veritabanında değil, uygulamada sağlanır.
