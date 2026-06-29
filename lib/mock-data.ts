import { Project, Asset, AssetVersion, Comment, ActivityItem, User } from './types'

export const MOCK_ME: User = {
  id: 'user-1',
  name: 'You (Satwik)',
  email: 'satwik@dailies.app',
  initials: 'YS',
  avatarColor: '#4CAF7D',
  role: 'owner',
}

export const MOCK_PROJECTS: Project[] = [
  { id: 'p1', name: 'Wedding Promo — Singh & Mehta', client: 'Private Client', status: 'in_review', assetCount: 4, commentCount: 12, memberCount: 3, updatedAt: '2h ago', createdAt: '2024-06-10', emoji: '🎬' },
  { id: 'p2', name: 'Flipkart Diwali TVC', client: 'Flipkart Media', status: 'approved', assetCount: 7, commentCount: 31, memberCount: 5, updatedAt: '1d ago', createdAt: '2024-06-05', emoji: '📺' },
  { id: 'p3', name: 'Ather Energy Brand Film', client: 'Ather Energy', status: 'changes', assetCount: 2, commentCount: 5, memberCount: 2, updatedAt: '3d ago', createdAt: '2024-06-01', emoji: '⚡' },
  { id: 'p4', name: 'Zomato Social Cuts Q4', client: 'Zomato', status: 'in_review', assetCount: 12, commentCount: 48, memberCount: 6, updatedAt: '5d ago', createdAt: '2024-05-28', emoji: '🍕' },
  { id: 'p5', name: 'CRED Brand Story S2', client: 'CRED', status: 'draft', assetCount: 0, commentCount: 0, memberCount: 1, updatedAt: '1w ago', createdAt: '2024-05-20', emoji: '💳' },
  { id: 'p6', name: 'Swiggy Monsoon Campaign', client: 'Swiggy', status: 'approved', assetCount: 3, commentCount: 9, memberCount: 4, updatedAt: '2w ago', createdAt: '2024-05-15', emoji: '🌧️' },
]

export const MOCK_ASSETS: Asset[] = [
  { id: 'a1', projectId: 'p1', name: 'Client Cut v3.mp4', version: 3, duration: '2:14', durationSec: 134, sizeLabel: '840 MB', status: 'in_review', commentCount: 7, emoji: '🎞️', uploadedAt: 'Today, 2:14 PM', uploadedBy: 'You' },
  { id: 'a2', projectId: 'p1', name: "Director's Cut v2.mp4", version: 2, duration: '3:02', durationSec: 182, sizeLabel: '1.1 GB', status: 'approved', commentCount: 5, emoji: '🎞️', uploadedAt: 'Yesterday, 9:40 AM', uploadedBy: 'Riya S.' },
  { id: 'a3', projectId: 'p1', name: 'Rough Assembly v1.mp4', version: 1, duration: '4:45', durationSec: 285, sizeLabel: '1.8 GB', status: 'changes', commentCount: 18, emoji: '🎞️', uploadedAt: 'Jun 15, 11:22 AM', uploadedBy: 'You' },
  { id: 'a4', projectId: 'p1', name: 'Sound Mix Preview.mp4', version: 1, duration: '2:14', durationSec: 134, sizeLabel: '320 MB', status: 'in_review', commentCount: 2, emoji: '🔊', uploadedAt: 'Jun 16, 4:00 PM', uploadedBy: 'You' },
]

export const MOCK_VERSIONS: AssetVersion[] = [
  { id: 'v3', versionNumber: 3, label: 'v3 — Client Cut',     sizeLabel: '840 MB', uploadedAt: 'Today, 2:14 PM',     isCurrent: true  },
  { id: 'v2', versionNumber: 2, label: 'v2 — Director\'s Cut', sizeLabel: '1.1 GB', uploadedAt: 'Yesterday, 9:40 AM', isCurrent: false },
  { id: 'v1', versionNumber: 1, label: 'v1 — Rough Assembly', sizeLabel: '1.8 GB', uploadedAt: 'Jun 15, 11:22 AM',   isCurrent: false },
]

