import { OPEN_PANE, CLOSE_PANE, CANCEL_REQUEST, Socket} from '../utils/index';
import {MOVE_PANE_TO_TOP, SET_PANE_CONFIG} from "../utils/constants";
import {each} from 'lodash';

function setPaneTo(panes, pane, state) {
    return panes.map((item) => {
        if (item.name == pane) {
            return Object.assign({}, item, {state: state});
        }
        return item;
    });
}

const defaultPane = {
    open: false,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    fullHeight: false,
    fullWidth: false,
    alignRight: false,
    alignBottom: false,
    minWidth: 200,
    minHeight: 100,
    zIndex: 2
};

export const defaultUtilsState = {
    panes: {
        configuration: Object.assign({}, defaultPane, {
            open: true,
            width: 300,
            fullHeight: true,
            minWidth: 250
        }),
        nodes: Object.assign({}, defaultPane, {
            width: 350,
            height: 300,
            alignRight: true,
            minWidth: 300
        }),
        table: Object.assign({}, defaultPane, {
            width: 500,
            height: 400,
            y: 300,
            alignRight: true,
            alignBottom: true,
            minWidth: 300
        }),
        histogram: Object.assign({}, defaultPane, {
            width: 300,
            height: 300,
            alignBottom: true,
            fullWidth: true
        }),
        filter: Object.assign({}, defaultPane, {
            width: 300,
            height: 300,
        })
    }
};

export default function utils(state = defaultUtilsState, action) {

    switch (action.type) {
        case OPEN_PANE: {
            const pane = Object.assign({}, state.panes[action.pane]);
            pane.open = true;

            return Object.assign({}, state, {
                panes: {
                    ...state.panes,
                    [action.pane]: pane
                }
            });
        }
        case CLOSE_PANE: {
            const pane = Object.assign({}, state.panes[action.pane]);
            pane.open = false;

            return Object.assign({}, state, {
                panes: {
                    ...state.panes,
                    [action.pane]: pane
                }
            });
        }
        case CANCEL_REQUEST:
            Socket.ws.postMessage(
                {
                    'request-id': action.requestId
                },
                CANCEL_REQUEST
            );
            return state;
        case SET_PANE_CONFIG: {
            const pane = Object.assign({}, state.panes[action.key], action.config);

            return Object.assign({}, state, {
                panes: {
                    ...state.panes,
                    [action.key]: pane
                }
            });
        }
        case MOVE_PANE_TO_TOP: {
            let highestZIndex = 0;

            each(state.panes, pane => {
                highestZIndex = Math.max(highestZIndex, pane.zIndex);
            });

            const pane = Object.assign({}, state.panes[action.key]);
            pane.zIndex = highestZIndex + 1;

            return Object.assign({}, state, {
                panes: {
                    ...state.panes,
                    [action.key]: pane
                }
            });
        }
        default:
            return state;
    }
}
