# Form Tanımı Spesifikasyonu

Bir form tanımı, sigorta ürününün risk soru setini anlatan tek bir JSON belgesidir.
Renderer (frontend) formu bu belgeden üretir, backend aynı belgeyle gelen cevabı yeniden doğrular.

JSON anahtarları İngilizce, kullanıcıya görünen metinler (`title`, `label`, `message`...) Türkçe yazılır.
Bilinmeyen anahtar **hatadır** (`visibleWehn` gibi yazım hataları sessizce yutulmaz).

Örnek tanımlar: [`examples/`](../examples).
Model kodu: `frontend/src/app/engine/model` (TypeScript), `backend/.../forms/schema` (Java).

## FormDefinition

| Anahtar       | Tip                 | Zorunlu | Açıklama |
|---------------|---------------------|---------|----------|
| `id`          | string              | evet    | Küçük harf, rakam, tire: `^[a-z][a-z0-9-]*$` (ör. `casco-risk`). |
| `version`     | integer ≥ 1         | evet    | Yayınlanan her değişiklik yeni versiyon açar (Faz 4). |
| `title`       | string              | evet    | Form başlığı. |
| `description` | string              | hayır   | Formun üstünde gösterilen açıklama. |
| `steps`       | StepDefinition[]    | evet    | En az bir adım. |

## StepDefinition

Stepper'daki bir adım.

| Anahtar       | Tip                 | Zorunlu | Açıklama |
|---------------|---------------------|---------|----------|
| `id`          | identifier          | evet    | Form içinde benzersiz. |
| `title`       | string              | evet    | |
| `description` | string              | hayır   | |
| `visibleWhen` | ifade               | hayır   | Yanlışsa adım tamamen atlanır, içindeki alanlar gizli sayılır. |
| `fields`      | FieldDefinition[]   | evet    | En az bir alan. |

## FieldDefinition

