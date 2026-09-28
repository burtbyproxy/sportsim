import { describe, it, expect } from 'vitest'
import {
  COMMUNITY_ERROR_CODES,
  artistMediumIds,
  makingSpotFind,
  pieceBeats,
  pieceMakeByCharacter,
} from './community.js'
import { ARTIFACT_STATUSES, MAKING_TIERS } from './making.js'
import { contentDir, tuningContent } from '../../tests/helpers/content.js'
import { rngForNatural } from '../../tests/helpers/rng.js'

const tuning = tuningContent()
const mediums = Object.fromEntries(contentDir({ dir: 'content/mediums' }).map((m) => [m.id, m]))
const voices = Object.fromEntries(contentDir({ dir: 'content/voices' }).map((v) => [v.id, v]))
const PASS = rngForNatural({ natural: 20 })
const FAIL = rngForNatural({ natural: 1 })

// --- Fixtures ---

const cell = (base) => ({ base, modifiers: [], xp: 0 })
const stat = (base) => ({ base, modifiers: [], xp: 0 })
const artist = ({
  id = 'tyler',
  skills = { tagging: { sober: cell(25) } },
  experiences = [],
} = {}) => ({
  id,
  name: id,
  stats: { creativity: stat(20), wits: stat(20), toughness: stat(10) },
  skills,
  experiences,
  blend: { dominantPersonaId: 'sober', weights: [], modifierSources: [] },
})
const bar = {
  id: 'bar',
  displayInline: 'the bar',
  pieceAs: 'at the bar',
  venue: { audience: 'strangers', dc: 12 },
  surfaces: [
    { id: 'wall', name: 'the wall', pieceAs: 'on the bathroom wall', mediumIds: ['tagging'] },
    { id: 'corner', name: 'the corner', pieceAs: 'in the corner', mediumIds: ['performance'] },
  ],
  marks: [],
}
const at = { tick: 4 }

describe('who is an artist, and where', () => {
  it('anyone with any skill in a medium', () => {
    expect(artistMediumIds({ subject: artist() })).toEqual(['tagging'])
    expect(
      artistMediumIds({ subject: artist({ skills: { tagging: { sober: cell(0) } } }) })
    ).toEqual([])
    expect(artistMediumIds({ subject: null })).toEqual([])
  })

  it('a surface that takes the medium, the place itself for one done anywhere, or nowhere', () => {
    expect(makingSpotFind({ location: bar, medium: mediums.tagging }).surface.id).toBe('wall')
    expect(makingSpotFind({ location: bar, medium: mediums.freestyle })).toEqual({
      surfaceKind: 'place',
      surface: null,
    })
    expect(makingSpotFind({ location: bar, medium: mediums.painting })).toBeNull()
  })
})

