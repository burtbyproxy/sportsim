<template>
	<figure class="map-wrap world">
		<div class="img"
			@click="zoomIn('north')"
			style="
				background-image: url('/assets/img/map-world_bg.jpg');
				background-size: cover;
				background-repeat: no-repeat;
				background-position: center center;
			">		
		</div>
		<figcaption class="map-controls">
			<button @click="zoomOut" disabled>
				Back
			</button>
		</figcaption>
	</figure>
</template>

<script>
	export default {
		name: 'MapWorld',
		methods: {
			zoomIn: function(region_id) {
				this.$router.push('/map/'+region_id);
			},
			zoomOut: function() {
				console.log('cannot zoom out');
			}
		}
	}
</script>

<style>
	
</style>