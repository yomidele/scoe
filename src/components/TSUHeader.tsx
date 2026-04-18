import { GraduationCap } from "lucide-react";

export function TSUHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="tsu-header-grad text-primary-foreground">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 md:px-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-primary-foreground text-primary">
          <GraduationCap className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h1 className="font-serif text-lg font-bold leading-tight md:text-xl">SHALLOM COLLEGE OF EDUCATION, PAMBULA MICHIKA</h1>
          <p className="text-xs text-accent md:text-sm">Office of the Registrar — Result Management Portal</p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-primary-foreground/80">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}
