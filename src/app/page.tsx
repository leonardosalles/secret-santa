"use client";
import Image from "next/image";
import { Gift, LogOut, Home, Eye, EyeOff, Lock, ArrowUpRight, Sparkles, Users, Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, limit } from "firebase/firestore";
import { db, getFirebaseErrorMessage } from "@/lib/firebase";
import PreferencesModal from "@/components/PreferencesModal";
import ParticipantModal from "@/components/ParticipantModal";
import RevealModal from "@/components/RevealModal";
import { APP_YEAR, IS_TEST_MODE, runFirebaseWrite } from "@/lib/app-config";
import { getOrCreatePrivateDraw } from "@/lib/secret-draw";
import { randomIndex } from "@/utils/draw";
import { decryptPicked, drawSessionKey, type EncryptedPicked } from "@/utils/crypto";
import { DRAW_UNLOCK_LABEL } from "@/lib/draw-schedule";
import { getAvatarUrl } from "@/utils/image";

type User = {
  id: string;
  name: string;
  preferences?: string[];
  avatarUrl?: string;
  picked?: string | EncryptedPicked;
  drawIdentity?: { publicKey: string };
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("home");
  const [showPrefs, setShowPrefs] = useState(false);
  const [showParticipant, setShowParticipant] = useState(false);
  const [participant, setParticipant] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [revealing, setRevealing] = useState(false);
  const [showRevealModal, setShowRevealModal] = useState(false);

  const [drawsUnlocked, setDrawsUnlocked] = useState(false);
  const [privatePickedId, setPrivatePickedId] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState("");
  const [testPicked, setTestPicked] = useState<User | null>(null);
  const [savedStarter, setSavedStarter] = useState<User | null>(null);
  const [historyLoading, setHistoryLoading] = useState(!IS_TEST_MODE);
  const [historyError, setHistoryError] = useState("");
  const [starter, setStarter] = useState<User | null>(null);
  const [showStarterModal, setShowStarterModal] = useState(false);
  const [drawingStarter, setDrawingStarter] = useState(false);
  const [drawError, setDrawError] = useState("");

  const [isHidden, setIsHidden] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const list: User[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<User, "id">),
      }));
      const cookie = document.cookie.split("; ").find((row) => row.startsWith("amigo_secreto_user="));
      setUserId(cookie ? cookie.split("=")[1] : null);
      setIsHidden(localStorage.getItem("secret_hidden") === "true");
      setUsers(list);
      setLoadingUsers(false);
      setLoadError("");
    }, (error) => {
      console.error("Falha ao acompanhar participantes do Firestore", error);
      setLoadError(getFirebaseErrorMessage(error));
      setLoadingUsers(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    const checkSchedule = async () => {
      try {
        const response = await fetch("/api/draws", { cache: "no-store" });
        if (!response.ok) throw new Error("Falha ao consultar a data do sorteio.");
        const status = await response.json();
        if (active) setDrawsUnlocked(status.unlocked === true);
      } catch {
        if (active) setDrawsUnlocked(false);
      }
    };
    void checkSchedule();
    const timer = setInterval(checkSchedule, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const ensureDrawsOpen = useCallback(async () => {
    const response = await fetch("/api/draws", { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível verificar a liberação. Tente novamente.");
    const status = await response.json();
    setDrawsUnlocked(status.unlocked === true);
    if (status.unlocked !== true) throw new Error(`Os sorteios serão liberados em ${DRAW_UNLOCK_LABEL}.`);
  }, []);

  useEffect(() => {
    if (IS_TEST_MODE) return;
    const history = query(collection(db, "editions", APP_YEAR, "starterDraws"), orderBy("createdAt", "desc"), limit(1));
    return onSnapshot(history, (snapshot) => {
      const data = snapshot.docs[0]?.data();
      setSavedStarter(data ? { id: data.participantId, name: data.participantName, avatarUrl: data.avatarUrl } : null);
      setHistoryLoading(false);
      setHistoryError("");
    }, (error) => {
      console.error("Falha ao carregar histórico de quem começa", error);
      setHistoryLoading(false);
      setHistoryError("Não foi possível carregar o histórico de quem começa.");
    });
  }, []);

  const handleDrawStarter = async () => {
    if (drawingStarter || loadingUsers || loadError || !users.length || !userId) return;
    if (!IS_TEST_MODE && !drawsUnlocked) return;
    setDrawingStarter(true);
    setStarter(null);
    setDrawError("");
    setShowStarterModal(true);
  };

  const finishStarter = async () => {
    try {
      if (!users.length || !userId) throw new Error("Nenhum participante disponível.");
      if (!IS_TEST_MODE) await ensureDrawsOpen();
      const random = new Uint32Array(1);
      const limit = 2 ** 32 - (2 ** 32 % users.length);
      do { crypto.getRandomValues(random); } while (random[0] >= limit);
      const choice = users[random[0] % users.length];
      await runFirebaseWrite(() => addDoc(collection(db, "editions", APP_YEAR, "starterDraws"), {
        year: APP_YEAR,
        participantId: choice.id,
        participantName: choice.name,
        avatarUrl: getAvatarUrl(choice),
        drawnBy: userId,
        createdAt: serverTimestamp(),
      }));
      setStarter(choice);
    } catch (error) {
      setShowStarterModal(false);
      setDrawError(error instanceof Error ? error.message : "Não foi possível salvar o sorteio de quem começa.");
    } finally {
      setDrawingStarter(false);
    }
  };

  const handleLogout = () => {
    if (userId) sessionStorage.removeItem(drawSessionKey(userId));
    document.cookie = "amigo_secreto_user=; path=/; max-age=0";
    router.push("/login");
  };

  const openParticipant = (u: User) => {
    setParticipant(u);
    setShowParticipant(true);
  };

  const me = useMemo(
    () => users.find((u) => u.id === userId) || null,
    [users, userId]
  );
  useEffect(() => {
    if (IS_TEST_MODE || !me || !userId) return;
    let active = true;
    const unlock = async () => {
      setPrivatePickedId(null);
      setUnlockError("");
      if (!me.picked) return;
      if (typeof me.picked === "string") {
        setUnlockError("Este resultado antigo ainda está em texto aberto. Ele será preservado e cifrado quando todos prepararem suas chaves e o sorteio da edição for iniciado.");
        return;
      }
      if (me.picked.year !== APP_YEAR) return;
      const key = sessionStorage.getItem(drawSessionKey(userId));
      if (!key) {
        setUnlockError("Entre novamente com sua senha para desbloquear seu resultado privado.");
        return;
      }
      try {
        const id = await decryptPicked(key, me.picked, userId, APP_YEAR);
        if (active) setPrivatePickedId(id);
      } catch {
        if (active) setUnlockError("Não foi possível abrir seu resultado privado. Entre novamente; nenhum sorteio foi alterado.");
      }
    };
    void unlock();
    return () => { active = false; };
  }, [me, userId]);

  const myPickedUser = useMemo(
    () => IS_TEST_MODE ? testPicked : users.find((user) => user.id === privatePickedId) || null,
    [users, privatePickedId, testPicked]
  );

  const displayedStarter = starter || savedStarter;
  const isLoadingMyPicked = loadingUsers;

  const handleReveal = useCallback(async () => {
    if (!userId || !users.some((user) => user.id === userId) || revealing) return;
    setRevealing(true);

    setDrawError("");
    try {
      if (!IS_TEST_MODE) await ensureDrawsOpen();
      let choice: User | undefined;
      if (IS_TEST_MODE) {
        const candidates = users.filter((user) => user.id !== userId);
        if (!candidates.length) throw new Error("São necessários pelo menos dois participantes.");
        choice = candidates[randomIndex(candidates.length)];
        setTestPicked(choice);
      } else {
        const key = sessionStorage.getItem(drawSessionKey(userId));
        if (!key) throw new Error("Entre novamente com sua senha para desbloquear sua chave privada.");
        const encrypted = await getOrCreatePrivateDraw(userId);
        const id = await decryptPicked(key, encrypted, userId, APP_YEAR);
        choice = users.find((user) => user.id === id);
        if (!choice) throw new Error("O participante sorteado não está disponível.");
        setPrivatePickedId(id);
      }

      setParticipant(choice);
      setShowParticipant(true);
    } catch (error) {
      setDrawError(error instanceof Error ? error.message : "Não foi possível sortear seu amigo secreto.");
    } finally {
      setRevealing(false);
    }
  }, [userId, users, revealing, ensureDrawsOpen]);

  const finishReveal = useCallback(() => {
    setShowRevealModal(false);
    void handleReveal();
  }, [handleReveal]);

  return (
    <div className="dashboard min-h-screen flex flex-col bg-gradient-to-b from-gray-950 to-gray-900 text-gray-100">
      {/* Header */}
      <header className="w-full flex items-center justify-between px-6 py-4 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 fixed z-50">
        <div className="flex items-center gap-3">
          <Gift className="text-blue-400 w-6 h-6" />
          <h1 className="text-xl font-semibold flex items-center gap-2">
            Amigo Secreto
            <span className="bg-gradient-to-r from-blue-700 to-blue-800 via-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
              {process.env.NEXT_PUBLIC_APP_YEAR}
            </span>
          </h1>
        </div>

        {/* Navegação desktop */}
        <nav className="hidden md:flex items-center gap-6">
          <button
            onClick={() => setActiveTab("home")}
            className={`hover:text-blue-400 cursor-pointer ${
              activeTab === "home" ? "text-blue-400 font-medium" : ""
            }`}
          >
            Início
          </button>
          <button
            onClick={() => setShowPrefs(true)}
            className="hover:text-blue-400 cursor-pointer"
          >
            Presentes
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 rounded-lg px-4 py-2 font-medium cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </nav>

        {/* Botão sair mobile */}
        <button
          onClick={handleLogout}
          className="md:hidden flex items-center gap-2 bg-red-600 hover:bg-red-700 rounded-lg px-3 py-2 text-sm font-medium"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 p-6 pb-24 md:pb-6 pt-22 md:pt-24">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          {loadError && <p role="alert" className="rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-200">{loadError} <button className="underline" onClick={() => window.location.reload()}>Tentar novamente</button></p>}
          <div className="welcome-block">
            <div><span className="eyebrow"><Sparkles size={14} /> UM PRESENTE, MUITAS HISTÓRIAS</span>
            <h2>O melhor presente<br />é estar <span>junto.</span></h2>
            <p>Olá{me ? `, ${me.name.split(" ")[0]}` : ""}! A surpresa começa aqui. Vamos espalhar um pouco de carinho?</p></div>
            <div className="edition-stamp"><Gift size={30} strokeWidth={1.3} /><span>AMIGO SECRETO</span><strong>{process.env.NEXT_PUBLIC_APP_YEAR || "2025"}</strong></div>
          </div>
          {IS_TEST_MODE && <p role="status" className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4 text-sm text-amber-200">Modo teste ativo: sorteios liberados. Nenhuma alteração é salva no Firebase.</p>}
          {!IS_TEST_MODE && !drawsUnlocked && (
            <div className="flex items-start gap-3 rounded-2xl border border-gray-800 bg-gray-900/70 p-5" role="status">
              <Lock size={20} className="shrink-0 text-blue-400" />
              <div><p className="text-sm font-medium">A surpresa tem data marcada</p><p className="mt-1 text-sm text-gray-400">O sorteio do amigo secreto será liberado em {DRAW_UNLOCK_LABEL}. Até lá, aproveite para atualizar sua lista de desejos.</p></div>
            </div>
          )}
          {unlockError && <p role="status" className="rounded-xl border border-amber-700/50 p-4 text-sm text-amber-200">{unlockError} <button onClick={handleLogout} className="underline">Entrar novamente</button></p>}
          {drawError && <p role="alert" className="rounded-xl border border-red-900 p-4 text-sm text-red-200">{drawError}</p>}
          <div className="dashboard-grid">
          {/* Meu amigo secreto */}
          <section className="secret-card relative bg-gray-900/70 border border-gray-800 rounded-2xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-blue-400">
                Seu amigo secreto
              </h3>
              {myPickedUser && (
                <button
                  onClick={() => { localStorage.setItem("secret_hidden", String(!isHidden)); setIsHidden(!isHidden); }}
                  aria-label={isHidden ? "Mostrar amigo secreto" : "Ocultar amigo secreto"} className="text-gray-400 hover:text-blue-400 transition cursor-pointer"
                >
                  {isHidden ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>

            {/* Skeleton */}
            {isLoadingMyPicked ? (
              <div className="flex flex-col items-center justify-center md:py-6 animate-pulse">
                <div className="relative w-28 h-28 mb-4">
                  <div className="w-28 h-28 rounded-full bg-gray-800 border border-gray-800" />
                </div>
                <div className="h-5 w-32 bg-gray-800 rounded mb-3" />
                <div className="w-full max-w-xs h-10 bg-gray-800 rounded mt-3" />
              </div>
            ) : myPickedUser ? (
              <div className="flex flex-col items-center justify-center py-8 relative">
                <div className="relative w-28 h-28 mb-4">
                  <div className="relative w-28 h-28 mb-4">
                    {/* Imagem real */}
                    {!isHidden && (
                      <Image unoptimized width={112} height={112}
                        src={getAvatarUrl(myPickedUser)}
                        alt={myPickedUser.name}
                        className="w-28 h-28 rounded-full border border-gray-800 object-cover"
                      />
                    )}

                    {/* Avatar ofuscado com gradiente e blur */}
                    {isHidden && (
                      <div className="w-28 h-28 rounded-full border border-gray-800 overflow-hidden relative">
                        {/* Camada de gradiente "base" (simulando uma foto) */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 to-blue-800 via-blue-600" />

                        {/* Camada de blur translúcido */}
                        <div className="absolute inset-0 backdrop-blur-xl bg-gray-950/60 flex items-center justify-center transition-all duration-300">
                          <Lock className="w-8 h-8 text-gray-300" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div
                  className={`text-lg font-semibold mb-2 transition-all ${
                    isHidden ? "text-gray-500 blur-[2px] select-none" : ""
                  }`}
                >
                  {isHidden ? "********" : myPickedUser.name}
                </div>
                <button
                  onClick={() => openParticipant(myPickedUser)}
                  className="px-4 py-2 rounded-lg w-full max-w-xs mt-2 transition-all bg-blue-800 hover:bg-blue-700 cursor-pointer"
                >
                  Ver Presentes
                </button>
                {IS_TEST_MODE && <button onClick={() => setShowRevealModal(true)} disabled={revealing} className="mt-3 rounded-xl px-4 py-3 text-sm">Testar novo sorteio</button>}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="gift-orbit"><Gift size={52} strokeWidth={1.2} /><Sparkles className="orbit-spark" size={22} /></div>
                <h4 className="text-xl font-semibold mt-6 mb-2">Quem será a sua surpresa?</h4>
                <p className="text-sm text-gray-400 mb-6 text-center max-w-xs leading-relaxed">Um nome, um segredo e a chance de fazer alguém sorrir. Seu amigo está esperando.</p>
                <button
                  onClick={() => { if (IS_TEST_MODE || drawsUnlocked) setShowRevealModal(true); }}
                  disabled={(!IS_TEST_MODE && !drawsUnlocked) || revealing || !userId || !!loadError}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg w-full max-w-xs"
                >
                  {IS_TEST_MODE || drawsUnlocked ? "Revelar amigo secreto ✨" : "Disponível em 05/12"}
                </button>
              </div>
            )}
          </section>

          <aside className="wishlist-card"><span className="eyebrow"><Heart size={14} /> DO SEU JEITINHO</span><div className="wishlist-icon"><Gift size={32} strokeWidth={1.3} /></div><h3>Uma ajudinha para<br />quem tirou você.</h3><p>Compartilhe o que você adora e deixe seu amigo secreto acertar no presente.</p><button onClick={() => setShowPrefs(true)}>Minha lista de desejos <ArrowUpRight size={18} /></button><span className="wishlist-note">Pequenas dicas, grandes sorrisos.</span></aside>
          </div>
          <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-6">
            <span className="eyebrow"><Sparkles size={14} /> HORA DA REVELAÇÃO</span>
            <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="text-xl font-medium">Quem vai começar?</h3><p className="mt-2 text-sm text-gray-400">Sorteie uma pessoa da turma para abrir a rodada de presentes.</p></div>
              <button onClick={handleDrawStarter} disabled={(!IS_TEST_MODE && !drawsUnlocked) || drawingStarter || historyLoading || loadingUsers || !!loadError || !users.length || !userId} className="shrink-0 rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium hover:bg-blue-700">
                {drawingStarter ? "Sorteando..." : !IS_TEST_MODE && !drawsUnlocked ? "Disponível em 05/12" : starter || savedStarter ? "Sortear novamente" : "Sortear quem começa"}
              </button>
            </div>
            {historyError && <p role="alert" className="mt-3 text-sm text-red-300">{historyError}</p>}
            <div aria-live="polite" aria-atomic="true">
              {displayedStarter && <div className="mt-5 flex items-center gap-4 rounded-xl border border-gray-800 p-4"><Image unoptimized width={56} height={56} src={getAvatarUrl(displayedStarter)} alt={displayedStarter.name} className="h-14 w-14 rounded-full object-cover" /><div><p className="text-xs text-gray-400">Quem começa a rodada é...</p><p className="mt-1 text-lg font-semibold text-blue-400">{displayedStarter.name}</p></div></div>}
            </div>
          </section>
          {/* Participantes */}
          <section className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6">
            <div className="participants-heading"><div><span className="eyebrow"><Users size={14} /> A TURMA TODA</span><h3>Quem faz parte da surpresa</h3></div><span className="count-pill">{users.length} participantes</span></div>
            {loadingUsers ? (
              <p className="text-sm text-gray-400">Carregando...</p>
            ) : (
              <div className="participants-grid">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => openParticipant(u)}
                    className="participant-tile relative group cursor-pointer"
                  >
                    <Image unoptimized width={112} height={112}
                      src={getAvatarUrl(u)}
                      alt={u.name}
                      className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border border-gray-800 hover:border-blue-500 transition-all"
                    />
                    <span className="participant-name">
                      {u.name}
                    </span>
                    {u.preferences && u.preferences.length > 0 && (
                      <span className="preference-count">
                        {u.preferences.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
          <footer className="page-footer"><Gift size={14} /> Feito para celebrar as boas conexões.<span>O segredo fica entre a gente.</span></footer>
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
        onSaved={() => {}}
      />
      <ParticipantModal
        open={showParticipant}
        onClose={() => setShowParticipant(false)}
        participant={participant}
      />
      <RevealModal
        open={showRevealModal}
        onFinish={finishReveal}
        onClose={() => setShowRevealModal(false)}
      />
      <RevealModal
        open={showStarterModal}
        variant="starter"
        onFinish={finishStarter}
        onClose={() => { setShowStarterModal(false); setDrawingStarter(false); }}
        result={starter ? { name: starter.name, avatarUrl: getAvatarUrl(starter) } : null}
      />
    </div>
  );
}
