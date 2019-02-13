class Entity extends LiveRecord {

	constructor(id, name) {
		super("entities");
		this.id = id;
		this.name = name || "unknown";
	}

}