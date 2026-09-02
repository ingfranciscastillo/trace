import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Nav } from "../components/Nav";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		const { error: signInError } = await authClient.signIn.email({
			email,
			password,
		});
		setSubmitting(false);
		if (signInError) {
			setError(signInError.message ?? "Could not sign in.");
			return;
		}
		navigate({ to: "/" });
	}

	return (
		<div className="auth-page">
			<Nav />
			<div className="auth-page__stage">
				<div className="auth-card">
					<div className="auth-card__eyebrow">SIGN IN</div>
					<h1>Welcome back.</h1>
					{error && <div className="auth-card__error">{error}</div>}
					<form onSubmit={onSubmit}>
						<div className="auth-field">
							<label htmlFor="email">EMAIL</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								autoComplete="email"
								required
							/>
						</div>
						<div className="auth-field">
							<label htmlFor="password">PASSWORD</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								autoComplete="current-password"
								required
							/>
						</div>
						<button
							type="submit"
							className="btn btn--accent auth-card__submit"
							disabled={submitting}
						>
							{submitting ? "SIGNING IN…" : "SIGN IN"}
						</button>
					</form>
					<div className="auth-card__footer">
						No account? <Link to="/register">Register</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
