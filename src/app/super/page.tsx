import Link from "next/link";
import { ComingSoon } from "@/components/ComingSoon";
import { requireRole } from "@/lib/auth/session";
import { signOut } from "@/app/login/actions";

export default async function SuperPage() {
  await requireRole("super_admin");
  return (
    <>
      <ComingSoon title="Super admin" message="Account and museum management is coming in a later phase." />
      <div className="-mt-24 flex justify-center gap-3 pb-16 text-sm">
        <Link href="/admin" className="underline underline-offset-4">
          Open my museum admin
        </Link>
        <form action={signOut}>
          <button type="submit" className="underline underline-offset-4">
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
