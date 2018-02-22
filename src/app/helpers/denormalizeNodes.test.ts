import {Node} from "../interfaces/node";
import {Normalization} from "../interfaces/normalization";
import {uniqueId} from 'lodash';
import normalizeNodes from "./normalizeNodes";
import denormalizeNodes from "./denormalizeNodes";

const generateNode = (id): Node => {
    return {
        id: id,
        name: id,
        normalizationId: null
    } as Node
};

const generateNormalization = (regex: string, replaceWith: string): Normalization => {
    return {
        id: uniqueId(),
        regex: regex,
        replaceWith: replaceWith
    };
};

test('should restore to how it was', () => {
    const nodes = [
        generateNode('hello'),
        generateNode('bello')
    ];

    const normalization = generateNormalization('^[bh]ello$', 'hello');
    const normalized = normalizeNodes(nodes, [normalization]);
    const restored = denormalizeNodes(normalized, normalization);

    expect(nodes).toEqual(restored);
});