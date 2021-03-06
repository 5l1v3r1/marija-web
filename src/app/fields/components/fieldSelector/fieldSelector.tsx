import * as React from 'react';
import { AppState } from '../../../main/interfaces/appState';
import {
	createGetFieldsByDatasourceAndType
} from '../../fieldsSelectors';
import VirtualizedSelect from 'react-virtualized-select';
import { Field } from '../../interfaces/field';
import { connect } from 'react-redux';

interface Props {
	datasourceId: string;
	types?: string[];
	fields: Field[];
	selected: Field;
	onChange: (field: Field) => void
}

class FieldSelector extends React.Component<Props> {
	onChange(option) {
		const { onChange, fields } = this.props;

		if (option === null) {
			onChange(null);
		} else {
			onChange(fields.find(field => field.path === option.value));
		}
	}

	static fieldToOption(field: Field) {
		return {
			label: field.path,
			value: field.path
		};
	}

	static filterOption(option, query: string) {
		return option.value.includes(query);
	}

	render() {
		const { fields, selected } = this.props;

		const options = fields.map(field => FieldSelector.fieldToOption(field));
		let selectedOption = null;

		if (selected) {
			selectedOption = {
				label: selected,
				value: selected
			}
		}

		const disabled = fields.length === 0;
		const placeholder = disabled ? 'No fields available for this type.' : 'Select a field';

		return (
			<VirtualizedSelect
				filterOption={FieldSelector.filterOption}
				disabled={disabled}
				placeholder={placeholder}
				value={selectedOption}
				options={options}
				onChange={this.onChange.bind(this)}
			/>
		);
	}
}

const select = () => {
	const getFieldsByDatasourceAndType = createGetFieldsByDatasourceAndType();

	return (state: AppState, ownProps) => ({
		...ownProps,
		fields: getFieldsByDatasourceAndType(state, ownProps.datasourceId, ownProps.types)
	});
};

export default connect(select)(FieldSelector);