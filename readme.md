# SportSim

## Summary

See how far you can take one slacker in Portland's turn of the millenium art scene.

## About

### The Setting

Portland, Oregon, 2001... an artistic odyssey. Make your way through the outwardly pleasant yet truly antagonistic confines of the whitest city in America, with nothing but your presumed good looks and natural brilliance, creativity, and confidence in the importance of your own unique artistic vision.

### Gameplay

You start out in your mom's basement, with a couple of bucks and a few meager possessions. Technology-wise you have a flip phone and an old computer that needs an upgrade. You have a several acquaintances, local and long distance, no real friends but several enemies. You vaguely remember hitting rock bottom the previous day, and on your way back to mom's you found a nice heavy piece of wood. Mom got you a set of paints from your Grandma, and left it in the basement with an encouraging note.

From this point you can venture out looking for work, make some art, build some friendships, sit around doing nothing, write poetry, commit a crime, I mean basically whatever. As you explore locations throughout the city, you will meet a huge cast of characters with lousy memories. THey'll forget you eventually so as long as you don't come around the same places too often you can basically get away with murder.

### Features

- Friends who hate you!
- Family that support you (and hate you)!
- Significant others who hate themselves!
- So much hate to go around, we might need to add a trigger warning!
- Urinate on the bus!
- Eat so much beef jerky!
- Get caught stealing from the dollar store!
- Come back later that day anyways!
- Cultivate one way relationships with bartenders!
- Sleep outside on discarded mattresses!
- Get hit by random objects (treasures) from passing cars!
- Try to make crack!
- Scrape together enough money to blow it all at the nearest strip bar!
- Punch telephone poles!
- Accidental cab rides in luxury automobiles!
- Sometimes you might even manage to make some artwork!
- Curate your momma!
- Hotbox outside the police station!
- So much more...

### FAQ

1. Why the fuck did you call this SportSim when it has nothing to do with sports?  
   **I beg to differ. The art scene in Portland, during that time period, was one of the most vicious competitive sports ever devised. The fact that it wasn't televised is a national tragedy. Although many have criticized the fact that without figuratively and sometimes literally sucking a filthy cock was the only way to get ahead in the art scene, this is what made it so glorious. A true sport of kings, anyone at any time could be savagely obliterated for fun and profit in front of their crowds of supporters, and never in the history of the world could a man, woman, or other with so little talent for their chosen trade soar to such heights on the wings of nothing more than social maneuvering. And now you can fucking live it.**

2. Isn't this all a bit of an exaggeration?  
   **Listen here, millenial, I was THERE alright? I lived this shit. I realize that in the modern, insulated, cookie cutter world we live in today, the events that take place within this simulation are difficult to believe. I get it, I understand how life is now. That doesn't change the fact that back in those days, in that town, all you had to do was hang around somewhere long enough and shit would get crazy. This was all before Portlandia, and the migration that followed, remember. There were so many parking spots. So many stools open at every bar... and so many opportunities to become worshipped as a locally famous artist.**

## Running it

You need Node (the exact version is in `.nvmrc`) and, for the conformance gate, Go (the version is in `tools/go.mod`).

```sh
npm ci              # install
npm run dev         # play it at the address Vite prints
npm run build       # the static site, in dist/
```

### The gates

Nothing merges without all four passing. The pre-commit hook runs them, and so does CI.

```sh
npm run lint                            # ESLint with the Boundary-First Development preset
npm run format:check                    # Prettier
npm run test:run                        # every test, once
"$(go -C tools tool -n bfd)" conform    # bfd conform, pinned in tools/go.mod
```

### Where the game lives

Everything the player reads or meets is content, under `content/`: the map and its places, actions and events, the people, items, substances, voices, and the numbers the engines run on (`content/tuning.json`). Adding to the game means adding content; the tests under `tests/content/` check every file against its contract.
