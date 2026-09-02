import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "../components/Nav";

export const Route = createFileRoute("/about")({
	component: AboutPage,
});

function AboutPage() {
	return (
		<div className="about-page">
			<Nav />
			<div className="about-stage">
				<h1>Follow information back to where it began.</h1>

				<div className="about-section">
					<h2>What Trace does</h2>
					<p>
						Paste a URL and Trace extracts the article, pulls out its
						checkable claims, and looks for where each one actually comes
						from — inside the article's own citations, and across everything
						else already in the corpus.
					</p>
					<p>
						It flags claims with no attached source, detects when text has
						been copied or republished elsewhere, and compares a claim's
						wording against the source it's supposedly drawn from to see
						whether it's actually supported.
					</p>
				</div>

				<div className="about-section">
					<h2>The pipeline</h2>
					<div className="about-pipeline">
						URL
						<br />→ ARTICLE
						<br />→ CLAIMS
						<br />→ SOURCES (cited, or found on request)
						<br />→ SOURCES OF THOSE SOURCES
						<br />→ COPIES / REPUBLICATIONS
						<br />→ TIMELINE + CONFIDENCE
					</div>
				</div>

				<div className="about-section">
					<h2>On confidence</h2>
					<p>
						Confidence is never a made-up number. It's an ordinal level
						(high / medium / low / unverified) derived from concrete
						evidence — an inline citation, a corroborating occurrence
						elsewhere with a known date, a shared-sentence count — always
						shown with the reason behind it.
					</p>
				</div>

				<div className="about-section">
					<h2>Costs something, tells you so</h2>
					<p>
						Following a citation chain beyond an article's own links means
						searching the web and fetching other sites — real requests with
						real cost. Trace never does that automatically. Every step past
						the article you pasted is a switch or a button you choose to
						use.
					</p>
				</div>
			</div>
		</div>
	);
}
