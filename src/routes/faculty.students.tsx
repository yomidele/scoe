import { createFileRoute } from "@tanstack/react-router";
import { ProtectedFaculty } from "@/components/ProtectedFaculty";
import { StudentsPage } from "./students";

export const Route = createFileRoute("/faculty/students")({
  head: () => ({ meta: [{ title: "Faculty Students — SCOE" }] }),
  component: () => (
    <ProtectedFaculty>
      <StudentsPage />
    </ProtectedFaculty>
  ),
});
