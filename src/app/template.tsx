// Unlike layout.tsx, a template.tsx instance remounts on every navigation,
// which is what makes the fade-in below replay on each page change instead
// of only once per session. Purely presentational -- no data, no state,
// nothing that touches routing or page logic.
export default function RootTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
