import { utils, datasources, fields } from './';
import { compose, createStore, combineReducers, applyMiddleware } from 'redux';
import { syncHistoryWithStore, routerReducer } from 'react-router-redux';
import {EXPORT_DATA, IMPORT_DATA} from "../modules/import/constants";
import exportJson from "../helpers/exportJson";
import contextMenuReducer from '../modules/contextMenu/contextMenuReducer';
import statsReducer from "../modules/stats/statsReducer";
import graphReducer from "./graphReducer";

const appReducer = combineReducers({
    graph: graphReducer,
    utils,
    datasources,
    fields,
    contextMenu: contextMenuReducer,
    routing: routerReducer,
    stats: statsReducer
});

export default function root(state, action) {
    if (action.type === IMPORT_DATA) {
        state = action.payload;
    } else if (action.type === EXPORT_DATA) {
        exportJson(state);
    }

    return appReducer(state, action);
}