"use client";

import { useEffect, useRef, useState } from "react";
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { Trophy, X, Shuffle, Check, Search, LoaderCircle } from "lucide-react";
import styles from "./TeamsModal.module.css";
import Modal from "./ui/Modal";
import { db } from "@/lib/firebase";
import { APP_YEAR, IS_TEST_MODE, runFirebaseWrite } from "@/lib/app-config";
import { drawTeams, getTeamIdentity, type GincanaTeam, type TeamMember } from "@/utils/teams";

const letters = ["α", "β", "γ", "δ", "ε", "ζ", "η", "θ"];
function TeamBadge({ team }: { team: GincanaTeam }) {

  return <div className={styles.badge} style={{ color: team.color }}>
    <svg viewBox="0 0 100 112" aria-hidden="true"><path d="M50 3 94 20v39c0 25-25 42-44 50C31 101 6 84 6 59V20Z" fill="currentColor" fillOpacity=".1" stroke="currentColor" strokeWidth="2" /><path d="m50 12 36 15v32c0 19-19 34-36 42-17-8-36-23-36-42V27Z" fill="none" stroke="currentColor" strokeOpacity=".3" strokeDasharray="3 4" /></svg>
    <span aria-hidden="true">{letters[team.emblem]}</span>
  </div>;
}

