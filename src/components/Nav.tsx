import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreditsBadge } from "./CreditsBadge";
import { authClient } from "../lib/auth-client";

export function Nav() {
	const { data: session, isPending } = authClient.useSession();
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => {
		if (!menuOpen) return;
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") setMenuOpen(false);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [menuOpen]);

	function closeMenu() {
		setMenuOpen(false);
	}

	return (
		<nav className="nav">
			<Link to="/" className="nav__brand" onClick={closeMenu}>
				TRACE
			</Link>
			<button
				type="button"
				className={`nav__toggle${menuOpen ? " nav__toggle--open" : ""}`}
				aria-label={menuOpen ? "Close menu" : "Open menu"}
				aria-expanded={menuOpen}
				onClick={() => setMenuOpen((open) => !open)}
			>
				<span />
				<span />
				<span />
			</button>
			<div className={`nav__links${menuOpen ? " nav__links--open" : ""}`}>
				<Link to="/" onClick={closeMenu}>
					ANALYZE
				</Link>
				<Link to="/history" onClick={closeMenu}>
					HISTORY
				</Link>
				<Link to="/about" onClick={closeMenu}>
					ABOUT
				</Link>
				{isPending && <span className="nav__skeleton" aria-hidden="true" />}
				{!isPending && session?.user && <CreditsBadge />}
				{!isPending &&
					(session?.user ? (
						<a
							onClick={(e) => {
								e.preventDefault();
								closeMenu();
								void authClient.signOut();
							}}
							href="#sign-out"
						>
							SIGN OUT
						</a>
					) : (
						<Link to="/login" onClick={closeMenu}>
							SIGN IN
						</Link>
					))}
			</div>
		</nav>
	);
}
