# Roadmap

What comes next for sportsim, and what is decided but not built. The game is
a framework that takes content over time: each item below lands as a generic
mechanism plus content, never a one-off. What already shipped is in the git
history and the release tags.

## Next: story and legend

Art is the whole point. Display, reveal and community shipped (below);
the next art unit is story and legend: ingredients that add story, techniques known
per persona, pieces that sell on story times legend, and telling the
story as an action where the story changes. Then the real-time games
for painting and drawing, which need a new UI component.

NPCs getting themselves help is parked with its design (a lot of
friction, like losing weight).

## Shipped: 0.28.0 — art is community

Other artists are going around making pieces and performing. Anyone
with skill in a medium is an artist in it (`skills` on a character), and
an act can make (`make: { mediumId }` on a branch): a check on their
skill, a tier, a piece on a surface where they are with their name on
it, or nothing but the doing, in the words of whoever is in charge of
them. The world judges it there and then, like yours. You find their
pieces up on walls and see them go up, and hear them done, when you are
in the room.

And the nemesis. Seeing another artist's piece in your medium that
beats your best is a save (`tuning.community.rivalry`); fail it and it
is an obsession about that person, love or hate. It does not matter
what other people said about it: it is what you see. The same from the
other side: an artist in the room who sees yours shown and beaten may
come away with an obsession about you. Marks can be about the player
now. The fan and the rival are the same machinery as everything else
that stays with a person.

## Shipped: 0.27.0 — judged live, and the world helps itself

Art is as much performance as painting. A performance leaves no object,
so its verdict lands live, at the finish, from the room: karaoke,
freestyle, singing, a performance in the corner by the jukebox. And the
world acts on what is left in it: a shown piece with legend on a wall in
front of strangers can meet a fate (`tuning.display.fates`, a table:
stolen, defaced, whatever content names), each at its legend's chance
per tick. Stolen is the best compliment there is, and it still sucks
when you're broke. Defaced is still up, with somebody's opinion on it.
You find out when you look.

Parked with its design: permission and opportunity. Walls come from
people; showing a piece to a person is its own act, and the sanctioned
wall is what you earn. The fuck-it hanging stays.

## Shipped: 0.26.0 — display and reveal

Making produces only the artist's text. What anybody else sees is
written once, when the piece goes up in front of strangers, and never
again. Every place says who is there to see it (`venue`): strangers are
the world, friends are not, so a piece shown at mom's is not shown. Put
something up and the menu becomes what could go up; the verdict is a
check of your standing against the venue, bent by how the piece came
out, and reads praised, ignored or mocked, in the voice of whoever is in
charge. Showing transforms the piece: the world's words replace the
artist's and the idea survives only as story. Legend lands on the piece,
which is what it will one day sell on. Mocked in front of strangers is
the kind of thing that stays with you. A wall in front of the world
shows itself the moment it goes up.

## Shipped: 0.25.0 — who fights, and how each persona squares off

Who would, and who would not: a trigger can read a stat, so the grudge
only swings in somebody tough enough. Whoever is in charge sets your
options: a fight's compulsions grey a choice with the persona's reason,
the way the making games do. The priest will not let you walk, and will
not let you needle; mr. cool will not swing first; the yeller finds a
needle too subtle; the telepath cannot get closer; the host will not
swing with a drink in hand. Seven persona catalogs gained their own
fight lines.

## Shipped: 0.24.0 — instigating

The player's real skill. The talk in the room is the lever: with Kiss on
the menu at Mock's, Dennis's grudge goes off, and a grudge in a fit can
swing at whoever is nearest (an act whose branch starts a fight). Two
other people fighting is told from the bar stool, and watching gets in:
a mood, and an idea. When the world comes at the player there is no
squaring off, and if somebody comes at you, you're probably getting
knocked out. The world's fights carry the player home, or out the door,
once the tick that started them ends. A character knocked out is carried
home for the knockout's hours, whatever the schedule says.

## Shipped: 0.23.0 — the fight

Real fights, as they actually go. Start something with whoever you have
picked out and the menu becomes the squaring off: each round a jab
(content, a contest of one stat against another) puts its heat on the
loser, and everything gets hotter regardless. The side whose heat reaches
the line cracks and swings first, at a penalty, because throwing first
makes you reactive. Walk away while you can; swing first if you must. The
swing and the ground are not chosen: one contest, a knock to the head,
and past the line it is over where you fall; otherwise rolling around
until somebody is on top enough, or whoever is there pulls you apart. The
loser takes the toll and a save. A bar 86's you for a while, never cops.
Knocked out, you always wake up at mom's: the basement, a bush, the front
yard. You're a raccoon.

