import LiveRecord from './liverecord.js';

export default class Possession extends LiveRecord {
	
	constructor(name) {
		super("possessions");
		this.name = name || "unknown";
	}

}