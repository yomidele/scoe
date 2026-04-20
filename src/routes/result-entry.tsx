import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { ResultsEntryGrid } from "@/components/ResultsEntryGrid";

export const Route = createFileRoute("/result-entry")({
  head: () => ({ meta: [{ title: "Result Entry — SCOE" }] }),
  component: () => (
    <ProtectedAdmin>
      <ResultEntryPage />
    </ProtectedAdmin>
  ),
});

function ResultEntryPage() {
  return (
    <div className="p-6">
      <ResultsEntryGrid />
    </div>
  );
}
