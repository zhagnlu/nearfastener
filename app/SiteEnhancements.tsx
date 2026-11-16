"use client";

import { useEffect } from "react";

/** Attach DOM behavior only after React has hydrated the captured markup. */
export default function SiteEnhancements() {
  useEffect(() => {
    if (document.getElementById("near-fastener-interactions")) return;
    const script = document.createElement("script");
    script.id = "near-fastener-interactions";
    script.src = "/site.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);
  return null;
}
