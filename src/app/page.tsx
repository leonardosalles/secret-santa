"use client";
import { Gift, LogOut, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, doc, getDocs, updateDoc } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import PreferencesModal from "@/components/PreferencesModal";
import ParticipantModal from "@/components/ParticipantModal";
import RevealModal from "@/components/RevealModal";
import { getAvatarUrl } from "@/utils/image";

type User = {
  id: string;
  name: string;
  preferences?: string[];
  avatarUrl?: string;
  picked?: string;
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("home");
  const [showPrefs, setShowPrefs] = useState(false);
  const [showParticipant, setShowParticipant] = useState(false);
  const [participant, setParticipant] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [revealing, setRevealing] = useState(false);
  const [showRevealModal, setShowRevealModal] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("amigo_secreto_user="));
    if (cookie) {
      const id = cookie.split("=")[1];
      setUserId(id);
    }
    loadAllUsers();
  }, []);

  async function loadAllUsers() {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const list: User[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setUsers(list);
    } finally {
      setLoadingUsers(false);
    }
  }

  const handleLogout = () => {
    document.cookie = "amigo_secreto_user=; path=/; max-age=0";
    router.push("/login");
  };

  const openParticipant = (u: User) => {
    setParticipant(u);
    setShowParticipant(true);
  };

  const handleSavedPrefs = () => {
    loadAllUsers();
  };

  const myPicked = users.find((u) => u.id === userId)?.picked || null;
  const myPickedUser = users.find((u) => u.id === myPicked) || null;

  const handleReveal = async () => {
    if (!userId) return;
    setRevealing(true);

    await loadAllUsers();

    const updatedUsers = [...users];
    const me = updatedUsers.find((u) => u.id === userId);
    if (!me) return;

    const pickedIds = new Set(
      updatedUsers.filter((u) => u.picked).map((u) => u.picked as string)
    );

    let candidates = updatedUsers.filter(
      (u) => u.id !== userId && !pickedIds.has(u.id)
    );

    if (candidates.length === 0) {
      candidates = updatedUsers.filter((u) => u.id !== userId);
    }

    if (candidates.length === 0) {
      alert("Não há outros participantes disponíveis para sortear.");
      setRevealing(false);
      return;
    }

    const choice = candidates[Math.floor(Math.random() * candidates.length)];

    await updateDoc(doc(db, "users", userId), { picked: choice.id });

    await loadAllUsers();

    setParticipant(choice);
    setShowParticipant(true);
    setRevealing(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-950 to-gray-900 text-gray-100">
      {/* Header */}
      <header className="w-full flex items-center justify-between px-6 py-4 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 fixed z-50">
        <div className="flex items-center gap-3">
          <Gift className="text-blue-400 w-6 h-6" />
          <h1 className="text-xl font-semibold flex items-center gap-2">
            Amigo Secreto
            <span className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
              2025
            </span>
          </h1>
        </div>

        {/* Navegação principal (desktop) */}
        <nav className="hidden md:flex items-center gap-6">
          <button
            onClick={() => setActiveTab("home")}
            className={`hover:text-blue-400 ${
              activeTab === "home" ? "text-blue-400 font-medium" : ""
            }`}
          >
            Início
          </button>
          <button
            onClick={() => setShowPrefs(true)}
            className="hover:text-blue-400"
          >
            Presentes
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 rounded-lg px-4 py-2 font-medium"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </nav>

        {/* Botão sair no mobile */}
        <button
          onClick={handleLogout}
          className="md:hidden flex items-center gap-2 bg-red-600 hover:bg-red-700 rounded-lg px-3 py-2 text-sm font-medium"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </header>

      {/* Content area */}
      <main className="flex-1 p-6 pb-24 md:pb-6 pt-22 md:pt-24">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          {/* Meu amigo secreto */}
          <section className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 flex flex-col">
            <h3 className="text-lg font-semibold mb-4 text-blue-400">
              Meu Amigo Secreto
            </h3>

            {myPickedUser ? (
              <div className="flex-1 flex flex-col items-center justify-center md:px-42 md:py-6">
                <img
                  src={getAvatarUrl(myPickedUser)}
                  className="w-28 h-28 rounded-full mb-4 border border-gray-800"
                />
                <div className="text-lg font-semibold mb-2">
                  {myPickedUser.name}
                </div>

                <button
                  onClick={() => openParticipant(myPickedUser)}
                  className="bg-blue-800 hover:bg-blue-700 px-4 py-2 rounded-lg w-full mt-2"
                >
                  Ver Presentes
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center md:px-42 md:py-6">
                <p className="text-sm text-gray-400 mb-4 border rounded-lg p-6 w-full text-center border-gray-800 my-6">
                  Você ainda não tirou ninguém.
                </p>
                <button
                  onClick={() => setShowRevealModal(true)}
                  disabled={revealing || !userId}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg w-full"
                >
                  Revelar amigo secreto
                </button>
              </div>
            )}
          </section>

          {/* Participantes */}
          <section className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-blue-400">
              Participantes
            </h3>

            {loadingUsers ? (
              <p className="text-sm text-gray-400">Carregando...</p>
            ) : (
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => openParticipant(u)}
                    className="relative group"
                  >
                    <img
                      src={getAvatarUrl(u)}
                      alt={u.name}
                      className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border border-gray-800 hover:border-blue-500 transition-all"
                    />
                    <span className="absolute left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block bg-gray-800 text-gray-100 text-xs px-2 py-1 rounded-md whitespace-nowrap z-10 shadow-lg">
                      {u.name}
                    </span>

                    {u.preferences && u.preferences.length > 0 && (
                      <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                        {u.preferences.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Tabbar mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-md border-t border-gray-800 flex justify-around py-2 z-50">
        <button
          onClick={() => {
            setActiveTab("home");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center gap-1 text-xs ${
            activeTab === "home" ? "text-blue-400" : "text-gray-400"
          }`}
        >
          <Home className="w-5 h-5" />
          Início
        </button>
        <button
          onClick={() => {
            setActiveTab("amigos");
            setShowPrefs(true);
          }}
          className={`flex flex-col items-center gap-1 text-xs ${
            activeTab === "amigos" ? "text-blue-400" : "text-gray-400"
          }`}
        >
          <Gift className="w-5 h-5" />
          Presentes
        </button>
      </div>

      {/* Modais */}
      <PreferencesModal
        open={showPrefs}
        onClose={() => {
          setShowPrefs(false);
          setActiveTab("home");
        }}
        userId={userId}
        onSaved={handleSavedPrefs}
      />

      <ParticipantModal
        open={showParticipant}
        onClose={() => setShowParticipant(false)}
        participant={participant}
      />

      <RevealModal
        open={showRevealModal}
        onFinish={() => {
          setShowRevealModal(false);
          handleReveal();
        }}
      />
    </div>
  );
}
