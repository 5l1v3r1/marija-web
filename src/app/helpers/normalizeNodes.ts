import {Node} from "../interfaces/node";
import {Normalization} from "../interfaces/normalization";

export default function normalizeNodes(
    nodes: Node[],
    normalizations: Normalization[]
): Node[] {
    if (normalizations.length === 0) {
        return nodes;
    }

    nodes = nodes.concat([]);
    normalizations = normalizations.concat([]);

    const regexes = normalizations.map(normalization => new RegExp(normalization.regex, 'i'));
    const parents: Node[] = nodes.filter(node => node.isNormalizationParent);
    let children: Node[] = nodes.filter(node => !node.isNormalizationParent);

    children = children.map(node => {
        const updates: any = {};

        normalizations.forEach((normalization, nIndex) => {
            if (regexes[nIndex].test(node.id)) {
                const parent: Node = parents.find(node =>
                    node.isNormalizationParent
                    && node.normalizationId === normalization.id
                );

                if (typeof parent === 'undefined') {
                    const newParent: Node = Object.assign({}, node, {
                        id: normalization.replaceWith,
                        name: normalization.replaceWith,
                        abbreviated: normalization.replaceWith,
                        normalizationId: normalization.id,
                        isNormalizationParent: true
                    });

                    parents.push(newParent);
                }

                updates.normalizationId = normalization.id;
            }
        });

        if (updates) {
            return Object.assign({}, node, updates);
        }

        return node;
    });

    return children.concat(parents);
}