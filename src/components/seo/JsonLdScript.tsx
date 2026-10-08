import { serializeJsonLd, structuredDataEnabled, type JsonLd } from "@/lib/seo/structured-data";

/** JSON-LD を出す（検索への登録を許可したときだけ）。server component。 */
export function JsonLdScript({ data }: { data: JsonLd }) {
  if (!structuredDataEnabled()) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
