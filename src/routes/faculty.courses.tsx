import { createFileRoute } from "@tanstack/react-router";
import { ProtectedFaculty } from "@/components/ProtectedFaculty";
import { CoursesPage } from "./courses";

export const Route = createFileRoute("/faculty/courses")({
  head: () => ({ meta: [{ title: "Faculty Courses — SCOE" }] }),
  component: () => (
    <ProtectedFaculty>
      <CoursesPage />
    </ProtectedFaculty>
  ),
});