## Shipped: 0.22.0 — nothing happens in one sitting

A cure has a cadence and a lapse. Therapy is one session a day; let three
days go by and a session slides back. The shortcut has no cadence, and
that is the trap: a session that slips on the tape is a save against the
insanity table, and what it leaves is not announced. You can make
yourself a different crazy and not know it.

## Shipped: 0.21.0 — curing

Marks never wear off on their own. A cure (`content/cures`) is how one
ends: which kinds of mark it reaches, how many sessions it takes, and what
a session is (its time, its check, its price, what it takes out of you).
A cure is a door on the menu (an action of kind `cure`); through it, the
marks it can reach. Progress is on the mark, per cure, and a session that
slips can set it back. The count reached changes the mark's status to
cured: it stays, as what happened, and stops doing anything.

- Therapy is a word with the pastor: six sessions, an hour each, and it
  takes something out of you every time.
- The shortcut is a self-hypnosis tape found in mom's basement: two
  sessions, but a slip costs one, and it only reaches fears, obsessions
  and neuroses.

## Shipped: 0.20.0 — NPC is PC lite

Everyone with vitals lives the player's day. The schedule stands in for
the menu: what the player does by choosing, a character does by standing
somewhere. A stop's type is what it does per tick (`tuning.simulation.stops`):
home rests and feeds, the bar puts beer in them, food feeds, the park and
company lift the mood. Off the map is home. The wear is the player's own
decay, at the player's rates, and what goes in wears off the way it does
for the player. When the player spends two hours, everyone lives two hours,
stop by stop. Routine and full tiers both live; fixed stays a post.

## Planned: battles

Real fights, as they actually go: a short squaring off (insults,
antagonizing), a frantic little moment of fighting, then one guy on the other
rolling around on the ground. Fast, and boring.

- The player is not a good fighter. A good fighter wins regardless, and if
  somebody comes at you, you're probably getting knocked out.
- The player is good at getting people to fight: instigating, including
  getting two other people to go at each other, and using that.
- Throwing first is probably bad, because it makes you reactive. That
  belongs in tuning, not in code.

In order:

1. **NPC free will.** Shipped in 0.19.0. People start things: an act
   (`content/acts`) has an author (a character, anyone with a persona in
   charge, anyone with a mark in a fit), goes off in the author's own scene
   on the triggers marks use, and is done to the player, to the mark's
   target, to anyone present, or to nobody. With a check it is a contest,
   the author's stat against the recipient's. Outcomes land on characters
   as well as the player: vitals, stats, doses, a knock to the head, a
   trauma save. The player hears of it only in the room. The talk around
   the player is now the talk around everyone in the room, which is the
   instigation lever.
2. **The fight.** Shipped in 0.23.0 (`content/fights`, `tuning.fight`,
   `game.json` `knockout.spots`). Squaring off is the only part with
   choices; the swing and the ground follow at once. Knocked out is
   `dazed` past a line; a bad fight is a trauma save.

3. **Instigating.** Shipped in 0.24.0. Topics and fits are the levers; an
   act's branch can start a fight (`fight: { fightId }`); watching is an
   outcome on the fight (`watched`).
4. **Content.** Shipped in 0.25.0: a stat trigger for who fights, fight
   compulsions for how each persona squares off, and the lines.

Answered: knocked out, you always wake up at mom's, hours later; a bar
86's you for a while; never cops. Nothing goes missing from your pockets
until Steve says otherwise.

## Parked: the art system

Agreed direction, not scheduled:

- Real-time games for painting and drawing (a timing bar, flash recall).
  They need a new UI component.
- Story and legend: techniques known per persona, ingredients that add
  story, pieces that sell on story × legend, and telling the story as an
  action where the story changes.
- The rumor quest about controlling inspiration (the answer is benign).

## Parked: other

- What archetypes do: they accrue from what you keep doing, but nothing
  reads them yet.
- Voice catalogs for the personas that have none (golden, headache, hollow,
  shakes, sleepwalker, tortured, train_wreck), and for the fit personas
  marks added in 0.18.0.
- Content packs: the loader reads only `content/`.
- A reference of voice codes and their params, for whoever writes lines.
