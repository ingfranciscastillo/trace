import { Link } from "@tanstack/react-router";
import { authClient } from "../lib/auth-client";

export function Nav() {
	const { data: session, isPending } = authClient.useSession();

	return (
		<nav className="nav">
			<Link to="/" className="nav__brand">
				TRACE
			</Link>
			<div className="nav__links">
				<Link to="/">ANALYZE</Link>
				<Link to="/history">HISTORY</Link>
				<Link to="/about">ABOUT</Link>
				{!isPending &&
					(session?.user ? (
						<a
							onClick={(e) => {
								e.preventDefault();
								void authClient.signOut();
							}}
							href="#sign-out"
						>
							SIGN OUT
						</a>
					) : (
						<Link to="/login">SIGN IN</Link>
					))}
			</div>
		</nav>
	);
}
