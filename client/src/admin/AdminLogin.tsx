import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLogin } from "./api";

type Props = { onSuccess: () => void };

export function AdminLogin({ onSuccess }: Props) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminLogin(login, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">PING — Админ-панель</h1>
          <p className="text-slate-400 text-sm mt-1">Вход для администратора</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-slate-800/50 p-6 border border-slate-700">
          <div className="space-y-2">
            <Label htmlFor="admin-login" className="text-slate-300">Логин</Label>
            <Input
              id="admin-login"
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white"
              placeholder="admin"
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password" className="text-slate-300">Пароль</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !login.trim() || !password}>
            {loading ? "Вход…" : "Войти"}
          </Button>
        </form>
      </div>
    </div>
  );
}
