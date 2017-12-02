import { slice, concat, without, reduce, remove, assign, find, forEach, union, filter, uniqBy } from 'lodash';
import {fieldLocator, normalize} from "./index";

export default function getNodesAndLinks(previousNodes, previousLinks, items, fields, query, normalizations) {
    let nodes = concat(previousNodes, []);
    let links = concat(previousLinks, []);

    let nodeCache = {};
    for (let node of nodes) {
        nodeCache[node.id] = node;
    }

    let linkCache = {};
    for (let link of links) {
        linkCache[link.source + link.target] = link;
    }

    query = query.q;

    forEach(items, (d, i) => {
        forEach(fields, (source) => {
            let sourceValue = fieldLocator(d.fields, source.path);
            if (sourceValue === null) {
                return;
            }

            if (!Array.isArray(sourceValue)) {
                sourceValue = [sourceValue];
            }

            for (let sv of sourceValue) {
                switch (typeof sv) {
                    case "boolean":
                        sv = (sv?"true":"false");
                }

                const normalizedSourceValue = normalize(normalizations, sv);
                if (normalizedSourceValue === "") {
                    continue;
                }

                let n = nodeCache[normalizedSourceValue];
                if (n) {
                    if (n.items.indexOf(d.id) === -1){
                        n.items.push(d.id);
                    }

                    if (n.fields.indexOf(source.path) === -1){
                        n.fields.push(source.path);
                    }

                    n.queries.push(query);
                } else {
                    let n = {
                        id: normalizedSourceValue,
                        queries: [query],
                        items: [d.id],
                        name: normalizedSourceValue,
                        description: '',
                        icon: source.icon,
                        fields: [source.path],
                    };

                    nodeCache[n.id] = n;
                    nodes.push(n);
                }

                forEach(fields, (target) => {
                    let targetValue = fieldLocator(d.fields, target.path);
                    if (targetValue === null) {
                        return;
                    }

                    if (!Array.isArray(targetValue)) {
                        targetValue = [targetValue];
                    }

                    // todo(nl5887): issue with normalizing is if we want to use it as name as well.
                    // for example we don't want to have the first name only as name.
                    //
                    // we need to keep track of the fields the value is in as well.
                    for (let tv of targetValue) {
                        switch (typeof tv) {
                            case "boolean":
                                tv = (tv?"true":"false");
                        }

                        const normalizedTargetValue = normalize(normalizations, tv);
                        if (normalizedTargetValue === "") {
                            continue;
                        }

                        let n = nodeCache[normalizedTargetValue];
                        if (n) {
                            if (n.items.indexOf(d.id) === -1){
                                n.items.push(d.id);
                            }

                            if (n.fields.indexOf(target.path) === -1){
                                n.fields.push(target.path);
                            }

                            // should add counter instead of thousands same query being added
                            n.queries.push(query);
                        } else {
                            let n = {
                                id: normalizedTargetValue,
                                queries: [query],
                                items: [d.id],
                                name: normalizedTargetValue,
                                description: '',
                                icon: [target.icon],
                                fields: [target.path],
                            };

                            nodeCache[n.id] = n;
                            nodes.push(n);
                        }

                        if (sourceValue.length > 1) {
                            // we don't want all individual arrays to be linked together
                            // those individual arrays being linked are (I assume) irrelevant
                            // otherwise this needs to be a configuration option
                            continue;
                        }

                        if (linkCache[normalizedSourceValue + normalizedTargetValue]) {
                            // link already exists
                            continue;
                        }

                        const link = {
                            source: normalizedSourceValue,
                            target: normalizedTargetValue,
                            color: '#ccc'
                        };

                        links.push(link);
                        linkCache[link.source + link.target] = link;
                    }
                });
            }
        });

        d.query = query.q;
    });

    return {
        nodes,
        links
    };
}