import { Suspense } from "react";
import PreviewClient from "./PreviewClient";

export default function PreviewPage() {
  return (
    <Suspense>
      <PreviewClient />
    </Suspense>
  );
}
