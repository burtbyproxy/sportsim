import LiveRecord from './liverecord.js';

export default class Artwork extends LiveRecord {
	
	constructor(name) {
		super("artwork");
		this.name = name || "unknown";
	}

}