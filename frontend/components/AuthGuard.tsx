"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";

const publicRoutes = ["/login", "/register", "/forgot-password"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, loadUser } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (token && !user) {
      loadUser();
    }
  }, [token, user, loadUser]);

  useEffect(() => {
    if (!mounted) return;

    if (!token && !publicRoutes.includes(pathname)) {
      router.push("/login");
    } else if (token && publicRoutes.includes(pathname)) {
      router.push("/");
    }
  }, [token, pathname, router, mounted]);

  if (!mounted) return null; // Avoid hydration mismatch

  if (!token && !publicRoutes.includes(pathname)) {
    return null; // Return nothing while redirecting to login
  }

  return <>{children}</>;
}
