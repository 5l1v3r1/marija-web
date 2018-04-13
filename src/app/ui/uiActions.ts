import {
    CLOSE_PANE,
    MOVE_PANE_TO_TOP,
    OPEN_PANE,
    SET_PANE_CONFIG
} from './uiConstants';

export function openPane(pane) {
    return {
        type: OPEN_PANE,
        pane: pane
    };
}

export function closePane(pane) {
    return {
        type: CLOSE_PANE,
        pane: pane
    };
}

export function setPaneConfig(key, config) {
    return {
        type: SET_PANE_CONFIG,
        key: key,
        config: config
    };
}

export function movePaneToTop(key) {
    return {
        type: MOVE_PANE_TO_TOP,
        key: key
    };
}