describe('pieceMakeByCharacter — somebody makes something', () => {
  const make = ({ character = artist(), mediumId = 'tagging', location = bar, rng }) =>
    pieceMakeByCharacter({
      tuning,
      character,
      mediumId,
      mediums,
      location,
      voices,
      gameTime: at,
      rng,
    })

  it('refuses nobody, a medium that does not exist, and nowhere to make it', () => {
    expect(make({ character: null, rng: () => PASS }).error.code).toBe(
      COMMUNITY_ERROR_CODES.characterMissing
    )
    expect(make({ mediumId: 'mime', rng: () => PASS }).error.code).toBe(
      COMMUNITY_ERROR_CODES.mediumUnknown
    )
    expect(make({ mediumId: 'painting', rng: () => PASS }).error.code).toBe(
      COMMUNITY_ERROR_CODES.nowhereToMake
    )
  })

  it('a tag on the wall: the check, the tier, the words in their voice, a piece with their name on it, covering what was there', () => {
    const before = { id: 'old', surfaceId: 'wall', status: ARTIFACT_STATUSES.fresh, makerId: 'me' }
    const result = make({ location: { ...bar, marks: [before] }, rng: () => PASS })
    expect(result.ok).toBe(true)
    expect(result.data.tier).toBe(MAKING_TIERS.inspired)
    expect(result.data.artifact).toMatchObject({
      kind: 'fixed',
      status: ARTIFACT_STATUSES.fresh,
      makerId: 'tyler',
      mediumId: 'tagging',
      surfaceId: 'wall',
      tier: MAKING_TIERS.inspired,
      reception: null,
      legend: 0,
      createdAtTick: 4,
    })
    expect(result.data.artifact.workText.length).toBeGreaterThan(0)
    expect(result.data.experience).toMatchObject({
      makerId: 'tyler',
      artifactId: result.data.artifact.id,
    })
    expect(result.data.marks.map((m) => [m.id, m.status])).toEqual([
      ['old', ARTIFACT_STATUSES.covered],
      [result.data.artifact.id, ARTIFACT_STATUSES.fresh],
    ])
  })

  it('a performance leaves nothing but the doing; a botched tag leaves nothing either', () => {
    const performer = artist({ id: 'maurice', skills: { performance: { sober: cell(30) } } })
    const performed = make({ character: performer, mediumId: 'performance', rng: () => PASS })
    expect(performed.data.artifact).toBeNull()
    expect(performed.data.experience.artifactId).toBeNull()
    expect(performed.data.marks).toEqual([])
    const botched = make({ rng: () => FAIL })
    expect(botched.data.tier).toBe(MAKING_TIERS.botched)
    expect(botched.data.artifact).toBeNull()
  })
})

describe('pieceBeats — something to chase', () => {
  const piece = ({
    makerId = 'tyler',
    mediumId = 'tagging',
    tier = MAKING_TIERS.solid,
    legend = 0,
  } = {}) => ({
    id: 'p',
    makerId,
    mediumId,
    tier,
    legend,
  })
  const me = ({ skills = { tagging: { sober: cell(10) } }, experiences = [] } = {}) =>
    artist({ id: 'me', skills, experiences })

  it('not your own, not outside your medium, and nothing to chase for someone with no skill in it', () => {
    expect(pieceBeats({ viewer: me(), piece: piece({ makerId: 'me' }) })).toEqual({ beats: false })
    expect(pieceBeats({ viewer: me(), piece: piece({ mediumId: 'painting' }) })).toEqual({
      beats: false,
    })
    expect(pieceBeats({ viewer: me({ skills: {} }), piece: piece() })).toEqual({ beats: false })
  })

  it('anything beats nothing; a higher tier beats a lower; the same tier with more legend beats it; less does not', () => {
    expect(pieceBeats({ viewer: me(), piece: piece() })).toEqual({ beats: true })
    const solid = me({
      experiences: [{ mediumId: 'tagging', tier: MAKING_TIERS.solid, legend: 1 }],
    })
    expect(pieceBeats({ viewer: solid, piece: piece({ tier: MAKING_TIERS.inspired }) })).toEqual({
      beats: true,
    })
    expect(
      pieceBeats({ viewer: solid, piece: piece({ tier: MAKING_TIERS.solid, legend: 2 }) })
    ).toEqual({ beats: true })
    expect(
      pieceBeats({ viewer: solid, piece: piece({ tier: MAKING_TIERS.solid, legend: 1 }) })
    ).toEqual({ beats: false })
    expect(pieceBeats({ viewer: solid, piece: piece({ tier: MAKING_TIERS.rough }) })).toEqual({
      beats: false,
    })
  })

  it('a botched attempt of your own does not count as a best', () => {
    const only = me({
      experiences: [{ mediumId: 'tagging', tier: MAKING_TIERS.botched, legend: 0 }],
    })
    expect(pieceBeats({ viewer: only, piece: piece({ tier: MAKING_TIERS.rough }) })).toEqual({
      beats: true,
    })
  })
})
