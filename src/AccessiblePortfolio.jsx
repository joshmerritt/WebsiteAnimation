/**
 * AccessiblePortfolio.jsx — Traditional portfolio layout
 *
 * A fully accessible, SEO-friendly version of the portfolio that presents
 * the same project data as the physics playground but in a traditional
 * card-based layout. Semantic HTML, keyboard navigable, screen reader friendly.
 *
 * Shares the existing design language: dark theme, Syne/DM Sans/JetBrains Mono,
 * steel blue accents, glass morphism.
 */

import { useState, useEffect, useRef } from 'react';
import projects from './data/projects.js';

/* ── Category color map (matches the physics game's ball colors) ───────── */
const CATEGORY_COLORS = {
  Me:         '#5985b1',
  Business:   '#d4a843',
  Technology: '#6b9f6b',
  Apps:       '#c06060',
};

/* ── Helpers ───────────────────────────────────────────────────────────── */
function ctaLabel(link) {
  if (!link) return null;
  if (link.includes('linkedin.com'))  return 'View LinkedIn';
  if (link.includes('github.com'))    return 'View on GitHub';
  if (link.includes('upwork.com'))    return 'View Upwork Profile';
  if (link.includes('.html'))         return 'View Dashboard';
  if (link.includes('.app'))          return 'Open App';
  return 'View Project';
}

function ctaIcon(link) {
  if (link?.includes('.html')) return '📊';
  if (link?.includes('github.com'))   return '⌨';
  if (link?.includes('linkedin.com')) return '💼';
  if (link?.includes('.app'))         return '🚀';
  return '↗';
}

/* ── Scroll-reveal hook ────────────────────────────────────────────────── */
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return [ref, visible];
}

/* ── Project Card ──────────────────────────────────────────────────────── */
function ProjectCard({ project, index }) {
  const [ref, visible] = useReveal();
  const categoryColor = CATEGORY_COLORS[project.category] || '#5985b1';
  const hasLink = project.link && project.link !== 'null' && project.link.trim() !== '';

  // Skip aboutMe from the project grid (it's in the hero)
  if (project.id === 'aboutMe') return null;

  const rows = [
    { label: 'Goal',       value: project.goal },
    { label: 'My Role',    value: project.role },
    { label: 'Technology', value: project.technology },
    { label: 'Summary',    value: project.description },
  ].filter((r) => r.value);

  return (
    <article
      ref={ref}
      className={`port-card ${visible ? 'port-card--visible' : ''}`}
      style={{ animationDelay: `${index * 80}ms` }}
      itemScope
      itemType="https://schema.org/CreativeWork"
    >
      <div className="port-card-image">
        <img
          src={`/assets/images/${project.id}.jpg`}
          alt={`${project.name} — ${project.category} project by Josh Merritt`}
          loading="lazy"
          itemProp="image"
        />
        <span className="port-card-badge" style={{ background: categoryColor }}>
          {project.category}
        </span>
      </div>

      <div className="port-card-body">
        <h2 className="port-card-title" itemProp="name">{project.name}</h2>

        <dl className="port-card-meta">
          {rows.map(({ label, value }) => (
            <div className="port-card-row" key={label}>
              <dt>{label}</dt>
              <dd itemProp={label === 'Goal' ? 'description' : undefined}>{value}</dd>
            </div>
          ))}
        </dl>

        {hasLink && (
          <a
            className="port-card-cta"
            href={project.link}
            target={project.link.startsWith('/') ? '_self' : '_blank'}
            rel={project.link.startsWith('/') ? undefined : 'noopener noreferrer'}
            itemProp="url"
          >
            <span className="port-card-cta-icon">{ctaIcon(project.link)}</span>
            {ctaLabel(project.link)}
            {!project.link.startsWith('/') && <span aria-hidden="true"> ↗</span>}
          </a>
        )}
      </div>
    </article>
  );
}

/* ── Skills Section ────────────────────────────────────────────────────── */
const SKILLS = [
  { name: 'SQL',            level: 95 },
  { name: 'Power BI / DAX', level: 92 },
  { name: 'Python',         level: 85 },
  { name: 'React / JS',     level: 88 },
  { name: 'Google BigQuery', level: 80 },
  { name: 'Data Modeling',  level: 90 },
  { name: 'Firebase',       level: 78 },
  { name: 'Git',            level: 85 },
];

