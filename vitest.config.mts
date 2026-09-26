import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@fixtures": path.resolve(import.meta.dirname, "./fixtures"),
    },
  },
  test: {
    environment: "node",
    // `tests/chrome-extension/**` sözleşme testleri: eklentinin topladığı
    // verinin sunucunun gerçekten okuyabildiği burada kanıtlanır. Aksi halde
    // eklenti yalnız saha denemesiyle doğrulanır ve kırık olduğu ekip işe
    // başlarken anlaşılır.
    //
    // Testler eklenti klasörünün DIŞINDA: Chrome `_` ile başlayan dosya veya
    // klasör adlarını reddeder ("Filenames starting with "_" are reserved"),
    // bu yüzden `__test__` yükleme hatası veriyordu.
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
