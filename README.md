# LinkedIn Clearance Check

LinkedIn iş ilanı açıklamasını yerel olarak tarayan basit bir Chrome
Manifest V3 uzantısıdır. Chrome'un native sağ panelinde şu sonuçlardan
birini gösterir:

- Clearance gerekiyor
- Clearance alınabilmeli
- Clearance gerekmiyor
- Elle kontrol et
- Clearance belirtilmemiş

## Kurulum

1. Chrome'da `chrome://extensions` adresini aç.
2. Sağ üstten **Developer mode / Geliştirici modu** seçeneğini aç.
3. **Load unpacked / Paketlenmemiş öğe yükle** düğmesine bas.
4. Bu `linkedin-clearance-checker` klasörünü seç.
5. LinkedIn'de bir iş ilanı aç.
6. Chrome araç çubuğundaki uzantı ikonuna tıkla. Panel sağda açılır.

İlanlar arasında geçtikçe panel otomatik güncellenir. Gerekirse
**Yeniden tara** düğmesini kullan.

## Autofill

Yan paneldeki cevap bankasında form alanı ile cevabını eşleştirebilirsin.
**Açık formu doldur** düğmesi metin alanlarını, textarea alanlarını,
native dropdown'ları, radio seçeneklerini ve checkbox'ları doldurur.
Formu otomatik olarak göndermez.

**Formdan öğren** düğmesi açık formdaki doldurulmuş güvenli alanları cevap
bankasına kaydeder. Şifre, dosya yükleme, kart güvenlik kodu ve benzeri
hassas alanlar kaydedilmez.

## Gizlilik

İlan metni yalnızca tarayıcı içinde analiz edilir. Harici API veya sunucu
kullanılmaz.

## Sınırlar

LinkedIn zaman zaman sayfa yapısını değiştirir. Böyle bir durumda
`content.js` içindeki seçicilerin güncellenmesi gerekebilir. Sonuç,
anahtar kelime tabanlı hızlı bir kontroldür; kesin hukuki veya işveren
kararı değildir.
