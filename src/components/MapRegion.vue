<template>
	<figure class="map-wrap region">
		<div class="img" 
			@click="zoomIn('kenton')"
			style="
				background-image: url('/assets/img/map-region_bg.jpg');
				background-size: cover;
				background-repeat: no-repeat;
				background-position: center center;
			">
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
		name: 'MapRegion',
		props: [
			'region_id'
		],
		methods: {
			zoomIn: function(neighborhood_id) {
				this.$router.push('/map/'+this.region_id+'/'+neighborhood_id);
			},
			zoomOut: function() {
				this.$router.push('/map');
			}
		}
	}
</script>

<style>
	
</style>