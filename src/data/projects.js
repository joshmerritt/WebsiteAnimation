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
    heroMode: 'full',
    goal: 'To leave things better than I found them.',
    role: 'Data Engineer \u00B7 BI Developer \u00B7 Full-Stack Builder',
    technology:
      'SQL, Python, JavaScript, React, Power BI, DAX, Google BigQuery, Git, Jupyter, Excel',
    description:
      'Builder with a bias for shipping. Just as comfortable wiring up a data pipeline as designing the frontend that displays it. Turns messy, complex data into clear answers for the people who need them \u2014 whether that\u2019s a VP checking quarterly numbers or a teammate debugging a report. Track record of balancing competing priorities while keeping projects on schedule and under budget.',
  },
  {
    id: 'thisWebsite',
    name: 'Portfolio Website',
    link: 'https://github.com/joshmerritt/websiteAnimation',
    category: 'Technology',
    goal: 'Build a portfolio that doubles as a playable physics sandbox \u2014 because a list of links doesn\u2019t show how you think.',
    role: 'Creator and Developer',
    technology: 'React 18, Vite, p5.js (instance mode), Matter.js, ES Modules, GA4',
    description:
      'The site you\u2019re on right now. Each project is a ball you drag and launch into a goal \u2014 part portfolio, part physics playground. Works on phones and desktops, adapts its performance to the device, and quietly tracks every interaction so the analytics dashboard has real data to show.',
  },
  {
    id: 'SiteAnalytics',
    name: 'Site Analytics',
    link: '/analytics-v3.html',
    category: 'Technology',
    goal: 'Prove the portfolio isn\u2019t just pretty \u2014 track the important engagements and tell the story in a live dashboard.',
    role: 'Creator and Developer',
    technology: 'React, Cloudflare Workers, GA4 Data API, SVG, CSS Grid',
    description:
      'A live analytics dashboard for this very site. Every ball launch, score, and project open is tracked, piped through a custom backend, and displayed here in real time. Includes visitor trends, traffic sources, top pages, and a ball engagement funnel that shows how visitors move from launching a ball all the way to clicking a project link.',
  },
  {
    id: 'arduinoCoopDoor',
    name: 'Smart Chicken Coop',
    link: 'https://github.com/joshmerritt/arduinoChickenCoopDoor',
    category: 'Technology',
    heroMode: 'full',
    goal: 'Automate a chicken coop door that opens at sunrise and locks at sundown \u2014 no manual intervention required.',
    role: 'Hardware Engineer and Builder',
    technology: 'C++, Arduino, Motor Shield, Photoresistor, Programmable RGB LEDs, Custom Woodworking',
    description:
      'An automated coop door that senses daylight and drives a repurposed car-window motor to open at sunrise and lock at sundown \u2014 no manual intervention, no missed bedtimes. Built on an Arduino with a light sensor, color-coded status LEDs, and a custom wooden housing. A true end-to-end hardware project: designed the circuit, wrote the firmware, and built the enclosure.',
  },
  {
    id: 'googleDataStudioServiceTechs',
    name: 'Google Data Studio Streaming Dashboard',
    link: 'https://www.upwork.com/fl/joshuapmerritt',
    category: 'Business',
    goal: 'Give frontline employees real-time visibility into their performance and standing relative to team benchmarks.',
    role: 'BI Developer',
    technology: 'Google Data Studio, Data Modeling, ScreenCloud, Amazon Fire TV',
    description:
      'A live KPI dashboard displayed on office TVs so the whole team can see how they\u2019re tracking against goals at a glance. Shows individual and team standings updated throughout the day, driving friendly competition without anyone needing to open a spreadsheet. Designed to be readable from across the room \u2014 big numbers, color-coded status, and automatic refresh.',
  },
  {
    id: 'powerBIMetrics',
    name: 'Microsoft Power BI',
    link: 'https://www.upwork.com/fl/joshuapmerritt',
    category: 'Business',
    goal: 'Build a governed data warehouse with automated pipelines that lets business users self-serve answers without filing tickets.',
    role: 'BI Developer and Data Analyst',
    technology:
      'Power BI, DAX, Power Query, REST APIs, Google BigQuery, Azure',
    description:
      'Built the reporting layer that lets business teams answer their own questions instead of filing a ticket and waiting. Data flows in automatically from multiple sources, lands in a clean, structured model, and powers a set of linked reports users can drill into on their own. Cut ad-hoc analyst requests significantly and gave leadership real-time visibility into KPIs.',
  },

  {
    id: 'thewineyoudrink',
    name: 'The Wine You Drink',
    link: 'https://thewineyoudrink.web.app',
    category: 'Apps',
    goal: 'Replace spreadsheets and sticky notes with a purpose-built app for managing a wine collection \u2014 from cellar to glass.',
    role: 'Product Owner and Creator \u2014 built this to solve my own problem after years of tracking bottles in spreadsheets. Developed with Claude AI as a coding partner.',
    technology:
      'React 18, Firebase (Auth + Firestore), Vite, PWA, Claude AI (label recognition), CSS Custom Properties',
    description:
      'A wine cellar app built for collectors who outgrew their spreadsheet. Organize multiple cellars, snap a photo of any label to auto-fill the details with AI, and see at a glance which bottles are in their prime. Includes tasting notes, drinking history, and stats \u2014 and it works offline, so you can use it in the cellar where there\u2019s no signal.',
  },
  {
    id: 'dartleague',
    name: 'Black Sheep Dart League',
    link: 'https://theblacksheepdartleague.web.app',
    category: 'Apps',
    goal: 'Eliminate the spreadsheets, group texts, and paper scoresheets that were slowing down league night.',
    role: 'Product Owner and Creator \u2014 got tired of the paper scoresheets and group-text chaos, so I built something better. Developed with Claude AI as a coding partner.',
    technology:
      'React 19, Firebase (Auth + Firestore + Cloud Functions), Tailwind CSS, Vite, Claude AI (scoresheet OCR)',
    description:
      'A league management app used weekly by real players. Handles RSVPs, automatically pairs teams based on past matchups and current standings, and tracks everyone\u2019s stats. The scorekeeper just snaps a photo of the paper scoresheet and AI reads it in \u2014 what used to take 30+ minutes of manual entry now takes seconds.',
  },
];

export default projects;
