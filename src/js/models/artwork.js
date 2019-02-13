class Artwork extends LiveRecord {
	
	constructor(name) {
		super("artwork");
		this.name = name || "unknown";
	}

}