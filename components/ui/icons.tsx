import * as React from 'react'
import {
  Archive as IArchive,
  ArrowDown as IArrowDown,
  ArrowLeft as IArrowLeft,
  ArrowRight as IArrowRight,
  ArrowUpRight as IArrowUpRight,
  Attachment as IAttachment,
  Bell as IBell,
  Check as ICheck,
  CheckCircle as ICheckCircle,
  ChatBubble as IChatBubble,
  Clock as IClock,
  Copy as ICopy,
  CornerBottomRight as ICornerBottomRight,
  DoubleCheck as IDoubleCheck,
  Download as IDownload,
  EditPencil as IEditPencil,
  Expand as IExpand,
  Eye as IEye,
  EyeClosed as IEyeClosed,
  Group as IGroup,
  HalfMoon as IHalfMoon,
  KanbanBoard as IKanbanBoard,
  Link as ILink,
  List as IList,
  Lock as ILock,
  LogOut as ILogOut,
  MediaImage as IMediaImage,
  Minus as IMinus,
  MultiBubble as IMultiBubble,
  MultiplePages as IMultiplePages,
  MusicDoubleNote as IMusicDoubleNote,
  NavArrowDown as INavArrowDown,
  NavArrowLeft as INavArrowLeft,
  NavArrowRight as INavArrowRight,
  Notes as INotes,
  OpenNewWindow as IOpenNewWindow,
  Page as IPage,
  Pause as IPause,
  Play as IPlay,
  Plus as IPlus,
  Prohibition as IProhibition,
  Refresh as IRefresh,
  Search as ISearch,
  Send as ISend,
  Settings as ISettings,
  ShieldCheck as IShieldCheck,
  SidebarCollapse as ISidebarCollapse,
  SidebarExpand as ISidebarExpand,
  SkipNext as ISkipNext,
  SkipPrev as ISkipPrev,
  SoundHigh as ISoundHigh,
  SoundOff as ISoundOff,
  Sort as ISort,
  SunLight as ISunLight,
  Trash as ITrash,
  Undo as IUndo,
  Upload as IUpload,
  UserPlus as IUserPlus,
  VideoCamera as IVideoCamera,
  ViewGrid as IViewGrid,
  WarningCircle as IWarningCircle,
  Xmark as IXmark,
} from 'iconoir-react'
import { cn } from '@/lib/utils'

/* CollabCut icons: the ONE place icons come from. The app imports from this
   file only, never from iconoir-react directly. Every icon is exported under
   a stable name, takes `size` and `className`, and is drawn at stroke-width
   1.75 with round caps and joins (Iconoir's own default is 1.5).

   Colour is theme-driven in globals.css (the .ic rules):
     Dark   every icon is a lime line, except icons that sit on a lime / danger
            fill (they inherit the fill's text colour), disabled icons (muted)
            and danger icons (the danger colour).
     Light  icons are plain Ink or muted (they inherit currentColor). Only KEY
            icons pass `accent`: they are drawn as an Ink icon on a lime tile
            with a 1px Ink edge. In Dark `accent` is just the lime line.
   Key icons: the active sidebar item, the Reel / film icons, Approve (check)
   and the main Play overlay.

   `tone="inherit"` opts an icon out of the Dark lime rule (used on surfaces
   with their own colour system, e.g. the landing page). */

export type IconTone = 'auto' | 'inherit' | 'muted' | 'danger'

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string
  /** Key icon: Ink icon on a lime tile in Light, lime line in Dark. */
  accent?: boolean
  tone?: IconTone
}

export type IconComponent = React.ComponentType<IconProps>

const TILE_PAD = 6 // 18px icon -> 30px tile

type PaintFn = (props: React.SVGProps<SVGSVGElement>) => React.ReactElement

