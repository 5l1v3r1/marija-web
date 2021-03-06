import { Node } from './node';

export interface Link {
    hash: number;
    source: number;
    target: number;
    color: string;
    total: number; // total number of links between source and target
    current: number; // current link number between source and target
    label?: string;

    /**
     * Per search a user can choose the amount of nodes that he wants to be
     * displayed. When the amount of available nodes exceeds this chosen amount,
     * this can cause the link to be hidden.
     */
    display: boolean;

    /**
     * When the link is created because of a 'via configuration' (meaning it
     * has a via), we also need to store the id of the via configuration. This
     * is useful if we later delete the via config, because we can then rebuild
     * the original links (without labels).
     */
    viaId: string | null;

    replacedNode: Node;
    sourceX?: number;
    sourceY?: number;
    targetX?: number;
    targetY?: number;
    thickness?: number;
    batch?: number;
    directional?: boolean;
    highlighted: boolean;
}