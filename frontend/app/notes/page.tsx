import { Suspense } from "react";
import NotesPanel from "@/components/NotesPanel";
import { LoadingState } from "@/components/ui/Primitives";
export default function NotesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <NotesPanel />
    </Suspense>
  );
}
