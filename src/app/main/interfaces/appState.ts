/**
 * The complete redux store for the entire application.
 */
import { ContextMenuState } from '../../contextMenu/contextMenuReducer';
import { DatasourcesState } from '../../datasources/datasourcesReducer';
import { FieldsState } from '../../fields/fieldsReducer';
import { GraphState } from '../../graph/graphReducer';
import { StatsState } from '../../stats/statsReducer';
import { TableState } from '../../table/tableReducer';
import { UiState } from '../../ui/uiReducer';
import {ConnectionState} from "../../connection/interfaces/connectionState";

export interface AppState {
    graph: GraphState;
    contextMenu: ContextMenuState;
    fields: FieldsState;
    datasources: DatasourcesState;
    stats: StatsState;
    table: TableState;
    ui: UiState;
    connection: ConnectionState;
}