function build(name: string, paint: PaintFn): IconComponent {
  const Icon = ({ size = 16, strokeWidth = 1.75, accent = false, tone = 'auto', className, ...props }: IconProps) => {
    const toneAttr = tone === 'auto' ? undefined : tone
    const svg = paint({
      width: size,
      height: size,
      strokeWidth,
      className: cn('ic', accent ? undefined : className),
      'aria-hidden': props['aria-label'] || props['aria-labelledby'] ? undefined : true,
      ...props,
      ...(toneAttr ? { 'data-tone': toneAttr } : null),
    } as React.SVGProps<SVGSVGElement>)
    if (!accent) return svg
    const px = typeof size === 'number' ? size + TILE_PAD * 2 : undefined
    return (
      <span
        className={cn('ic-tile', className)}
        style={px ? { width: px, height: px } : undefined}
        data-tone={toneAttr}
      >
        {svg}
      </span>
    )
  }
  Icon.displayName = name
  return Icon
}

// Wrap an Iconoir icon: it renders <svg width height strokeWidth ...> with
// round-capped paths and spreads our props over its defaults.
type Src = React.ComponentType<React.SVGProps<SVGSVGElement>>
function iconoir(name: string, Source: Src) {
  return build(name, (p) => <Source {...p} />)
}

// Drawn by hand where Iconoir has no equivalent (24x24, stroke only).
function drawn(name: string, children: React.ReactNode) {
  return build(name, (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...p}
    >
      {children}
    </svg>
  ))
}

/* ── Iconoir, under stable names ── */
export const Archive = iconoir('Archive', IArchive)
export const ArrowDown = iconoir('ArrowDown', IArrowDown)
export const ArrowDownUp = iconoir('ArrowDownUp', ISort)
export const ArrowLeft = iconoir('ArrowLeft', IArrowLeft)
export const ArrowRight = iconoir('ArrowRight', IArrowRight)
export const ArrowUpRight = iconoir('ArrowUpRight', IArrowUpRight)
export const Ban = iconoir('Ban', IProhibition)
export const Bell = iconoir('Bell', IBell)
export const Check = iconoir('Check', ICheck)
export const CheckCheck = iconoir('CheckCheck', IDoubleCheck)
export const CheckCircle2 = iconoir('CheckCircle2', ICheckCircle)
export const ChevronDown = iconoir('ChevronDown', INavArrowDown)
export const ChevronLeft = iconoir('ChevronLeft', INavArrowLeft)
export const ChevronRight = iconoir('ChevronRight', INavArrowRight)
export const CircleAlert = iconoir('CircleAlert', IWarningCircle)
export const CircleCheck = iconoir('CircleCheck', ICheckCircle)
export const Clock = iconoir('Clock', IClock)
export const Clock3 = iconoir('Clock3', IClock)
export const Copy = iconoir('Copy', ICopy)
export const CornerDownRight = iconoir('CornerDownRight', ICornerBottomRight)
export const ExternalLink = iconoir('ExternalLink', IOpenNewWindow)
export const Eye = iconoir('Eye', IEye)
export const EyeOff = iconoir('EyeOff', IEyeClosed)
export const File = iconoir('File', IPage)
export const FileText = iconoir('FileText', IPage)
export const FolderKanban = iconoir('FolderKanban', IKanbanBoard)
export const Image = iconoir('Image', IMediaImage)
export const Layers3 = iconoir('Layers3', IMultiplePages)
export const LayoutGrid = iconoir('LayoutGrid', IViewGrid)
export const Link2 = iconoir('Link2', ILink)
export const List = iconoir('List', IList)
export const Lock = iconoir('Lock', ILock)
export const LogOut = iconoir('LogOut', ILogOut)
export const Maximize2 = iconoir('Maximize2', IExpand)
export const MessageCircle = iconoir('MessageCircle', IChatBubble)
export const MessageSquare = iconoir('MessageSquare', IChatBubble)
export const MessagesSquare = iconoir('MessagesSquare', IMultiBubble)
export const Minus = iconoir('Minus', IMinus)
export const Moon = iconoir('Moon', IHalfMoon)
export const Music = iconoir('Music', IMusicDoubleNote)
export const PanelLeftClose = iconoir('PanelLeftClose', ISidebarCollapse)
export const PanelLeftOpen = iconoir('PanelLeftOpen', ISidebarExpand)
export const Paperclip = iconoir('Paperclip', IAttachment)
export const Pause = iconoir('Pause', IPause)
export const Pencil = iconoir('Pencil', IEditPencil)
export const Play = iconoir('Play', IPlay)
export const Plus = iconoir('Plus', IPlus)
export const RefreshCw = iconoir('RefreshCw', IRefresh)
export const RotateCcw = iconoir('RotateCcw', IUndo)
export const Search = iconoir('Search', ISearch)
export const Send = iconoir('Send', ISend)
export const Settings = iconoir('Settings', ISettings)
export const ShieldCheck = iconoir('ShieldCheck', IShieldCheck)
export const SkipBack = iconoir('SkipBack', ISkipPrev)
export const SkipForward = iconoir('SkipForward', ISkipNext)
export const StickyNote = iconoir('StickyNote', INotes)
export const Sun = iconoir('Sun', ISunLight)
export const Trash2 = iconoir('Trash2', ITrash)
export const Upload = iconoir('Upload', IUpload)
export const Download = iconoir('Download', IDownload)
export const UserPlus = iconoir('UserPlus', IUserPlus)
export const Users = iconoir('Users', IGroup)
export const Users2 = iconoir('Users2', IGroup)
export const Video = iconoir('Video', IVideoCamera)
export const Volume2 = iconoir('Volume2', ISoundHigh)
export const VolumeX = iconoir('VolumeX', ISoundOff)
export const X = iconoir('X', IXmark)

