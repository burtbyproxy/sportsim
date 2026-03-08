/**
 * Kenton neighborhood locations.
 * 17 locations in North Portland, year 2001.
 * Exported as a single object keyed by location ID.
 *
 * Exit travel times: 1 tick = 15 minutes of game time.
 * Adjacent/across-the-street: 1 tick.
 * Same block cluster: 1 tick.
 * Across the neighborhood: 2-3 ticks.
 */

export const kentonLocations = {

  moms_house: {
    id: 'moms_house',
    type: 'home',
    variant: 'house',
    display: "Mom's House",
    descriptions: {
      default: "The basement has a cot, a space heater that smells like burning dust, and a litter box in the corner that Dave — the cat — uses as a territorial statement. Your mom is upstairs. She is kind. She does not ask questions. Dave is not kind. Dave has irritable bowel syndrome and strong opinions about squatters.",
      night: "After midnight the furnace kicks on and shudders like it's thinking about giving up. Dave prowls the perimeter in the dark. You can hear him but you cannot see him. This is how Dave prefers it.",
      repeat: "You know this basement. You know every creak in the stairs, every draft from the window that doesn't quite close, every place Dave has marked. You are home. This is not a compliment.",
      drunk: "The basement tilts slightly. Dave watches you from the top of the dryer with an expression that suggests he has been waiting for exactly this.",
    },
    exits: [
      { locationId: 'blue_parrot',    label: 'Walk up Denver Ave to the Blue Parrot', travelTime: 1, requirements: null },
      { locationId: 'mocks_crest',    label: 'Cut across to Mock\'s Crest',            travelTime: 1, requirements: null },
      { locationId: 'columbia_park',  label: 'Head over to Columbia Park',             travelTime: 1, requirements: null },
      { locationId: 'toads_express',  label: 'Walk to Toad\'s Express',                travelTime: 2, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: true,
    availability: { openHour: 0, closeHour: 23, closedMessage: null },
    visitCount: 0,
  },

  blue_parrot: {
    id: 'blue_parrot',
    type: 'bar',
    variant: 'tavern',
    display: 'The Blue Parrot',
    descriptions: {
      default: "The Blue Parrot smells like decades of spilled beer fermented into the wood grain. The neon parrot in the window has one dead eye and the other flickers in a way that feels intentional, like it's winking at people it recognizes. There are four stools at the bar. One of them is broken. Nobody sits in the other three either.",
      night: "Karaoke night has a sound system that sounds like someone recorded a tape of a tape of a tape, and a song selection that tops out at 1987. A man in a Blazers jersey is murdering 'Livin' on a Prayer.' You can buy a cassette of your own performance for five bucks. Nobody does.",
      drunk: "The neon parrot winks at you. You wink back. This feels like an understanding.",
      repeat: "The bartender sees you and reaches for the Pabst without being asked. This is either efficiency or pity. Probably both.",
    },
    exits: [
      { locationId: 'moms_house',   label: 'Head back down Denver to Mom\'s',    travelTime: 1, requirements: null },
      { locationId: 'mocks_crest',  label: 'Cross the street to Mock\'s Crest',  travelTime: 1, requirements: null },
      { locationId: 'columbia_park', label: 'Walk over to Columbia Park',         travelTime: 1, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 11, closeHour: 2, closedMessage: "The Blue Parrot is dark. Even parrots sleep." },
    visitCount: 0,
  },

  mocks_crest: {
    id: 'mocks_crest',
    type: 'bar',
    variant: 'tavern',
    display: "Mock's Crest Tavern",
    descriptions: {
      default: "Mock's Crest is always busier than it has any right to be. The drinks cost a little more than the Parrot but they pour heavy and nobody tracks how many you've had. There's a taxidermied elk head above the bar that somebody put a Santa hat on around 1994. The hat is still there.",
      night: "By ten o'clock the volume has reached a point where conversation is a theory. Everybody is shouting. Nobody is listening. The elk watches all of it with the same expression.",
      drunk: "The elk head seems sympathetic. You are projecting.",
      repeat: "The bartender knows your order. You have feelings about this you cannot fully articulate.",
    },
    exits: [
      { locationId: 'blue_parrot',  label: 'Cross back to the Blue Parrot',  travelTime: 1, requirements: null },
      { locationId: 'moms_house',   label: 'Walk down to Mom\'s',            travelTime: 1, requirements: null },
      { locationId: 'columbia_park', label: 'Head to Columbia Park',          travelTime: 1, requirements: null },
      { locationId: 'arbys',        label: 'Walk south to Arby\'s',          travelTime: 2, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 11, closeHour: 2, closedMessage: "Mock's Crest is closed. The elk is unavailable." },
    visitCount: 0,
  },

  columbia_park: {
    id: 'columbia_park',
    type: 'park',
    variant: 'community',
    display: 'Columbia Park',
    descriptions: {
      default: "A large tree-lined park a block from Mom's. The kind of park that's pleasant at 2pm and complicated at 2am. Old-growth firs line the path. There's a playground with a broken swing that spins when there's no wind. During the day people walk dogs. At night, other things happen. You've been told not to make eye contact.",
      night: "The park after dark is a different ecology. Things move between the trees that are not animals. Or maybe they are animals. Hard to say. If you look like you know where you're going, nobody bothers you. Look lost and someone will find you.",
      drunk: "The trees are very large and very dark and the swing is spinning again. You find this beautiful. This is a sign.",
      exhausted: "The grass looks extremely comfortable. This is a trap. You know it's a trap. You sit down anyway.",
    },
    exits: [
      { locationId: 'moms_house',   label: 'Head back to Mom\'s',          travelTime: 1, requirements: null },
      { locationId: 'blue_parrot',  label: 'Walk to the Blue Parrot',      travelTime: 1, requirements: null },
      { locationId: 'mocks_crest',  label: 'Head to Mock\'s Crest',        travelTime: 1, requirements: null },
      { locationId: 'denver_711',   label: 'Walk to the Denver 7-11',      travelTime: 2, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 0, closeHour: 23, closedMessage: null },
    visitCount: 0,
  },

  mouse_trap: {
    id: 'mouse_trap',
    type: 'bar',
    variant: 'tavern',
    display: 'The Mouse Trap',
    descriptions: {
      default: "The Mouse Trap has five pool tables. This is three more pool tables than there are people, on a good day. The bar has been known to close without notice when the only bartender is in jail, which happens. The light fixtures are the kind that made sense in 1978. The carpet is the color of a mistake.",
      night: "The same three guys are here who were here last time. You're not sure they ever leave. One of them nods at you like you're old friends. You don't know his name.",
      drunk: "Pool suddenly seems achievable. You are wrong about this.",
      repeat: "You've memorized the exact pitch the third pool table makes when the cue ball drops into the corner pocket. You did not choose to learn this.",
    },
    exits: [
      { locationId: 'arbys',         label: 'Walk south to Arby\'s',        travelTime: 1, requirements: null },
      { locationId: 'toads_express', label: 'Head to Toad\'s Express',       travelTime: 2, requirements: null },
      { locationId: 'mocks_crest',   label: 'Walk north to Mock\'s Crest',   travelTime: 2, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 11, closeHour: 2, closedMessage: "The Mouse Trap is closed. Or the bartender is in jail again. Same thing." },
    visitCount: 0,
  },

  arbys: {
    id: 'arbys',
    type: 'restaurant',
    variant: 'fast',
    display: "Arby's",
    descriptions: {
      default: "What can you say about Arby's. The cheesy curly fries are a genuine achievement of American food science. This particular Arby's has tables with a slimy film that no amount of wiping fully removes. The bathroom situation is unclear. The clientele at this location tends toward the weathered.",
      night: "The late-night Arby's crowd is a specific demographic. You are part of it now. The overhead lights are very bright. Everyone looks worse than they did an hour ago.",
      drunk: "The curly fries have never been more important. You need them. This is clear.",
      starving: "There is food here. It costs money. This is the situation.",
    },
    exits: [
      { locationId: 'mocks_crest',   label: 'Walk north to Mock\'s Crest',  travelTime: 2, requirements: null },
      { locationId: 'mouse_trap',    label: 'Head to the Mouse Trap',        travelTime: 1, requirements: null },
      { locationId: 'toads_express', label: 'Walk to Toad\'s Express',       travelTime: 1, requirements: null },
      { locationId: 'ainsworth_plaid', label: 'Head to Plaid Pantry',        travelTime: 2, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 9, closeHour: 23, closedMessage: "Arby's is closed. The curly fries will have to wait." },
    visitCount: 0,
  },

  toads_express: {
    id: 'toads_express',
    type: 'fuel',
    variant: 'convenience',
    display: "Toad's Express",
    descriptions: {
      default: "Really just a cheap cigarette shop with an Astro gas station attached for optics. The clerk sits behind bulletproof glass. On weekends there's an armed guard by the door, which seems like a lot of security for a place that sells discount Marlboros, but here we are. A hand-lettered sign on the glass says 'No checks No exceptions.' It has been laminated.",
      night: "The fluorescent overheads outside buzz with insects. The guard watches the lot. You buy cigarettes through the sliding drawer. Nobody makes eye contact. It's efficient.",
      drunk: "The bulletproof glass reflects your face back at you. You look fine. Everything is fine.",
    },
    exits: [
      { locationId: 'moms_house',    label: 'Walk back toward Mom\'s',      travelTime: 2, requirements: null },
      { locationId: 'arbys',         label: 'Head to Arby\'s',              travelTime: 1, requirements: null },
      { locationId: 'mouse_trap',    label: 'Walk to the Mouse Trap',       travelTime: 2, requirements: null },
      { locationId: 'ainsworth_plaid', label: 'Head to Plaid Pantry',       travelTime: 2, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 0, closeHour: 23, closedMessage: null },
    visitCount: 0,
  },

  ainsworth_plaid: {
    id: 'ainsworth_plaid',
    type: 'market',
    variant: 'convenience',
    display: 'Plaid Pantry',
    descriptions: {
      default: "This Plaid Pantry is indistinguishable from every other Plaid Pantry. That is not an accident. The design is intentional, a franchise commitment to radical sameness. The staff pays you minimal attention. This is either customer service philosophy or just the vibe. Either way, you can stand in front of the hot dog rollers for a long time without anyone asking you to leave.",
      night: "The night clerk reads a paperback with a spaceship on the cover. He does not look up when you come in. He does not look up when you leave. The hot dogs have been rotating since morning.",
    },
    exits: [
      { locationId: 'toads_express', label: 'Walk to Toad\'s Express',      travelTime: 2, requirements: null },
      { locationId: 'arbys',         label: 'Head to Arby\'s',              travelTime: 2, requirements: null },
      { locationId: 'denver_711',    label: 'Walk to Denver 7-11',          travelTime: 2, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 0, closeHour: 23, closedMessage: null },
    visitCount: 0,
  },

  denver_711: {
    id: 'denver_711',
    type: 'market',
    variant: 'convenience',
    display: '7-11',
    descriptions: {
      default: "The Denver Ave 7-11 is the kind of place where the Slurpee machine is always one flavor from being completely out of something. The parking lot has good light, which means it sees a lot of business after the bars close. The dumpster out back is not locked. You have noticed this.",
      night: "Post-bar crowd cycles through in waves. Drunk people making decisions about nachos. You are one of these people, or close enough.",
      drunk: "The Slurpee machine is right there. This is important information.",
    },
    exits: [
      { locationId: 'columbia_park',   label: 'Walk to Columbia Park',       travelTime: 2, requirements: null },
      { locationId: 'ainsworth_plaid', label: 'Head to Plaid Pantry',        travelTime: 2, requirements: null },
      { locationId: 'greeley_711',     label: 'Walk south to the Greeley 7-11', travelTime: 3, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 0, closeHour: 23, closedMessage: null },
    visitCount: 0,
  },

  greeley_711: {
    id: 'greeley_711',
    type: 'market',
    variant: 'convenience',
    display: '7-11',
    descriptions: {
      default: "This 7-11 is cleaner than it has any right to be. The shelves are fully stocked. Two guys work every shift and they are both genuinely friendly, which is disorienting in a convenience store context. There are always more cars in the lot than there are people inside. You have wondered about this and then stopped wondering because some things don't require an answer.",
      night: "The night shift guys keep the coffee fresh. They nod at you. You nod back. This is a relationship.",
    },
    exits: [
      { locationId: 'denver_711',   label: 'Walk north to Denver 7-11',   travelTime: 3, requirements: null },
      { locationId: 'greeley_plaid', label: 'Walk to the Greeley Plaid',   travelTime: 1, requirements: null },
      { locationId: 'glitters',     label: 'Head to All That Glitters',   travelTime: 2, requirements: null },
      { locationId: 'dancin_bare',  label: 'Walk to the Dancin\' Bare',   travelTime: 2, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 0, closeHour: 23, closedMessage: null },
    visitCount: 0,
  },

  greeley_plaid: {
    id: 'greeley_plaid',
    type: 'market',
    variant: 'convenience',
    display: 'Plaid Pantry',
    descriptions: {
      default: "The Greeley Plaid is not the same as the Ainsworth Plaid despite being the same chain selling the same products under the same lighting. The difference is difficult to articulate and probably not real. The clerk here seems to recognize you even if you've never been in before. Maybe you just have one of those faces.",
      night: "Quieter than the other Plaid. The kind of quiet that's just the refrigeration units humming.",
    },
    exits: [
      { locationId: 'greeley_711',  label: 'Walk to Greeley 7-11',        travelTime: 1, requirements: null },
      { locationId: 'glitters',     label: 'Walk to All That Glitters',   travelTime: 1, requirements: null },
      { locationId: 'liquor',       label: 'Head to Kenton Liquor',       travelTime: 2, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 0, closeHour: 23, closedMessage: null },
    visitCount: 0,
  },

  glitters: {
    id: 'glitters',
    type: 'market',
    variant: 'pawn',
    display: 'All That Glitters',
    descriptions: {
      default: "A pawn shop run by two Egyptian brothers who wear rayon shirts and will buy almost anything without asking about its origins. Outside, a blonde mannequin holds a spinning sign that reads 'Grate Deals.' The sign has been there for years. The misspelling has also been there for years. Nobody has mentioned it. Nobody will.",
      night: "Closed. The mannequin stays outside regardless. She is always on duty.",
      repeat: "The brothers have started to recognize you. One of them nods. You take this as a good sign and are probably right.",
    },
    exits: [
      { locationId: 'greeley_plaid', label: 'Walk back to Greeley Plaid',  travelTime: 1, requirements: null },
      { locationId: 'greeley_711',   label: 'Head to Greeley 7-11',        travelTime: 2, requirements: null },
      { locationId: 'liquor',        label: 'Walk to Kenton Liquor',       travelTime: 2, requirements: null },
      { locationId: 'dancin_bare',   label: 'Walk to the Dancin\' Bare',   travelTime: 1, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 9, closeHour: 18, closedMessage: "All That Glitters is closed. The mannequin remains." },
    visitCount: 0,
  },

  dancin_bare: {
    id: 'dancin_bare',
    type: 'bar',
    variant: 'exotic',
    display: "The Dancin' Bare",
    descriptions: {
      default: "Portland has more strip clubs per capita than anywhere in the country, and the Dancin' Bare represents the genre at its least glamorous. There are steak bites for two dollars. There is a pool table that is inexplicably zig-zag shaped. Amateur night runs on Thursdays and patrons throw spare change onto the stage, which is either the most degrading thing you've witnessed or a reasonable tipping system depending on how you look at it.",
      night: "The amateur night crowd has a specific energy. Enthusiastic. Generous with coinage. The zig-zag pool table sees heavy use.",
      drunk: "You are at the Dancin' Bare. You got here somehow. The steak bites are two dollars.",
    },
    exits: [
      { locationId: 'glitters',    label: 'Walk to All That Glitters',    travelTime: 1, requirements: null },
      { locationId: 'greeley_711', label: 'Head to Greeley 7-11',         travelTime: 2, requirements: null },
      { locationId: 'liquor',      label: 'Walk to Kenton Liquor',        travelTime: 2, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 11, closeHour: 2, closedMessage: "The Dancin' Bare is dark. No steak bites tonight." },
    visitCount: 0,
  },

  liquor: {
    id: 'liquor',
    type: 'market',
    variant: 'liquor',
    display: 'Kenton Liquor Store',
    descriptions: {
      default: "Oregon liquor stores are state-run, which means the same drab layout, the same price, the same slightly hostile efficiency everywhere you go. The Kenton location has a clerk who looks like he's been working here since the state acquired it and sees no reason to change jobs now. The selection is adequate. The prices are what they are.",
      night: "Closes at nine. Which you keep forgetting until you walk up and the lights are off.",
      repeat: "The clerk does not recognize you. This is either because he doesn't look at faces or because you are not distinctive. You've decided it's the former.",
    },
    exits: [
      { locationId: 'greeley_plaid', label: 'Walk to Greeley Plaid',      travelTime: 2, requirements: null },
      { locationId: 'glitters',      label: 'Head to All That Glitters',  travelTime: 2, requirements: null },
      { locationId: 'dancin_bare',   label: 'Walk to the Dancin\' Bare',  travelTime: 2, requirements: null },
      { locationId: 'lombard_dental', label: 'Walk to Lombard Dental',    travelTime: 2, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 9, closeHour: 21, closedMessage: "The Oregon Liquor Control Commission has closed this location for the night." },
    visitCount: 0,
  },

  lombard_dental: {
    id: 'lombard_dental',
    type: 'clinic',
    variant: 'dental',
    display: 'Lombard Dental',
    descriptions: {
      default: "The waiting room has a fish tank where one fish circles endlessly and the other fish do not move. There are magazines from 1997. A sign says 'Financing Available' and underneath, someone has written in ballpoint pen, 'You'll need it.' The receptionist has heard all the jokes about dentists and has achieved a kind of transcendence beyond them.",
      night: "Closed. The fish continue regardless.",
    },
    exits: [
      { locationId: 'liquor',        label: 'Walk to Kenton Liquor',      travelTime: 2, requirements: null },
      { locationId: 'chief_joseph',  label: 'Walk past Chief Joseph',     travelTime: 1, requirements: null },
      { locationId: 'abundant_life', label: 'Head to Abundant Life Church', travelTime: 2, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 8, closeHour: 17, closedMessage: "Lombard Dental is closed. Your tooth will keep until morning." },
    visitCount: 0,
  },

  chief_joseph: {
    id: 'chief_joseph',
    type: 'school',
    variant: 'elementary',
    display: 'Chief Joseph Elementary',
    descriptions: {
      default: "An elementary school. You are not a child and have no business here. The chain-link fence runs the length of the block. The playground equipment is the solid metal kind from the seventies that you could break an arm on. The school day ends at 3pm. After that, the yard is technically public. You try not to look suspicious. This is harder than it sounds.",
      night: "The school is dark. The playground is accessible. Sitting on a metal slide at midnight is a legitimate activity if you keep it moving.",
    },
    exits: [
      { locationId: 'lombard_dental', label: 'Walk to Lombard Dental',    travelTime: 1, requirements: null },
      { locationId: 'abundant_life',  label: 'Head to Abundant Life Church', travelTime: 1, requirements: null },
      { locationId: 'moms_house',     label: 'Walk back toward Mom\'s',   travelTime: 3, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 0, closeHour: 23, closedMessage: null },
    visitCount: 0,
  },

  abundant_life: {
    id: 'abundant_life',
    type: 'church',
    variant: 'christian',
    display: 'Abundant Life Church',
    descriptions: {
      default: "A Pentecostal church in a converted storefront. The sign out front changes weekly with a new message — not scripture, exactly, more like scripture adjacent. Something that sounds like it should be a verse but isn't. Inside, on Sundays, there is singing that you can hear from half a block away. The pastor has a handshake like a vice and remembers every name. Every one.",
      night: "Dark except for a light in the pastor's office, which is always on.",
      repeat: "The pastor sees you coming. He has already remembered your name. This should not be as unsettling as it is.",
    },
    exits: [
      { locationId: 'chief_joseph',  label: 'Walk past the school',       travelTime: 1, requirements: null },
      { locationId: 'lombard_dental', label: 'Walk to Lombard Dental',    travelTime: 2, requirements: null },
      { locationId: 'moms_house',    label: 'Walk back toward Mom\'s',    travelTime: 3, requirements: null },
    ],
    npcSlots: [],
    actionIds: [],
    discovered: false,
    availability: { openHour: 8, closeHour: 20, closedMessage: "The church doors are closed. The light in the pastor's office is on." },
    visitCount: 0,
  },

};

export default kentonLocations;
