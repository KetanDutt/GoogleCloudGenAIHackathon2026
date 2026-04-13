"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginAPI } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setToken = useAppStore((state) => state.setToken);

  const testEmail = process.env.NEXT_PUBLIC_TEST_EMAIL;
  const testPassword = process.env.NEXT_PUBLIC_TEST_PASSWORD;

  const handleLogin = async (loginEmail: string, loginPassword: string) => {
    setLoading(true);
    try {
      const data = await loginAPI(loginEmail, loginPassword);
      setToken(data.access_token);
      toast.success("Logged in successfully");
      router.push("/");
    } catch (error: unknown) {
      if (error instanceof Error && 'response' in error) {
        toast.error((error as {response?: {data?: {detail?: string}}}).response?.data?.detail || "Login failed");
      } else {
        toast.error("Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleLogin(email, password);
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <div className="text-sm">
              <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
                Create an account
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>

        {testEmail && testPassword && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-zinc-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Test Account Details
            </h3>
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-md p-3 text-sm text-gray-700 dark:text-gray-300 mb-4 font-mono">
              <div><span className="font-semibold">Email:</span> {testEmail}</div>
              <div><span className="font-semibold">Password:</span> {testPassword}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail(testEmail);
                setPassword(testPassword);
                handleLogin(testEmail, testPassword);
              }}
              disabled={loading}
              className="flex w-full justify-center rounded-md bg-zinc-200 dark:bg-zinc-700 px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 disabled:opacity-50"
            >
              Login with Test Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
