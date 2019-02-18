<template>
	<figure class="map-wrap neighborhood">
		<div class="img"
			@click="zoomIn('moms_house')" 
			style="
				background-image: url('/assets/img/map-neighborhood_bg.jpg');
				background-size: cover;
				background-repeat: no-repeat;
				background-position: center center;">
		</div>
		<figcaption class="map-controls">
			<button @click="zoomOut">
				Back
			</button>
		</figcaption>
	</figure>
</template>

<script>
	export default {
		name: 'MapNeighborhood',
		props: [
			'region_id',
			'neighborhood_id'
		],
		methods: {
			zoomIn: function(location_id) {
				this.$router.push('/map/'+this.region_id+'/'+this.neighborhood_id+'/'+location_id);
			},
			zoomOut: function() {
				this.$router.push('/map/'+this.region_id);
			}
		}
	}
</script>

<style>
	
</style>