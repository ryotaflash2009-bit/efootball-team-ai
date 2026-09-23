import type { MetadataRoute } from "next";
import { buildRobotsTxt } from "@/lib/public-info/search-indexing";

export default function robots(): MetadataRoute.Robots {
  return buildRobotsTxt();
}
