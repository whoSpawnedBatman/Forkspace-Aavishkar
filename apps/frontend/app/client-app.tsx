"use client";

import dynamic from "next/dynamic";
const Workspace = dynamic(() => import("../src/App"), { ssr: false, loading: () => <main>Loading Snipbase…</main> });
export default Workspace;
