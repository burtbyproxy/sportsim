<template>
	<form id="game-menu" class="game-menu-settings">
		<fieldset class="menu-wrap">
			
			<legend v-if="settings.length">
				Game Settings
			</legend>

			<p v-if="!settings.length">
				There are no settings for you to change.
			</p>
			
			<ul class="list-style"
				v-if="settings.length">
				<li v-for="setting in settings"
					:key="setting.id">
					{{ setting.title }}
				</li>
			</ul>

			<div class="button-wrap">
				<button @click="saveSettings">
					Save Changes
				</button>
			</div>

			<div class="button-wrap">
				<router-link to="/">
					<button>
						Back
					</button>
				</router-link>
			</div>

		</fieldset>
	</form>
</template>

<script>

	export default {

		name: 'MenuGameSettings',

		data: function() {
			return {
				settings: []
			};
		},

		methods: {
			
			saveSettings: function() {
				console.debug('saving settings...');
			}

		}

	}


</script>

<style lang="scss">

</style>