import Vue from 'vue';
import VueRouter from 'vue-router';

import MenuGame from './components/MenuGame.vue';
import MenuGameSettings from './components/MenuGameSettings.vue';
import MenuGameLoad from './components/MenuGameLoad.vue';

import MapTile from './components/MapTile.vue';
import MapWorld from './components/MapWorld.vue';
import MapRegion from './components/MapRegion.vue';
import MapNeighborhood from './components/MapNeighborhood.vue';
import MapLocation from './components/MapLocation.vue';
import MapInterior from './components/MapInterior.vue';

Vue.use(VueRouter);

export default new VueRouter({
	mode: 'history',
	routes: [
		{
			path: '/',
			name: 'menu-game',
			component: MenuGame,
			props: true
		},
		{
			path: '/settings',
			name: 'menu-game-settings',
			component: MenuGameSettings,
			props: true
		},
		{
			path: '/load',
			name: 'menu-game-load',
			component: MenuGameLoad,
			props: true
		},
		{
			path: '/map',
			name: 'world-map',
			component: MapWorld,
			props: true
		},
		{
			path: '/map/:region_id',
			name: 'map-region',
			component: MapRegion,
			props: true
		},
		{
			path: '/map/:region_id/:neighborhood_id',
			name: 'map-neighborhood',
			component: MapNeighborhood,
			props: true
		},
		{
			path: '/map/:region_id/:neighborhood_id/:location_id',
			name: 'map-location',
			component: MapLocation,
			props: true
		},
		{
			path: '/map/:region_id/:neighborhood_id/:location_id/:interior_id',
			name: 'map-interior',
			component: MapInterior,
			props: true
		}
	]
});
