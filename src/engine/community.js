/**
 * Community Engine — art is community.
 *
 * Other artists are going around making pieces and performing. Anyone
 * with skill in a medium can make in it (the acts engine opens the door;
 * this engine does the making): a check on their skill, a tier, a piece
 * on a surface where they are, or nothing but the doing, in the words of
 * whoever is in charge of them. The world judges it like the player's.
 *
 * And there is the nemesis: another artist, in your style, who is better
 * than you, or at least that is what you keep telling yourself. It does
 * not matter what other people say. You see their piece and you feel you
 * have something to chase or prove. Seeing a piece in your medium that
 * beats your best is a save; fail it and it is an obsession about that
 * person, love or hate. The same from the other side: somebody sees yours
 * and it beats theirs, and now they think you are the best, or hate you.
 *
 * Pure functions. No side effects. No Vue. No DOM. Every public function
 * takes a single input struct; the ones that can fail return a result
 * struct (ok/data/error).
 */

import { v4 as uuidv4 } from 'uuid'
import { resultOk, resultFail } from './result.js'
import { skillCheckRoll } from './skills.js'
import { pieceDescribe } from './describer.js'
import {
  ARTIFACT_KINDS,
  ARTIFACT_STATUSES,
  EXPERIENCE_STATUS_REMEMBERED,
  MAKING_SURFACE_KINDS,
  MAKING_TIERS,
  SURFACE_ARTIFACTS,
  makingTierFrom,
  marksCover,
} from './making.js'
import { blendSober } from './blend.js'

/** Enumerated error codes for every community result. The code is the contract. */
export const COMMUNITY_ERROR_CODES = Object.freeze({
  characterMissing: 'CHARACTER_MISSING',
  mediumUnknown: 'MEDIUM_UNKNOWN',
  nowhereToMake: 'NOWHERE_TO_MAKE',
})

