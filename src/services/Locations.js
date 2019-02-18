import axios from 'axios'


/* 

	private functions 

*/

function _getMapList() {
	return axios.get('/api/locations')
	.then(response => {
		return response.data;
	});
}

function _getNeighborhoodList(map_id) {
	return axios.get('/api/locations/'+map_id)
	.then(response => {
		return response.data;
	});
}

function _getLocationList(map_id, neighborhood_id) {
	return axios.get('/api/locations/'+map_id+'/'+neighborhood_id)
	.then(response => {
		return response.data;
	});
}

function _getLocation(map_id, neighborhood_id, location_id) {
	return axios.get('/api/locations/'+map_id+'/'+neighborhood_id+'/'+location_id)
	.then(response => {
		return response.data;
	});
}


/* 

	public functions 

*/

export default {

	get(map_id, neighborhood_id, location_id) {

		map_id = map_id || null;
		if(!map_id) {
			return _getMapList();
		}

		neighborhood_id = neighborhood_id || null;
		if(!neighborhood_id) {
			return _getNeighborhoodList(map_id);
		}

		location_id = location_id || null;
		if(!location_id) {
			return _getLocationList(map_id, neighborhood_id);
		}

		else {
			return _getLocation(map_id, neighborhood_id, location_id);
		}

	}

}

