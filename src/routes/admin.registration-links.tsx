import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { FacultyRegistrationLinksPanel } from "@/components/RegistrationLinksPanel";

export const Route = createFileRoute("/admin/registration-links")({
  head: () => ({ meta: [{ title: "Registration Links — SCOE" }] }),
  component: () => <ProtectedAdmin><FacultyRegistrationLinksPanel adminMode /></ProtectedAdmin>,
});
