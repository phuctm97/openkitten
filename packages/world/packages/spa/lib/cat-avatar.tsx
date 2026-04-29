import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

function getInitials(name: string): string {
  let first = "";
  let last = "";
  for (const match of name.matchAll(/\b[A-Za-z]/g)) {
    if (!first) first = match[0];
    last = match[0];
  }
  if (!first) return "?";
  return (first === last ? first : first + last).toUpperCase();
}

export function CatAvatar({
  cat,
  size = "default",
}: {
  cat: { name: string; avatar: string | null };
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Avatar size={size}>
      {cat.avatar && <AvatarImage src={cat.avatar} alt={cat.name} />}
      <AvatarFallback>{getInitials(cat.name)}</AvatarFallback>
    </Avatar>
  );
}
