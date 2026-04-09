"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Save, User, Key, Check, Loader2 } from "lucide-react";

const AVATARS: Record<string, string> = {
  "1": "👤",
  "2": "👩‍💻",
  "3": "👨‍💻",
  "4": "🤖",
  "5": "🦊",
  "6": "🦄",
  "7": "🐸",
  "8": "🐻",
  "9": "🦖",
  "10": "🐶",
};

export default function ProfilePage() {
  const { user, loadUser } = useAppStore();

  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("1");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setAvatar(user.avatar || "1");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Current password is required to save changes");
      return;
    }

    setIsLoading(true);
    try {
      await api.put('/users/me', {
        username,
        avatar,
        current_password: currentPassword,
        new_password: newPassword || undefined
      });

      toast.success("Profile updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      await loadUser();
    } catch (error: unknown) {
      if (error instanceof Error && (error as any).response?.data?.detail) {
        toast.error((error as any).response.data.detail);
      } else {
        toast.error("Failed to update profile");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Profile Settings</h1>
        <p className="text-gray-500 mt-2">Manage your account details and preferences.</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 dark:bg-zinc-900 dark:border-zinc-800">
        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white border-b pb-2 dark:border-zinc-800">
              <User className="w-5 h-5 text-blue-500" />
              Public Profile
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Avatar
              </label>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                {Object.entries(AVATARS).map(([id, emoji]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAvatar(id)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all ${
                      avatar === id
                        ? 'bg-blue-100 ring-2 ring-blue-500 ring-offset-2 dark:bg-blue-900/30 dark:ring-offset-zinc-900'
                        : 'bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-6">
             <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white border-b pb-2 dark:border-zinc-800">
              <Key className="w-5 h-5 text-indigo-500" />
              Security
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                placeholder="Enter current password to save changes"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New Password <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                placeholder="Leave blank to keep current password"
              />
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={isLoading || !currentPassword}
              className="flex items-center justify-center w-full sm:w-auto gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}