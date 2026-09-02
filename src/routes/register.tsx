import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Nav } from "../components/Nav";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/register")({
	component: RegisterPage,
});

function RegisterPage() {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		const { error: signUpError } = await authClient.signUp.email({
			name,
			email,
			password,
		});
		setSubmitting(false);
		if (signUpError) {
			setError(signUpError.message ?? "Could not create an account.");
			return;
		}
		navigate({ to: "/" });
	}

	return (
		<div className="auth-page">
			<Nav />
			<div className="auth-page__stage">
				<div className="auth-card">
					<div className="auth-card__eyebrow">REGISTER</div>
					<h1>Create an account.</h1>
					{error && <div className="auth-card__error">{error}</div>}
					<form onSubmit={onSubmit}>
						<div className="auth-field">
							<label htmlFor="name">NAME</label>
							<input
								id="name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								autoComplete="name"
								required
							/>
						</div>
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
								autoComplete="new-password"
								minLength={8}
								required
							/>
						</div>
						<button
							type="submit"
							className="btn btn--accent auth-card__submit"
							disabled={submitting}
						>
							{submitting ? "CREATING…" : "REGISTER"}
						</button>
					</form>
					<div className="auth-card__footer">
						Already have an account? <Link to="/login">Sign in</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
