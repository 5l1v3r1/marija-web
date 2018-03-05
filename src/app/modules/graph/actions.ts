import { NODES_DESELECT, NODES_DELETE, NODES_HIGHLIGHT, NODE_UPDATE, NODES_SELECT, SELECTION_CLEAR, SET_SELECTING_MODE, NODES_TOOLTIP } from './index';
import { GRAPH_WORKER_OUTPUT, FIELD_NODES_HIGHLIGHT } from './constants';
import {Node} from "../../interfaces/node";
import {Link} from "../../interfaces/link";
import {Item} from "../../interfaces/item";
import {Search} from "../../interfaces/search";
import {Field} from "../../interfaces/field";

export function deselectNodes(opts) {
    return {
        type: NODES_DESELECT,
        receivedAt: Date.now(),
        nodes: opts
    };
}

export function deleteNodes(opts) {
    return {
        type: NODES_DELETE,
        receivedAt: Date.now(),
        nodes: opts
    };
}

export function highlightNodes(opts) {
    return {
        type: NODES_HIGHLIGHT,
        receivedAt: Date.now(),
        nodes: opts
    };
}

export function fieldNodesHighlight(fieldPath: string) {
    return {
        type: FIELD_NODES_HIGHLIGHT,
        payload: {
            fieldPath: fieldPath
        }
    }
}

export function showTooltip(nodes) {
    return {
        type: NODES_TOOLTIP,
        receivedAt: Date.now(),
        nodes: nodes
    };
}

export function clearSelection(opts) {
    return {
        type: SELECTION_CLEAR,
        receivedAt: Date.now(),
        ...opts,
    };
}

export function nodeUpdate(node_id, params) {
    return {
        type: NODE_UPDATE,
        receivedAt: Date.now(),
        node_id: node_id,
        params: params
    };
}

export function nodesSelect(opts) {
    return {
        type: NODES_SELECT,
        receivedAt: Date.now(),
        nodes: opts
    };
}

export function setSelectingMode(enable) {
    return {
        type: SET_SELECTING_MODE,
        selectingMode: enable
    };
}

export function graphWorkerOutput(nodes: Node[], links: Link[], items: Item[], fields: Field[]) {
    return {
        type: GRAPH_WORKER_OUTPUT,
        nodes: nodes,
        links: links,
        items: items,
        fields: fields
    }
}