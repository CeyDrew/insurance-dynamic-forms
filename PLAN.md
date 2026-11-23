# Sigorta Dinamik Form Motoru — Geliştirme Planı

## Amaç

Sigorta sektörüne yönelik full stack portföy projesi (Java, Spring Boot, Angular, Oracle).
Ana portföy projesi `D:\projeler\insurance-policy-management`. Bu proje onu tamamlar ve **Angular yetkinliğini CRUD ekranlarının ötesinde** gösterir.

Problem: sigortada her ürünün kendi risk soru seti var (kasko, konut, sağlık, seyahat...). Sigorta şirketleri bu formları her seferinde kodlamak yerine **JSON tanımından üretir**. Ürün ekibi yeni soru ekler, deploy gerekmez.

## Kapsam kısıtları

- **Sadece lokal çalışır.** Deploy yok.
- Her faz sonunda GitHub'a push.
- Form tanımı ve cevaplar Oracle'da saklanır, backend Spring Boot.

## Teknoloji yığını

- **Angular** (en güncel stabil): standalone components, **signals**, reactive forms (typed), Angular CDK drag-drop, Angular Material
- **Java 21**, **Spring Boot 3.x**, Maven Wrapper (`mvnw`), Spring Web, Spring Data JPA, Validation, springdoc-openapi
- **Oracle Database Free** (`gvenzl/oracle-free`), Flyway; form tanımı JSON kolonda (`JSON` tipi / `IS JSON` constraint)
- Test: Jest veya Vitest (Angular unit), Playwright (e2e), JUnit 5 + Testcontainers (backend)
- Docker Compose: `oracle` + `backend` + `frontend`

## Repo yapısı

```
insurance-dynamic-forms/
├── backend/                         # Spring Boot
│   └── src/main/java/com/portfolio/forms/
│       ├── definition/              # form tanımı CRUD + versiyonlama
│       ├── submission/              # cevap kaydı + sunucu tarafı doğrulama
│       ├── schema/                  # tanım modeli + şema doğrulayıcı
│       └── common/
├── frontend/
│   └── src/app/
│       ├── engine/                  # form motoru (kütüphane gibi, uygulamadan bağımsız)
│       │   ├── model/               # FormDefinition, FieldDefinition, Rule tipleri
│       │   ├── renderer/            # tanım → reactive form + bileşenler
│       │   ├── fields/              # alan bileşenleri (text, number, select, date...)
│       │   ├── rules/               # koşullu görünürlük / zorunluluk / hesaplama ifadeleri
│       │   └── validation/
│       ├── designer/                # sürükle-bırak form tasarımcısı
│       ├── fill/                    # müşteri/acente form doldurma ekranı
│       └── submissions/             # gelen cevaplar listesi
├── docs/
│   ├── form-definition-spec.md      # JSON şemasının tam tanımı
│   ├── rule-language.md             # koşul ifadelerinin sözdizimi
│   └── adr/
├── examples/                        # örnek tanımlar: casco.json, home.json, health.json, travel.json
├── docker-compose.yml
├── CLAUDE.md
├── PLAN.md
└── README.md
```

Kod, commit mesajları, JSON anahtarları İngilizce. Arayüz metinleri ve örnek soru metinleri Türkçe.

## Form tanımı modeli (özet; tam hali `docs/form-definition-spec.md`)

```json
{
  "id": "casco-risk",
  "version": 3,
  "title": "Kasko Risk Formu",
  "steps": [
    {
      "id": "vehicle",
      "title": "Araç Bilgileri",
      "fields": [
        { "id": "plate", "type": "text", "label": "Plaka", "required": true,
          "validators": [{ "type": "pattern", "value": "^[0-9]{2}[A-Z]{1,3}[0-9]{2,4}$", "message": "Geçersiz plaka" }] },
        { "id": "hasLpg", "type": "boolean", "label": "Araçta LPG var mı?" },
        { "id": "lpgBrand", "type": "select", "label": "LPG Marka",
          "optionsSource": { "type": "remote", "url": "/api/lookups/lpg-brands" },
          "visibleWhen": "hasLpg == true", "requiredWhen": "hasLpg == true" },
        { "id": "vehicleAge", "type": "computed", "label": "Araç Yaşı",
          "expression": "currentYear() - modelYear" }
      ]
    }
  ]
}
```

Alan tipleri: `text`, `textarea`, `number`, `currency`, `date`, `boolean`, `select`, `multiselect`, `radio`, `repeater` (tekrarlanan grup, ör. sürücü listesi), `computed`, `info` (sadece açıklama).
Kurallar: `visibleWhen`, `requiredWhen`, `disabledWhen`, `expression`. İfade dili küçük ve güvenli: karşılaştırma, `&&`, `||`, `!`, aritmetik, birkaç yardımcı fonksiyon. **`eval` / `new Function` kullanılmaz**, kendi parser'ı yazılır.

## Fazlar

