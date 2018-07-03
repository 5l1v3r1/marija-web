import { fieldAdd, getFields } from '../fields/fieldsActions';
import Url from '../main/helpers/url';
import { activateLiveDatasource, addLiveDatasourceSearch } from '../search/searchActions';
import {
	DATASOURCE_ACTIVATED,
	DATASOURCE_DEACTIVATED,
	INITIAL_STATE_RECEIVE,
	UPDATE_DATASOURCE
} from './datasourcesConstants';
import { Datasource } from './interfaces/datasource';
import { DATASOURCE_ICON_UPDATED } from '../graph/graphConstants';

export function datasourceActivated(datasourceId: string) {
    return {
        type: DATASOURCE_ACTIVATED,
        payload: {
            datasourceId: datasourceId
        }
    };
}

export function datasourceDeactivated(datasourceId: string) {
    return {
        type: DATASOURCE_DEACTIVATED,
        payload: {
            datasourceId: datasourceId
        }
    };
}

export function receiveInitialState(initialState) {
    return (dispatch, getState) => {
        dispatch({
            type: INITIAL_STATE_RECEIVE,
            receivedAt: Date.now(),
            initial_state: initialState
        });

        const normal: Datasource[] = initialState.datasources.filter((datasource: Datasource) =>
            datasource.type !== 'live'
        );

        dispatch(getFields(normal));

        const live: Datasource[] = initialState.datasources.filter((datasource: Datasource) =>
            datasource.type === 'live'
        );

        live.forEach(datasource => {
            dispatch(addLiveDatasourceSearch(datasource));

            if (Url.isLiveDatasourceActive(datasource.id)) {
                dispatch(activateLiveDatasource(datasource.id));
            }
        });
    };
}

export function updateDatasource(datasourceId: string, props: any) {
    return {
        type: UPDATE_DATASOURCE,
        payload: {
            datasourceId,
            props
        }
    };
}

export function updateDatasourceIcon(datasourceId: string, icon: string) {
	return (dispatch, getState) => {
		dispatch(updateDatasource(datasourceId, {
			icon
		}));

		dispatch({
			type: DATASOURCE_ICON_UPDATED,
			payload: {
				datasourceId,
				icon
			}
		});
	}
}