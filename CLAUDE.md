# CLAUDE.md

Portföy projesi: Sigorta Dinamik Form Motoru (Angular + Spring Boot + Oracle).
Tüm yol haritası `PLAN.md` içinde. İşe başlamadan önce onu oku ve kaldığın fazı `git log` / branch'lerden tespit et.

## Çalışma kuralları

- Fazları `PLAN.md` sırasıyla uygula. Her faz bitince dur, kullanıcıya kısa özet ver (ne yapıldı, nasıl denenir), onay almadan sonraki faza geçme.
- Her faz için branch: `feature/phase-N-kisa-ad`. Faz bitince testler geçiyorsa `main`'e merge et ve push et.
- Küçük, anlamlı commit'ler. Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- GitHub repo oluşturma, force push, branch silme gibi geri dönüşü zor işlerden önce kullanıcıya sor.
- Sadece lokal çalışır. Deploy adımı, sunucu ayarı ekleme.
- Secret commit'lenmez; değerler `.env`, şablon `.env.example`.
- `D:\projeler\insurance-policy-management` ayrı bir proje ve başka bir oturum orada çalışıyor; ona dokunma.

## Ortam (Windows 11)

- JDK 22 kurulu; proje `release 21` hedefler. Global Maven yok: `./mvnw` (Windows'ta `mvnw.cmd`).
- Global `JAVA_HOME` jdk-17'yi gösterir; Maven komutlarından önce oturumda `$env:JAVA_HOME='C:\Program Files\Java\jdk-22'` ayarla (global ayarı değiştirme).
- Node 24, Docker Desktop, `gh` CLI (giriş yapılmış).
- Oracle: `docker compose up -d oracle`. Ana proje de Oracle kullanıyor; port çakışmasın diye bu projede host portu **1522** olsun.

## Kod kuralları

- Form motoru (`frontend/src/app/engine`) uygulamadan bağımsız kalır: designer/fill/submissions klasörlerini import etmez. İleride ayrı kütüphaneye çıkarılabilecek şekilde yazılır.
- İfade değerlendirmede `eval`, `new Function` veya benzeri dinamik kod çalıştırma yasak.
- Angular: standalone components, signals, typed reactive forms, `OnPush`.
- İstemci doğrulaması kullanıcı deneyimi içindir; asıl doğrulama backend'de aynı kurallarla tekrar yapılır.
- Yayınlanmış form versiyonu değiştirilmez. Flyway'de commit'lenmiş `V__` migration'ı düzenlenmez.
- Her kural/ifade özelliği için test; Java ve TypeScript ifade motorları ortak fixture dosyasından test edilir.

## Komutlar

```bash
docker compose up -d oracle
cd backend && ./mvnw spring-boot:run   # http://localhost:8081
cd backend && ./mvnw verify
cd frontend && npm start               # http://localhost:4300
cd frontend && npm test
cd frontend && npx playwright test     # Faz 6 sonrası
```
