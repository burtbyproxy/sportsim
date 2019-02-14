import Entity from '../entity.js';

export default class Human extends Entity {
	
	constructor(id, name, gender, birthday, height, weight) {
		
		super(id, name);
		this.gender = gender;
		this.birthday = birthday;
		this.height = height;
		this.weight = weight;

		this.appearance = new HumanAppearance();
		this.attributes = new HumanAttributes();
		this.personality = new HumanPersonality();
		this.possessions = new HumanPossessions();
		this.relations = new HumanRelations();

	}

}

class HumanAppearance {

	constructor() {
	
		this.hair = "";
		this.brow = "";
		this.ears = ["", ""];
		this.eyes = ["", ""];
		this.nose = "";
		this.mouth = "";
		this.jaw = "";

		this.beard = "";
		this.tone = "";

		this.marks = [];

	}

}

class HumanAttributes {

	constructor() {
	
		// physical
		this.agility = new Attribute();
		this.strength = new Attribute();
		this.endurance = new Attribute();
		this.speed = new Attribute();
		
		// mental
		this.aptitude = new Attribute();
		this.awareness = new Attribute();
		this.willpower = new Attribute();
		this.wisdom = new Attribute();

		// spiritual
		this.charisma = new Attribute();
		this.machismo = new Attribute();
		this.karma = new Attribute();
		this.luck = new Attribute();
		
	}

}

class HumanPersonality extends Collection {
	
	constructor() {
		this.preferences = [];
		this.traits = [];
		this.talents = [];
	}

}

class HumanPossessions extends Collection {
	
	constructor() {

	}

}

class HumanRelations extends Collection {
	
	constructor() {
		this.entities = [];
		this.locations = [];

	}

}

