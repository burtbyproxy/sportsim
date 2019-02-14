import Vue from 'vue';

import App from './App.vue';

import router from './router.js';
import axios from 'axios';

var vm = new Vue({
	router,
	components: { App }
}).$mount('#app');

//new Vue({
//	el: '#app',
//	components: { App },
//	template: '<App/>'
//});
