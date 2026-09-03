import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";
import { getCreditBalance } from "./credits";

export const getMyCredits = createServerFn({ method: "POST" }).handler(
	async () => {
		const session = await auth.api.getSession({ headers: getRequestHeaders() });
		if (!session) return { signedIn: false as const };
		const balance = await getCreditBalance(session.user.id);
		return { signedIn: true as const, balance };
	},
);
