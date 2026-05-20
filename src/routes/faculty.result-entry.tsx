import { createFileRoute } from "@tanstack/react-router";
import { ProtectedFaculty } from "@/components/ProtectedFaculty";
import { ResultsEntryGrid } from "@/components/ResultsEntryGrid";

export const Route = createFileRoute("/faculty/result-entry")({
  head: () => ({ meta: [{ title: "Faculty Result Entry — SCOE" }] }),
  component: () => (
    <ProtectedFaculty>
      <div className="p-2 md:p-6">
        <ResultsEntryGrid />
      </div>
    </ProtectedFaculty>
  ),
});