function SkillBar({ skill, visible, delay }) {
  return (
    <div className="port-skill" style={{ animationDelay: `${delay}ms` }}>
      <div className="port-skill-header">
        <span className="port-skill-name">{skill.name}</span>
        <span className="port-skill-pct">{skill.level}%</span>
      </div>
      <div className="port-skill-track">
        <div
          className={`port-skill-fill ${visible ? 'port-skill-fill--active' : ''}`}
          style={{ width: visible ? `${skill.level}%` : '0%', transitionDelay: `${delay}ms` }}
          role="progressbar"
          aria-valuenow={skill.level}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${skill.name}: ${skill.level}%`}
        />
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────── */
export default function AccessiblePortfolio() {
  const [filter, setFilter] = useState('All');
  const [skillsRef, skillsVisible] = useReveal();

  const categories = ['All', ...new Set(projects.filter(p => p.id !== 'aboutMe').map((p) => p.category))];
  const aboutMe = projects.find((p) => p.id === 'aboutMe');
  const filteredProjects = projects
    .filter((p) => p.id !== 'aboutMe')
    .filter((p) => filter === 'All' || p.category === filter);

  return (
    <div className="port-root">
      {/* Ambient background effects */}
      <div className="port-glow port-glow--tl" aria-hidden="true" />
      <div className="port-glow port-glow--br" aria-hidden="true" />

      {/* ── Skip link for keyboard users ── */}
      <a href="#projects" className="port-skip">Skip to projects</a>

      {/* ── Header / Hero ── */}
      <header className="port-hero" role="banner">
        <nav className="port-topnav" aria-label="Site navigation">
          <a href="/" className="port-topnav-brand">Da Data Dad</a>
          <div className="port-topnav-links">
            <a href="/" className="port-topnav-link" title="Interactive physics portfolio">
              <span className="port-topnav-link-icon" aria-hidden="true">🎮</span>
              Interactive Version
            </a>
            <a href="/analytics-dashboard.html" className="port-topnav-link">
              <span className="port-topnav-link-icon" aria-hidden="true">📊</span>
              Analytics
            </a>
          </div>
        </nav>

        <div className="port-hero-content">
          <div className="port-hero-text">
            <p className="port-hero-eyebrow">Analyst · Creator · Engineer</p>
            <h1 className="port-hero-name">{aboutMe?.name || 'Josh Merritt'}</h1>
            <p className="port-hero-tagline">Honest. Analytical. Data Dreamer.</p>
            <p className="port-hero-bio">
              {aboutMe?.description || 'Builder with a bias for shipping.'}
            </p>

            <div className="port-hero-actions">
              <a href="mailto:josh@DaDataDad.com" className="port-btn port-btn--primary">
                Contact Me
              </a>
              <a href="https://www.linkedin.com/in/josh-merritt" className="port-btn port-btn--ghost" target="_blank" rel="noopener noreferrer">
                LinkedIn ↗
              </a>
              <a href="https://github.com/joshmerritt" className="port-btn port-btn--ghost" target="_blank" rel="noopener noreferrer">
                GitHub ↗
              </a>
            </div>
          </div>

          <div className="port-hero-image">
            <img
              src="/assets/images/aboutMe.jpg"
              alt="Josh Merritt"
              className="port-hero-photo"
            />
          </div>
        </div>
      </header>

      {/* ── Skills ── */}
      <section className="port-section port-skills-section" ref={skillsRef} aria-labelledby="skills-heading">
        <h2 id="skills-heading" className="port-section-title">Core Skills</h2>
        <div className="port-skills-grid">
          {SKILLS.map((skill, i) => (
            <SkillBar key={skill.name} skill={skill} visible={skillsVisible} delay={i * 60} />
          ))}
        </div>
      </section>

      {/* ── Projects ── */}
      <section className="port-section" id="projects" aria-labelledby="projects-heading">
        <h2 id="projects-heading" className="port-section-title">Projects</h2>

        {/* Category filter */}
        <div className="port-filters" role="tablist" aria-label="Filter projects by category">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`port-filter-btn ${filter === cat ? 'port-filter-btn--active' : ''}`}
              onClick={() => setFilter(cat)}
              role="tab"
              aria-selected={filter === cat}
              style={filter === cat && cat !== 'All' ? { borderColor: CATEGORY_COLORS[cat] || '#5985b1', color: CATEGORY_COLORS[cat] || '#5985b1' } : undefined}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Project grid */}
        <div className="port-grid" role="tabpanel">
          {filteredProjects.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} />
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="port-footer" role="contentinfo">
        <div className="port-footer-inner">
          <p className="port-footer-brand">Da Data Dad</p>
          <p className="port-footer-copy">&copy; {new Date().getFullYear()} Josh Merritt</p>
          <nav className="port-footer-links" aria-label="Footer links">
            <a href="mailto:josh@DaDataDad.com">josh@DaDataDad.com</a>
            <a href="https://www.linkedin.com/in/josh-merritt" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href="https://github.com/joshmerritt" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://www.upwork.com/fl/joshuapmerritt" target="_blank" rel="noopener noreferrer">Upwork</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
