import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aydınlatma Metni (KVKK m.10) | CERBERUS",
  description: "CERBERUS Commerce OS kişisel verilerin işlenmesine dair aydınlatma metni.",
};

function Section({ no, title, children }: { no: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface-1 p-5">
      <h2 className="font-mono-tech text-[12px] font-bold uppercase tracking-wider text-brand-soft">
        {no}. {title}
      </h2>
      <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}

export default function AydinlatmaPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold text-ink">
          Kişisel Verilerin İşlenmesine Dair Aydınlatma Metni
        </h1>
        <p className="mt-1 font-mono-tech text-[11px] text-ink-faint">
          6698 sayılı KVKK m.10 kapsamında hazırlanmıştır. Son güncelleme: Eylül 2026.
        </p>
      </div>

      <div className="rounded-2xl border border-caution/40 bg-caution/10 px-4 py-3 text-[12px] text-caution">
        Bu metindeki [köşeli parantezli] alanlar şirket bilgileriyle doldurulmalıdır.
        Yayınlanmadan önce KVKK uzmanı bir hukukçu incelemelidir.
      </div>

      <Section no="1" title="Veri sorumlusu">
        <p>[ŞİRKET UNVANI] — [ADRES] — [KEP/E-POSTA]</p>
        <p>KVKK başvuru adresi: [kvkk@sirket.com]</p>
      </Section>

      <Section no="2" title="İşlenen kişisel veriler">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">Hesap verisi:</strong> ad-soyad, e-posta, rol ve
            mağaza kodu, parola özeti (açık parola asla saklanmaz).
          </li>
          <li>
            <strong className="text-ink">Sipariş verisi:</strong> sipariş iletişim e-postası,
            ödeme kartının yalnızca son 4 hanesi.
          </li>
          <li>
            <strong className="text-ink">İşlem kayıtları:</strong> sistemdeki işlemlerinizin
            denetim izi (kim, ne zaman, hangi kayıt üzerinde).
          </li>
        </ul>
      </Section>

      <Section no="3" title="İşleme amaçları ve hukuki sebepler">
        <p>
          Veriler; hesabınızın oluşturulması ve oturumunuzun güvenli yönetimi,
          mağaza/sipariş operasyonlarının yürütülmesi, sistem güvenliğinin
          sağlanması ve yasal yükümlülüklerin yerine getirilmesi amaçlarıyla,
          KVKK m.5/2 (sözleşmenin ifası, hukuki yükümlülük, meşru menfaat)
          kapsamında işlenir.
        </p>
      </Section>

      <Section no="4" title="Aktarım ve saklama">
        <p>
          Veriler, hizmetin gerektirdiği ölçüde barındırma (veritabanı/bulut) ve
          hata izleme sağlayıcılarına aktarılabilir. Denetim kayıtları 1 yıl,
          tamamlanmış sipariş kayıtları 1 yıl canlı + arşiv saklanır; süre dolan
          kayıtlar silinir, yok edilir veya anonim hâle getirilir.
        </p>
      </Section>

      <Section no="5" title="Haklarınız (KVKK m.11)">
        <p>
          İşlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini isteme,
          aktarıldığı üçüncü kişileri öğrenme ve işlemeye itiraz etme haklarına
          sahipsiniz. Başvurularınızı [kvkk@sirket.com] adresine iletebilirsiniz;
          talebiniz azami 30 gün içinde sonuçlandırılır.
        </p>
      </Section>
    </div>
  );
}
