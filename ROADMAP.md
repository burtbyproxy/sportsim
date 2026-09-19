# Roadmap

What comes next for sportsim, and what is decided but not built. The game is
a framework that takes content over time: each item below lands as a generic
mechanism plus content, never a one-off. What already shipped is in the git
history and the release tags.

## Next: 0.19.0 — curing

Marks (0.18.0) never wear off on their own. Curing is how one ends.

- Therapy is work: long, effortful and repeated.
- Shortcuts (self-hypnosis, brainwashing yourself) open up only once you
  find the right information.
- A cured mark changes status. It isn't deleted.

Still open: whether NPC free will (below) goes ahead of curing.

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

1. **NPC free will.** People start things. An NPC act is an event with an
   author: who does it (a character, or anyone with a persona or a mark in a
   fit), when (the same triggers marks use), and what it does (the existing
   outcome contract). Outcomes can land on characters, not only on the
   player.
2. **The fight.** Three phases, each a small game:
   - **Squaring off:** tit-for-tat that raises the heat. Whoever is in
     charge sets your options, and the side that cracks swings.
   - **The swing:** a contested roll with a big skill gap.
   - **The ground:** rolling around until somebody is on top or gets
     pulled off by whoever is there.

   Getting knocked out is a knock to the head (`dazed`) past a threshold.
   A bad fight is a trauma save.

3. **Instigating.** Feeding the heat between two other people. Topics and
   fits are the levers (bring up Kiss to Dennis mid-grudge). Watching is a
   show, and a fight can be an inspiration.
4. **Content.** Who fights, how each persona squares off, and the lines.

Open questions:

- Getting knocked out: where do you wake up, what time is it, and is
  anything gone from your pockets?
- After a fight: what does a bar do about you? Barred? Cops?

## Parked: the art system

Agreed direction, not scheduled:

- Real-time games for painting and drawing (a timing bar, flash recall).
  They need a new UI component.
- Display and reveal: the world's verdict on a piece is written once, the
  first time it goes up in front of strangers.
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
