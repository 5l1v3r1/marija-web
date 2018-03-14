import { DATASOURCE_ACTIVATED, DATASOURCE_DEACTIVATED } from './index'
import {getFields, clearFields} from "../fields/actions";
import {Datasource} from "../../interfaces/datasource";
import {deleteSearch} from "../search/actions";

export function datasourceActivated(datasource: Datasource) {
    console.log('activate');

    return {
        type: DATASOURCE_ACTIVATED,
        payload: {
            datasource: datasource
        }
    };
}

export function activateDatasource(datasource: Datasource) {
    console.log('activateDatasource');

    return (dispatch, getState) => {
        dispatch(datasourceActivated(datasource));

        // Get the updated datasources
        const datasources = getState()
            .datasources
            .datasources
            .filter(datasource => datasource.active);

        // Update the fields based on the new datasources
        dispatch(getFields(datasources));
    };
}

export function datasourceDeactivated(datasource) {
    return {
        type: DATASOURCE_DEACTIVATED,
        payload: {
            datasource: datasource
        }
    };
}

export function deActivateDatasource(datasource: Datasource) {
    return (dispatch, getState) => {
        // If live datasources are deactived, their associated queries also
        // need to be deleted
        if (datasource.type === 'live') {
            const search = getState()
                .entries
                .searches
                .find(search => search.liveDatasource === datasource.id);

            dispatch(deleteSearch(search))
        }

        dispatch(datasourceDeactivated(datasource));

        // Delete the datasource's fields
        dispatch(clearFields(datasource.id));
    };
}