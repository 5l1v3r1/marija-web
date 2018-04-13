import { Node } from '../interfaces/node';

export function selectNodes(nodesToSelect: Node[], allNodes: Node[]): Node[] {
    const select: Node[] = nodesToSelect.filter(node => !node.selected);
    const nodes: Node[] = allNodes.concat([]);

    select.forEach(node => {
        const index = nodes.findIndex(searchNode =>
            searchNode.id === node.id
            && searchNode.display
            && (searchNode.normalizationId === null || searchNode.isNormalizationParent)
        );

        if (index === -1) {
            throw new Error('Node ' + node.id + ' not found');
        }

        if (!nodes[index].selected) {
            nodes[index] = Object.assign({}, nodes[index], {
                selected: true
            });
        }
    });

    return nodes;
}