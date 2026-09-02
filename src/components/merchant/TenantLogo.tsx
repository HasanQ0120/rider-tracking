export function TenantLogo({
  name,
  logoUrl,
  size = 32,
  accentColor = "#FFD700",
}: {
  name: string;
  logoUrl: string | null;
  size?: number;
  accentColor?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${name} logo`}
        width={size}
        height={size}
        className="rounded-md object-contain"
        style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
      />
    );
  }

  const initial = name.charAt(0).toUpperCase();
  return (
    <span
      className="flex items-center justify-center rounded-md font-bold text-[#0a192f]"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        backgroundColor: accentColor,
      }}
    >
      {initial}
    </span>
  );
}
