<template>
	<form id="game-menu">
		<fieldset class="menu-wrap">
			
			<div class="button-wrap">
				<button @click="newGame">New Game</button>
			</div>
			
			<div class="button-wrap">
				<router-link to="/load">
					<button>Load Game</button>
				</router-link>
			</div>
			
			<div class="button-wrap">
				<router-link to="/settings">
					<button>Settings</button>
				</router-link>
			</div>
			
			<div class="button-wrap">
				<button @click="quitGame">Quit</button>
			</div>

		</fieldset>
	</form>
</template>

<script>

	export default {

		name: 'MenuGame',

		methods: {
			
			newGame: function() {
				console.debug('starting new game...');
				this.$router.push('/map')

			},

			showSubMenu: function(target) {
				console.debug('showing sub menu '+target+'...');
			},

			quitGame: function() {
				console.debug('quitting game...');
			}

		}

	}


</script>

<style lang="scss">

</style>