type Props = { open: boolean; onClose: () => void; users: TeamMember[]; userId: string | null; loading: boolean; usersError: string };
export default function TeamsModal({ open, onClose, users, userId, loading, usersError }: Props) {
  const [selected, setSelected] = useState<string[] | null>(null);
  const [playersPerTeam, setPlayersPerTeam] = useState(4);
  const [search, setSearch] = useState("");
  const [teams, setTeams] = useState<GincanaTeam[]>([]);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [historyLoading, setHistoryLoading] = useState(!IS_TEST_MODE);
  const [historyError, setHistoryError] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (IS_TEST_MODE) return;
    return onSnapshot(query(collection(db, "editions", APP_YEAR, "teamDraws"), orderBy("createdAt", "desc"), limit(1)), snapshot => {
      const data = snapshot.docs[0]?.data();
      if (data) {
        const result = data.teams as GincanaTeam[];
        setTeams(result.map((team, index) => ({ ...team, ...getTeamIdentity(index) })));
        setSelected(result.flatMap(team => team.members.map(member => member.id)));
        setPlayersPerTeam(data.playersPerTeam ?? Math.max(1, ...result.map(team => team.members.length)));
        setSaved(true);
      }
      setHistoryLoading(false);
      setHistoryError("");
    }, () => { setHistoryLoading(false); setHistoryError("Não foi possível carregar o sorteio salvo. Feche e reabra a página para tentar novamente."); });
  }, []);
  const selectedUsers = users.filter(user => selected === null || selected.includes(user.id));
  const valid = Number.isSafeInteger(playersPerTeam) && playersPerTeam > 0 && selectedUsers.length > 0;
  const teamCount = valid ? Math.ceil(selectedUsers.length / playersPerTeam) : 0;
  const lastTeamSize = valid ? selectedUsers.length % playersPerTeam : 0;
  const generate = async () => {
    if (busy.current || !valid || !userId || loading || usersError || historyLoading || historyError) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const result = drawTeams(selectedUsers, playersPerTeam);
      await runFirebaseWrite(() => addDoc(collection(db, "editions", APP_YEAR, "teamDraws"), {
        year: APP_YEAR, playersPerTeam, teams: result, drawnBy: userId, createdAt: serverTimestamp(),
      }));
      setTeams(result);
      setSaved(true);
    } catch {
      setError("Não foi possível salvar o sorteio. Confira sua conexão e as permissões do Firebase e tente novamente. O resultado anterior foi mantido.");
    } finally { busy.current = false; setSaving(false); }
  };
  return <Modal open={open} onClose={saving ? () => {} : onClose} label="Arena da gincana" className={styles.dialog}>
    <div className={styles.root}>
      <header className="flex items-start justify-between gap-4"><div><span className="eyebrow"><Trophy size={14} /> MODO GINCANA</span><h2 className="mt-3 text-3xl font-bold tracking-tight">Monte sua arena<span className="text-lime-300">.</span></h2><p className="mt-2 text-sm text-gray-400">Reúna a turma. Sorteie os times. Que vença a diversão!</p></div><button onClick={onClose} disabled={saving} aria-label="Fechar equipes" className="rounded-full p-2 hover:bg-white/10"><X size={20} /></button></header>
      {IS_TEST_MODE && <p className="mt-4 text-sm text-amber-200" role="status">Modo teste: o sorteio fica apenas nesta sessão, sem salvar no Firebase.</p>}
      <div className={styles.step}><span>01</span><h3>Escolha os jogadores</h3><strong>{selectedUsers.length} na arena</strong></div>
      <fieldset disabled={saving || loading || historyLoading} className={styles.fieldset}>
        <div className={styles.toolbar}><label className={styles.search}><Search size={16} /><input aria-label="Buscar participante" placeholder="Buscar jogador..." value={search} onChange={e => setSearch(e.target.value)} /></label><button className={styles.selectAll} onClick={() => setSelected(selectedUsers.length === users.length ? [] : users.map(u => u.id))}>{selectedUsers.length === users.length ? "Limpar" : "Todos"}</button></div>
        <div className={styles.players}>{users.filter(u => u.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(user => <label key={user.id} className={styles.player} data-selected={selected === null || selected.includes(user.id)}><input type="checkbox" checked={selected === null || selected.includes(user.id)} onChange={e => setSelected(e.target.checked ? [...(selected ?? users.map(u => u.id)), user.id] : (selected ?? users.map(u => u.id)).filter(id => id !== user.id))} /><span className={styles.avatar}>{user.name.slice(0, 2).toUpperCase()}</span><span className={styles.playerName}>{user.name}</span><Check size={16} /></label>)}{users.length > 0 && !users.some(u => u.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && <p className={styles.empty}>Nenhum participante encontrado.</p>}{!users.length && <p className="p-3 text-sm text-gray-400">{loading ? "Carregando jogadores..." : "Nenhum participante cadastrado."}</p>}</div>
        <div className={styles.step}><span>02</span><h3>Defina os times</h3></div>
        <div className={styles.settings}><label htmlFor="players-per-team">Jogadores por equipe</label><input id="players-per-team" type="number" min={1} step={1} value={playersPerTeam || ""} onChange={e => setPlayersPerTeam(Number(e.target.value))} /></div>
      </fieldset>
      <p className={`mt-3 text-xs ${valid ? "text-lime-200" : "text-amber-200"}`} role="status">{valid ? `${teamCount} ${teamCount === 1 ? "equipe" : "equipes"} · até ${playersPerTeam} jogadores por equipe${lastTeamSize ? ` · última equipe com ${lastTeamSize}` : ""} · ninguém fica de fora` : "Selecione participantes e informe quantos jogadores cada equipe deve ter."}</p>
      {(error || historyError || usersError) && <p role="alert" className="mt-4 text-sm text-red-300">{error || historyError || usersError}</p>}
      <button onClick={generate} disabled={!valid || saving || loading || historyLoading || !!historyError || !!usersError || !userId} className={styles.generate}>{saving ? <LoaderCircle className="animate-spin" size={18} /> : <Shuffle size={18} />}{saving ? "Salvando os times..." : historyLoading ? "Carregando sorteio..." : teams.length ? "Gerar novo sorteio" : "Sortear equipes"}</button>
      {teams.length > 0 && <section className="mt-7" aria-live="polite"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold"><Trophy size={17} className="mr-2 inline text-amber-300" />Times na arena</h3><span className="text-xs text-gray-400">{saved ? IS_TEST_MODE ? "Prévia desta sessão" : "Sorteio salvo no Firebase" : ""}</span></div><div className={styles.teams}>{teams.map(team => <article key={team.name} className={styles.team} style={{ borderColor: `${team.color}55` }}><TeamBadge team={team} /><h4 style={{ color: team.color }}>{team.name}</h4><span className="text-xs text-gray-400">{team.members.length} jogadores</span><ol>{team.members.map((member, i) => <li key={member.id}><span>{String(i + 1).padStart(2, "0")}</span>{member.name}</li>)}</ol></article>)}</div><p className="mt-3 text-xs text-gray-400">Gerar novamente embaralha os jogadores entre as equipes. O último sorteio salvo aparece ao voltar.</p></section>}
    </div>
  </Modal>;
}
