import fs from 'node:fs'
import path from 'node:path'
import { Reveal } from './Reveal'
import { StepVideo } from './StepVideo'
import { StepsRise } from './StepsRise'
import { STEPS, STEPS_INTRO, STEPS_LAYOUT } from './content'

// The one place that decides which side a step's text sits on (desktop).
// Strict alternation from STEPS_LAYOUT.firstTextSide; a step can pin its own
// side with `textSide` in content.ts. On mobile it is always text above video.
function textSideFor(index: number): 'left' | 'right' {
  const pinned = STEPS[index].textSide
  if (pinned) return pinned
  const first = STEPS_LAYOUT.firstTextSide
  const other = first === 'left' ? 'right' : 'left'
  return index % 2 === 0 ? first : other
}

// Recordings are optional: drop step-N.mp4 (and optionally step-N.jpg as its
// poster) into public/videos and the slot picks it up on the next build or
// dev refresh. Checked on the server, so a missing file is never requested
// and never shows up as a 404.
function mediaFor(step: number) {
  const dir = path.join(process.cwd(), 'public', 'videos')
  const has = (file: string) => fs.existsSync(path.join(dir, file))
  return {
    src: has(`step-${step}.mp4`) ? `/videos/step-${step}.mp4` : undefined,
    poster: has(`step-${step}.jpg`) ? `/videos/step-${step}.jpg` : undefined,
  }
}

export function Steps() {
  return (
    <section className="lp-section lp-steps" id="workflow" aria-labelledby="lp-steps-title">
      <div className="lp-container">
        <Reveal>
          <p className="lp-kicker">{STEPS_INTRO.kicker}</p>
          <h2 className="lp-h2" id="lp-steps-title">{STEPS_INTRO.title}</h2>
        </Reveal>
      </div>
      {/* Full-bleed rows: the text keeps the page gutter, the video runs to the screen edge. */}
      <ol className="lp-steps-list">
        {STEPS.map((step, i) => {
          const media = mediaFor(i + 1)
          return (
            <li className="lp-step" data-text-side={textSideFor(i)} key={step.number}>
              <div className="lp-step-text">
                <div className="lp-step-rise">
                  <span className="lp-step-number">{step.number}</span>
                  <h3>{step.name}</h3>
                  <p>{step.text}</p>
                </div>
              </div>
              <div className="lp-step-slot">
                <StepVideo src={media.src} poster={media.poster} number={step.number} name={step.name} />
              </div>
            </li>
          )
        })}
      </ol>
      <StepsRise target="#workflow" />
    </section>
  )
}
