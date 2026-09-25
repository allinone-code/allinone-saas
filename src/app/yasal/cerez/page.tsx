import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Çerez Bildirimi | CERBERUS",
  description: "CERBERUS Commerce OS çerez ve benzeri teknolojiler bildirimi.",
};

export default function CerezPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold text-ink">Çerez Bildirimi</h1>
        <p className="mt-1 font-mono-tech text-[11px] text-ink-faint">
          Son güncelleme: Eylül 2026.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-surface-1 p-5 text-[13px] leading-relaxed text-ink-muted">
        <h2 className="font-mono-tech text-[12px] font-bold uppercase tracking-wider text-brand-soft">
          Zorunlu oturum çerezi
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-line font-mono-tech text-[11px] uppercase tracking-wider text-ink-faint">
                <th className="py-2 pr-4">Çerez</th>
                <th className="py-2 pr-4">Amaç</th>
                <th className="py-2">Süre</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line/60">
                <td className="py-2 pr-4 font-mono-tech text-ink">cerberus_session</td>
                <td className="py-2 pr-4">
                  Oturumunuzun güvenli şekilde sürdürülmesi (imzalı, HttpOnly; içeriği
                  tarayıcıda okunamaz/değiştirilemez)
                </td>
                <td className="py-2">8 saat</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3">
          Bu çerez hizmetin çalışması için zorunludur; reddedilmesi durumunda panele
          giriş yapılamaz.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-surface-1 p-5 text-[13px] leading-relaxed text-ink-muted">
        <h2 className="font-mono-tech text-[12px] font-bold uppercase tracking-wider text-brand-soft">
          Kullanılmayan teknolojiler
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Reklam/izleyici çerezi kullanılmaz.</li>
          <li>Üçüncü taraf analitik çerezi kullanılmaz.</li>
          <li>
            Tercih çerezleri (örn. menü daraltma) yalnızca tarayıcınızın yerel
            depolamasında saklanır, sunucuya gönderilmez.
          </li>
        </ul>
      </section>
    </div>
  );
}
