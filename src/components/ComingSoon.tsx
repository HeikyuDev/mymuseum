type ComingSoonProps = {
  title: string;
  message: string;
};

// Temporary placeholder used by routes that are rebuilt in later phases.
export function ComingSoon({ title, message }: ComingSoonProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{title}</h1>
      <p className="max-w-md text-muted">{message}</p>
      <span className="rounded-full border border-line bg-surface px-4 py-1 text-sm text-fg">Coming soon</span>
    </main>
  );
}
