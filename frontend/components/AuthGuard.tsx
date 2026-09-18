"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/queries";
import { ErrorState, LoadingState } from "./ui/Primitives";

const publicRoutes = ["/login", "/register"];
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const isPublic = publicRoutes.includes(pathname);
  useEffect(() => {
    if (session.isPending || session.isError) return;
    if (!session.data && !isPublic) router.replace("/login");
    else if (session.data && isPublic) router.replace("/");
  }, [session.data, session.isPending, session.isError, isPublic, router]);
  if (session.isPending)
    return (
      <div className="grid min-h-dvh place-items-center">
        <LoadingState />
      </div>
    );
  if (session.isError)
    return (
      <div className="mx-auto mt-24 max-w-lg p-6">
        <ErrorState
          error={session.error}
          retry={() => void session.refetch()}
        />
      </div>
    );
  if ((!session.data && !isPublic) || (session.data && isPublic))
    return <LoadingState label="Taking you to your workspace…" />;
  return children;
}
