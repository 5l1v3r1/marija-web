import { AppState } from '../main/interfaces/appState';
import {
	CREATE_NEW_CONNECTOR,
	DELETE_CONNECTOR,
	DELETE_FROM_CONNECTOR,
	MOVE_RULE_BETWEEN_CONNECTORS,
	MOVE_RULE_TO_NEW_CONNECTOR,
	RECEIVE_FIELD_MAPPING,
	SET_MATCHING_STRATEGY,
	UPDATE_CONNECTOR,
	UPDATE_RULE
} from './fieldsConstants';
import { Field } from './interfaces/field';
import { dispatchAndRebuildGraph, rebuildGraph } from '../graph/graphActions';
import { MatchingStrategy } from '../graph/interfaces/connector';
import { getConnectorName } from './helpers/getConnectorName';
import { FieldMapping } from './interfaces/fieldMapping';

export function moveRuleBetweenConnectors(ruleId: string, fromConnectorName: string, toConnectorName: string) {
    return dispatchAndRebuildGraph({
		type: MOVE_RULE_BETWEEN_CONNECTORS,
		payload: {
			ruleId,
			fromConnectorName,
			toConnectorName
		}
	});
}

export function moveRuleToNewConnector(ruleId: string, fromConnectorName: string) {
    return dispatchAndRebuildGraph({
		type: MOVE_RULE_TO_NEW_CONNECTOR,
		payload: {
			ruleId,
			fromConnectorName
		}
	});
}

export function createNewConnector(fields: Field[]) {
    return (dispatch, getState) => {
    	const state: AppState = getState();
    	const name = getConnectorName(state.fields.connectors);

        dispatch({
			type: CREATE_NEW_CONNECTOR,
			payload: {
				fields,
				name
			}
		});

        dispatch(rebuildGraph());
    };
}

export function setMatchingStrategy(connectorName: string, matchingStrategy: MatchingStrategy) {
	return dispatchAndRebuildGraph({
		type: SET_MATCHING_STRATEGY,
		payload: {
			connectorName,
			matchingStrategy
		}
	});
}

export function deleteFromConnector(connectorName: string, ruleId: string) {
	return dispatchAndRebuildGraph({
		type: DELETE_FROM_CONNECTOR,
		payload: {
			connectorName,
			ruleId
		}
	});
}

export function deleteConnector(connectorName: string) {
	return dispatchAndRebuildGraph({
		type: DELETE_CONNECTOR,
		payload: {
			connectorName
		}
	});
}

export interface ConnectorProps {
	color?: string;
	icon?: string;
}

export function updateConnector(connectorName: string, props: ConnectorProps) {
	return dispatchAndRebuildGraph({
		type: UPDATE_CONNECTOR,
		payload: {
			connectorName,
			props
		}
	})
}

export interface RuleProps {
	similarity?: number;
	distance?: number
}

export function updateRule(ruleId: string, props: RuleProps) {
	return dispatchAndRebuildGraph({
		type: UPDATE_RULE,
		payload: {
			ruleId,
			props
		}
	})
}

export function receiveFieldMapping(fieldMapping: FieldMapping) {
	return {
		type: RECEIVE_FIELD_MAPPING,
		payload: {
			fieldMapping
		}
	};
}