/**
 * HowItWorks.jsx — The second tab: how a drag on the canvas becomes a number
 * on this page.
 *
 * The physics values are read from the game's own config, so this tab can't
 * drift out of date the way a hand-typed copy does.
 */

import config from '../../game/config.js';
import { Card, DataTable } from './ui.jsx';
import { CATEGORIES } from './meta.js';

const PIPELINE = [
  {
    name: 'The playground', where: 'p5.js + matter.js, in your browser',
    what: 'You drag a ball and let go. The physics engine reports every collision; the game decides what counts as a launch, a first contact and a goal.',
  },
  {
    name: 'EventBus', where: 'src/game/EventBus.js',
    what: 'A small publish/subscribe bridge. The game announces what happened; anything interested listens. The canvas knows nothing about analytics.',
  },
  {
    name: 'PostHog', where: 'posthog-js, sent through e.dadatadad.com',
    what: 'Listeners turn those announcements into events. They travel through a first-party proxy on this domain, so ad blockers don’t silently drop them.',
  },
  {
    name: 'Analytics worker', where: 'Cloudflare Worker, three HogQL queries',
    what: 'Reading PostHog needs a secret key that must never reach a browser. A worker holds it, runs three queries, and returns counts and shot positions — no visitor or session ids.',
  },
  {
    name: 'This dashboard', where: 'React + hand-drawn SVG',
    what: 'One request, one JSON document, every range. Switching between 7, 30 and 90 days never asks the server again.',
  },
];

const EVENTS = [
  ['ball_launch',      'A ball is released with enough power to count as a shot', 'project_name, total_shots, accuracy'],
  ['ball_impact',      'A launched ball touches something for the first time',    'impact_x, impact_y, hit_type, shot_number'],
  ['ball_score',       'A ball reaches its own category in the goal',             'project_name, total_shots, total_makes'],
  ['detail_open',      'A project panel opens (by a goal or a double-click)',     'project_name, project_link'],
  ['cta_click',        'A visitor follows a project’s link',                      'project_name, project_link'],
  ['miss_hint_shown',  'Three misses in a row: the game offers the double-click', '—'],
  ['first_launch',     'The first shot of a visit',                               'ms_since_navigation'],
  ['portfolio_loaded', 'The game has finished loading',                           'load_time_ms'],
  ['game_perf',        'One frame-rate sample, about 30 s into play',             'avg_fps, min_fps, canvas_px'],
];

const PHYSICS = [
  ['Ball bounciness',         config.ball.restitution],
  ['Goal post & net bounciness', config.goal.restitution],
  ['Category bar bounciness', config.menu.restitution],
  ['Ball friction',           config.ball.friction],
  ['Air resistance',          config.ball.frictionAir],
  ['Minimum power for a shot', config.minLaunchPower],
  ['Double-click window',     `${config.doubleTapWindow} ms`],
];

export default function HowItWorks() {
  return (
    <div className="v4-grid">
      <Card className="v4-span-12" title="From a drag to a data point" subtitle="Five steps, none of which knows more than it needs to">
        <ol className="v4-pipeline">
          {PIPELINE.map((step, i) => (
            <li key={step.name} className="v4-step">
              <span className="v4-step-n" aria-hidden="true">{i + 1}</span>
              <div>
                <h3 className="v4-step-name">{step.name}</h3>
                <p className="v4-step-where">{step.where}</p>
                <p className="v4-step-what">{step.what}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="v4-span-7" title="What gets recorded" subtitle="The custom events behind every number here">
        <DataTable
          caption="Custom events"
          columns={[{ label: 'Event' }, { label: 'Fires when' }, { label: 'Carries' }]}
          rows={EVENTS.map(([name, when, props]) => [<code key={name}>{name}</code>, when, <span key={name} className="v4-mono">{props}</span>])}
        />
        <p className="v4-footnote">
          The intro demo launches a ball by itself on every load. It is tagged and never counted — no shot, no goal, no project open.
        </p>
      </Card>

      <div className="v4-span-5 v4-stack">
        <Card title="The physics" subtitle="Live values from the game’s configuration">
          <DataTable
            caption="Physics settings"
            columns={[{ label: 'Setting' }, { label: 'Value', numeric: true }]}
            rows={PHYSICS.map(([k, v]) => [k, String(v)])}
          />
          <p className="v4-footnote">
            A ball only scores in its own category: {CATEGORIES.join(', ')}. It is 79–88% as wide as the goal, which is why most misses are rim clips.
          </p>
        </Card>

        <Card title="Privacy" subtitle="What is collected, and what is not">
          <ul className="v4-plain-list">
            <li>Collected: page views, the events listed here, your country (from your IP address), your kind of device, the site that linked you, and a recording of clicks and scrolling on the page.</li>
            <li>Not collected: names, emails or accounts. Visitors are never identified, and anything typed into a field is masked.</li>
            <li>“My session” on the shot chart never leaves your browser — it is read from local storage, kept for 24 hours.</li>
            <li>This page is sent counts and shot positions: no ids, no timestamps, no IP addresses, no exact screen sizes, and no linking site by name unless it is a well-known public one. With only a handful of visits, though, a count of one is still one person’s visit.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