/** How tiers rank against each other, for who is better. */
const TIER_RANK = Object.freeze({
  [MAKING_TIERS.botched]: 0,
  [MAKING_TIERS.rough]: 1,
  [MAKING_TIERS.solid]: 2,
  [MAKING_TIERS.inspired]: 3,
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The media somebody has any skill in: the ones they are an artist in.
 * @param {{ subject: Object }} input
 * @returns {string[]}
 */
export function artistMediumIds({ subject }) {
  return Object.entries(subject?.skills ?? {})
    .filter(([, cells]) => Object.values(cells ?? {}).some((cell) => (cell?.base ?? 0) > 0))
    .map(([mediumId]) => mediumId)
}

/**
 * Where somebody could make in a medium at a place: the first surface
 * that takes it, or the place itself for a medium done anywhere, or nothing.
 * @param {{ location: Object, medium: Object }} input
 * @returns {{ surfaceKind: string, surface: Object|null }|null}
 */
export function makingSpotFind({ location, medium }) {
  const surface = (location?.surfaces ?? []).find((s) => (s.mediumIds ?? []).includes(medium.id))
  if (surface) return { surfaceKind: MAKING_SURFACE_KINDS.location, surface }
  if (medium.making.anywhere) return { surfaceKind: MAKING_SURFACE_KINDS.place, surface: null }
  return null
}

/**
 * Somebody makes something, here, now. One check on their skill in the
 * medium, a tier, the words in the voice of whoever is in charge of them,
 * a piece on the surface (covering what was there), or nothing but the
 * doing. Nothing is applied here; the marks and the experience come back.
 *
 * @param {{
 *   tuning: Object,
 *   character: Object,
 *   mediumId: string,
 *   mediums: Object<string, Object>,
 *   location: Object,
 *   voices: Object<string, Object>,
 *   gameTime: { tick: number },
 *   rng: () => number,
 * }} input
 * @returns {{ ok: boolean, data: {
 *   artifact: Object|null,
 *   experience: Object,
 *   marks: Object[],
 *   tier: string,
 *   check: Object,
 * }|null, error: Object|null }}
 *   marks — the place's marks after, with the new piece on them when it left one
 */
export function pieceMakeByCharacter({
  tuning,
  character,
  mediumId,
  mediums,
  location,
  voices,
  gameTime,
  rng,
}) {
  if (!character) {
    return resultFail({
      code: COMMUNITY_ERROR_CODES.characterMissing,
      message: 'pieceMakeByCharacter needs a character',
    })
  }
  const medium = mediums[mediumId]
  if (!medium) {
    return resultFail({
      code: COMMUNITY_ERROR_CODES.mediumUnknown,
      message: `Unknown medium '${mediumId}'`,
      params: { mediumId },
    })
  }
  const spot = makingSpotFind({ location, medium })
  if (!spot) {
    return resultFail({
      code: COMMUNITY_ERROR_CODES.nowhereToMake,
      message: `Nowhere at '${location?.id}' to make ${mediumId}`,
      params: { locationId: location?.id ?? '', mediumId },
    })
  }
  const rolled = skillCheckRoll({
    tuning,
    player: character,
    mediumId,
    mediums,
    dc: medium.making.dc,
    modifiers: [],
    rng,
  })
  if (!rolled.ok) return rolled
  const check = rolled.data
  const tier = makingTierFrom({ check })
  const blend = character.blend ?? blendSober()
  const words = pieceDescribe({
    tier,
    medium,
    tool: null,
    surface: spot.surface ?? location,
    ingredient: null,
    personaId: blend.dominantPersonaId,
    voices,
  })
  if (!words.ok) return words

  const tick = gameTime.tick
  const leaves =
    spot.surfaceKind === MAKING_SURFACE_KINDS.place
      ? SURFACE_ARTIFACTS.none
      : (spot.surface.artifact ?? SURFACE_ARTIFACTS.fixed)
  const leavesArtifact =
    medium.making.leavesArtifact &&
    leaves === SURFACE_ARTIFACTS.fixed &&
    tier !== MAKING_TIERS.botched
  const experienceId = uuidv4()
  const artifact = leavesArtifact
    ? {
        id: uuidv4(),
        status: ARTIFACT_STATUSES.fresh,
        kind: ARTIFACT_KINDS.fixed,
        makerId: character.id,
        experienceId,
        makingId: null,
        mediumId,
        toolItemId: null,
        surfaceKind: spot.surfaceKind,
        surfaceId: spot.surface.id,
        ingredientItemId: null,
        tier,
        madeAtLocationId: location.id,
        workText: words.data.workText,
        artistText: words.data.artistText,
        reception: null,
        legend: 0,
        ideaText: null,
        shownAtTick: null,
        shownAtLocationId: null,
        endedBy: null,
        createdAtTick: tick,
        updatedAtTick: tick,
      }
    : null
  const experience = {
    id: experienceId,
    status: EXPERIENCE_STATUS_REMEMBERED,
    kind: 'making',
    makerId: character.id,
    makingId: null,
    inspirationId: null,
    mediumId,
    tier,
    check,
    personaSnapshot: JSON.parse(JSON.stringify(blend)),
    dominantPersonaId: blend.dominantPersonaId,
    locationId: location.id,
    artifactId: artifact ? artifact.id : null,
    workText: words.data.workText,
    artistText: words.data.artistText,
    reception: null,
    legend: 0,
    ideaText: null,
    shownAtTick: null,
    shownAtLocationId: null,
    createdAtTick: tick,
    updatedAtTick: tick,
  }
  let marks = [...(location.marks ?? [])]
  if (artifact) {
    const markIdsCovered = marks
      .filter(
        (m) =>
          m.surfaceId === artifact.surfaceId &&
          [ARTIFACT_STATUSES.fresh, ARTIFACT_STATUSES.defaced].includes(m.status)
      )
      .map((m) => m.id)
    marks = [
      ...marksCover({
        location,
        markIdsCovered,
        coveredBy: { kind: 'mark', id: artifact.id },
        gameTime,
      }),
      artifact,
    ]
  }
  return resultOk({ artifact, experience, marks, tier, check })
}

/**
 * Whether a piece by somebody else, in a medium the viewer works in,
 * beats the viewer's best in it: a higher tier, or the same tier with
 * more legend, or anything at all when the viewer has never finished one.
 * What other people said about it does not come into it: it is what the
 * viewer sees. A viewer with no skill in the medium sees nothing to chase.
 *
 * @param {{ viewer: Object, piece: Object }} input
 *   piece — an artifact or experience with a mediumId, tier and legend
 * @returns {{ beats: boolean }}
 */
export function pieceBeats({ viewer, piece }) {
  if (!viewer || !piece || piece.makerId === viewer.id) return { beats: false }
  if (!artistMediumIds({ subject: viewer }).includes(piece.mediumId)) return { beats: false }
  const own = (viewer.experiences ?? []).filter(
    (e) => e.mediumId === piece.mediumId && e.tier !== MAKING_TIERS.botched
  )
  if (own.length === 0) return { beats: true }
  const best = { rank: -1, legend: 0 }
  for (const e of own) {
    const rank = TIER_RANK[e.tier] ?? 0
    if (rank > best.rank || (rank === best.rank && (e.legend ?? 0) > best.legend)) {
      best.rank = rank
      best.legend = e.legend ?? 0
    }
  }
  const rank = TIER_RANK[piece.tier] ?? 0
  return { beats: rank > best.rank || (rank === best.rank && (piece.legend ?? 0) > best.legend) }
}
