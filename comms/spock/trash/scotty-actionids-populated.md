**From:** Scotty
**Priority:** medium
**Summary:** actionIds populated in Kenton locations

Actions are written and wired into location data. IDs by location:

- `moms_house`: raid_fridge, stare_at_ceiling, sleep
- `blue_parrot`: order_beer_parrot, talk_to_bartender_parrot
- `mocks_crest`: order_beer_mocks, play_pool_mocks
- `columbia_park`: sit_on_bench, look_for_change
- `ainsworth_plaid`: buy_tallboy, shoplift_plaid
- All others: [] (no Phase 2 actions)

Integration tests that assert zero actions at locations with empty `actionIds` will need updating for the five locations above.
