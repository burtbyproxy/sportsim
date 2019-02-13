class Collection {

	constructor(list) {
		this._list = list || [];
		this._index = {};
		this._remap();
	}

	function get (handle) {
		return typeof handle !== 'undefined' ? this._list[this._index[handle]] || null : null;
	}

	function add (obj) {
		var handle = obj.handle || null;
		if(!handle) return false;
		this._list.push(obj);
		this._remap();
		return this.get(handle);
	}

	function remove (handle) {
		var idx = this._index[handle];
		if(!idx && idx !== 0) return false;
		this._list.splice(idx, 1);
		this._remap();
	}

	function size () {
		return this._index.length;
	}

	function clear () {
		this._list = [];
		this._remap();
	}
	
	function _remap () {
		var that = this;
		var idx = 0;
		that.index = {};
		that._list.forEach(function(item) {
			var handle = item.handle || item;
			that._index[handle] = idx;
			idx++;
		});
	}

	function getList() {
		return this._list;
	}

	function getIndex() {
		return this._index;
	}

}
