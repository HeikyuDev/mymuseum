import { Skeleton } from "@/components/ui/panel";

export default function StudioLoading() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-4">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
