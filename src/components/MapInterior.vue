<template>
	<figure class="map-wrap interior">
		<div class="img"
			style="
				background-image: url('/assets/img/map-interior_bg.jpg');
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
		name: 'MapInterior',
		props: [
			'region_id',
			'neighborhood_id',
			'location_id',
			'interior_id'
		],
		methods: {
			zoomOut: function() {
				this.$router.push('/map/'+this.region_id+'/'+this.neighorhood_id+'/'+this.location_id);
			}
		}
	}
</script>

<style>
	
</style>