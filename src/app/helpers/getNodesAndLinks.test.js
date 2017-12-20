import getNodesAndLinks from './getNodesAndLinks';
import { uniqueId } from 'lodash';

const generateItem = (fields) => {
    if (typeof fields === 'undefined') {
        fields = {
            text: 'test' + uniqueId()
        };
    }

    return {
        highlight: null,
        id: uniqueId(),
        fields: fields,
        query: undefined
    };
};

const generateField = (field) => {
    return {
        icon: 'a',
        path: field
    };
};

const generateQuery = (items) => {
    return {
        color: '#aaaaaa',
        q: 'my search',
        total: 100,
        items: items
    };
};

test('should output nodes', () => {
    const previousNodes = [];
    const previousLinks = [];
    const normalizations = [];

    const items = [
        generateItem(),
        generateItem(),
        generateItem()
    ];

    const fields = [
        generateField('text')
    ];

    const query = generateQuery(items);
    const { nodes } = getNodesAndLinks(previousNodes, previousLinks, items, fields, query, normalizations);

    expect(nodes.length).toBe(3);
});

test('should output 1 node for every field in an item', () => {
    const previousNodes = [];
    const previousLinks = [];
    const normalizations = [];

    const items = [
        generateItem({
            text: 'hello',
            user: 'thomas'
        }),
    ];

    const fields = [
        generateField('text'),
        generateField('user')
    ];

    const query = generateQuery(items);
    const { nodes } = getNodesAndLinks(previousNodes, previousLinks, items, fields, query, normalizations);

    expect(nodes.length).toBe(2);
});

test('should output links between related nodes', () => {
    const previousNodes = [];
    const previousLinks = [];
    const normalizations = [];

    const items = [
        generateItem({
            text: 'lalala',
            user: 'thomas'
        }),
    ];

    const fields = [
        generateField('text'),
        generateField('user')
    ];

    const query = generateQuery(items);
    const { nodes, links } = getNodesAndLinks(previousNodes, previousLinks, items, fields, query, normalizations);

    expect(links).toBeDefined();
    expect(links.length).toBe(1);
});

// test if a link exists between a source and a target
const expectLink = (links, source, target) => {
    const link = links.find(link => link.source === source && link.target === target);
    expect(link).toBeDefined();
};

test('when nodes have exactly the same fields they should not be duplicated', () => {
    const previousNodes = [];
    const previousLinks = [];
    const normalizations = [];

    const items = [
        generateItem({text: 'same'}),
        generateItem({text: 'same'})
    ];

    const fields = [
        generateField('text'),
    ];

    const query = generateQuery(items);
    const { nodes } = getNodesAndLinks(previousNodes, previousLinks, items, fields, query, normalizations);

    expect(nodes.length).toBe(1);
});

test('should do via stuff', () => {
    const previousNodes = [];
    const previousLinks = [];
    const normalizations = [];

    const items = [
        generateItem({
            'src-ip': 1,
            'dst-net': null,
            'src-ip_dst-net_port': '1_2_80'
        }),
        generateItem({
            'src-ip': null,
            'dst-net': 2,
            'src-ip_dst-net_port': '1_2_80'
        })
    ];

    const fields = [
        generateField('src-ip'),
        generateField('dst-net'),
        generateField('src-ip_dst-net_port')
    ];

    const query = generateQuery(items);
    const { nodes, links } = getNodesAndLinks(previousNodes, previousLinks, items, fields, query, normalizations);

    expect(links).toBeDefined();
    expect(links.length).toBe(2);

    console.log(links);

    expectLink(links, 1, '1_2_80');
    expectLink(links, 2, '1_2_80');
});

test('should do via stuff 2', () => {
    const previousNodes = [];
    const previousLinks = [];
    const normalizations = [];

    const items = [
        generateItem({
            'src-ip': 1,
            'dst-net': null,
            'source_dest_port': '1_2_80'
        }),
        generateItem({
            'src-ip': null,
            'dst-net': 2,
            'source_dest_port': '1_2_80'
        })
    ];

    const fields = [
        generateField('src-ip'),
        generateField('dst-net'),
        generateField('source_dest_port')
    ];

    const query = generateQuery(items);
    const { nodes, links } = getNodesAndLinks(previousNodes, previousLinks, items, fields, query, normalizations);

    expect(links).toBeDefined();
    expect(links.length).toBe(2);

    console.log(nodes);
    console.log(links);

    expectLink(links, 1, '1_2_80');
    expectLink(links, 2, '1_2_80');
});