// Landing copy, lifted verbatim from the approved agency landing
// (components/collabcut-landing.tsx). Edit wording here, not in components.

export const BRAND = 'CollabCut'

export const NAV = {
  links: [
    { label: 'Sign in', href: '/auth/login' },
    { label: 'How it works', href: '#workflow' },
    { label: 'Plans', href: '#pricing' },
  ],
  cta: { label: 'Talk to us', href: '/contact' },
}

export const HERO = {
  tagline: 'By editors, for editors',
  eyebrow: 'For teams who ship more than one cut',
  copy: 'Stop managing production through scattered messages, mystery files, and status meetings. Give every client, editor, and cut a place to move forward.',
  primary: { label: 'Talk to our team', href: '/contact' },
  secondary: { label: 'See the agency workflow', href: '#workflow' },
}

// The scroll story. `gap` is the existing "operational gap" statement;
// `resolve` is the existing agency headline, now the line the story lands on.
export const STORY = {
  kicker: 'THE OPERATIONAL GAP',
  gap: ['When the work lives', 'in five different places.'],
  copy: 'WhatsApp for notes. Drive for files. Email for approvals. A spreadsheet for ownership. Your team spends more time finding the latest truth than making the next cut.',
  resolve: ['Your agency,', 'in one frame.'],
  toolsLabel: 'The tools one cut gets scattered across',
}

// Feature marquee. The heading is the existing "one board" statement.
export const FEATURES_INTRO = {
  kicker: 'ONE BOARD. EVERY CLIENT.',
  title: ['See the whole operation', 'without the overhead.'],
  copy: 'Admins see every project. Editors see what is assigned. Five stages make the status of every cut legible from across the room.',
  listLabel: 'CollabCut features. Hover or focus to pause.',
}

export type FeatureIcon = 'versions' | 'transfer' | 'chat' | 'link' | 'storage' | 'timecode' | 'access' | 'workspaces' | 'resolve'

// `draft: true` marks one-liners written for the redesign and awaiting
// sign-off; everything else is existing landing copy. The flag is not rendered.
export const FEATURES: { icon: FeatureIcon; title: string; text: string; draft?: boolean }[] = [
  { icon: 'versions', title: 'Version stacking', text: 'A visible history, every time.' },
  { icon: 'transfer', title: 'Fast upload and download', text: 'Upload a cut straight from the browser. Download it from the review page.', draft: true },
  { icon: 'chat', title: 'Chat section', text: 'A General channel for the workspace and one for each client, inside the app.', draft: true },
  { icon: 'link', title: 'One review link per upload', text: 'Clients review without an account.' },
  { icon: 'storage', title: 'Nothing needs to be uploaded to Drive', text: 'Cuts and raw footage live in the workspace, with the project they belong to.', draft: true },
  { icon: 'timecode', title: 'Frame-accurate', text: 'Every note carries its own timecode.' },
  { icon: 'access', title: 'Role-based access', text: 'Every person sees the right work.' },
  { icon: 'workspaces', title: 'Multi-client workspaces', text: 'Projects stay clean and separate.' },
  { icon: 'resolve', title: 'Resolve as you go', text: 'Turn conversation into a clear finish line.' },
]

// The five stages a cut moves through, with their existing one-liners.
// The heading reuses the label the old workflow strip carried.
export const STEPS_INTRO = {
  kicker: 'HOW IT WORKS',
  title: 'How a cut moves through CollabCut',
}

// Which side the text of step 1 sits on; the rest alternate from there.
// Flip this one value to mirror the whole zigzag.
export const STEPS_LAYOUT: { firstTextSide: 'left' | 'right' } = { firstTextSide: 'left' }

// `textSide` on a step pins that one step and overrides the alternation.
// Recordings: public/videos/step-1.mp4 ... step-5.mp4 (optional poster: step-N.jpg).
export const STEPS: { number: string; name: string; text: string; textSide?: 'left' | 'right' }[] = [
  { number: '01', name: 'Cut', text: 'Brief, raw footage link and deadline' },
  { number: '02', name: 'Editing', text: 'The assigned editor works from the brief' },
  { number: '03', name: 'Review', text: 'Timecoded notes, right on the frame' },
  { number: '04', name: 'Revision', text: 'New versions stack on the last' },
  { number: '05', name: 'Approved', text: 'Admin signs off the final cut' },
]

// Plans: specs only. Copy and CTAs are the existing agency pricing section.
export const PRICING = {
  kicker: 'BUILT AROUND YOUR OPERATION',
  title: ['A workspace that fits', 'the way you work.'],
  copy: 'Every workspace starts on Tier 1 with shared storage for the whole team. Move up to Tier 2 when the footage or the team outgrows it.',
  primary: { label: 'Talk to CollabCut', href: '/contact' },
  secondary: { label: 'Already onboarding? Create your workspace', href: '/auth/signup/agency' },
}

export const PLANS = [
  { name: 'Tier 1', storage: '2 TB', admins: 2, editors: 3, description: 'For a small team getting production out of the group chat.' },
  { name: 'Tier 2', storage: '4 TB', admins: 3, editors: 4, description: 'For studios running several clients and cuts at once.' },
]

// The two paragraphs and the link from /about.
export const ABOUT = {
  title: 'About CollabCut',
  paragraphs: [
    'CollabCut is one board that follows a cut from first pass to final approval. Reviewers drop timecoded notes right on the frame, new versions stack instead of overwriting the last one, share links let clients review without creating an account, and a raw footage archive keeps the source material alongside the edit.',
    'It’s built for agencies and editing teams who currently coordinate their work over scattered files and messages.',
  ],
  link: { label: 'Get in touch', href: '/contact' },
}

// Same links and lines as the existing site footer. No social links yet.
export const FOOTER = {
  tagline: ['The clear path from first cut', 'to final approval.'],
  groups: [
    { title: 'Product', links: [{ label: 'How it works', href: '#workflow' }, { label: 'Features', href: '#features' }, { label: 'Plans', href: '#pricing' }] },
    { title: 'Company', links: [{ label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }] },
    { title: 'Legal', links: [{ label: 'Terms of Service', href: '/terms' }, { label: 'Privacy Policy', href: '/privacy' }] },
  ],
  bottom: ['© 2026 CollabCut. Built for better cuts.', 'Made for the people behind the timeline.'],
}
