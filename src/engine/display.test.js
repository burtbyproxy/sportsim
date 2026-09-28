import { describe, it, expect } from 'vitest'
import {
  DISPLAY_ERROR_CODES,
  RECEPTIONS,
  VENUE_AUDIENCES,
  artifactShown,
  displayCandidates,
  displayReveal,
  displayVenue,
} from './display.js'
import { ARTIFACT_KINDS, ARTIFACT_STATUSES, MAKING_TIERS } from './making.js'
import { tuningContent } from '../../tests/helpers/content.js'
import { rngForNatural } from '../../tests/helpers/rng.js'

const tuning = tuningContent()
const FAIL = rngForNatural({ natural: 1 })
const PASS = rngForNatural({ natural: 20 })
const EVEN = rngForNatural({ natural: 10 })

// --- Fixtures ---

const stat = (base) => ({ base, modifiers: [], xp: 0 })
const player = ({ reputation = 10, portfolio = [] } = {}) => ({
  id: 'p',
  stats: { reputation: stat(reputation) },
  portfolio,
})
const piece = ({
  id = 'a1',
  kind = ARTIFACT_KINDS.portable,
  tier = MAKING_TIERS.solid,
  reception = null,
  legend = 0,
} = {}) => ({
  id,
  kind,
  status: kind === ARTIFACT_KINDS.portable ? ARTIFACT_STATUSES.unshown : ARTIFACT_STATUSES.fresh,
  tier,
  workText: 'a painting on a door',
  artistText: 'the idea',
  reception,
  legend,
  ideaText: null,
  shownAtTick: null,
  shownAtLocationId: null,
  updatedAtTick: 0,
})
const bar = {
  id: 'bar',
  displayInline: 'the bar',
  venue: { audience: VENUE_AUDIENCES.strangers, dc: 12 },
}
const home = {
  id: 'home',
  displayInline: "Mom's",
  venue: { audience: VENUE_AUDIENCES.friends, dc: 5 },
}
const nowhere = { id: 'lot', displayInline: 'the lot', venue: null }
const at = { tick: 9 }

describe('who is here to see it', () => {
  it('strangers are the world; friends are not; nobody is nobody', () => {
    expect(displayVenue({ location: bar }).ok).toBe(true)
    expect(displayVenue({ location: home }).error.code).toBe(DISPLAY_ERROR_CODES.venueFriends)
    expect(displayVenue({ location: nowhere }).error.code).toBe(DISPLAY_ERROR_CODES.venueNone)
  })

  it('what could still be shown: carried pieces the world has not seen', () => {
    const carried = [
      piece({ id: 'new' }),
      piece({ id: 'seen', reception: RECEPTIONS.praised }),
      piece({ id: 'wall', kind: ARTIFACT_KINDS.fixed }),
    ]
    expect(displayCandidates({ player: player({ portfolio: carried }) }).map((a) => a.id)).toEqual([
      'new',
    ])
    expect(artifactShown({ artifact: carried[1] })).toBe(true)
    expect(artifactShown({ artifact: carried[0] })).toBe(false)
  })
})

describe('displayReveal — the verdict, once', () => {
  const reveal = ({ artifact = piece(), who = player(), location = bar, rng }) =>
    displayReveal({ tuning, player: who, artifact, location, gameTime: at, rng })

  it('refuses no piece, a piece already shown, friends, nobody, and a standing that does not exist', () => {
    expect(reveal({ artifact: null, rng: () => PASS }).error.code).toBe(
      DISPLAY_ERROR_CODES.artifactMissing
    )
    expect(
      reveal({ artifact: piece({ reception: RECEPTIONS.ignored }), rng: () => PASS }).error.code
    ).toBe(DISPLAY_ERROR_CODES.artifactShown)
    expect(reveal({ location: home, rng: () => PASS }).error.code).toBe(
      DISPLAY_ERROR_CODES.venueFriends
    )
    expect(reveal({ location: nowhere, rng: () => PASS }).error.code).toBe(
      DISPLAY_ERROR_CODES.venueNone
    )
    expect(reveal({ who: { id: 'p', stats: {} }, rng: () => PASS }).error.code).toBe(
      DISPLAY_ERROR_CODES.statUnknown
    )
  })

  it('praised: the check passes, legend lands, the piece is shown and keeps the idea as story', () => {
    const result = reveal({ rng: () => PASS })
    expect(result.ok).toBe(true)
    expect(result.data.reception).toBe(RECEPTIONS.praised)
    expect(result.data.legendGained).toBe(tuning.display.legend.praised)
    expect(result.data.artifact).toMatchObject({
      status: ARTIFACT_STATUSES.shown,
      reception: RECEPTIONS.praised,
      legend: tuning.display.legend.praised,
      ideaText: 'the idea',
      shownAtTick: 9,
      shownAtLocationId: 'bar',
      updatedAtTick: 9,
    })
    expect(result.data.check.stat).toBe(tuning.display.stat)
  })

  it('ignored: the check fails; mocked: a natural one, and legend cannot go under nothing', () => {
    // Reputation 10 (+1), an even roll of 10, a rough piece (-2) against DC 12: nine, ignored.
    expect(
      reveal({ artifact: piece({ tier: MAKING_TIERS.rough }), rng: () => EVEN }).data.reception
    ).toBe(RECEPTIONS.ignored)
    const mocked = reveal({ rng: () => FAIL })
    expect(mocked.data.reception).toBe(RECEPTIONS.mocked)
    expect(mocked.data.legendGained).toBe(tuning.display.legend.mocked)
    expect(mocked.data.artifact.legend).toBe(0)
  })

  it('how the piece came out bends the verdict', () => {
    // Even roll, reputation 10: eleven. Inspired adds enough to pass; rough takes it under.
    expect(
      reveal({ artifact: piece({ tier: MAKING_TIERS.inspired }), rng: () => EVEN }).data.reception
    ).toBe(RECEPTIONS.praised)
    expect(
      reveal({ artifact: piece({ tier: MAKING_TIERS.rough }), rng: () => EVEN }).data.reception
    ).toBe(RECEPTIONS.ignored)
    expect(
      reveal({ artifact: piece({ tier: MAKING_TIERS.inspired }), rng: () => EVEN }).data.check
        .modifierItems
    ).toContainEqual({
      source: 'situational',
      sourceId: null,
      value: tuning.display.tierModifiers.inspired,
    })
  })

  it('a wall keeps its own status; only the verdict changes', () => {
    const result = reveal({ artifact: piece({ kind: ARTIFACT_KINDS.fixed }), rng: () => PASS })
    expect(result.data.artifact.status).toBe(ARTIFACT_STATUSES.fresh)
    expect(result.data.artifact.reception).toBe(RECEPTIONS.praised)
  })
})
