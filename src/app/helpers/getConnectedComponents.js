import { each } from 'lodash';

function getNeighbourMap(links) {
    const neighbours = {};

    links.forEach(link => {
        if (neighbours[link.source]) {
            neighbours[link.source].push(link.target);
        } else {
            neighbours[link.source] = [link.target];
        }

        if (neighbours[link.target]) {
            neighbours[link.target].push(link.source);
        } else {
            neighbours[link.target] = [link.source];
        }
    });

    return neighbours;
}

function getNodeMap(nodes) {
    const map = {};

    nodes.forEach(node => map[node.id] = node);

    return map;
}

export default function getConnectedComponents(nodes, links) {
    const visited = [];
    const groups = {};
    const neighbours = getNeighbourMap(links);
    const nodeMap = getNodeMap(nodes);

    const addToGroup = (groupId, nodeId) => {
        const node = nodeMap[nodeId];

        if (groups[groupId]) {
            groups[groupId].push(node);
        } else {
            groups[groupId] = [node];
        }
    };

    const depthFirstSearch = (nodeId, groupId) => {
        each(neighbours[nodeId], loopNodeId => {
            if (visited.indexOf(loopNodeId) !== -1) {
                return;
            }

            visited.push(loopNodeId);
            addToGroup(groupId, loopNodeId);
            depthFirstSearch(loopNodeId, groupId);
        });
    };

    let groupId = 1;

    nodes.forEach(node => {
        if (visited.indexOf(node.id) !== -1) {
            return;
        }

        visited.push(node.id);
        addToGroup(groupId, node.id);
        depthFirstSearch(node.id, groupId);

        groupId ++;
    });

    return Object.values(groups);
}