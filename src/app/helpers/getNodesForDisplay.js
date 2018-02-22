export default function getNodesForDisplay(nodes, searches) {
    const searchesCounter = {};
    const nodesForDisplay = [];
    const max = {};

    searches.forEach(search => max[search.q] = search.displayNodes);

    nodes.forEach(node => {
        let display = true;

        node.queries.forEach(query => {
            if (searchesCounter[query]) {
                searchesCounter[query] ++;
            } else {
                searchesCounter[query] = 1;
            }

            if (searchesCounter[query] > max[query]) {
                display = false;
            }
        });

        nodesForDisplay.push(Object.assign({}, node, {
            display: display
        }));
    });

    return nodesForDisplay;
}