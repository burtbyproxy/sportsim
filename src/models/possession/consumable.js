import Possession from '../possession.js';

export default class Consumable extends Possession {

	constructor(name, effects) {
		super(name);
		this.effects = effects || [];
	}

}

class ConsumableEffect {
	
	constructor(type) {
		
	}

}
