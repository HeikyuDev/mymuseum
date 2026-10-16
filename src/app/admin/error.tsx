"use client";

import { ErrorPanel } from "@/components/ui/ErrorPanel";

export default function AdminError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel {...props} />;
}
