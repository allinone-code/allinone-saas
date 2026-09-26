// extractor.js tarayıcıya enjekte edilir ve `window.__cerberusExtract` olarak
// açılır. Test altında CommonJS `module.exports` ile alınır.
export interface CapturedPage {
  url: string;
  title: string;
  jsonLd: string[];
  meta: string;
  metaPairs: string[];
}
export function cerberusExtract(doc: unknown): CapturedPage;
