import { saveAs } from 'file-saver';
import * as React from 'react';
import { connect, Dispatch } from 'react-redux';
import {
	MatchingStrategy,
	Connector
} from '../../../graph/interfaces/connector';
import { AppState } from '../../../main/interfaces/appState';
import * as styles from './connectorComponent.scss';
import { FormEvent } from 'react';
import {
	deleteConnector,
	moveRuleBetweenConnectors,
	moveRuleToNewConnector, setMatchingStrategy, updateConnector
} from '../../fieldsActions';
import RuleComponent from '../ruleComponent/ruleComponent';
import { createGetNodesByConnector } from '../../../graph/graphSelectors';
import { Node } from '../../../graph/interfaces/node';
import ColorPicker from '../../../ui/components/colorPicker/colorPicker';
import IconSelector from '../iconSelector/iconSelector';
import MagicWand from '../../../graph/components/magicWand/magicWand';
import Icon from '../../../ui/components/icon';
import { FormattedMessage } from 'react-intl';

interface State {
	isHoveringOnDropArea: boolean;
	iconSelectorOpen: boolean;
}

interface Props {
	dispatch: Dispatch<any>;
	connector: Connector | null;
	nodes: Node[];
}

class ConnectorComponent extends React.Component<Props, State> {
	state: State = {
		isHoveringOnDropArea: false,
		iconSelectorOpen: false
	};

	getDragData(event: DragEvent) {
		const text: string = event.dataTransfer.getData('text');

		try {
			return JSON.parse(text);
		} catch (e) {
			return null;
		}
	}

	onDragOver(event: DragEvent) {
		event.preventDefault();
	}

	onDragEnter(event: DragEvent) {
		this.setState({
			isHoveringOnDropArea: true
		});
	}

	onDragLeave() {
		this.setState({
			isHoveringOnDropArea: false
		});
	}

	onDrop(event: DragEvent) {
		const { connector, dispatch } = this.props;

		const data = this.getDragData(event);

		if (!data) {
			return;
		}

		if (connector === null) {
			dispatch(moveRuleToNewConnector(data.ruleId, data.fromConnectorName));
		} else if (connector.name !== data.fromConnectorName) {
			dispatch(moveRuleBetweenConnectors(data.ruleId, data.fromConnectorName, connector.name));
		}

		this.setState({
			isHoveringOnDropArea: false
		});
	}

	onStrategyChange(event: FormEvent<HTMLInputElement>) {
		const { connector, dispatch } = this.props;

		dispatch(setMatchingStrategy(connector.name, event.currentTarget.value as MatchingStrategy));
	}


	toggleIconSelector() {
		const { iconSelectorOpen } = this.state;

		this.setState({
			iconSelectorOpen: !iconSelectorOpen
		});
	}

	onColorChange(color: string) {
		const { dispatch, connector } = this.props;

		dispatch(updateConnector(connector.name, {
			color
		}));

		this.setState({
			iconSelectorOpen: false
		});
	}

	onIconChange(icon: string) {
		const { dispatch, connector } = this.props;

		dispatch(updateConnector(connector.name, {
			icon
		}));

		this.setState({
			iconSelectorOpen: false
		});
	}

	deleteConnector() {
		const { dispatch, connector } = this.props;

		dispatch(deleteConnector(connector.name));
	}

	render() {
		const { connector, nodes } = this.props;
		const { isHoveringOnDropArea, iconSelectorOpen } = this.state;

		return (
			<div className={styles.connector}>
				{connector !== null && (
					<div className={styles.icon}
						 onClick={this.toggleIconSelector.bind(this)}
						 style={{backgroundColor: connector.color}}>
						{connector.icon}
					</div>
				)}

				{connector !== null && (
					<MagicWand nodes={nodes} cssClass={styles.magicWand}/>
				)}

				<div className={styles.main}>
					{connector && connector.rules.length > 1 && (
						<form className={styles.strategy}>
							<label>
								<input type="radio" name="strategy" checked={connector.strategy === 'OR'} value="OR" onChange={this.onStrategyChange.bind(this)}/>
								<span><FormattedMessage id="match_at_least_one" /></span>
							</label>
							<label>
								<input type="radio" name="strategy" checked={connector.strategy === 'AND'} value="AND" onChange={this.onStrategyChange.bind(this)}/>
								<span><FormattedMessage id="match_all" /></span>
							</label>
							<Icon name={styles.delete + ' ion-ios-close'} onClick={this.deleteConnector.bind(this)}/>
						</form>
					)}

					{connector !== null && (
						<ul className={styles.fields}>
							{connector.rules.map(rule => (
								<RuleComponent rule={rule} connector={connector} key={rule.id} />
							))}
						</ul>
					)}

					<div className={styles.dropZone + (isHoveringOnDropArea ? ' ' + styles.hovering : '')}
						 onDragOver={this.onDragOver.bind(this)}
						 onDragEnter={this.onDragEnter.bind(this)}
						 onDragLeave={this.onDragLeave.bind(this)}
						 onDrop={this.onDrop.bind(this)}>
						{connector === null
							? <FormattedMessage id="drop_field_new_connector" />
							: <FormattedMessage id="drop_field_existing_connector" />}
					</div>
				</div>

				{iconSelectorOpen && (
					<div className={styles.iconSelector}>
						<ColorPicker
							selected={connector.color}
							onChange={this.onColorChange.bind(this)}
						/>
						<IconSelector onSelectIcon={this.onIconChange.bind(this)}/>
					</div>
				)}
			</div>
		);
	}
}


function select() {
	const getNodesByConnector = createGetNodesByConnector();

	return (state: AppState, ownProps) => ({
		...ownProps,
		nodes: ownProps.connector ? getNodesByConnector(state, ownProps.connector.name) : []
	});
}

export default connect(select)(ConnectorComponent);
