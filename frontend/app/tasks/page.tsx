import { Suspense } from "react";
import TaskList from "@/components/TaskList";
import { LoadingState } from "@/components/ui/Primitives";
export default function TasksPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TaskList />
    </Suspense>
  );
}
