import * as React from 'react';
import { AppState } from '../../../main/interfaces/appState';
import { connect } from 'react-redux';
import { ValueInfo } from '../../helpers/getValueInfo';
import {
	searchValueInfo,
} from '../../graphSelectors';
import ValueTableRow from '../valueTableRow/valueTableRow';
import * as styles from './valuetable.scss';
import { FormattedMessage } from 'react-intl';

interface Props {
	valueInfoList: ValueInfo[];
	field: string;
	search: string;
}

class ValueTable extends React.Component<Props> {
	render() {
		const { valueInfoList } = this.props;

		return (
			<table className={styles.table}>
				<thead>
				<tr>
					<td className={styles.columnTitle}><FormattedMessage id="value"/></td>
					<td className={styles.columnTitle + ' ' + styles.occurences}><FormattedMessage id="occurences"/></td>
					<td className={styles.columnTitle + ' ' + styles.fields}><FormattedMessage id="fields"/></td>
					<td className={styles.columnTitle + ' ' + styles.nodes}><FormattedMessage id="nodes"/></td>
				</tr>
				</thead>
				<tbody>
				{valueInfoList.map(valueInfo =>
					<ValueTableRow key={valueInfo.value} valueInfo={valueInfo}/>
				)}
				</tbody>
			</table>
		)
	}
}

const select = (state: AppState, ownProps) => ({
	valueInfoList: searchValueInfo(state, ownProps.field, ownProps.search),
});

export default connect(select)(ValueTable);