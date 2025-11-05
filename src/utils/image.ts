export function getAvatarUrl(user: { name: string; avatarUrl?: string }) {
  const processedName = user.name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return (
    user.avatarUrl ||
    `/avatars/${processedName.toLowerCase().split(" ").join("-")}.png`
  );
}
