import * as React from 'react'

/* CollabCut action icons, drawn exactly as in the design board: stroke only,
   24x24 viewBox, 1.75 stroke, round caps and joins. They take the same props
   as the lucide icons they replace (size, className, style, aria-*) and
   inherit the text colour through currentColor. */

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string
}

function makeIcon(name: string, paths: string[]) {
  const Icon = ({ size = 16, strokeWidth = 1.75, children, ...props }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    >
      {paths.map((d) => <path key={d} d={d} />)}
      {children}
    </svg>
  )
  Icon.displayName = name
  return Icon
}

const TRAY = 'M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3'

export const UploadIcon = makeIcon('UploadIcon', ['M12 16V4m0 0l-4 4m4-4l4 4', TRAY])
export const DownloadIcon = makeIcon('DownloadIcon', ['M12 4v12m0 0l-4-4m4 4l4-4', TRAY])
export const CommentIcon = makeIcon('CommentIcon', ['M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z'])
export const VersionsIcon = makeIcon('VersionsIcon', ['M12 3l9 5-9 5-9-5 9-5z', 'M3 13l9 5 9-5'])
export const ReviewLinkIcon = makeIcon('ReviewLinkIcon', ['M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1', 'M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0010 18.7l1-1'])
export const TimecodeIcon = makeIcon('TimecodeIcon', ['M12 7v5l3 2', 'M12 21a9 9 0 100-18 9 9 0 000 18z'])
export const ApproveIcon = makeIcon('ApproveIcon', ['M5 12.5l4.5 4.5L19 7.5'])
export const BoardIcon = makeIcon('BoardIcon', ['M4 5h4v14H4z', 'M10 5h4v9h-4zM16 5h4v6h-4z'])
