import { createServerFn } from "@tanstack/react-start";
import { ensureSession } from "@/lib/auth.functions";
import { getCreditBalance } from "./credits";
import { getFreeQuotaStatus } from "./usageLimits";

export const getMyCredits = createServerFn({ method: "POST" }).handler(
	async () => {
		let session: Awaited<ReturnType<typeof ensureSession>>;
		try {
			session = await ensureSession();
		} catch {
			return { signedIn: false as const };
		}
		const [balance, quota] = await Promise.all([
			getCreditBalance(session.user.id),
			getFreeQuotaStatus(session.user.id),
		]);
		return {
			signedIn: true as const,
			balance,
			quota: { ...quota, resetsAt: quota.resetsAt.toISOString() },
		};
	},
);