`identifier` = `^[a-zA-Z][a-zA-Z0-9_]*$`. Alan id'leri ifadelerde değişken adı olarak kullanıldığı için bu kurala uyar
ve **formun tamamında benzersizdir** (adım id'leri ve repeater içindeki alanlar dahil).

### Ortak anahtarlar

| Anahtar        | Tip          | Açıklama |
|----------------|--------------|----------|
| `id`           | identifier   | Zorunlu. |
| `type`         | FieldType    | Zorunlu. Aşağıdaki tablodan biri. |
| `label`        | string       | Zorunlu. |
| `hint`         | string       | Alanın altında gösterilen yardım metni. |
| `placeholder`  | string       | |
| `required`     | boolean      | Varsayılan `false`. |
| `defaultValue` | tipine uygun | Form ilk açıldığında değer. |
| `visibleWhen`  | ifade        | Yanlışsa alan gizlenir; **gizli alanın değeri ve doğrulaması yok sayılır**. |
| `requiredWhen` | ifade        | Doğruysa alan zorunlu. `required: true` ile birlikte kullanılamaz. |
| `disabledWhen` | ifade        | Doğruysa alan salt okunur (değeri korunur). |
| `validators`   | Validator[]  | Tipine uygun doğrulayıcılar (aşağıda). |

### Alan tipleri

| `type`        | Değer tipi             | Tipe özel anahtarlar | İzinli validator'lar |
|---------------|------------------------|----------------------|----------------------|
| `text`        | string                 | | `minLength`, `maxLength`, `pattern` |
| `textarea`    | string                 | `rows` | `minLength`, `maxLength`, `pattern` |
| `number`      | number                 | `decimals` (≥ 0, varsayılan 0) | `min`, `max` |
| `currency`    | number                 | `currency` (ISO 4217, varsayılan `TRY`) | `min`, `max` |
| `date`        | string `YYYY-MM-DD`    | | `minDate`, `maxDate` |
| `boolean`     | boolean                | | — |
| `select`      | string                 | `options` **veya** `optionsSource` | — |
| `radio`       | string                 | `options` | — |
| `multiselect` | string[]               | `options` **veya** `optionsSource` | `minItems`, `maxItems` |
| `repeater`    | object[]               | `fields`, `itemLabel`, `addLabel` | `minItems`, `maxItems` |
| `computed`    | ifadenin sonucu        | `expression` (zorunlu), `format` (`number`, `currency`, `text`) | — |
| `info`        | — (değer tutmaz)       | `content` | — |

Kısıtlar:

- `select` / `multiselect`: `options` ile `optionsSource` aynı anda verilemez; biri zorunlu.
- `radio`: `options` zorunlu, en az iki seçenek.
- `options` içindeki `value` değerleri benzersiz olmalı.
- `computed`: kullanıcı girmez; `required`, `requiredWhen`, `disabledWhen`, `validators`, `defaultValue` verilemez.
- `info`: değer tutmaz; `required`, `requiredWhen`, `disabledWhen`, `validators`, `defaultValue` verilemez
  ve ifadelerde referans verilemez.
- `repeater`: `fields` en az bir alan içerir; iç içe `repeater` yoktur. `required: true` en az bir satır demektir.

### Option

```json
{ "value": "diesel", "label": "Dizel" }
```

### OptionsSource

```json
{ "type": "remote", "url": "/api/lookups/lpg-brands" }
```

`url` uygulama içi bir yol olmalı (`/` ile başlar). Uzak kaynak `[{ "value", "label" }]` dizisi döner;
renderer sonucu cache'ler (Faz 3).

### Validator

```json
{ "type": "pattern", "value": "^[0-9]{2}[A-Z]{1,3}[0-9]{2,4}$", "message": "Geçersiz plaka" }
```

| `type`      | `value`                          | Not |
|-------------|----------------------------------|-----|
| `minLength` | integer ≥ 0                      | |
| `maxLength` | integer ≥ 1                      | `minLength` ≤ `maxLength` |
| `pattern`   | regex string                     | Değerin **tamamı** eşleşmeli. Java ve JS'de ortak alt küme kullanılmalı (lookbehind, named group yok). |
| `min`       | number                           | |
| `max`       | number                           | `min` ≤ `max` |
| `minDate`   | `YYYY-MM-DD` veya `today`        | |
| `maxDate`   | `YYYY-MM-DD` veya `today`        | |
| `minItems`  | integer ≥ 0                      | |
| `maxItems`  | integer ≥ 1                      | `minItems` ≤ `maxItems` |

`message` isteğe bağlı; verilmezse varsayılan Türkçe mesaj kullanılır. Aynı tipten iki validator verilemez.

## İfadeler

`visibleWhen`, `requiredWhen`, `disabledWhen` ve `expression` küçük, güvenli bir ifade dilindedir
(sözdizimi ve tam anlamı: `docs/rule-language.md`, Faz 2). `eval` / `new Function` kullanılmaz.

```text
hasLpg == true
vehicleType == 'car' && modelYear >= 2015
!isEmpty(previousInsurer) || count(drivers) > 1
currentYear() - modelYear
```

- Değişkenler alan id'leridir.
- Literaller: sayı, `'metin'` / `"metin"`, `true`, `false`, `null`.
- Operatörler: `+ - * / %`, `== != < <= > >=`, `&& || !`, parantez.
- Fonksiyonlar: `currentYear()`, `today()`, `age(date)`, `daysBetween(from, to)`, `len(text)`, `count(list)`,
  `contains(list, value)`, `isEmpty(value)`, `round(number, digits)`, `min(a, b)`, `max(a, b)`, `abs(number)`.

### Kapsam

- Üst seviye alanlar birbirine ve repeater'ın kendisine (dizi olarak, ör. `count(drivers)`) referans verebilir.
- Repeater içindeki bir alan, aynı satırdaki kardeş alanlara ve üst seviye alanlara referans verebilir.
- Repeater dışından repeater içindeki bir alana doğrudan referans verilemez.

## Tanım doğrulama kuralları

Backend `POST /api/definitions/validate` her tanımı şu kurallarla kontrol eder; hatalar
`{ path, code, message }` listesi olarak döner (`path` ör. `steps[0].fields[2].visibleWhen`).

| `code`                   | Ne zaman |
|--------------------------|----------|
| `INVALID_JSON`           | Belge JSON olarak okunamıyor. |
| `UNKNOWN_PROPERTY`       | Spesifikasyonda olmayan anahtar. |
| `INVALID_VALUE`          | Değer yanlış tipte veya izinli değerlerden biri değil. |
| `REQUIRED`               | Zorunlu anahtar eksik veya boş. |
| `INVALID_ID`             | Id biçim kuralına uymuyor. |
| `DUPLICATE_ID`           | Aynı id iki kez kullanılmış (adım veya alan). |
| `PROPERTY_NOT_ALLOWED`   | Anahtar bu alan tipinde kullanılamaz (ör. `computed` + `required`). |
| `CONFLICTING_PROPERTIES` | Birlikte verilemeyen anahtarlar (ör. `options` + `optionsSource`). |
| `DUPLICATE_OPTION`       | Seçeneklerde tekrar eden `value`. |
| `INVALID_VALIDATOR`      | Validator tipe uygun değil, değeri hatalı, tekrar ediyor veya min > max. |
| `EXPRESSION_SYNTAX`      | İfade okunamıyor. |
| `UNKNOWN_REFERENCE`      | İfadede olmayan bir alan geçiyor. |
| `INVALID_REFERENCE`      | Alan var ama referans verilemez (`info`, kapsam dışı repeater alanı, alanın kendi kuralı). |
| `UNKNOWN_FUNCTION`       | Listede olmayan fonksiyon. |
| `CIRCULAR_DEPENDENCY`    | `computed` alanlar döngüsel olarak birbirine bağlı (ör. `a → b → a`). |
