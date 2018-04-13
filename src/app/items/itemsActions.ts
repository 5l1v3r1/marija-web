import { chunk, uniqueId } from 'lodash';

import { webSocketSend } from '../connection/connectionActions';
import { AppState } from '../main/interfaces/appState';
import { Item } from './interfaces/item';
import { ITEMS_RECEIVE, ITEMS_REQUEST } from './itemsConstants';

export function requestItems(items: Item[]) {
    return (dispatch, getState) => {
        const ids: string[] = items.map(item => item.id);
        const chunks = chunk(ids, 10);

        chunks.forEach(batch => {
            const payload = {
                'request-id': uniqueId(),
                items: batch
            };

            dispatch(webSocketSend({
                type: ITEMS_REQUEST,
                payload: payload
            }));
        });

        dispatch({
            type: ITEMS_REQUEST,
            items: items
        });
    }
}

export function receiveItems(items: Item[], prevItemId: string) {
    return (dispatch, getState) => {
        const state: AppState = getState();

        dispatch({
            type: ITEMS_RECEIVE,
            payload: {
                items: items,
                prevItemId: prevItemId,
                sortColumn: state.table.sortColumn,
                sortType: state.table.sortType
            }
        });
    };
}