Her faz: branch `feature/phase-N-kisa-ad` → testler geçer → `main`'e merge → push.
Her fazın sonunda **dur, kullanıcıya özet ver, onay almadan sonraki faza geçme.**

### Faz 0 — İskelet ve GitHub
- Monorepo, `.gitignore`, `docker-compose.yml` (Oracle Free + healthcheck), `.env.example`
- Spring Boot + Flyway + Actuator; Angular + Material, boş layout
- `git init`, ilk commit, `gh repo create` ile **public** repo (önce kullanıcıya repo adını onaylat), push
- **Bitti kriteri:** üç parça lokalde ayağa kalkıyor.

### Faz 1 — Tanım modeli ve şema doğrulama
- `docs/form-definition-spec.md`: tüm alanlar, tipler, kurallar
- TypeScript tipleri (`engine/model`) ve Java tarafında aynı modelin karşılığı
- Backend'de tanım doğrulayıcı: benzersiz alan id'leri, kurallarda geçen alanlar gerçekten var mı, döngüsel `computed` bağımlılığı yok mu
- `examples/` altında 4 gerçekçi ürün formu
- **Bitti kriteri:** örnek tanımlar doğrulanıyor, bozuk tanımlar anlamlı hata mesajıyla reddediliyor (testli).

### Faz 2 — Kural/ifade motoru ⭐
- Tokenizer + recursive descent parser + değerlendirici (TypeScript)
- Bağımlılık grafiği: bir alan değişince sadece ona bağlı kurallar yeniden hesaplanır (signals / `computed()` ile)
- Aynı ifade dili Java tarafında da değerlendirilir (sunucu tarafı doğrulama için); iki tarafın aynı sonucu verdiğini gösteren ortak test vakaları (`docs/rule-language.md` içindeki tablo → her iki tarafın testi aynı JSON fixture'ı okur)
- **Bitti kriteri:** ifade motoru unit testleri iki tarafta da geçiyor, hatalı ifadede satır/sütunlu hata mesajı.

### Faz 3 — Renderer ⭐
- Tanımı typed reactive form'a çeviren renderer; her alan tipi için bileşen, `ControlValueAccessor` ile
- Stepper ile adımlar, adım bazlı doğrulama
- Koşullu görünürlük/zorunluluk; gizlenen alanın değeri ve validator'ı temizlenir
- `repeater` (FormArray), `computed` alanlar, uzak kaynaktan seçenek (`optionsSource: remote`, cache'li)
- Taslak kaydetme ve kaldığı yerden devam
- Erişilebilirlik: label, hata mesajları `aria-describedby`, klavye ile tam kullanım
- **Bitti kriteri:** 4 örnek form eksiksiz doldurulup gönderilebiliyor.

### Faz 4 — Backend: tanım ve cevap API'si
- Tanım CRUD + **versiyonlama**: yayınlanmış versiyon değiştirilemez, yeni versiyon açılır; her cevap hangi versiyonla doldurulduğunu tutar
- Cevap kaydı: sunucu tarafında aynı kurallarla yeniden doğrulama (istemciye güvenilmez)
- Cevap listesi, filtreleme, JSON alanlarında Oracle `JSON_VALUE` / `JSON_TABLE` ile sorgulama (ör. "LPG'li araçlar")
- Testcontainers integration testleri
- **Bitti kriteri:** frontend'den gönderilen form Oracle'a kaydoluyor; kural ihlali olan istek 400 + alan bazlı hata dönüyor.

### Faz 5 — Sürükle-bırak form tasarımcısı ⭐
- Sol panel alan paleti, ortada canvas (CDK drag-drop, adımlar arası taşıma), sağda özellik paneli (label, zorunluluk, validator, kural ifadesi)
- Kural ifadesi editöründe anlık sözdizimi kontrolü ve alan adı önerisi
- Canlı önizleme (renderer'ın kendisi kullanılır), JSON görünümü, geri al / yinele
- Taslak → yayınla akışı (Faz 4 versiyonlama)
- **Bitti kriteri:** sıfırdan bir form tasarımcıda oluşturulup yayınlanıyor ve doldurulabiliyor.

### Faz 6 — Kalite ve vitrin
- Playwright e2e: tasarla → yayınla → doldur → cevabı listede gör
- GitHub Actions: build + test (deploy yok)
- Tam `docker compose up`
- README: GIF/ekran görüntüleri, mimari diyagram, teknik öne çıkanlar tablosu, "ana proje ile ilişkisi" bölümü
- `docs/adr/`: neden kendi ifade parser'ı, neden JSON kolonda saklama, neden versiyonlama
- **Bitti kriteri:** README'yi takip eden biri 10 dakikada ayağa kaldırıp demo akışını yürütebiliyor.

## Kapsam dışı
- Deploy, kullanıcı yönetimi (basit tek admin yeterli; gerekirse sabit demo kullanıcı)
- Ana sigorta projesine entegrasyon (ileride ayrıca konuşulur)
