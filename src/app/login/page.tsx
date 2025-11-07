"use client";

import { collection, db, doc, getDoc, getDocs, setDoc } from "@/lib/firebase";
import { sha256 } from "@/utils/crypto";
import { Eye, EyeOff, Gift } from "lucide-react";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register" | null>(null);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      const snapshot = await getDocs(collection(db, "users"));
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(list);
    };
    loadUsers();
  }, []);

  const handleSelectUser = async (id: string) => {
    setPassword("");
    setMessage("");
    if (!id) return setSelectedUser(null);
    const ref = doc(db, "users", id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      setSelectedUser({ id, ...data });
      setMode(data.passwordHash ? "login" : "register");
    }
  };

  const doLogin = (userId: string) => {
    document.cookie = `amigo_secreto_user=${userId}; path=/; max-age=${
      60 * 60 * 24 * 7
    }`;
    window.location.href = "/";
  };

  const handleLogin = async () => {
    if (!selectedUser) return;
    const hashed = await sha256(password);
    if (hashed === selectedUser.passwordHash) {
      doLogin(selectedUser.id);
    } else {
      setMessage("❌ Senha incorreta!");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleRegister = async () => {
    if (!selectedUser || !password) return;
    const hashed = await sha256(password);
    const ref = doc(db, "users", selectedUser.id);

    await setDoc(
      ref,
      { ...selectedUser, passwordHash: hashed },
      { merge: true }
    );

    const updatedUser = { ...selectedUser, passwordHash: hashed };
    setSelectedUser(updatedUser);
    setMessage("✅ Senha criada! Entrando...");

    setTimeout(() => {
      doLogin(updatedUser.id);
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (mode === "login") handleLogin();
      if (mode === "register") handleRegister();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-950 to-gray-900 text-gray-100 px-4">
      <div className="backdrop-blur-xl bg-gray-900/70 border border-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-sm sm:max-w-md transition-all">
        <div className="flex items-center gap-3 pt-2 p-6 md:p-12 md:pt-6 justify-center">
          <Gift className="text-blue-400 w-6 h-6" />
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            Amigo Secreto
            <span className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
              2025
            </span>
          </h1>
        </div>

        <label className="block text-gray-300 mb-2 font-medium text-sm">
          Selecione seu Nome
        </label>
        <div className="relative mb-4">
          <select
            className="appearance-none w-full bg-gray-800 border border-gray-700 rounded-lg px-3 pr-10 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => handleSelectUser(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>
              Escolha...
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          {/* Ícone de seta */}
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-400 drop-shadow-sm"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.293l3.71-4.06a.75.75 0 111.08 1.04l-4.24 4.64a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </div>

        {mode && (
          <>
            <label className="block text-gray-300 mb-2 font-medium text-sm">
              {mode === "register" ? "Crie uma senha" : "Digite sua senha"}
            </label>

            <div className="relative mb-4">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === "register" ? "Nova senha..." : "Senha..."}
              />

              {/* Botão olho */}
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {mode === "login" ? (
              <button
                onClick={handleLogin}
                className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 transition active:scale-95"
              >
                Entrar
              </button>
            ) : (
              <button
                onClick={handleRegister}
                className="w-full bg-green-600 text-white rounded-lg py-3 font-medium hover:bg-green-700 transition active:scale-95"
              >
                Registrar
              </button>
            )}
          </>
        )}

        {message && (
          <p className="mt-4 text-center text-sm text-gray-400">{message}</p>
        )}
      </div>
    </div>
  );
}
