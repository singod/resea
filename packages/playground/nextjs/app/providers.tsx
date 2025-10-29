"use client";

import { createSea } from "resea";

const pinia = createSea();

export default function Providers({ children }) {
  return <>{children}</>;
}
