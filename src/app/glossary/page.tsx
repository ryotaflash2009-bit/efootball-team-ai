import { PageContainer } from "@/components/ui/PageContainer";
import { GlossaryView } from "@/components/public-info/GlossaryView";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-static";

export const metadata = pageMetadata({
  path: "/glossary",
  title: "用語集 | TeamAIXI",
  description: "イーフト（eFootball™）の基礎 OVR・最大 OVR・ブースター・Link-Up Play・暫定のカードなど、TeamAIXI の画面に出てくる言葉の意味をまとめました。",
});

export default function GlossaryPage() {
  return (
    <PageContainer width="regular">
      <GlossaryView />
    </PageContainer>
  );
}
