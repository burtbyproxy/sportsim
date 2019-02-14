<template>
	<form id="game-menu" class="game-menu-load">
		<fieldset class="menu-wrap">
			
			<legend>
				Choose a game to load.
			</legend>

			<p v-if="!games.length">
				There are no games for you to load.
			</p>

			<ul class="list-style"
				v-if="games.length">
				<li v-for="game in games"
					:key="game.id">
					{{ game.title }}
					<button @click="loadGame(game.id)">
						Load
					</button>
				</li>
			</ul>

			<div class="button-wrap">
				<router-link to="/">
					<button>Back</button>
				</router-link>
			</div>

		</fieldset>
	</form>
</template>

<script>

	export default {

		name: 'GameMenuLoad',

		data: function() {
			return {
				games: []
			};
		},

		methods: {
			
			deleteGame: function() {
				console.debug('deleting game...');
			},

			loadGame: function(target) {
				console.debug('loading game '+target+'...');
			}

		}

	}


</script>

<style lang="scss">

</style>