type ComingSoonProps = {
  title: string;
  message: string;
};

// Temporary placeholder used by routes that are rebuilt in later phases.
export function ComingSoon({ title, message }: ComingSoonProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-100 sm:text-4xl">{title}</h1>
      <p className="max-w-md text-stone-400">{message}</p>
      <span className="rounded-full border border-amber-200/30 px-4 py-1 text-sm text-amber-200/80">
        Coming soon
      </span>
    </main>
  );
}
