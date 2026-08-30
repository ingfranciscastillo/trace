import { Link } from "@tanstack/react-router";

export function Nav() {
	return (
		<nav className="nav">
			<Link to="/" className="nav__brand">
				TRACE
			</Link>
			<div className="nav__links">
				<Link to="/">ANALYZE</Link>
				<a href="#history">HISTORY</a>
				<a href="#about">ABOUT</a>
			</div>
		</nav>
	);
}
