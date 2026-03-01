/**
 * projects.js — Portfolio project data
 *
 * Replaces the old .txt file loading. Each project's image should be
 * placed at public/assets/images/{id}.jpg
 */

const projects = [
  {
    id: 'aboutMe',
    name: 'Josh Merritt',
    link: 'https://www.linkedin.com/in/josh-merritt',
    category: 'Me',
    goal: 'To leave things better than I found them.',
    role: 'Analyst, Creator, Engineer, Project Manager',
    technology:
      'SQL, Python, Jupyter, JavaScript, React.js, Git, RDBMS, PowerBI, DAX, Excel, Google Data Studio',
    description:
      'I am a builder with integrity, who not only understands complex data sets, but also knows how to convey their relevance in an elegant, effective manner. As a born problem-solver with a passion for efficiency and a history of success in a host of diverse roles, I\u2019ve juggled competing stakeholder interests and communicated efficient solutions to executives, engineers, and customers alike to help them get more done and be smarter about it.',
  },
  {
    id: 'arduinoCoopDoor',
    name: 'Smart Chicken Coop',
    link: 'https://github.com/joshmerritt/arduinoChickenCoopDoor',
    category: 'Technology',
    goal: 'Build an automated door to allow the chickens to free range from sun-up to sun-down, while keeping them safely enclosed in their coop overnight.',
    role: 'Creator and Engineer',
    technology: 'C++, Arduino, Motors, Programmable RGB LEDs, Woodworking',
    description:
      'Using an Arduino, a motor shield, and a car door window motor, I created a door that opens and closes automatically based upon a photoresistor\u2019s realtime readings.',
  },
  {
    id: 'googleDataStudioServiceTechs',
    name: 'Google Data Studio Streaming Dashboard',
    link: 'https://www.upwork.com/fl/joshuapmerritt',
    category: 'Business',
    goal: 'Educate and motivate employees about their contribution to the business and performance metrics relative to their colleagues.',
    role: 'BI Developer',
    technology: 'Google Data Studio, Data Modeling, Screencloud, Amazon Firestick',
    description:
      'I created a TV dashboard to help track key performance indicators and display it within a business. By providing goals and showcasing performance over the year, employees can understand their contribution to the company in real-time and track how their metrics compare to those of their colleagues.',
  },
  {
    id: 'powerBIMetrics',
    name: 'Microsoft PowerBI',
    link: 'https://www.upwork.com/fl/joshuapmerritt',
    category: 'Business',
    goal: 'Create a data warehouse, with robust data pipelines and ETL processes, to enable self-service analytics.',
    role: 'BI Developer and Data Analyst',
    technology:
      'Microsoft PowerBI, REST APIs, Microsoft PowerQuery, DAX, Google BigQuery, Microsoft Azure',
    description:
      'I use PowerBI to create multidimensional star schema modeled data warehouses. Using interconnected visualizations to answer real-world business questions and track key performance indicators.',
  },
  {
    id: 'thisWebsite',
    name: 'Portfolio Website',
    link: 'https://github.com/joshmerritt/websiteAnimation',
    category: 'Technology',
    goal: 'Learn new skills and create a fun, interactive way to showcase my creativity and experience with business and technology.',
    role: 'Creator and Developer',
    technology: 'JavaScript, CSS3, HTML5, Git, p5.js, matter.js',
    description:
      'I created this website to showcase some of my favorite recent projects while learning new technologies. It is coded to allow for a dynamic number of content tiles and is responsive to the size of the screen on which it is viewed.',
  },
  {
    id: 'SiteAnalytics',
    name: 'Site Analytics',
    link: '/analytics-dashboard.html',
    category: 'Technology',
    goal: 'Track and visualize website engagement metrics including visitor traffic, referral sources, and interactive ball engagement data.',
    role: 'Creator and Developer',
    technology: 'React, JavaScript, CSS3, SVG',
    description:
      'An interactive analytics dashboard built for DaDataDad.com that displays visitor traffic, traffic sources, top pages, and a unique ball engagement funnel tracking how users interact with the physics playground.',
  },
  {
    id: 'thewineyoudrink',
    name: 'The Wine You Drink',
    link: 'https://thewineyoudrink.web.app',
    category: 'Apps',
    goal: 'To provide a visually appealing and intuitive way to manage your wine cellar.',
    role: 'Creator and Product Owner \u2014 dreamed up the concept after years of collecting wine. Built with Claude.ai as development partner.',
    technology:
      'React 18, Firebase (Auth + Firestore), Vite, PWA, CSS custom properties, Claude AI (wine label recognition)',
    description:
      'A full-featured wine cellar management progressive web app. Features include multi-cellar management, a section builder with drag-and-drop reordering, AI-powered wine label photo recognition, drink window tracking with animated SVG rings, tasting notes timeline, consumption history, statistics dashboard, and full offline capability.',
  },
  {
    id: 'dartleague',
    name: 'Black Sheep Dart League',
    link: 'https://theblacksheepdartleague.web.app',
    category: 'Apps',
    goal: 'To make setting up weekly pairings and brackets quick and easy for a local dart league.',
    role: 'Creator and Product Owner \u2014 identified the friction points in a highly manual, paper-based process. Built with Claude.ai as development partner.',
    technology:
      'React 19, Firebase (Auth + Firestore + Cloud Functions), Tailwind CSS, Vite, Claude AI (scoresheet scanning)',
    description:
      'A league management app that replaces a paper-based process. Tracks player stats and win percentages, manages weekly RSVPs, generates smart pairings based on matchup history and standings, and uses Claude AI to scan and parse physical scoresheets via phone camera.',
  },
];

export default projects;
