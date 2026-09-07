import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireUser, isDenied, resolveStoreScope } from "@/lib/guards";
import { parseBody, driveUrlSchema } from "@/lib/validation";
import { parseXlsMatrix } from "@/lib/xlsRowParse";
import { handleRouteError } from "@/lib/apiResponse";

function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  // Direct id fallback
  if (/^[a-zA-Z0-9-_]{20,}$/.test(url.trim())) return url.trim();
  return null;
}

export async function POST(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    // Zod doğrulama (T3.1)
    const parsed = await parseBody(req, driveUrlSchema);
    if ("response" in parsed) return parsed.response;
    const { driveUrl, defaultStore: requestedStore = "HRN" } = parsed.data;
    const defaultStore = resolveStoreScope(currentUser, requestedStore);

    const sheetId = extractSpreadsheetId(driveUrl);
    if (!sheetId) {
      return NextResponse.json(
        {
          error:
            "Geçerli bir Google E-Tablo ID'si bulunamadı. Lütfen https://docs.google.com/spreadsheets/d/... linkini girin.",
        },
        { status: 400 }
      );
    }

    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;

    // T3.4: 15 sn timeout + 20 MB içerik üst sınırı
    const fetchResponse = await fetch(exportUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Cerberus Commerce Intelligence Bot)",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!fetchResponse.ok) {
      return NextResponse.json(
        {
          error:
            "Google Drive tablosuna erişilemedi. Lütfen tablonun paylaşım ayarlarından 'Bağlantıya sahip olan herkes görüntüleyebilir' seçili olduğuna emin olun.",
        },
        { status: 403 }
      );
    }

    const contentLength = Number(fetchResponse.headers.get("content-length") || "0");
    if (contentLength > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Google E-Tablo dosyası çok büyük (üst sınır 20 MB)." },
        { status: 413 }
      );
    }

    const arrayBuffer = await fetchResponse.arrayBuffer();
    // cellDates:true — gerçek Excel tarih hücreleri Date nesnesi olarak gelir
    // (aksi hâlde "46043" gibi seri numaraları okunuyordu; xlsRowParse her
    // iki hâli de normalize eder, bu yalnızca ikinci savunma hattıdır)
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];

    // Read as 2D array
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    if (!rawMatrix || rawMatrix.length < 2) {
      return NextResponse.json(
        { error: "Google E-Tabloda içe aktarılacak satır bulunamadı." },
        { status: 400 }
      );
    }

    // First row is headers (yanıtta bilgilendirme amaçlı döner)
    const headers = rawMatrix[0].map((h: any) => String(h || "").trim());

    // Kolon eşleme tek doğruluk noktasından (xlsRowParse): başlık tespiti +
    // konumsal geri dönüş, Türkçe para biçimi ham bırakılır, CountPerBundle
    // (kolon 33) artık kaybolmaz.
    const { rows: parsedRows } = parseXlsMatrix(rawMatrix, {
      defaultStore,
      driveLinkFallback: driveUrl,
    });

    if (parsedRows.length === 0) {
      return NextResponse.json(
        { error: "Google E-Tabloda içe aktarılacak satır bulunamadı." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: `Google Drive tablosundan (${firstSheetName}) ${parsedRows.length} adet sipariş ayrıştırıldı.`,
      headers,
      rows: parsedRows,
    });
  } catch (error: unknown) {
    return handleRouteError("POST /api/orders/import-drive-url", error);
  }
}
