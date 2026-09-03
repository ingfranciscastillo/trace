import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";
import { getCreditBalance } from "./credits";
import { getFreeQuotaStatus } from "./usageLimits";

export const getMyCredits = createServerFn({ method: "POST" }).handler(
	async () => {
		const session = await auth.api.getSession({ headers: getRequestHeaders() });
		if (!session) return { signedIn: false as const };
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