export const MOCK_COMMENTS: Comment[] = [
  {
    id: 'c1', assetId: 'a1', timeSec: 2.5,
    author: 'Riya S.', initials: 'RS', avatarColor: '#E8A33D',
    status: 'changes', resolved: false, createdAt: '3h ago',
    text: 'The cut on this beat feels a touch slow — can we trim 8–10 frames from the tail end?',
    replies: [{ id: 'r1', author: 'You', initials: 'YS', avatarColor: '#4CAF7D', text: 'On it. Will push v4 tonight.', createdAt: '1h ago' }],
  },
  {
    id: 'c2', assetId: 'a1', timeSec: 5.8,
    author: 'Client (Aditi)', initials: 'CA', avatarColor: '#5BA4CF',
    status: 'resolved', resolved: true, createdAt: '2h ago',
    text: 'Color grade looks excellent here — locking this section.',
    replies: [],
  },
  {
    id: 'c3', assetId: 'a1', timeSec: 7.6,
    author: 'Riya S.', initials: 'RS', avatarColor: '#E8A33D',
    status: 'open', resolved: false, createdAt: '1h ago',
    text: 'Logo is clipping the right edge. Needs a 40px safe zone minimum.',
    replies: [],
  },
  {
    id: 'c4', assetId: 'a1', timeSec: 9.2,
    author: 'Client (Aditi)', initials: 'CA', avatarColor: '#5BA4CF',
    status: 'open', resolved: false, createdAt: '55m ago',
    text: "This transition is exactly right — don't touch it in any future version.",
    replies: [{ id: 'r2', author: 'Riya S.', initials: 'RS', avatarColor: '#E8A33D', text: 'Noted — flagging it as locked.', createdAt: '45m ago' }],
  },
  {
    id: 'c5', assetId: 'a1', timeSec: 14.1,
    author: 'You', initials: 'YS', avatarColor: '#4CAF7D',
    status: 'open', resolved: false, createdAt: '30m ago',
    text: 'There is an audio dip here. Checking with the sound team.',
    replies: [],
  },
]

export const MOCK_MEMBERS = [
  { name: 'You (Satwik)', initials: 'YS', avatarColor: '#4CAF7D', role: 'Owner', email: 'satwik@dailies.app' },
  { name: 'Riya S.',      initials: 'RS', avatarColor: '#E8A33D', role: 'Editor', email: 'riya@studio.in' },
  { name: 'Client (Aditi)', initials: 'CA', avatarColor: '#5BA4CF', role: 'Client', email: 'aditi@client.com' },
]

export const MOCK_ACTIVITY: ActivityItem[] = [
  { id: 'act1', who: 'Riya S.',       initials: 'RS', avatarColor: '#E8A33D', action: 'left a note at',   detail: '00:00:02:12', createdAt: '3h ago' },
  { id: 'act2', who: 'Client (Aditi)',initials: 'CA', avatarColor: '#5BA4CF', action: 'approved section', detail: '',            createdAt: '2h ago' },
  { id: 'act3', who: 'You',           initials: 'YS', avatarColor: '#4CAF7D', action: 'uploaded v3',      detail: '840 MB',      createdAt: '5h ago' },
  { id: 'act4', who: 'Riya S.',       initials: 'RS', avatarColor: '#E8A33D', action: 'resolved a note',  detail: '',            createdAt: '6h ago' },
  { id: 'act5', who: 'Client (Aditi)',initials: 'CA', avatarColor: '#5BA4CF', action: 'opened the review',detail: '',            createdAt: 'Yesterday' },
  { id: 'act6', who: 'You',           initials: 'YS', avatarColor: '#4CAF7D', action: 'uploaded v2',      detail: '1.1 GB',      createdAt: '2d ago' },
]
