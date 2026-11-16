"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { BASE_PATH } from "@/lib/base-path";

/**
 * Product photo hot-linked from Open Food Facts (CC BY-SA), with a neutral
 * placeholder when there is no photo or it fails to load.
 */
export function ProductImage({ src, className }: { src: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  // Uploaded photos are served by this app, so their path needs the base path; remote ones are absolute.
  const url = src?.startsWith("/") ? `${BASE_PATH}${src}` : src;
  if (!url || failed) return <Package className="size-7 text-neutral-400" aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={className} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  );
}
