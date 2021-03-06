interface Input {
	[key: string]: string | string[]
}

export interface ValueSet {
	[key: string]: string;
}

export function getValueSets(values: Input, relevantFields: string[]): ValueSet[] {
	const keys = Object.keys(values).filter(key =>
		relevantFields.indexOf(key) !== -1
	);

	if (keys.length === 0) {
		return [];
	}

	// Usually it's just 1 key, this is much faster
	if (keys.length === 1) {
		return getValueSetsFast(values, keys[0]);
	}

	const output = [];

	const recurse = (prevValues, index) => {
		const key = keys[index];
		let value = values[key];

		if (!Array.isArray(value)) {
			value = [value];
		}

		if (value.length === 0) {
			if (typeof keys[index + 1] !== 'undefined') {
				recurse(prevValues, index + 1);
			} else {
				output.push(prevValues);
			}

			return;
		}

		value.forEach(val => {
			const newValues = {
				...prevValues
			};

			if (val !== null && val !== '') {
				newValues[key] = val + '';
			}

			if (typeof keys[index + 1] !== 'undefined') {
				recurse(newValues, index + 1);
			} else {
				output.push(newValues);
			}
		});
	};

	recurse({}, 0);

	return output;
}

function getValueSetsFast(values: Input, field: string): ValueSet[] {
	const output = [];
	let value = values[field];

	if (!Array.isArray(value)) {
		value = [value];
	}

	value.forEach(val => {
		if (val !== null && val !== '') {
			output.push({
				[field]: val
			})
		}
	});

	return output;
}