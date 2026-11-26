import { randomIndex } from "./draw";

export type TeamMember = { id: string; name: string };
export type GincanaTeam = { name: string; color: string; emblem: number; members: TeamMember[] };
export const TEAM_IDENTITIES = [
  { name: "Alfa", color: "#fb923c", emblem: 0 },
  { name: "Beta", color: "#c4b5fd", emblem: 1 },
  { name: "Gama", color: "#facc15", emblem: 2 },
  { name: "Delta", color: "#67e8f9", emblem: 3 },
  { name: "Épsilon", color: "#f9a8d4", emblem: 4 },
  { name: "Zeta", color: "#86efac", emblem: 5 },
  { name: "Eta", color: "#60a5fa", emblem: 6 },
  { name: "Teta", color: "#f87171", emblem: 7 },
];

export function getTeamIdentity(index: number) {
  const identity = TEAM_IDENTITIES[index % TEAM_IDENTITIES.length];
  const round = Math.floor(index / TEAM_IDENTITIES.length);
  return { ...identity, name: round ? `${identity.name} ${round + 1}` : identity.name };
}

export function drawTeams(members: TeamMember[], playersPerTeam: number): GincanaTeam[] {
  if (!Number.isSafeInteger(playersPerTeam) || playersPerTeam < 1 || members.length < 1) {
    throw new Error("Selecione participantes e informe um número inteiro de jogadores por equipe maior que zero.");
  }
  if (new Set(members.map(({ id }) => id)).size !== members.length) throw new Error("Existem participantes repetidos.");
  function shuffle<T>(items: T[]) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = randomIndex(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  const shuffled = shuffle(members);
  const count = Math.ceil(members.length / playersPerTeam);
  return Array.from({ length: count }, (_, index) => ({
    ...getTeamIdentity(index), members: shuffled.slice(index * playersPerTeam, (index + 1) * playersPerTeam).map(({ id, name }) => ({ id, name })),
  }));
}
