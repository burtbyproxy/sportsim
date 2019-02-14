import Vue from 'vue';
import VueRouter from 'vue-router';

import GameMenu from './components/GameMenu.vue';
import GameMenuSettings from './components/GameMenuSettings.vue';
import GameMenuLoad from './components/GameMenuLoad.vue';

Vue.use(VueRouter);

export default new VueRouter({
	mode: 'history',
	routes: [
		{
			path: '/',
			name: 'game-menu',
			component: GameMenu,
			props: true
		},
		{
			path: '/settings',
			name: 'game-menu-settings',
			component: GameMenuSettings,
			props: true
		},
		{
			path: '/load',
			name: 'game-menu-load',
			component: GameMenuLoad,
			props: true
		}
	]
});