/* ── Drawn here: no Iconoir match ── */

// Reel: a circle with four holes. Replaces the lucide Film icon everywhere.
export const Reel = drawn(
  'Reel',
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="7.6" r="1.35" />
    <circle cx="12" cy="16.4" r="1.35" />
    <circle cx="7.6" cy="12" r="1.35" />
    <circle cx="16.4" cy="12" r="1.35" />
  </>
)
export const Film = Reel

// Play inside a circle (landing play button); Iconoir has no circled play.
export const CirclePlay = drawn(
  'CirclePlay',
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.6v6.8l5.6-3.4L10 8.6z" />
  </>
)

// Plain shapes (stop / record indicators).
export const Square = drawn('Square', <rect x="4" y="4" width="16" height="16" rx="2" />)
export const Circle = drawn('Circle', <circle cx="12" cy="12" r="9" />)

// Loading spinner: a CSS-spinning ring (Loader2 in the old set).
export function Loader2({
  size = 16,
  className,
  style,
  ...rest
}: { size?: number | string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      role="status"
      aria-label="Loading"
      {...rest}
      className={cn('ic-spinner inline-block shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin', className)}
      style={{ width: size, height: size, ...style }}
    />
  )
}

/* ── CollabCut board icons ──
   Drawn exactly as in the design board: stroke only, 24x24, round caps and
   joins. They take the same props as every icon above. */
const TRAY = 'M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3'

function board(name: string, paths: string[]) {
  return drawn(name, paths.map((d) => <path key={d} d={d} />))
}

export const UploadIcon = board('UploadIcon', ['M12 16V4m0 0l-4 4m4-4l4 4', TRAY])
export const DownloadIcon = board('DownloadIcon', ['M12 4v12m0 0l-4-4m4 4l4-4', TRAY])
export const CommentIcon = board('CommentIcon', ['M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z'])
export const VersionsIcon = board('VersionsIcon', ['M12 3l9 5-9 5-9-5 9-5z', 'M3 13l9 5 9-5'])
export const ReviewLinkIcon = board('ReviewLinkIcon', ['M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1', 'M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0010 18.7l1-1'])
export const TimecodeIcon = board('TimecodeIcon', ['M12 7v5l3 2', 'M12 21a9 9 0 100-18 9 9 0 000 18z'])
export const ApproveIcon = board('ApproveIcon', ['M5 12.5l4.5 4.5L19 7.5'])
export const BoardIcon = board('BoardIcon', ['M4 5h4v14H4z', 'M10 5h4v9h-4zM16 5h4v6h-4z'])
