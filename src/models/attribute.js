export default class Attribute {

	constructor(value, min, max) {
		this.value = value || 0;
		this.min = min || min === 0 ? min : false;
		this.max = max || max === 0 ? max : false;
		this.modifiers = [];
		this.multipliers = [];
	}

}

class AttributeModifier {

	constructor(type, power, duration) {
		if(this.VALID_TYPES.indexOf(type) === -1)
			return console.error('Tried to construct an AttributeModifier with an invalid type.', type);
		this.type = type;
		this.power = power && power > 0 ? power : 0;
		this.created_time = _syco.now();
		this.duration = duration || duration === 0 ? duration : false;
	}

}

AttributeModifier.VALID_TYPES = [
	"bonus",
	"penalty",
	"multiplier"
];

