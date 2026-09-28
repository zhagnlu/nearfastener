"use client";

import { useEffect } from "react";

/** Attach DOM behavior only after React has hydrated the captured markup. */
export default function SiteEnhancements() {
  useEffect(() => {
    if (document.getElementById("near-fastener-i18n")) return;
    const script = document.createElement("script");
    script.id = "near-fastener-interactions";
    script.src = "/site.js";
    script.async = true;
    const i18n = document.createElement("script");
    i18n.id = "near-fastener-i18n";
    i18n.src = "/i18n.js";
    i18n.onload = () => document.body.appendChild(script);
    i18n.onerror = () => document.body.appendChild(script);
    document.body.appendChild(i18n);
  }, []);
  return null;
}
