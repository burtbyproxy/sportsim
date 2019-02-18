import Vue from 'vue';

/*
import Vuex from 'vuex';
Vue.use(Vuex);
const store = new Vuex.Store({
	state: {
		count: 0
	},
	mutations: {
		increment(state) {
			state.count++;
		}
	}
});
*/

import router from './router.js';
import axios from 'axios';

import Game from './Game.vue';
import TheSidebar from './components/TheSidebar.vue'

var vm = new Vue({
	router,
	components: {
		Game,
		'the-sidebar': TheSidebar
	}
}).$mount('#game');
