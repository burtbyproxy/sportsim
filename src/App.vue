<template>
</template>

<script>

//	import TheNavbar from './components/navbar/TheNavbar.vue'

	export default {
		name: 'App',
		components: {
//			TheNavbar
		},
		data: function() {
			return {
			}
		},
		methods: {
			setBodyClass(className, newState) {
				const el = document.body;
				if (newState) {
					el.classList.add(className);
				} else {
					el.classList.remove(className);
				}
			}
		},
		mounted() {
			console.info('mounted');
			this.setBodyClass('ready', true);
		},
		destroyed() {
			this.setBodyClass('ready', false);
		}
	}

</script>

<style lang="scss" scoped>

</style>