import { describe, it, expect } from 'vitest'
import {
  DISPLAY_ERROR_CODES,
  RECEPTIONS,
  VENUE_AUDIENCES,
  pieceShown,
  displayCandidates,
  displayReveal,
  displayVenue,
  fateTick,
  fateOf,
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
    expect(pieceShown({ piece: carried[1] })).toBe(true)
    expect(pieceShown({ piece: carried[0] })).toBe(false)
  })
})

describe('displayReveal — the verdict, once', () => {
  const reveal = ({ artifact = piece(), who = player(), location = bar, rng }) =>
    displayReveal({ tuning, player: who, piece: artifact, location, gameTime: at, rng })

  it('refuses no piece, a piece already shown, friends, nobody, and a standing that does not exist', () => {
    expect(reveal({ artifact: null, rng: () => PASS }).error.code).toBe(
      DISPLAY_ERROR_CODES.pieceMissing
    )
    expect(
      reveal({ artifact: piece({ reception: RECEPTIONS.ignored }), rng: () => PASS }).error.code
    ).toBe(DISPLAY_ERROR_CODES.pieceShown)
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
    expect(result.data.piece).toMatchObject({
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
    expect(mocked.data.piece.legend).toBe(0)
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
    expect(result.data.piece.status).toBe(ARTIFACT_STATUSES.fresh)
    expect(result.data.piece.reception).toBe(RECEPTIONS.praised)
  })
})

describe('a performance, judged live', () => {
  it('the experience takes the verdict, and its status is its own business', () => {
    const lived = {
      id: 'e1',
      kind: 'making',
      status: 'remembered',
      tier: MAKING_TIERS.solid,
      workText: 'a freestyle outside the 7-11',
      artistText: 'the idea',
      reception: null,
      legend: 0,
    }
    const result = displayReveal({
      tuning,
      player: player(),
      piece: lived,
      location: bar,
      gameTime: at,
      rng: () => PASS,
    })
    expect(result.data.piece).toMatchObject({
      status: 'remembered',
      reception: RECEPTIONS.praised,
      ideaText: 'the idea',
    })
  })
})

describe('fateTick — the world acts on what was left in it', () => {
  const stolen = tuning.display.fates.find((f) => f.status === ARTIFACT_STATUSES.stolen)
  const defaced = tuning.display.fates.find((f) => f.status === ARTIFACT_STATUSES.defaced)
  const onWall = ({
    id = 'w1',
    reception = RECEPTIONS.praised,
    legend = 2,
    status = ARTIFACT_STATUSES.fresh,
  } = {}) => ({ ...piece({ id, kind: ARTIFACT_KINDS.fixed, reception, legend }), status })
  const fate = ({ marks, location = bar, ticksElapsed = 1, rng }) =>
    fateTick({ tuning, location: { ...location, marks }, ticksElapsed, gameTime: at, rng })

  it('refuses time running backwards', () => {
    expect(fate({ marks: [], ticksElapsed: -1, rng: () => 0 }).error.code).toBe(
      DISPLAY_ERROR_CODES.ticksInvalid
    )
  })

  it('the first fate whose chance lands takes the piece: stolen is gone and worth more, unnoticed', () => {
    const result = fate({ marks: [onWall()], rng: () => 0 })
    expect(result.data.fated).toEqual([{ markId: 'w1', status: ARTIFACT_STATUSES.stolen }])
    expect(result.data.marks[0]).toMatchObject({
      status: ARTIFACT_STATUSES.stolen,
      legend: 2 + stolen.legendBonus,
      endedBy: { kind: 'fate', id: ARTIFACT_STATUSES.stolen },
      noticedAtTick: null,
      updatedAtTick: 9,
    })
    expect(fateOf({ tuning, mark: result.data.marks[0] })).toBe(stolen)
  })

  it('a chance that misses the first fate can land the next: defaced is still up', () => {
    // A roll past stealing's chance for one tick, under defacing's.
    const legend = 2
    const roll = legend * stolen.chancePerTickPerLegend + 0.0001
    expect(roll).toBeLessThan(legend * defaced.chancePerTickPerLegend)
    const result = fate({ marks: [onWall({ legend })], rng: () => roll })
    expect(result.data.fated).toEqual([{ markId: 'w1', status: ARTIFACT_STATUSES.defaced }])
    expect(result.data.marks[0].legend).toBe(legend + defaced.legendBonus)
  })

  it('nobody wants what the world has not seen, what has no legend, what is covered, or what hangs where nobody is', () => {
    const unseen = onWall({ id: 'a', reception: null })
    const nothing = onWall({ id: 'b', legend: 0 })
    const covered = onWall({ id: 'c', status: ARTIFACT_STATUSES.covered })
    expect(fate({ marks: [unseen, nothing, covered], rng: () => 0 }).data.fated).toEqual([])
    expect(fate({ marks: [onWall()], location: home, rng: () => 0 }).data.fated).toEqual([])
    expect(fate({ marks: [onWall()], location: nowhere, rng: () => 0 }).data.fated).toEqual([])
    expect(fateOf({ tuning, mark: onWall() })).toBeNull()
  })

  it('the chance is per tick per legend, and adds up over ticks', () => {
    const legend = 2
    // Past every fate's chance for one tick; over a day, stealing lands.
    const roll = legend * defaced.chancePerTickPerLegend + 0.0001
    expect(
      fate({ marks: [onWall({ legend })], ticksElapsed: 1, rng: () => roll }).data.fated
    ).toEqual([])
    expect(
      fate({ marks: [onWall({ legend })], ticksElapsed: 96, rng: () => roll }).data.fated
    ).toEqual([{ markId: 'w1', status: ARTIFACT_STATUSES.stolen }])
  })
})
